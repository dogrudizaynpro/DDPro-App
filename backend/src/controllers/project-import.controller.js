import { createHash } from "node:crypto";
import { getIntegrationAdmin } from "../config/integration-admin.js";
import { createProjectRecord } from "./projects.controller.js";
import { readProjectsSheet } from "../services/google-sheets.service.js";
import { prepareAiAttachment } from "../services/ai-file.service.js";

const headerAliases = {
  name: ["proje adı", "proje adi", "proje", "project name", "project"],
  customer: ["müşteri", "musteri", "müşteri adı", "musteri adi", "customer", "client"],
  company: ["firma", "firma işveren", "işveren", "şirket", "sirket", "company", "contractor", "employer"],
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
  String(value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/ı/g, "i")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");

const columnIndexes = (headers) => Object.fromEntries(
  Object.entries(headerAliases).map(([field, aliases]) => {
    const normalizedAliases = new Set(aliases.map(normalizeHeader));
    return [field, headers.findIndex((header) => normalizedAliases.has(normalizeHeader(header)))];
  })
);

const textValue = (row, index) =>
  index < 0 || row[index] === undefined || row[index] === null ? "" : String(row[index]).trim();

const parseAreaM2 = (value) => {
  const normalized = String(value ?? "").replace(/[\s\u00a0_]/g, "");
  if (!normalized || !/^[\d.,]+$/.test(normalized)) return null;
  const comma = normalized.lastIndexOf(",");
  const dot = normalized.lastIndexOf(".");
  let decimalSeparator = "";
  let groupingSeparator = "";
  if (comma >= 0 && dot >= 0) {
    decimalSeparator = comma > dot ? "," : ".";
    groupingSeparator = decimalSeparator === "," ? "." : ",";
  } else if (comma >= 0 || dot >= 0) {
    const separator = comma >= 0 ? "," : ".";
    const parts = normalized.split(separator);
    if (parts.length === 2 && parts[1].length !== 3) {
      decimalSeparator = separator;
    } else {
      if (parts.length > 1 && (
        parts[0].length < 1 ||
        parts[0].length > 3 ||
        parts.slice(1).some((part) => part.length !== 3)
      )) return null;
      groupingSeparator = separator;
    }
  }
  const decimalParts = decimalSeparator ? normalized.split(decimalSeparator) : [normalized];
  if (decimalParts.length > 2) return null;
  const integerGroups = groupingSeparator
    ? decimalParts[0].split(groupingSeparator)
    : [decimalParts[0]];
  if (integerGroups.length > 1 && (
    integerGroups[0].length < 1 ||
    integerGroups[0].length > 3 ||
    integerGroups.slice(1).some((part) => part.length !== 3)
  )) return null;
  const integer = decimalParts[0].split(groupingSeparator).join("");
  const fraction = decimalParts[1];
  if (!/^\d+$/.test(integer) || (fraction !== undefined && !/^\d+$/.test(fraction))) return null;
  const parsed = Number(fraction === undefined ? integer : `${integer}.${fraction}`);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseProjectDate = (value) => {
  const normalized = String(value ?? "").trim();
  if (!normalized) return null;
  const serial = Number(normalized);
  if (/^\d+(?:\.\d+)?$/.test(normalized) && serial >= 1 && serial <= 2_958_465) {
    return new Date(Date.UTC(1899, 11, 30) + Math.floor(serial) * 86_400_000)
      .toISOString()
      .slice(0, 10);
  }
  const turkishDate = normalized.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  if (turkishDate) {
    const [, day, month, year] = turkishDate;
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    if (date.getUTCFullYear() !== Number(year) ||
        date.getUTCMonth() !== Number(month) - 1 ||
        date.getUTCDate() !== Number(day)) return null;
    return date.toISOString().slice(0, 10);
  }
  const isoDate = normalized.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T)/);
  if (!isoDate) return null;
  const [, year, month, day] = isoDate;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (date.getUTCFullYear() !== Number(year) ||
      date.getUTCMonth() !== Number(month) - 1 ||
      date.getUTCDate() !== Number(day)) return null;
  return date.toISOString().slice(0, 10);
};

export const mapProjectSheetRow = (headers, row, { parseExcelValues = false } = {}) => {
  const indexes = columnIndexes(headers);
  const name = textValue(row, indexes.name);
  const status = textValue(row, indexes.status);
  const areaValue = textValue(row, indexes.area_m2);
  const system = textValue(row, indexes.system);
  const startDateValue = textValue(row, indexes.start_date);
  const endDateValue = textValue(row, indexes.end_date);
  const startDate = parseExcelValues
    ? parseProjectDate(startDateValue)
    : startDateValue || null;
  const endDate = parseExcelValues
    ? parseProjectDate(endDateValue)
    : endDateValue || null;
  const missing = {
    area_m2: !areaValue,
    start_date: !startDateValue,
    end_date: !endDateValue,
  };
  const validationErrors = [
    ...(areaValue && parseAreaM2(areaValue) === null ? ["Alan (m²) sayısal olmalıdır."] : []),
    ...(parseExcelValues && startDateValue && !startDate ? ["Başlangıç tarihi geçerli değil."] : []),
    ...(parseExcelValues && endDateValue && !endDate ? ["Bitiş tarihi geçerli değil."] : []),
  ];
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
      validationErrors,
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
      start_date: startDate,
      end_date: endDate,
      notes: textValue(row, indexes.notes),
      source_data: sourceData,
    },
    missing,
    validationErrors,
  };
};

const comparableName = (name) =>
  String(name ?? "").trim().normalize("NFKC").toLocaleLowerCase("tr-TR");

const rowFingerprint = (sourceFingerprint, sheetRow, row) =>
  createHash("sha256")
    .update(`${sourceFingerprint}:${sheetRow}:${JSON.stringify(row)}`)
    .digest("hex");

const isValidAiFileImport = ({ sourceFingerprint, headers, rows }) =>
  typeof sourceFingerprint === "string" &&
  /^[\da-f]{64}$/i.test(sourceFingerprint) &&
  Array.isArray(headers) &&
  headers.length >= 1 &&
  headers.length <= 100 &&
  headers.every((header) => typeof header === "string" && header.length <= 500) &&
  Array.isArray(rows) &&
  rows.length <= 300 &&
  rows.every((row) => Array.isArray(row) && row.length <= 100 &&
    row.every((value) => ["string", "number", "boolean"].includes(typeof value)));

const safeFailure = (error) => ({
  code: typeof error?.code === "string" ? error.code : "PROJECT_IMPORT_FAILED",
  message: error?.code === "23505" ? "A source row with this import key already exists." : "Project could not be imported.",
});

export const previewAiFileProjects = async (supabase, { sourceFingerprint, headers, rows }) => {
  const [projectResult, productResult, systemResult] = await Promise.all([
    supabase.from("projects").select("name,import_source_key"),
    supabase.from("products").select("name"),
    supabase.from("systems").select("name"),
  ]);
  for (const result of [projectResult, productResult, systemResult]) {
    if (result.error) throw result.error;
  }

  const projectNames = new Set((projectResult.data || []).map(({ name }) => comparableName(name)));
  const importKeys = new Set((projectResult.data || [])
    .map(({ import_source_key }) => import_source_key)
    .filter(Boolean));
  const productNames = new Set((productResult.data || []).map(({ name }) => comparableName(name)));
  const systemNames = new Set((systemResult.data || []).map(({ name }) => comparableName(name)));
  const records = [];

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    if (!row.some((cell) => String(cell ?? "").trim())) continue;
    const sheetRow = index + 2;
    const mapped = mapProjectSheetRow(headers, row, { parseExcelValues: true });
    const missing = Object.entries(mapped.missing)
      .filter(([, isMissing]) => isMissing)
      .map(([field]) => field);
    if (!mapped.project) {
      records.push({
        row: sheetRow,
        project: null,
        missing,
        error: mapped.error,
        classification: "review",
        reasons: [mapped.error],
        validationErrors: mapped.validationErrors,
        unmatched: [],
      });
      continue;
    }

    const importKey = rowFingerprint(sourceFingerprint, sheetRow, row);
    const name = comparableName(mapped.project.name);
    const duplicate = importKeys.has(importKey) || projectNames.has(name);
    const unmatched = [
      ...(mapped.project.product && !productNames.has(comparableName(mapped.project.product))
        ? [{ field: "product", name: mapped.project.product }]
        : []),
      ...(mapped.project.systems.some((system) => !systemNames.has(comparableName(system)))
        ? mapped.project.systems
          .filter((system) => !systemNames.has(comparableName(system)))
          .map((system) => ({ field: "system", name: system }))
        : []),
    ];
    const warnings = unmatched.map(({ field, name: value }) =>
      `Katalogda bulunamadı (${field === "product" ? "ürün" : "sistem"}): ${value}`
    );
    const reasons = mapped.validationErrors.length
      ? [`Doğrulama hataları: ${mapped.validationErrors.join("; ")}`]
      : [];

    if (duplicate) {
      records.push({
        row: sheetRow,
        project: mapped.project,
        missing,
        validationErrors: mapped.validationErrors,
        classification: "duplicate",
        reasons: ["Mevcut bir projeyle aynı ad veya kaynak satırı."],
        warnings,
        unmatched,
      });
      continue;
    }

    const classification = reasons.length ? "review" : "transfer";
    records.push({
      row: sheetRow,
      project: mapped.project,
      missing,
      validationErrors: mapped.validationErrors,
      classification,
      reasons,
      warnings,
      unmatched,
    });
    projectNames.add(name);
    importKeys.add(importKey);
  }

  return {
    records,
    counts: {
      transfer: records.filter(({ classification }) => classification === "transfer").length,
      duplicate: records.filter(({ classification }) => classification === "duplicate").length,
      review: records.filter(({ classification }) => classification === "review").length,
    },
  };
};

export const saveAiFileProjects = async (supabase, { sourceFingerprint, headers, rows }) => {
  const { data: existingProjects, error: lookupError } = await supabase
    .from("projects")
    .select("id,name,import_source_key");
  if (lookupError) throw lookupError;

  const knownNames = new Set((existingProjects || []).map(({ name }) => comparableName(name)));
  const existingKeys = new Set((existingProjects || [])
    .map(({ import_source_key }) => import_source_key)
    .filter(Boolean));
  const added = [];
  const existing = [];
  const errors = [];
  const incomplete = [];
  let sourceRows = 0;

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    if (!row.some((cell) => String(cell ?? "").trim())) continue;
    sourceRows += 1;
    const sheetRow = index + 2;
    const mapped = mapProjectSheetRow(headers, row, { parseExcelValues: true });
    const missingFields = Object.entries(mapped.missing)
      .filter(([, missing]) => missing)
      .map(([field]) => field);
    if (missingFields.length) incomplete.push({ row: sheetRow, missing: missingFields });
    if (mapped.error) {
      errors.push({ row: sheetRow, message: mapped.error, missing: missingFields });
      continue;
    }
    if (mapped.validationErrors.length) {
      errors.push({
        row: sheetRow,
        message: mapped.validationErrors.join("; "),
        missing: missingFields,
      });
      continue;
    }

    const importSourceKey = rowFingerprint(sourceFingerprint, sheetRow, row);
    const projectName = comparableName(mapped.project.name);
    if (existingKeys.has(importSourceKey) || knownNames.has(projectName)) {
      existing.push({
        row: sheetRow,
        name: mapped.project.name,
        missing: missingFields,
      });
      continue;
    }

    try {
      const data = await createProjectRecord(supabase, mapped.project, importSourceKey);
      added.push({
        row: sheetRow,
        id: data.id,
        name: data.name,
        missing: missingFields,
      });
      knownNames.add(projectName);
      existingKeys.add(importSourceKey);
    } catch (error) {
      if (error.code === "23505") {
        existing.push({ row: sheetRow, name: mapped.project.name, missing: missingFields });
        existingKeys.add(importSourceKey);
        continue;
      }
      errors.push({ row: sheetRow, name: mapped.project.name, ...safeFailure(error) });
    }
  }

  return { sourceRows, added, existing, errors, incomplete };
};

export const importAiFileProjects = async (req, res, next) => {
  try {
    const { sourceFingerprint, headers, rows } = req.body || {};
    if (!isValidAiFileImport({ sourceFingerprint, headers, rows })) {
      return res.status(400).json({ status: "error", message: "The project file import is invalid." });
    }

    const supabase = getIntegrationAdmin();
    if (!supabase) {
      return res.status(503).json({ status: "error", message: "Database service-role configuration is required." });
    }
    const data = await saveAiFileProjects(supabase, { sourceFingerprint, headers, rows });
    return res.json({ status: "success", data });
  } catch (error) {
    return next(error);
  }
};

export const previewAiFileProjectImport = async (req, res, next) => {
  try {
    const { sourceFingerprint, headers, rows } = req.body || {};
    if (!isValidAiFileImport({ sourceFingerprint, headers, rows })) {
      return res.status(400).json({ status: "error", message: "The project file import is invalid." });
    }

    const supabase = getIntegrationAdmin();
    if (!supabase) {
      return res.status(503).json({ status: "error", message: "Database service-role configuration is required." });
    }
    const data = await previewAiFileProjects(supabase, { sourceFingerprint, headers, rows });
    return res.json({ status: "success", data });
  } catch (error) {
    return next(error);
  }
};

export const previewProjectSpreadsheetUpload = async (req, res, next) => {
  try {
    if (!req.aiFile) {
      return res.status(400).json({ status: "error", message: "Select an XLSX or CSV project file." });
    }
    const parsed = await prepareAiAttachment(req.aiFile);
    if (parsed.extractedType !== "spreadsheet" || !Array.isArray(parsed.tables)) {
      return res.status(400).json({ status: "error", message: "The project spreadsheet is invalid or exceeds the safe processing limit." });
    }

    const table = findProjectSpreadsheetTable(parsed.tables);
    if (!table) {
      return res.status(400).json({ status: "error", message: "No project rows with a name and status were found in the spreadsheet." });
    }
    if (table.truncated) {
      return res.status(400).json({ status: "error", message: "The Projects sheet exceeds the safe row, column, or data-size limit." });
    }
    const sourceFingerprint = createHash("sha256").update(req.aiFile.buffer).digest("hex");
    const supabase = getIntegrationAdmin();
    if (!supabase) {
      return res.status(503).json({ status: "error", message: "Database service-role configuration is required." });
    }
    const preview = await previewAiFileProjects(supabase, {
      sourceFingerprint,
      headers: table.headers,
      rows: table.rows,
    });
    return res.json({
      status: "success",
      data: {
        sourceFingerprint,
        table: { name: table.name, headers: table.headers, rows: table.rows },
        ...preview,
      },
    });
  } catch (error) {
    return next(error);
  }
};

export const findProjectSpreadsheetTable = (tables = []) =>
  tables.find(({ name, headers = [], rows = [] }) =>
    normalizeHeader(name) === "projects" &&
    rows.some((row) => Boolean(mapProjectSheetRow(headers, row).project))
  ) ||
  tables.find(({ headers = [], rows = [] }) =>
    rows.some((row) => Boolean(mapProjectSheetRow(headers, row).project))
  ) || null;

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
