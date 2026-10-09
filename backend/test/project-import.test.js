import assert from "node:assert/strict";
import { test } from "node:test";
import {
  mapProjectSheetRow,
  previewAiFileProjects,
  saveAiFileProjects,
} from "../src/controllers/project-import.controller.js";

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

test("AI file import reports duplicates and failures and safely retries only unsaved rows", async () => {
  const headers = [
    "Project", "Customer", "Company", "Location", "Project type", "Product",
    "Area m2", "System", "Status", "Start date", "End date", "Notes",
  ];
  const rows = [
    ["Existing", "Customer", "Company", "City", "Office", "Facade", "20", "Wall", "Active", "2026-01-01", "2026-12-31", "original"],
    ["New project", "Customer", "Company", "City", "Office", "Facade", "30", "Wall", "Active", "2026-01-01", "2026-12-31", "preserve me"],
    ["Retry project", "Customer", "Company", "City", "Office", "Facade", "", "Wall", "Active", "", "", "no invented fields"],
    ["Incomplete project", "", "", "", "", "", "", "", "Active", "", "", ""],
  ];
  const projects = [{ id: "existing-id", name: "Existing", import_source_key: null }];
  let shouldFail = true;
  let nextId = 1;
  const supabase = {
    from(table) {
      assert.equal(table, "projects");
      let payload;
      const query = {
        select() {
          return payload
            ? query
            : Promise.resolve({ data: projects.map((project) => ({ ...project })), error: null });
        },
        insert(record) {
          payload = record;
          return query;
        },
        async single() {
          if (payload.name === "Retry project" && shouldFail) {
            shouldFail = false;
            throw Object.assign(new Error("temporary failure"), { code: "XX000" });
          }
          if (projects.some((project) => project.import_source_key === payload.import_source_key)) {
            throw Object.assign(new Error("duplicate import key"), { code: "23505" });
          }
          const project = { id: `created-${nextId++}`, ...payload };
          projects.push(project);
          return { data: project, error: null };
        },
      };
      return query;
    },
  };
  const sourceFingerprint = "a".repeat(64);

  const first = await saveAiFileProjects(supabase, { sourceFingerprint, headers, rows });
  assert.equal(first.sourceRows, 4);
  assert.equal(first.added.length, 2);
  assert.equal(first.existing.length, 1);
  assert.equal(first.errors.length, 1);
  assert.equal(first.errors[0].name, "Retry project");
  assert.deepEqual(first.incomplete.map(({ row }) => row), [4, 5]);
  assert.equal(projects.find(({ name }) => name === "New project").source_data.values[11], "preserve me");
  assert.equal(projects.find(({ name }) => name === "Incomplete project").area_m2, null);
  assert.equal(projects.find(({ name }) => name === "Incomplete project").project_type, null);
  assert.equal(projects.find(({ name }) => name === "Incomplete project").start_date, null);
  assert.equal(projects.find(({ name }) => name === "Incomplete project").end_date, null);

  const retry = await saveAiFileProjects(supabase, { sourceFingerprint, headers, rows });
  assert.equal(retry.added.length, 1);
  assert.equal(retry.added[0].name, "Retry project");
  assert.equal(retry.existing.length, 3);
  assert.equal(retry.errors.length, 0);
  assert.equal(projects.length, 4);
});

test("AI file preflight groups duplicate, review, and transferable rows without writing", async () => {
  const headers = ["Project", "Product", "System", "Status", "Area m2", "Start date", "End date"];
  const rows = [
    ["Existing", "Known product", "Known system", "Active", "10", "2026-01-01", "2026-12-31"],
    ["New project", "Unlisted product", "Unlisted system", "Active", "10", "2026-01-01", "2026-12-31"],
    ["Ready project", "Known product", "Known system", "Active", "10", "2026-01-01", "2026-12-31"],
    ["", "Known product", "Known system", "Active", "10", "2026-01-01", "2026-12-31"],
  ];
  const tables = {
    projects: [{ name: "Existing", import_source_key: null }],
    products: [{ name: "Known product" }],
    systems: [{ name: "Known system" }],
  };
  let writes = 0;
  const supabase = {
    from(table) {
      return {
        select: async () => ({ data: tables[table], error: null }),
        insert: () => { writes += 1; },
      };
    },
  };

  const preview = await previewAiFileProjects(supabase, {
    sourceFingerprint: "c".repeat(64),
    headers,
    rows,
  });

  assert.deepEqual(preview.counts, { transfer: 1, duplicate: 1, review: 2 });
  assert.deepEqual(preview.records.map(({ classification }) => classification), [
    "duplicate",
    "review",
    "transfer",
    "review",
  ]);
  assert.deepEqual(preview.records[1].unmatched, [
    { field: "product", name: "Unlisted product" },
    { field: "system", name: "Unlisted system" },
  ]);
  assert.deepEqual(preview.records[1].project.source_data.values, rows[1]);
  assert.equal(writes, 0);
});
