import { deflateRawSync, inflateRawSync } from "node:zlib";

const EOCD = 0x06054b50, CENTRAL = 0x02014b50, LOCAL = 0x04034b50;
function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}
type ZipEntry = { name: string; data: Buffer; method: number; time: number; date: number; externalAttrs: number };
function unzipEntries(zip: Buffer): ZipEntry[] {
  let eocd = -1;
  for (let i = zip.length - 22; i >= Math.max(0, zip.length - 65_557); i--) {
    if (zip.readUInt32LE(i) === EOCD) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("O modelo DOCX não é um arquivo ZIP válido.");
  const count = zip.readUInt16LE(eocd + 10);
  let cursor = zip.readUInt32LE(eocd + 16);
  const entries: ZipEntry[] = [];
  for (let index = 0; index < count; index++) {
    if (zip.readUInt32LE(cursor) !== CENTRAL) throw new Error("Estrutura interna do DOCX inválida.");
    const method = zip.readUInt16LE(cursor + 10), time = zip.readUInt16LE(cursor + 12), date = zip.readUInt16LE(cursor + 14);
    const compressedSize = zip.readUInt32LE(cursor + 20), nameLength = zip.readUInt16LE(cursor + 28);
    const extraLength = zip.readUInt16LE(cursor + 30), commentLength = zip.readUInt16LE(cursor + 32);
    const externalAttrs = zip.readUInt32LE(cursor + 38), localOffset = zip.readUInt32LE(cursor + 42);
    const name = zip.subarray(cursor + 46, cursor + 46 + nameLength).toString("utf8");
    const start = localOffset + 30 + zip.readUInt16LE(localOffset + 26) + zip.readUInt16LE(localOffset + 28);
    const compressed = zip.subarray(start, start + compressedSize);
    const data = method === 0 ? Buffer.from(compressed) : method === 8 ? inflateRawSync(compressed) : (() => { throw new Error(`Compressão DOCX não suportada: ${method}`); })();
    entries.push({ name, data, method: method === 0 ? 0 : 8, time, date, externalAttrs });
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}
function zipEntries(entries: ZipEntry[]): Buffer {
  const localParts: Buffer[] = [], centralParts: Buffer[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8"), compressed = entry.method === 0 ? entry.data : deflateRawSync(entry.data);
    const crc = crc32(entry.data), local = Buffer.alloc(30 + name.length);
    local.writeUInt32LE(LOCAL, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0, 6);
    local.writeUInt16LE(entry.method, 8); local.writeUInt16LE(entry.time, 10); local.writeUInt16LE(entry.date, 12);
    local.writeUInt32LE(crc, 14); local.writeUInt32LE(compressed.length, 18); local.writeUInt32LE(entry.data.length, 22);
    local.writeUInt16LE(name.length, 26); local.writeUInt16LE(0, 28); name.copy(local, 30);
    localParts.push(local, compressed);
    const central = Buffer.alloc(46 + name.length);
    central.writeUInt32LE(CENTRAL, 0); central.writeUInt16LE(0x031e, 4); central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8); central.writeUInt16LE(entry.method, 10); central.writeUInt16LE(entry.time, 12); central.writeUInt16LE(entry.date, 14);
    central.writeUInt32LE(crc, 16); central.writeUInt32LE(compressed.length, 20); central.writeUInt32LE(entry.data.length, 24);
    central.writeUInt16LE(name.length, 28); central.writeUInt16LE(0, 30); central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34); central.writeUInt16LE(0, 36); central.writeUInt32LE(entry.externalAttrs, 38); central.writeUInt32LE(offset, 42);
    name.copy(central, 46); centralParts.push(central); offset += local.length + compressed.length;
  }
  const centralDirectory = Buffer.concat(centralParts), localData = Buffer.concat(localParts), end = Buffer.alloc(22);
  end.writeUInt32LE(EOCD, 0); end.writeUInt16LE(0, 4); end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12); end.writeUInt32LE(localData.length, 16); end.writeUInt16LE(0, 20);
  return Buffer.concat([localData, centralDirectory, end]);
}
function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
function removeOptionalParagraph(xml: string, key: string): string {
  const paragraphs = /<w:p\b[^>]*>[\s\S]*?<\/w:p>/g;
  let found = false;
  const updated = xml.replace(paragraphs, (paragraph) => {
    if (found || !paragraph.includes(`{{${key}}}`)) return paragraph;
    found = true;
    return "";
  });
  // Se a chave estiver fora de um parágrafo isolado ou dividida pela estrutura
  // XML do Word, elimina somente o marcador literal; a ausência nunca bloqueia o DOCX.
  return found ? updated : updated.replaceAll(`{{${key}}}`, "");
}

function replaceParagraphContaining(xml: string, key: string, replace: (paragraph: string) => string): string {
  // Limita a busca a um único parágrafo Word; não atravessa </w:p>.
  const paragraphs = /<w:p\b[^>]*>[\s\S]*?<\/w:p>/g;
  let found = false;
  const updated = xml.replace(paragraphs, (paragraph) => {
    if (found || !paragraph.includes(`{{${key}}}`)) return paragraph;
    found = true;
    return replace(paragraph);
  });
  if (!found) throw new Error(`O modelo DOCX não contém a chave {{${key}}} em um único parágrafo.`);
  return updated;
}

export function fillDocxTemplate(template: Buffer, values: Record<string, string>): Buffer {
  const entries = unzipEntries(template), document = entries.find((entry) => entry.name === "word/document.xml");
  if (!document) throw new Error("O modelo DOCX não contém word/document.xml.");
  let xml = document.data.toString("utf8");
  // Fogos e deslocamento são opcionais: o modelo pode não conter essas chaves.
  if (!values.CLAUSULA_FOGOS?.trim()) {
    xml = removeOptionalParagraph(xml, "CLAUSULA_FOGOS");
  }
  if (!values.DESLOCAMENTO?.trim() || values.DESLOCAMENTO === "0,00") {
    xml = removeOptionalParagraph(xml, "DESLOCAMENTO");
  }
  if (values.ITENS_PACOTE !== undefined) {
    const lines = values.ITENS_PACOTE.split(/\r?\n/).filter((line) => line.trim());
    xml = replaceParagraphContaining(xml, "ITENS_PACOTE", (paragraph) =>
      lines.map((line) => paragraph.replace("{{ITENS_PACOTE}}", escapeXml(line))).join(""),
    );
  }
  for (const [key, raw] of Object.entries(values)) {
    if (key === "ITENS_PACOTE") continue;
    const text = escapeXml(raw).replace(/\r?\n/g, "</w:t><w:br/><w:t xml:space=\"preserve\">");
    xml = xml.replaceAll(`{{${key}}}`, text);
  }
  const unresolved = [...xml.matchAll(/\{\{([A-Z0-9_]+)\}\}/g)].map((match) => match[1]);
  if (unresolved.length) throw new Error(`Existem chaves sem valor no modelo: ${[...new Set(unresolved)].join(", ")}.`);
  document.data = Buffer.from(xml, "utf8");
  return zipEntries(entries);
}