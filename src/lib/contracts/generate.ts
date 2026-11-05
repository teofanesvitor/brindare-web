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
function contractDate(): string {
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Maceio", day: "2-digit", month: "long", year: "numeric",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.day} de ${String(value.month).toLocaleUpperCase("pt-BR")} de ${value.year}`;
}
export async function generateContract(input: ContractInput, supabase: SupabaseClient, userId: string) {
  const eventDate = localDate(input.eventDate), fileName = nomeContrato(input.client, input.eventDate);
  const values: Record<string, string> = {
    CLIENTE: input.client, RG: input.rg || "Não informado", CPF: input.cpf,
    ENDERECO: [input.address, input.neighborhood, input.city].filter(Boolean).join(", "),
    TELEFONE: input.phone || "Não informado", EMAIL: input.email || "Não informado",
    PACOTE: input.packageName, ITENS_PACOTE: itensDoPacote(input), DATA: formatDate(eventDate),
    HORARIO: input.eventTime || "A definir", HORARIO_BRINDE: input.toastTime || "Não informado",
    LOCAL: input.venue, VALOR: moeda(input.total), VALOR_EXTENSO: numeroPorExtenso(input.total),
    ENTRADA: moeda(input.deposit), ENTRADA_EXTENSO: numeroPorExtenso(input.deposit),
    RESTANTE: moeda(input.balance), RESTANTE_EXTENSO: numeroPorExtenso(input.balance),
    DESLOCAMENTO: moeda(input.travel), VENCIMENTO: formatDate(shiftDays(eventDate, -1)),
    DATA_CONTRATO: contractDate(),
    CLAUSULA_FOGOS: input.fogos > 0 ? "Os fogos indoor serão utilizados exclusivamente pela CONTRATADA ou por profissional por ela autorizado, observadas as condições de segurança do local." : "",
  };
  const template = await readFile(TEMPLATE_PATH), document = fillDocxTemplate(template, values);
  const safeClient = input.client.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9_-]+/g, "_").slice(0, 70);
  const storagePath = `${userId}/${Date.now()}-${randomUUID()}-${safeClient}.docx`;
  const { error: uploadError } = await supabase.storage.from(STORAGE_BUCKET).upload(storagePath, document, {
    contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", upsert: false,
  });
  if (uploadError) throw new Error(`Falha ao armazenar DOCX no Supabase: ${uploadError.message}`);
  const { data: signed, error: signedError } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(storagePath, 3600);
  if (signedError || !signed?.signedUrl) {
    await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
    throw new Error(`DOCX salvo, mas não foi possível gerar o link temporário: ${signedError?.message || "URL indisponível"}`);
  }
  return { name: fileName, storagePath, documentUrl: signed.signedUrl };
}
