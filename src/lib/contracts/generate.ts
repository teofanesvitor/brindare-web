import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { itensDoPacote, moeda, nomeContrato, numeroPorExtenso } from "@/lib/contracts/format";
import type { ContractInput } from "@/lib/contracts/schema";
import { fillDocxTemplate } from "@/lib/contracts/docx";

const STORAGE_BUCKET = "contracts";
const TEMPLATE_PATH = join(process.cwd(), "src", "templates", "contract-template.docx");
function localDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12));
}
function formatDate(value: Date): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(value);
}
function shiftDays(value: Date, days: number): Date {
  const result = new Date(value); result.setUTCDate(result.getUTCDate() + days); return result;
}
function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 11) return value;
  return digits.replace(/(\d{2})(\d)(\d{4})(\d{4})/, "($1) $2 $3-$4");
}
function formatTime(value: string): string {
  return value.trim().replace(":", "h");
}
function quantityInWords(value: number): string {
  const units = ["zero", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove"];
  const teens = ["dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
  const tens = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
  const hundreds = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];
  const underThousand = (n: number): string => {
    if (n < 10) return units[n];
    if (n < 20) return teens[n - 10];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ` e ${units[n % 10]}` : "");
    if (n === 100) return "cem";
    return hundreds[Math.floor(n / 100)] + (n % 100 ? ` e ${underThousand(n % 100)}` : "");
  };
  if (!Number.isInteger(value) || value < 0 || value > 999) throw new Error("Quantidade de taças inválida.");
  return underThousand(value);
}
function contractDate(): string {
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Maceio", day: "2-digit", month: "long", year: "numeric",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.day} de ${String(value.month).toLocaleUpperCase("pt-BR")} de ${value.year}`;
}

async function convertDocxToPdf(document: Buffer): Promise<Buffer> {
  const host = process.env.VERCEL_URL;
  const secret = process.env.CONVERTER_SECRET;
  if (!host || !secret) {
    throw new Error("Conversor PDF não configurado. Defina CONVERTER_SECRET no ambiente da Vercel e execute a aplicação em uma implantação Vercel.");
  }
  const response = await fetch(`https://${host}/api/docx_to_pdf`, {
    method: "POST",
    headers: { "content-type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "x-converter-secret": secret },
    body: new Uint8Array(document),
    cache: "no-store",
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Falha na conversão DOCX para PDF (HTTP ${response.status}). ${detail.slice(0, 400)}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

export async function generateContract(input: ContractInput, supabase: SupabaseClient, userId: string) {
  const eventDate = localDate(input.eventDate), fileName = nomeContrato(input.client, input.eventDate);
  const toastDeadline = formatDate(shiftDays(eventDate, -3));
  const toastText = input.toastTime?.trim()
    ? formatTime(input.toastTime)
    : `O horário para realização do brinde será definido até o dia ${toastDeadline}, devendo ser formalizado pelas partes, até essa data, por meio de termo aditivo ao presente contrato; e,`;
  const cpfDigits = input.cpf.replace(/\D/g, "");
  const cpfFormatted = cpfDigits.length === 11
    ? cpfDigits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")
    : input.cpf;
  const values: Record<string, string> = {
    CLIENTE: input.client, RG: input.rg || "Não informado", CPF: cpfDigits,
    CPF_FORMATADO: cpfFormatted,
    ENDERECO: [input.address, input.neighborhood, input.city].filter(Boolean).join(", "),
    TELEFONE: input.phone ? formatPhone(input.phone) : "Não informado", EMAIL: input.email || "Não informado",
    PACOTE: input.packageName, ITENS_PACOTE: itensDoPacote(input), DATA: formatDate(eventDate),
    HORARIO: formatTime(input.eventTime), HORARIO_BRINDE: toastText,
    LOCAL: input.venue, VALOR: moeda(input.total), VALOR_EXTENSO: numeroPorExtenso(input.total),
    ENTRADA: moeda(input.deposit), ENTRADA_EXTENSO: numeroPorExtenso(input.deposit),
    RESTANTE: moeda(input.balance), RESTANTE_EXTENSO: numeroPorExtenso(input.balance),
    VENCIMENTO: formatDate(shiftDays(eventDate, -1)),
    PRAZO_BRINDE: toastDeadline,
    TACAS: String(input.tacas), TACAS_EXTENSO: quantityInWords(input.tacas),
    DATA_CONTRATO: contractDate(),
  };
  const template = await readFile(TEMPLATE_PATH), document = fillDocxTemplate(template, values);
  const safeClient = input.client.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9_-]+/g, "_").slice(0, 70);
  const storagePath = `${userId}/${Date.now()}-${randomUUID()}-${safeClient}.docx`;
  const pdfBuffer = await convertDocxToPdf(document);
  const pdfStoragePath = storagePath.replace(/\.docx$/i, ".pdf");
  const { error: uploadError } = await supabase.storage.from(STORAGE_BUCKET).upload(storagePath, document, {
    contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", upsert: false,
  });
  if (uploadError) throw new Error(`Falha ao armazenar DOCX no Supabase: ${uploadError.message}`);
  const { error: pdfUploadError } = await supabase.storage.from(STORAGE_BUCKET).upload(pdfStoragePath, pdfBuffer, {
    contentType: "application/pdf", upsert: false,
  });
  if (pdfUploadError) {
    await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
    throw new Error(`DOCX salvo, mas falhou a conversão/armazenamento do PDF: ${pdfUploadError.message}`);
  }
  const [{ data: signed, error: signedError }, { data: pdfSigned, error: pdfSignedError }] = await Promise.all([
    supabase.storage.from(STORAGE_BUCKET).createSignedUrl(storagePath, 3600, { download: `${fileName}.docx` }),
    supabase.storage.from(STORAGE_BUCKET).createSignedUrl(pdfStoragePath, 3600, { download: `${fileName}.pdf` }),
  ]);
  if (signedError || !signed?.signedUrl || pdfSignedError || !pdfSigned?.signedUrl) {
    await supabase.storage.from(STORAGE_BUCKET).remove([storagePath, pdfStoragePath]);
    throw new Error(`Arquivos salvos, mas não foi possível gerar os links temporários: ${signedError?.message || pdfSignedError?.message || "URL indisponível"}`);
  }
  return { name: fileName, storagePath, pdfStoragePath, documentUrl: signed.signedUrl, pdfUrl: pdfSigned.signedUrl };
}
