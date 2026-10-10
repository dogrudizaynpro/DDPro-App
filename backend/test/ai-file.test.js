import assert from "node:assert/strict";
import { test } from "node:test";
import { strToU8, zipSync } from "fflate";
import { prepareAiAttachment } from "../src/services/ai-file.service.js";

const makeArchive = (entries) => Buffer.from(zipSync(
  Object.fromEntries(Object.entries(entries).map(([name, content]) => [name, strToU8(content)]))
));

const makeXlsxFromRows = (rows, {
  sheetName = "Projects",
  blankRows = 0,
} = {}) => {
  const strings = rows.flat().filter((value) => value !== "");
  let stringIndex = 0;
  const columnName = (value) => {
    let result = "";
    for (let number = value; number > 0; number = Math.floor((number - 1) / 26)) {
      result = String.fromCharCode(65 + ((number - 1) % 26)) + result;
    }
    return result;
  };
  const sheetRows = rows.map((row, rowIndex) =>
    `<row r="${rowIndex + 1}">${row.map((value, columnIndex) => {
      if (value === "") return "";
      const index = stringIndex++;
      return `<c r="${columnName(columnIndex + 1)}${rowIndex + 1}" t="s"><v>${index}</v></c>`;
    }).join("")}</row>`
  ).join("") + Array.from(
    { length: blankRows },
    (_, index) => `<row r="${rows.length + index + 1}"></row>`
  ).join("");
  return makeArchive({
    "xl/workbook.xml": `<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${sheetName}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    "xl/_rels/workbook.xml.rels": '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>',
    "xl/sharedStrings.xml": `<sst>${strings.map((value) => `<si><t>${value}</t></si>`).join("")}</sst>`,
    "xl/worksheets/sheet1.xml": `<worksheet><sheetData>${sheetRows}</sheetData></worksheet>`,
  });
};

const makePdf = () => {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Length 52 >>\nstream\nBT /F1 12 Tf 72 72 Td (PDF extracted text) Tj ET\nendstream",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf);
};

test("TXT and quoted CSV attachments are extracted with structured table details", async () => {
  const text = await prepareAiAttachment({
    originalName: "notes.txt",
    buffer: Buffer.from("Project handover notes"),
  });
  assert.equal(text.extractedType, "document");
  assert.equal(text.content, "Project handover notes");

  const csv = await prepareAiAttachment({
    originalName: "customers.csv",
    buffer: Buffer.from('Name,Company\r\n"Ada, A.",DDPro\r\n'),
  });
  assert.match(csv.content, /Sütunlar: Name \| Company/);
  assert.match(csv.content, /kayıt sayısı .*1/);
  assert.match(csv.content, /Ada, A\. \| DDPro/);
});

test("XLSX workbook sheets, columns, and records are extracted", async () => {
  const buffer = makeArchive({
    "xl/workbook.xml": '<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Products" sheetId="1" r:id="rId1"/></sheets></workbook>',
    "xl/_rels/workbook.xml.rels": '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>',
    "xl/sharedStrings.xml": "<sst><si><t>Product</t></si><si><t>Price</t></si><si><t>Chair</t></si></sst>",
    "xl/worksheets/sheet1.xml": "<worksheet><sheetData><row r=\"1\"><c r=\"A1\" t=\"s\"><v>0</v></c><c r=\"B1\" t=\"s\"><v>1</v></c></row><row r=\"2\"><c r=\"A2\" t=\"s\"><v>2</v></c><c r=\"B2\"><v>125</v></c></row></sheetData></worksheet>",
  });
  const result = await prepareAiAttachment({ originalName: "products.xlsx", buffer });
  assert.equal(result.extractedType, "spreadsheet");
  assert.match(result.content, /Tablo: Products/);
  assert.match(result.content, /Sütun sayısı: 2; kayıt sayısı .*1/);
  assert.match(result.content, /Chair \| 125/);
});

test("XLSX project rows preserve every header and cell through structured extraction", async () => {
  const headers = [
    "Project", "Customer", "Company", "Location", "Project type", "Product",
    "Area m2", "System", "Status", "Start date", "End date", "Notes",
  ];
  const values = [headers];
  for (let row = 1; row <= 18; row += 1) {
    values.push([
      `Project ${row}`, `Customer ${row}`, `Company ${row}`, `City ${row}`,
      "Office", "Facade", `${row * 10}`, "Curtain wall", "Active",
      "2026-01-01", "2026-12-31", `Source note ${row}`,
    ]);
  }
  const sharedStrings = values.flat();
  const columnName = (value) => {
    let result = "";
    for (let number = value; number > 0; number = Math.floor((number - 1) / 26)) {
      result = String.fromCharCode(65 + ((number - 1) % 26)) + result;
    }
    return result;
  };
  const sheetRows = values.map((row, rowIndex) =>
    `<row r="${rowIndex + 1}">${row.map((_, columnIndex) =>
      `<c r="${columnName(columnIndex + 1)}${rowIndex + 1}" t="s"><v>${rowIndex * headers.length + columnIndex}</v></c>`
    ).join("")}</row>`
  ).join("");
  const buffer = makeArchive({
    "xl/workbook.xml": '<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Projects" sheetId="1" r:id="rId1"/></sheets></workbook>',
    "xl/_rels/workbook.xml.rels": '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>',
    "xl/sharedStrings.xml": `<sst>${sharedStrings.map((value) => `<si><t>${value}</t></si>`).join("")}</sst>`,
    "xl/worksheets/sheet1.xml": `<worksheet><sheetData>${sheetRows}</sheetData></worksheet>`,
  });

  const result = await prepareAiAttachment({ originalName: "projects.xlsx", buffer });
  assert.equal(result.truncated, undefined);
  assert.deepEqual(result.tables[0].headers, headers);
  assert.equal(result.tables[0].rows.length, 18);
  assert.equal(result.tables[0].rows[17][11], "Source note 18");
});

test("XLSX ignores styled blank rows and preserves the 18 project records", async () => {
  const rows = [
    ["Proje Adı", "Durum"],
    ...Array.from({ length: 18 }, (_, index) => [`Proje ${index + 1}`, "Aktif"]),
  ];
  const result = await prepareAiAttachment({
    originalName: "DDPro CRM 2026.xlsx",
    buffer: makeXlsxFromRows(rows, { blankRows: 400 }),
  });
  assert.equal(result.tables[0].rows.length, 18);
  assert.equal(result.tables[0].truncated, false);
  assert.equal(result.tables[0].rows[17][0], "Proje 18");
});

test("XLSX row and column limits mark the affected structured table as truncated", async () => {
  const rowLimited = await prepareAiAttachment({
    originalName: "many-rows.xlsx",
    buffer: makeXlsxFromRows([
      ["Proje Adı", "Durum"],
      ...Array.from({ length: 301 }, (_, index) => [`Proje ${index + 1}`, "Aktif"]),
    ]),
  });
  assert.equal(rowLimited.tables[0].rows.length, 300);
  assert.equal(rowLimited.tables[0].truncated, true);

  const wideHeaders = Array.from({ length: 101 }, (_, index) => `Başlık ${index + 1}`);
  const columnLimited = await prepareAiAttachment({
    originalName: "many-columns.xlsx",
    buffer: makeXlsxFromRows([wideHeaders, wideHeaders]),
  });
  assert.equal(columnLimited.tables[0].headers.length, 100);
  assert.equal(columnLimited.tables[0].truncated, true);
});

test("empty and malformed XLSX workbooks are distinguished from unsupported file types", async () => {
  const empty = await prepareAiAttachment({
    originalName: "empty.xlsx",
    buffer: makeXlsxFromRows([]),
  });
  assert.deepEqual(empty.tables[0].headers, []);
  assert.deepEqual(empty.tables[0].rows, []);
  assert.equal(empty.tables[0].truncated, false);

  await assert.rejects(
    prepareAiAttachment({
      originalName: "broken.xlsx",
      buffer: Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from("broken")]),
    }),
    /XLSX|archive|workbook/i
  );
  await assert.rejects(
    prepareAiAttachment({ originalName: "legacy.xls", buffer: Buffer.from("PK\\x03\\x04") }),
    /Unsupported file type/
  );
});

test("DOCX and PDF document text is extracted", async () => {
  const docx = makeArchive({
    "word/document.xml": "<w:document xmlns:w=\"urn:word\"><w:body><w:p><w:r><w:t>Word document text</w:t></w:r></w:p></w:body></w:document>",
  });
  const word = await prepareAiAttachment({ originalName: "notes.docx", buffer: docx });
  assert.match(word.content, /Word document text/);

  const pdf = await prepareAiAttachment({ originalName: "report.pdf", buffer: makePdf() });
  assert.equal(pdf.pages, 1);
  assert.match(pdf.content, /PDF extracted text/);
});

test("image attachments retain an image data URL for vision-capable providers", async () => {
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/pXcAAAAASUVORK5CYII=", "base64");
  const image = await prepareAiAttachment({ originalName: "preview.png", buffer: png });
  assert.equal(image.mimeType, "image/png");
  assert.match(image.imageUrl, /^data:image\/png;base64,/);
});

test("unsupported, mismatched, and oversized files fail without processing", async () => {
  await assert.rejects(
    prepareAiAttachment({ originalName: "script.exe", buffer: Buffer.from("bad") }),
    /Unsupported file type/
  );
  await assert.rejects(
    prepareAiAttachment({ originalName: "wrong.pdf", buffer: Buffer.from("not pdf") }),
    /do not match/
  );
  await assert.rejects(
    prepareAiAttachment({ originalName: "large.txt", buffer: Buffer.alloc(10 * 1024 * 1024 + 1) }),
    /10 MB/
  );
});
