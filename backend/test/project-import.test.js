import assert from "node:assert/strict";
import { test } from "node:test";
import { mapProjectSheetRow } from "../src/controllers/project-import.controller.js";

test("project sheet mapping retains source columns and maps available project fields", () => {
  const headers = [
    "Proje Adı", "Müşteri", "Firma", "Lokasyon", "Proje Türü", "Ürün",
    "Metraj", "Sistem", "Durum", "Başlangıç Tarihi", "Bitiş Tarihi", "Notlar", "Other",
  ];
  const row = [
    "Project A", "Customer A", "Company A", "İstanbul", "Hospital", "Facade",
    "42.5", "Curtain wall", "Tamamlandı", "2020-01-02", "2020-02-03", "Notes", "preserved",
  ];
  const result = mapProjectSheetRow(headers, row);

  assert.equal(result.error, undefined);
  assert.deepEqual(result.project, {
    name: "Project A",
    customer: "Customer A",
    company: "Company A",
    location: "İstanbul",
    project_type: "Hospital",
    product: "Facade",
    area_m2: 42.5,
    systems: ["Curtain wall"],
    status: "Tamamlandı",
    start_date: "2020-01-02",
    end_date: "2020-02-03",
    notes: "Notes",
    source_data: { headers, values: row },
  });
  assert.deepEqual(result.missing, {
    area_m2: false,
    start_date: false,
    end_date: false,
  });
});

test("project sheet mapping leaves missing or ambiguous dates and metrage unguessed", () => {
  const headers = ["Proje", "Metraj", "Durum", "Başlangıç Tarihi", "Bitiş Tarihi"];
  const result = mapProjectSheetRow(headers, ["Project B", "1.250,5", "Aktif", "", ""]);

  assert.equal(result.project.area_m2, null);
  assert.equal(result.project.start_date, null);
  assert.equal(result.project.end_date, null);
  assert.equal(result.missing.area_m2, true);
  assert.equal(result.missing.start_date, true);
  assert.equal(result.missing.end_date, true);
  assert.deepEqual(result.project.source_data.values, ["Project B", "1.250,5", "Aktif", "", ""]);
});

test("project sheet mapping rejects rows without a project name or status", () => {
  const headers = ["Proje", "Durum"];
  assert.equal(mapProjectSheetRow(headers, ["", "Aktif"]).error, "Project name is missing.");
  assert.equal(mapProjectSheetRow(headers, ["Project C", ""]).error, "Project status is missing.");
});
