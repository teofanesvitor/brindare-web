const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const PDF_MIME = "application/pdf";
const MAX_DOCX_BYTES = 10 * 1024 * 1024;
const CONVERSION_TIMEOUT_MS = 60_000;

export async function convertDocxToPdf(document: Buffer): Promise<Buffer> {
  const endpoint = process.env.WORDCRAFT_CONVERTER_URL?.trim();
  const token = process.env.WORDCRAFT_CONVERTER_TOKEN?.trim();
  if (!endpoint || !token) {
    throw new Error("Conversor WordCraft não configurado. Defina WORDCRAFT_CONVERTER_URL e WORDCRAFT_CONVERTER_TOKEN no ambiente do servidor.");
  }
  if (document.byteLength === 0 || document.byteLength > MAX_DOCX_BYTES) {
    throw new Error("O DOCX excede o limite de 10 MB ou está vazio.");
  }

  let url: URL;
  try {
    url = new URL("/convert", endpoint);
  } catch {
    throw new Error("WORDCRAFT_CONVERTER_URL inválida.");
  }
  if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    throw new Error("O conversor WordCraft deve ser acessado por HTTPS.");
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": DOCX_MIME,
        accept: PDF_MIME,
      },
      body: new Uint8Array(document),
      signal: AbortSignal.timeout(CONVERSION_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (error) {
    const reason = error instanceof Error && error.name === "TimeoutError"
      ? "tempo limite de 60 segundos excedido"
      : "serviço indisponível";
    throw new Error(`Falha na conversão WordCraft: ${reason}.`);
  }

  if (!response.ok) {
    const detail = (await response.text().catch(() => "")).slice(0, 300);
    throw new Error(`WordCraft retornou HTTP ${response.status}.${detail ? ` ${detail}` : ""}`);
  }
  const contentType = response.headers.get("content-type")?.split(";")[0].trim();
  if (contentType !== PDF_MIME) throw new Error("O conversor não retornou um arquivo PDF.");

  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 5 || bytes.subarray(0, 5).toString("ascii") !== "%PDF-") {
    throw new Error("O arquivo retornado pelo WordCraft não possui assinatura PDF válida.");
  }
  return bytes;
}
