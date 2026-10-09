import { posix } from "node:path";
import { Unzip, UnzipInflate, UnzipPassThrough } from "fflate";
import { XMLParser } from "fast-xml-parser";
import { PDFParse } from "pdf-parse";

export const MAX_AI_FILE_SIZE = 10 * 1024 * 1024;
const MAX_EXTRACTED_TEXT = 60_000;
const MAX_EXPANDED_ARCHIVE_SIZE = 20 * 1024 * 1024;
const MAX_ARCHIVE_ENTRIES = 200;
const ZIP_SIGNATURE = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
const MIME_TYPES = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".csv": "text/csv",
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".txt": "text/plain",
};
const XML = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseTagValue: false,
  trimValues: false,
});

const fail = (message, statusCode = 400) => Object.assign(new Error(message), {
  statusCode,
  expose: true,
});

const asArray = (value) => (value === undefined ? [] : Array.isArray(value) ? value : [value]);

const decodeText = (buffer) => {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    throw fail("The text file is not valid UTF-8.");
  }
};

const parseXml = (xml) => {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw fail("The document contains unsupported XML declarations.");
  return XML.parse(xml);
};

const isPng = (buffer) => {
  if (!buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return false;
  let offset = 8;
  let hasHeader = false;
  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const end = offset + 12 + length;
    if (end > buffer.length) return false;
    if (offset === 8 && (type !== "IHDR" || length !== 13)) return false;
    if (type === "IHDR") hasHeader = true;
    if (type === "IEND") return hasHeader && length === 0 && end === buffer.length;
    offset = end;
  }
  return false;
};

const isWebp = (buffer) => {
  if (
    buffer.length < 20 ||
    buffer.subarray(0, 4).toString("ascii") !== "RIFF" ||
    buffer.subarray(8, 12).toString("ascii") !== "WEBP" ||
    buffer.readUInt32LE(4) !== buffer.length - 8
  ) return false;
  let offset = 12;
  let hasImageChunk = false;
  while (offset + 8 <= buffer.length) {
    const type = buffer.toString("ascii", offset, offset + 4);
    const length = buffer.readUInt32LE(offset + 4);
    const end = offset + 8 + length + (length % 2);
    if (end > buffer.length) return false;
    if (["VP8 ", "VP8L", "VP8X"].includes(type)) hasImageChunk = true;
    offset = end;
  }
  return hasImageChunk && offset === buffer.length;
};

const parseCsvRows = (text) => {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        cell += character;
      }
    } else if (character === '"' && cell.length === 0) {
      quoted = true;
    } else if (character === ",") {
      row.push(cell);
      cell = "";
    } else if (character === "\n" || character === "\r") {
      row.push(cell);
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      cell = "";
      if (character === "\r" && text[index + 1] === "\n") index += 1;
    } else {
      cell += character;
    }
  }
  if (quoted) throw fail("The CSV file contains an unclosed quoted field.");
  row.push(cell);
  if (row.some((value) => value.length > 0)) rows.push(row);
  return rows;
};

const renderTable = (rows, name = "CSV") => {
  const columns = Math.max(0, ...rows.map((row) => row.length));
  const headers = rows[0] || [];
  const records = rows.length > 0 ? rows.length - 1 : 0;
  const lines = rows.slice(0, 300).map((row, index) =>
    `${index === 0 ? "Başlık" : `Satır ${index}`}: ${row.slice(0, 100).join(" | ")}`
  );
  const truncated = rows.length > 300 || rows.some((row) => row.length > 100);
  return [
    `Tablo: ${name}`,
    `Sütun sayısı: ${columns}; kayıt sayısı (başlık satırı hariç): ${records}`,
    `Sütunlar: ${headers.map((value, index) => value || `Sütun ${index + 1}`).join(" | ")}`,
    ...lines,
    ...(truncated ? ["Önizleme güvenlik sınırı nedeniyle kısaltıldı."] : []),
  ].join("\n");
};

const selectedArchiveEntry = (name, extension) => {
  if (extension === ".docx") return name === "word/document.xml";
  return name === "xl/workbook.xml" ||
    name === "xl/_rels/workbook.xml.rels" ||
    name === "xl/sharedStrings.xml" ||
    /^xl\/worksheets\/sheet\d+\.xml$/.test(name);
};

const readArchiveEntries = (buffer, extension) => new Promise((resolve, reject) => {
  const entries = new Map();
  let entryCount = 0;
  let expandedSize = 0;
  let failure;
  const unzip = new Unzip((file) => {
    entryCount += 1;
    if (entryCount > MAX_ARCHIVE_ENTRIES) {
      failure = fail("The document archive contains too many entries.");
      return;
    }
    if (!selectedArchiveEntry(file.name, extension)) return;
    if (
      Number.isFinite(file.originalSize) &&
      expandedSize + file.originalSize > MAX_EXPANDED_ARCHIVE_SIZE
    ) {
      failure = fail("The document expands beyond the safe processing limit.");
      return;
    }
    if (file.compression === 0) unzip.register(UnzipPassThrough);
    else if (file.compression === 8) unzip.register(UnzipInflate);
    else {
      failure = fail("The document uses an unsupported archive compression method.");
      return;
    }
    const chunks = [];
    let size = 0;
    file.ondata = (error, chunk, final) => {
      if (error) {
        failure = fail("The document archive could not be read.");
        return;
      }
      size += chunk.length;
      expandedSize += chunk.length;
      if (expandedSize > MAX_EXPANDED_ARCHIVE_SIZE) {
        failure = fail("The document expands beyond the safe processing limit.");
        return;
      }
      chunks.push(Buffer.from(chunk));
      if (final) entries.set(file.name, Buffer.concat(chunks, size));
    };
    try {
      file.start();
    } catch {
      failure = fail("The document archive could not be read.");
    }
  });
  try {
    unzip.register(UnzipInflate);
    unzip.register(UnzipPassThrough);
    unzip.push(new Uint8Array(buffer), true);
  } catch {
    failure ||= fail("The document archive is invalid or corrupted.");
  }
  setImmediate(() => {
    if (failure) reject(failure);
    else resolve(entries);
  });
});

const getSharedStrings = (xml) => {
  let parsed;
  try {
    parsed = parseXml(xml);
  } catch (error) {
    if (error.expose) throw error;
    throw fail("The XLSX shared strings are invalid.");
  }
  return asArray(parsed.sst?.si).map((item) =>
    asArray(item.t).map((text) => typeof text === "object" ? text["#text"] || "" : text)
      .join("") ||
    asArray(item.r).flatMap((run) => asArray(run.t))
      .map((text) => typeof text === "object" ? text["#text"] || "" : text)
      .join("")
  );
};

const xmlText = (value) => {
  if (value === null || value === undefined) return "";
  if (typeof value !== "object") return String(value);
  if (Object.hasOwn(value, "#text")) return String(value["#text"] ?? "");
  return Object.entries(value)
    .filter(([key]) => !key.startsWith("@_"))
    .map(([, nested]) => asArray(nested).map(xmlText).join(""))
    .join("");
};

const findXmlChild = (value, name) =>
  value && typeof value === "object"
    ? Object.entries(value).find(([key]) => key.split(":").at(-1) === name)?.[1]
    : undefined;

const findXmlChildren = (value, name, matches = []) => {
  if (Array.isArray(value)) {
    value.forEach((item) => findXmlChildren(item, name, matches));
  } else if (value && typeof value === "object") {
    for (const [key, nested] of Object.entries(value)) {
      if (key.split(":").at(-1) === name) matches.push(...asArray(nested));
      else findXmlChildren(nested, name, matches);
    }
  }
  return matches;
};

const parseXlsx = async (buffer) => {
  const entries = await readArchiveEntries(buffer, ".xlsx");
  const workbookXml = entries.get("xl/workbook.xml")?.toString("utf8");
  const relationsXml = entries.get("xl/_rels/workbook.xml.rels")?.toString("utf8");
  if (!workbookXml || !relationsXml) throw fail("The XLSX workbook structure is incomplete.");
  let workbook;
  let relations;
  try {
    workbook = parseXml(workbookXml).workbook;
    relations = parseXml(relationsXml).Relationships;
  } catch {
    throw fail("The XLSX workbook structure is invalid.");
  }
  const relationTargets = new Map(asArray(relations?.Relationship).map((relation) => {
    const target = relation["@_Target"];
    const path = target?.startsWith("/")
      ? posix.normalize(target.slice(1))
      : posix.normalize(posix.join("xl", target || ""));
    return [relation["@_Id"], path.startsWith("xl/") ? path : ""];
  }));
  const sharedStringsXml = entries.get("xl/sharedStrings.xml")?.toString("utf8");
  const sharedStrings = sharedStringsXml ? getSharedStrings(sharedStringsXml) : [];
  const sheets = asArray(workbook?.sheets?.sheet);
  if (!sheets.length) throw fail("The XLSX workbook contains no readable sheets.");
  const output = [];
  for (const sheet of sheets.slice(0, 50)) {
    const path = relationTargets.get(sheet["@_r:id"]);
    const sheetXml = path ? entries.get(path)?.toString("utf8") : null;
    if (!sheetXml) throw fail("An XLSX worksheet could not be read.");
    let parsed;
    try {
      parsed = parseXml(sheetXml);
    } catch {
      throw fail("An XLSX worksheet is invalid.");
    }
    const rows = asArray(parsed.worksheet?.sheetData?.row).map((row) => {
      const cells = [];
      for (const cell of asArray(row.c)) {
        const reference = cell["@_r"] || "";
        const letters = reference.match(/^[A-Z]+/i)?.[0] || "";
        const columnIndex = [...letters.toUpperCase()].reduce(
          (value, letter) => value * 26 + letter.charCodeAt(0) - 64,
          0
        ) - 1;
        if (columnIndex < 0 || columnIndex >= 100) continue;
        const raw = xmlText(cell.v ?? cell.is);
        cells[columnIndex] = cell["@_t"] === "s"
          ? sharedStrings[Number(raw)] || ""
          : raw;
      }
      return cells;
    });
    output.push(renderTable(rows, sheet["@_name"] || `Sayfa ${output.length + 1}`));
  }
  return {
    type: "spreadsheet",
    content: output.join("\n\n").slice(0, MAX_EXTRACTED_TEXT),
    truncated: output.join("\n\n").length > MAX_EXTRACTED_TEXT || sheets.length > 50,
  };
};

const parseDocx = async (buffer) => {
  const entries = await readArchiveEntries(buffer, ".docx");
  const documentXml = entries.get("word/document.xml")?.toString("utf8");
  if (!documentXml) throw fail("The Word document does not contain readable document text.");
  try {
    const parsed = parseXml(documentXml);
    const document = findXmlChild(parsed, "document");
    const body = findXmlChild(document, "body");
    const text = findXmlChildren(body, "p").map(xmlText).filter((paragraph) => paragraph.trim()).join("\n");
    if (!text.trim()) throw fail("No text could be extracted from the Word document.");
    return { type: "document", content: text.slice(0, MAX_EXTRACTED_TEXT), truncated: text.length > MAX_EXTRACTED_TEXT };
  } catch (error) {
    if (error.expose) throw error;
    throw fail("The Word document is invalid or corrupted.");
  }
};

const validateAttachment = ({ originalName, buffer }) => {
  if (typeof originalName !== "string") throw fail("A file name is required.");
  const name = originalName.split(/[\\/]/).pop().trim();
  if (!name || name.length > 255 || /[\u0000-\u001f\u007f]/.test(name)) {
    throw fail("The file name is invalid.");
  }
  const extension = name.slice(name.lastIndexOf(".")).toLowerCase();
  if (!Object.hasOwn(MIME_TYPES, extension)) {
    throw fail("Unsupported file type. Use PNG, JPG, WebP, XLSX, CSV, PDF, DOCX, or TXT.");
  }
  if (!Buffer.isBuffer(buffer) || buffer.length < 1 || buffer.length > MAX_AI_FILE_SIZE) {
    throw fail("Files must be between 1 byte and 10 MB.", buffer?.length > MAX_AI_FILE_SIZE ? 413 : 400);
  }
  const signatureMatches = extension === ".png"
    ? isPng(buffer)
    : [".jpg", ".jpeg"].includes(extension)
      ? buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8 &&
        buffer[2] === 0xff && buffer.at(-2) === 0xff && buffer.at(-1) === 0xd9
      : extension === ".webp"
        ? isWebp(buffer)
        : extension === ".pdf"
          ? buffer.subarray(0, 5).toString() === "%PDF-"
          : [".xlsx", ".docx"].includes(extension)
            ? buffer.subarray(0, 4).equals(ZIP_SIGNATURE)
            : !buffer.includes(0);
  if (!signatureMatches) throw fail("File contents do not match the selected file type.");
  return { name, extension, mimeType: MIME_TYPES[extension] };
};

export const prepareAiAttachment = async (file) => {
  const { name, extension, mimeType } = validateAttachment(file);
  if (mimeType.startsWith("image/")) {
    return {
      name,
      mimeType,
      imageUrl: `data:${mimeType};base64,${file.buffer.toString("base64")}`,
    };
  }
  let parsed;
  if (extension === ".txt") {
    const content = decodeText(file.buffer);
    parsed = { type: "document", content: content.slice(0, MAX_EXTRACTED_TEXT), truncated: content.length > MAX_EXTRACTED_TEXT };
  } else if (extension === ".csv") {
    const rows = parseCsvRows(decodeText(file.buffer));
    const content = renderTable(rows);
    parsed = { type: "spreadsheet", content: content.slice(0, MAX_EXTRACTED_TEXT), truncated: content.length > MAX_EXTRACTED_TEXT };
  } else if (extension === ".xlsx") {
    parsed = await parseXlsx(file.buffer);
  } else if (extension === ".docx") {
    parsed = await parseDocx(file.buffer);
  } else {
    const parser = new PDFParse({ data: file.buffer });
    let timeoutId;
    try {
      const result = await Promise.race([
        parser.getText(),
        new Promise((_, reject) => {
          timeoutId = setTimeout(() => reject(fail("PDF processing timed out.", 422)), 15_000);
        }),
      ]);
      const content = result.text?.trim() || "";
      if (!content) throw fail("No text could be extracted from the PDF. Image-only PDFs need an OCR-capable provider.");
      parsed = {
        type: "document",
        content: content.slice(0, MAX_EXTRACTED_TEXT),
        pages: result.total,
        truncated: content.length > MAX_EXTRACTED_TEXT,
      };
    } catch (error) {
      if (error.expose) throw error;
      throw fail("The PDF is encrypted, invalid, or could not be read.");
    } finally {
      clearTimeout(timeoutId);
      await parser.destroy().catch(() => {});
    }
  }
  const truncationNote = parsed.truncated ? "\n[İçerik güvenli işlem sınırında kısaltıldı.]" : "";
  return {
    name,
    mimeType,
    extractedType: parsed.type,
    content: parsed.content + truncationNote,
    ...(parsed.pages ? { pages: parsed.pages } : {}),
  };
};
