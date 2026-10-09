import assert from "node:assert/strict";
import express from "express";
import { after, before, test } from "node:test";
import { strToU8, zipSync } from "fflate";
import { parseAiChatUpload } from "../src/middleware/ai-file-upload.js";
import { prepareAiAttachment } from "../src/services/ai-file.service.js";
import {
  previewAiFileProjects,
  saveAiFileProjects,
} from "../src/controllers/project-import.controller.js";

let server;
let baseUrl;

before(async () => {
  const app = express();
  app.post("/upload", parseAiChatUpload, async (req, res, next) => {
    try {
      const extracted = req.aiFile ? await prepareAiAttachment(req.aiFile) : null;
      return res.json({
        body: req.body,
        file: req.aiFile && {
          name: req.aiFile.originalName,
          mimeType: req.aiFile.mimeType,
          size: req.aiFile.buffer.length,
        },
        extracted: extracted && {
          type: extracted.extractedType,
          tables: extracted.tables,
        },
      });
    } catch (error) {
      return next(error);
    }
  });
  app.use((error, _req, res, _next) => res.status(error.statusCode || 500).json({
    message: error.message,
  }));
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (!server) return;
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
});

test("AI chat multipart uploads are parsed in memory with message and filename", async () => {
  const body = new FormData();
  body.set("message", "Analyze this invoice.");
  body.set("context", JSON.stringify({ activeModule: "finance" }));
  body.set("file", new Blob(["invoice text"], { type: "text/plain" }), "invoice.txt");
  const response = await fetch(`${baseUrl}/upload`, { method: "POST", body });
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(result.body, {
    message: "Analyze this invoice.",
    context: '{"activeModule":"finance"}',
  });
  assert.deepEqual(result.file, {
    name: "invoice.txt",
    mimeType: "text/plain",
    size: 12,
  });
});

test("unexpected upload fields are rejected", async () => {
  const body = new FormData();
  body.set("message", "Analyze this.");
  body.set("unexpected", "data");
  const response = await fetch(`${baseUrl}/upload`, { method: "POST", body });
  assert.equal(response.status, 400);
  assert.match((await response.json()).message, /unexpected or duplicate field/);
});

test("multipart XLSX upload reads all 18 rows and 12 source columns", async () => {
  const headers = [
    "Proje Adı", "Müşteri", "Firma", "Lokasyon", "Proje Türü", "Ürün",
    "Metraj", "Sistem", "Durum", "Başlangıç Tarihi", "Bitiş Tarihi", "Notlar",
  ];
  const rows = Array.from({ length: 18 }, (_, index) => [
    `Test Projesi ${index + 1}`,
    `Müşteri ${index + 1}`,
    `Firma ${index + 1}`,
    "İstanbul",
    "Ofis",
    "Cephe",
    `${(index + 1) * 10}`,
    "Curtain wall",
    "Aktif",
    index === 0 ? "" : "2026-01-01",
    "2026-12-31",
    `Kaynak notu ${index + 1}`,
  ]);
  rows[1][0] = rows[0][0];
  rows[2][9] = "";
  rows[2][10] = "";
  const values = [headers, ...rows];
  const columnName = (column) => {
    let result = "";
    for (let current = column; current > 0; current = Math.floor((current - 1) / 26)) {
      result = String.fromCharCode(65 + ((current - 1) % 26)) + result;
    }
    return result;
  };
  const sheetRows = values.map((row, rowIndex) =>
    `<row r="${rowIndex + 1}">${row.map((value, columnIndex) =>
      value === ""
        ? ""
        : `<c r="${columnName(columnIndex + 1)}${rowIndex + 1}" t="s"><v>${rowIndex * headers.length + columnIndex}</v></c>`
    ).join("")}</row>`
  ).join("");
  const workbook = Buffer.from(zipSync({
    "xl/workbook.xml": strToU8('<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Projeler" sheetId="1" r:id="rId1"/></sheets></workbook>'),
    "xl/_rels/workbook.xml.rels": strToU8('<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>'),
    "xl/sharedStrings.xml": strToU8(`<sst>${values.flat().map((value) => `<si><t>${value}</t></si>`).join("")}</sst>`),
    "xl/worksheets/sheet1.xml": strToU8(`<worksheet><sheetData>${sheetRows}</sheetData></worksheet>`),
  }));
  const body = new FormData();
  body.set("message", "Projeler sayfasını oku.");
  body.set(
    "file",
    new Blob([workbook], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    "DDPro_18_Proje_Referanslari.xlsx"
  );

  const response = await fetch(`${baseUrl}/upload`, { method: "POST", body });
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.file.name, "DDPro_18_Proje_Referanslari.xlsx");
  assert.equal(result.extracted.type, "spreadsheet");
  assert.deepEqual(result.extracted.tables[0].headers, headers);
  assert.equal(result.extracted.tables[0].rows.length, 18);
  assert.equal(result.extracted.tables[0].rows[0][9], "");
  assert.equal(result.extracted.tables[0].rows[17][11], "Kaynak notu 18");

  const table = result.extracted.tables[0];
  const databaseProjects = [{
    id: "existing-project",
    name: rows[0][0],
    import_source_key: null,
  }];
  const database = {
    from(tableName) {
      let payload;
      const query = {
        select() {
          if (payload) return query;
          const data = tableName === "projects"
            ? databaseProjects.map((project) => ({ ...project }))
            : [{ name: tableName === "products" ? "Cephe" : "Curtain wall" }];
          return Promise.resolve({ data, error: null });
        },
        insert(record) {
          payload = record;
          return query;
        },
        async single() {
          const project = { id: `imported-${databaseProjects.length}`, ...payload };
          databaseProjects.push(project);
          return { data: project, error: null };
        },
      };
      return query;
    },
  };
  const sourceFingerprint = "a".repeat(64);
  const preview = await previewAiFileProjects(database, {
    sourceFingerprint,
    headers: table.headers,
    rows: table.rows,
  });
  assert.deepEqual(preview.counts, { transfer: 15, duplicate: 2, review: 1 });
  assert.equal(preview.records.find(({ row }) => row === 4).classification, "review");
  assert.deepEqual(preview.records.find(({ row }) => row === 4).missing, ["start_date", "end_date"]);

  const imported = await saveAiFileProjects(database, {
    sourceFingerprint,
    headers: table.headers,
    rows: table.rows,
  });
  assert.equal(imported.sourceRows, 18);
  assert.equal(imported.added.length, 16);
  assert.equal(imported.existing.length, 2);
  assert.equal(imported.errors.length, 0);
  const refreshedProjects = databaseProjects.filter(({ id }) =>
    imported.added.some((record) => record.id === id)
  );
  assert.equal(refreshedProjects.length, 16);
  const incompleteProject = refreshedProjects.find(({ name }) => name === "Test Projesi 3");
  assert.equal(incompleteProject.start_date, null);
  assert.equal(incompleteProject.end_date, null);
  assert.equal(incompleteProject.source_data.values[11], "Kaynak notu 3");
});
