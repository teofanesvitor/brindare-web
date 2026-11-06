import { createServer } from "node:http";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { timingSafeEqual } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const PORT = Number(process.env.PORT || 8080);
const TOKEN = process.env.WORDCRAFT_CONVERTER_TOKEN || "";
const CLI = process.env.WORDCRAFT_CLI_PATH || "wordcraft-cli";
const MAX_BYTES = 10 * 1024 * 1024;
const TIMEOUT_MS = 45_000;

function authorized(value = "") {
  const supplied = value.startsWith("Bearer ") ? value.slice(7) : "";
  if (!TOKEN || supplied.length !== TOKEN.length) return false;
  return timingSafeEqual(Buffer.from(supplied), Buffer.from(TOKEN));
}

async function readBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BYTES) throw Object.assign(new Error("DOCX excede 10 MB."), { status: 413 });
    chunks.push(chunk);
  }
  if (size === 0) throw Object.assign(new Error("Corpo vazio."), { status: 400 });
  return Buffer.concat(chunks);
}

const server = createServer(async (request, response) => {
  response.setHeader("Cache-Control", "no-store");
  if (request.method === "GET" && request.url === "/health") {
    response.writeHead(TOKEN ? 200 : 503, { "content-type": "application/json" });
    response.end(JSON.stringify({ ok: Boolean(TOKEN) }));
    return;
  }
  if (request.method !== "POST" || request.url !== "/convert") {
    response.writeHead(404).end();
    return;
  }
  if (!authorized(request.headers.authorization)) {
    response.writeHead(401).end("Unauthorized");
    return;
  }
  if (!String(request.headers["content-type"] || "").startsWith("application/vnd.openxmlformats-officedocument.wordprocessingml.document")) {
    response.writeHead(415).end("Expected DOCX");
    return;
  }

  let directory;
  try {
    const docx = await readBody(request);
    directory = await mkdtemp(join(tmpdir(), "brindare-wordcraft-"));
    const input = join(directory, "input.docx");
    const output = join(directory, "output.pdf");
    await writeFile(input, docx, { mode: 0o600 });
    await execFileAsync(CLI, ["convert", input, output], {
      timeout: TIMEOUT_MS,
      maxBuffer: 1024 * 1024,
      windowsHide: true,
    });
    const pdf = await readFile(output);
    if (pdf.length < 5 || pdf.subarray(0, 5).toString("ascii") !== "%PDF-") {
      throw new Error("WordCraft não gerou um PDF válido.");
    }
    response.writeHead(200, {
      "content-type": "application/pdf",
      "content-length": pdf.length,
      "content-disposition": 'attachment; filename="contract.pdf"',
    });
    response.end(pdf);
  } catch (error) {
    const status = error.status || (error.killed ? 504 : 422);
    if (!response.headersSent) {
      response.writeHead(status, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: status === 504 ? "Conversion timeout" : "Conversion failed" }));
    }
    // Não registrar conteúdo do contrato nem saída do CLI: contém dados pessoais.
    console.error("WordCraft conversion failed:", error.status ? error.message : error.killed ? "timeout" : "conversion error");
  } finally {
    if (directory) await rm(directory, { recursive: true, force: true }).catch(() => {});
  }
});

server.listen(PORT, "0.0.0.0", () => {
  if (!TOKEN) console.error("WORDCRAFT_CONVERTER_TOKEN is required");
});
