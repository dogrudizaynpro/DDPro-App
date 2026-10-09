import { getIntegrationAdmin } from "../config/integration-admin.js";
import { readProjectsSheet } from "../services/google-sheets.service.js";

const headerAliases = {
  name: ["proje adı", "proje adi", "proje", "project name", "project"],
  customer: ["müşteri", "musteri", "müşteri adı", "musteri adi", "customer", "client"],
  company: ["firma", "şirket", "sirket", "company", "contractor"],
  location: ["lokasyon", "konum", "location", "city"],
  project_type: ["proje türü", "proje turu", "proje tipi", "project type", "type"],
  product: ["ürün", "urun", "product"],
  area_m2: ["metraj", "alan", "alan (m²)", "m²", "area", "area m2", "area_m2"],
  system: ["sistem", "systems", "system"],
  status: ["durum", "status"],
  start_date: ["başlangıç tarihi", "baslangic tarihi", "başlangıç", "baslangic", "start date", "start_date"],
  end_date: ["bitiş tarihi", "bitis tarihi", "bitiş", "bitis", "end date", "end_date"],
  notes: ["not", "notlar", "açıklama", "aciklama", "notes", "description"],
};

const normalizeHeader = (value) =>
  String(value ?? "").trim().normalize("NFKC").toLocaleLowerCase("tr-TR");

const columnIndexes = (headers) => Object.fromEntries(
  Object.entries(headerAliases).map(([field, aliases]) => {
    const normalizedAliases = new Set(aliases.map(normalizeHeader));
    return [field, headers.findIndex((header) => normalizedAliases.has(normalizeHeader(header)))];
  })
);

const textValue = (row, index) =>
  index < 0 || row[index] === undefined || row[index] === null ? "" : String(row[index]).trim();

const parseAreaM2 = (value) => {
  if (!value || !/^\d+(?:\.\d+)?$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const mapProjectSheetRow = (headers, row) => {
  const indexes = columnIndexes(headers);
  const name = textValue(row, indexes.name);
  const status = textValue(row, indexes.status);
  const areaValue = textValue(row, indexes.area_m2);
  const system = textValue(row, indexes.system);
  const missing = {
    area_m2: !areaValue || parseAreaM2(areaValue) === null,
    start_date: !textValue(row, indexes.start_date),
    end_date: !textValue(row, indexes.end_date),
  };
  const sourceData = {
    headers: headers.map((header) => String(header ?? "")),
    values: Array.from(
      { length: Math.max(headers.length, row.length) },
      (_, index) => row[index] ?? ""
    ),
  };
  if (!name || !status) {
    return {
      error: !name ? "Project name is missing." : "Project status is missing.",
      missing,
    };
  }
  return {
    project: {
      name,
      customer: textValue(row, indexes.customer) || null,
      company: textValue(row, indexes.company) || null,
      location: textValue(row, indexes.location) || null,
      project_type: textValue(row, indexes.project_type) || null,
      product: textValue(row, indexes.product) || null,
      area_m2: parseAreaM2(areaValue),
      systems: system ? [system] : [],
      status,
      start_date: textValue(row, indexes.start_date) || null,
      end_date: textValue(row, indexes.end_date) || null,
      notes: textValue(row, indexes.notes),
      source_data: sourceData,
    },
    missing,
  };
};

const comparableName = (name) =>
  String(name ?? "").trim().normalize("NFKC").toLocaleLowerCase("tr-TR");

const safeFailure = (error) => ({
  code: typeof error?.code === "string" ? error.code : "PROJECT_IMPORT_FAILED",
  message: error?.code === "23505" ? "A source row with this import key already exists." : "Project could not be imported.",
});

export const importGoogleProjects = async (req, res, next) => {
  try {
    const spreadsheetId = req.body?.spreadsheetId;
    if (typeof spreadsheetId !== "string" || !/^[A-Za-z0-9_-]{20,200}$/.test(spreadsheetId)) {
      return res.status(400).json({ status: "error", message: "A valid Google spreadsheet ID is required." });
    }

    const supabase = getIntegrationAdmin();
    if (!supabase) {
      return res.status(503).json({ status: "error", message: "Database service-role configuration is required." });
    }
    const { sheetId, values } = await readProjectsSheet(req.integrationAccount, spreadsheetId);
    if (values.length < 2) {
      return res.json({ status: "success", data: { sourceRows: 0, added: [], existing: [], errors: [] } });
    }

    const headers = values[0];
    const { data: existingProjects, error: lookupError } = await supabase
      .from("projects")
      .select("id,name,import_source_key");
    if (lookupError) return next(lookupError);
    const knownNames = new Set((existingProjects || []).map(({ name }) => comparableName(name)));
    const existingKeys = new Set((existingProjects || []).map(({ import_source_key }) => import_source_key).filter(Boolean));
    const added = [];
    const existing = [];
    const errors = [];
    const incomplete = [];
    let sourceRows = 0;

    for (let index = 1; index < values.length; index += 1) {
      const row = values[index];
      if (!row?.some((cell) => String(cell ?? "").trim())) continue;
      sourceRows += 1;
      const sheetRow = index + 1;
      const mapped = mapProjectSheetRow(headers, row);
      const missingFields = Object.entries(mapped.missing)
        .filter(([, missing]) => missing)
        .map(([field]) => field);
      if (missingFields.length) incomplete.push({ row: sheetRow, missing: missingFields });
      if (mapped.error) {
        errors.push({ row: sheetRow, message: mapped.error, missing: missingFields });
        continue;
      }
      const importSourceKey = `${spreadsheetId}:${sheetId}:${sheetRow}`;
      if (existingKeys.has(importSourceKey) || knownNames.has(comparableName(mapped.project.name))) {
        existing.push({
          row: sheetRow,
          name: mapped.project.name,
          missing: {
            start_date: mapped.missing.start_date,
            end_date: mapped.missing.end_date,
            area_m2: mapped.missing.area_m2,
          },
        });
        continue;
      }

      const { data, error } = await supabase.from("projects")
        .insert({ ...mapped.project, import_source_key: importSourceKey })
        .select("id,name")
        .single();
      if (error) {
        if (error.code === "23505") {
          existing.push({ row: sheetRow, name: mapped.project.name });
          existingKeys.add(importSourceKey);
          continue;
        }
        errors.push({ row: sheetRow, name: mapped.project.name, ...safeFailure(error) });
        continue;
      }
      added.push({
        row: sheetRow,
        id: data.id,
        name: data.name,
        missing: {
          start_date: mapped.missing.start_date,
          end_date: mapped.missing.end_date,
          area_m2: mapped.missing.area_m2,
        },
      });
      knownNames.add(comparableName(mapped.project.name));
      existingKeys.add(importSourceKey);
    }

    return res.json({ status: "success", data: { sourceRows, added, existing, errors, incomplete } });
  } catch (error) {
    return next(error);
  }
};
