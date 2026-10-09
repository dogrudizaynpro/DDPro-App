import assert from "node:assert/strict";
import { test } from "node:test";
import { strToU8, zipSync } from "fflate";
import { prepareAiAttachment } from "../src/services/ai-file.service.js";

const makeArchive = (entries) => Buffer.from(zipSync(
  Object.fromEntries(Object.entries(entries).map(([name, content]) => [name, strToU8(content)]))
));

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
