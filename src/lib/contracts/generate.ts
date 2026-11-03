import { googleClients, CONTRACT_TEMPLATE_ID } from "@/lib/google/client";
import { itensDoPacote, moeda, nomeContrato, numeroPorExtenso } from "@/lib/contracts/format";
import type { ContractInput } from "@/lib/contracts/schema";
import { Readable } from "node:stream";

function dateAtLocalMidday(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}
function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Maceio" }).format(date);
}
function addDays(date: Date, days: number): Date {
  const copy = new Date(date); copy.setDate(copy.getDate() + days); return copy;
}
function safeText(value: string | number | undefined): string { return value === undefined ? "" : String(value); }

export async function generateContract(input: ContractInput) {
  const { drive, docs } = googleClients();
  const eventDate = dateAtLocalMidday(input.eventDate);
  const dueDate = addDays(eventDate, -1);
  const limitDate = addDays(eventDate, -3);
  const todayParts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Maceio", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const today = Object.fromEntries(todayParts.map((part) => [part.type, part.value]));
  const todayDate = new Date(Number(today.year), Number(today.month) - 1, Number(today.day));
  const monthNames = ["JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];
  const contractDate = `${String(todayDate.getDate()).padStart(2, "0")} de ${monthNames[todayDate.getMonth()]} de ${todayDate.getFullYear()}`;
  const fileName = nomeContrato(input.client, input.eventDate);

  const template = await drive.files.get({ fileId: CONTRACT_TEMPLATE_ID, fields: "id,name,mimeType,parents" });
  if (template.data.mimeType !== "application/vnd.google-apps.document") throw new Error("O modelo configurado não é um documento Google Docs.");
  const parentId = template.data.parents?.[0];
  const copy = await drive.files.copy({
    fileId: CONTRACT_TEMPLATE_ID,
    requestBody: { name: fileName, ...(parentId ? { parents: [parentId] } : {}) },
    fields: "id,name,webViewLink",
  });
  const documentId = copy.data.id;
  if (!documentId) throw new Error("O Google Drive não retornou o ID da cópia do contrato.");

  const values: Record<string, string> = {
    CLIENTE: input.client, RG: input.rg, CPF: input.cpf, ENDERECO: input.address,
    BAIRRO: input.neighborhood, MUNICIPIO: input.city, TELEFONE: input.phone,
    EMAIL: input.email, PACOTE: input.packageName,
    ITENS_PACOTE: itensDoPacote(input), DATA: formatDate(eventDate),
    HORARIO: input.eventTime || "A definir", LOCAL: input.venue,
    VALOR: moeda(input.total), VALOR_EXTENSO: numeroPorExtenso(input.total),
    ENTRADA: moeda(input.deposit), ENTRADA_EXTENSO: numeroPorExtenso(input.deposit),
    RESTANTE: moeda(input.balance), RESTANTE_EXTENSO: numeroPorExtenso(input.balance),
    VENCIMENTO: formatDate(dueDate), LIMITE: formatDate(limitDate),
    CLAUSULA_FOGOS: input.fogos > 0
      ? "Os fogos indoor serão utilizados exclusivamente pela CONTRATADA ou por profissional por ela autorizado, observadas as condições de segurança do local."
      : "",
    DATA_CONTRATO: contractDate,
  };
  try {
    await docs.documents.batchUpdate({
      documentId,
      requestBody: { requests: Object.entries(values).map(([marker, value]) => ({ replaceAllText: { containsText: { text: `{{${marker}}}`, matchCase: true }, replaceText: safeText(value) } })) },
    });
    const pdfResponse = await drive.files.export({ fileId: documentId, mimeType: "application/pdf" }, { responseType: "arraybuffer" });
    const pdfBuffer = Buffer.from(pdfResponse.data as ArrayBuffer);
    const pdf = await drive.files.create({
      requestBody: { name: `${fileName}.pdf`, mimeType: "application/pdf", ...(parentId ? { parents: [parentId] } : {}) },
      media: { mimeType: "application/pdf", body: Readable.from(pdfBuffer) },
      fields: "id,name,webViewLink,webContentLink",
    });
    return {
      name: fileName,
      documentId,
      documentUrl: copy.data.webViewLink || `https://docs.google.com/document/d/${documentId}/edit`,
      pdfId: pdf.data.id || "",
      pdfUrl: pdf.data.webViewLink || (pdf.data.id ? `https://drive.google.com/file/d/${pdf.data.id}/view` : ""),
    };
  } catch (error) {
    await drive.files.delete({ fileId: documentId }).catch(() => undefined);
    throw error;
  }
}
