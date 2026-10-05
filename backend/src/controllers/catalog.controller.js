import { getIntegrationAdmin } from "../config/integration-admin.js";

const UUID_PATTERN =
  /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
const RESOURCE_TABLES = {
  products: "products",
  systems: "systems",
  "price-analysis": "price_analysis",
  "material-analysis": "material_analysis",
};

const invalid = (message) => Object.assign(new Error(message), { statusCode: 400, expose: true });

const optionalText = (value, fieldName, maxLength = 5000) => {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string" || value.trim().length > maxLength) {
    throw invalid(`${fieldName} is invalid.`);
  }
  return value.trim();
};

const referenceId = (value, fieldName) => {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    throw invalid(`${fieldName} must be a valid UUID.`);
  }
  return value;
};

const positiveNumber = (value, fieldName, allowEmpty = false) => {
  if ((value === undefined || value === null || value === "") && allowEmpty) {
    return null;
  }
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    throw invalid(`${fieldName} must be greater than zero.`);
  }
  return number;
};

const sourceUrl = (value) => {
  const normalized = optionalText(value, "Source URL", 2048);
  if (normalized === undefined || normalized === null) return normalized;
  try {
    const url = new URL(normalized);
    if (!["https:", "http:"].includes(url.protocol)) throw new Error();
    return url.toString();
  } catch {
    throw invalid("Source URL must be a valid HTTP or HTTPS URL.");
  }
};

export const normalizeCatalogPayload = (resource, body = {}, existing = {}) => {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw invalid("Request body must be an object.");
  }
  const values = { ...existing, ...body };

  if (resource === "products") {
    const name = optionalText(values.name, "Product name", 200);
    if (!name) throw invalid("Product name is required.");
    const status = values.status ?? "ACTIVE";
    if (!["ACTIVE", "ARCHIVED", "DRAFT"].includes(status)) {
      throw invalid("Product status is invalid.");
    }
    return {
      name,
      product_code: optionalText(values.product_code, "Product code", 80) ?? null,
      system_id: referenceId(values.system_id, "System"),
      manufacturer: optionalText(values.manufacturer, "Manufacturer", 200) ?? null,
      description: optionalText(values.description, "Description") ?? "",
      unit: optionalText(values.unit, "Unit", 32) || "adet",
      source_url: sourceUrl(values.source_url) ?? null,
      status,
    };
  }

  if (resource === "systems") {
    const name = optionalText(values.name, "System name", 200);
    const code = optionalText(values.code, "System code", 80);
    if (!name || !code || !/^[a-z0-9-]{2,80}$/.test(code)) {
      throw invalid("System name and a valid system code are required.");
    }
    const status = values.status ?? "ACTIVE";
    if (!["ACTIVE", "ARCHIVED"].includes(status)) {
      throw invalid("System status is invalid.");
    }
    return {
      name,
      code,
      description: optionalText(values.description, "Description") ?? "",
      status,
    };
  }

  if (resource === "price-analysis") {
    const name = optionalText(values.name, "Price item name", 200);
    const unit = optionalText(values.unit, "Unit", 32);
    if (!name || !unit) throw invalid("Price item name and unit are required.");
    const unitPrice = positiveNumber(values.unit_price, "Unit price", true);
    const currency = String(values.currency || "TRY").toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) throw invalid("Currency must be a three-letter code.");
    const verificationStatus = values.verification_status || "UNVERIFIED";
    if (!["VERIFIED", "UNVERIFIED", "MISSING"].includes(verificationStatus)) {
      throw invalid("Price verification status is invalid.");
    }
    const source = optionalText(values.source, "Price source", 500);
    const verifiedAt = optionalText(values.verified_at, "Verification date", 64);
    if (verificationStatus === "VERIFIED") {
      if (!unitPrice || !source || !verifiedAt || Number.isNaN(Date.parse(verifiedAt))) {
        throw invalid("A verified price requires a unit price, source, and valid verification date.");
      }
    }
    if (verificationStatus === "MISSING" && unitPrice !== null) {
      throw invalid("A missing price record cannot contain a unit price.");
    }
    return {
      name,
      product_id: referenceId(values.product_id, "Product"),
      system_id: referenceId(values.system_id, "System"),
      project_id: referenceId(values.project_id, "Project"),
      unit_price: unitPrice,
      currency,
      unit,
      source: source ?? null,
      source_url: sourceUrl(values.source_url) ?? null,
      verification_status: verificationStatus,
      verified_at: verificationStatus === "VERIFIED" ? new Date(verifiedAt).toISOString() : null,
      notes: optionalText(values.notes, "Notes") ?? "",
    };
  }

  if (resource === "material-analysis") {
    const name = optionalText(values.name, "Material name", 200);
    const unit = optionalText(values.unit, "Unit", 32);
    if (!name || !unit) throw invalid("Material name and unit are required.");
    return {
      name,
      project_id: referenceId(values.project_id, "Project"),
      system_id: referenceId(values.system_id, "System"),
      product_id: referenceId(values.product_id, "Product"),
      price_analysis_id: referenceId(values.price_analysis_id, "Price analysis"),
      quantity: positiveNumber(values.quantity, "Quantity"),
      unit,
      notes: optionalText(values.notes, "Notes") ?? "",
    };
  }

  throw Object.assign(new Error("Catalog resource not found."), { statusCode: 404, expose: true });
};

const database = (res) => {
  const client = getIntegrationAdmin();
  if (client) return client;
  res.status(503).json({
    status: "error",
    message: "Database service-role configuration is required.",
  });
  return null;
};

const sendDatabaseError = (error, res, next) => {
  if (error?.code === "23505") {
    return res.status(409).json({ status: "error", message: "A record with this unique value already exists." });
  }
  if (error?.code === "23503" || error?.code === "23514") {
    return res.status(400).json({ status: "error", message: "The record references invalid or incompatible data." });
  }
  return next(error);
};

const getRecord = async (client, resource, id) => {
  const { data, error } = await client
    .from(RESOURCE_TABLES[resource])
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
};

export const buildMaterialCostSnapshot = (payload, price = null) => {
  if (price) {
    if (price.product_id && payload.product_id && price.product_id !== payload.product_id) {
      throw invalid("Selected price does not belong to the selected product.");
    }
    if (price.project_id && payload.project_id && price.project_id !== payload.project_id) {
      throw invalid("Selected price does not belong to the selected project.");
    }
    if (price.system_id && payload.system_id && price.system_id !== payload.system_id) {
      throw invalid("Selected price does not belong to the selected system.");
    }
    if (price.unit !== payload.unit) {
      throw invalid("Material and verified price units must match.");
    }
  }
  const isVerified = price?.verification_status === "VERIFIED" &&
    Number.isFinite(Number(price.unit_price)) &&
    Number(price.unit_price) > 0 &&
    Boolean(price.source && price.verified_at);
  return {
    ...payload,
    project_id: payload.project_id || price?.project_id || null,
    system_id: payload.system_id || price?.system_id || null,
    product_id: payload.product_id || price?.product_id || null,
    unit_price: isVerified ? Number(price.unit_price) : null,
    total_cost: isVerified ? Number((Number(price.unit_price) * payload.quantity).toFixed(4)) : null,
    currency: price?.currency || null,
    source: price ? (price.source_url || price.source) : null,
    verification_status: isVerified ? "VERIFIED" : price ? "UNVERIFIED" : "MISSING",
  };
};

const materialCostSnapshot = async (client, payload) => {
  if (!payload.price_analysis_id) return buildMaterialCostSnapshot(payload);
  const { data, error } = await client
    .from("price_analysis")
    .select("id, product_id, project_id, system_id, unit_price, currency, unit, source, source_url, verification_status, verified_at")
    .eq("id", payload.price_analysis_id)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw Object.assign(new Error("Price analysis record not found."), { statusCode: 404, expose: true });
  return buildMaterialCostSnapshot(payload, data);
};

export const createCatalogController = (resource) => {
  const table = RESOURCE_TABLES[resource];
  if (!table) throw new Error(`Unsupported catalog resource: ${resource}`);

  return {
    list: async (_req, res, next) => {
      const client = database(res);
      if (!client) return;
      try {
        const { data, error } = await client.from(table).select("*").order("created_at", { ascending: false });
        if (error) return sendDatabaseError(error, res, next);
        return res.status(200).json({ status: "success", data: data || [] });
      } catch (error) {
        return sendDatabaseError(error, res, next);
      }
    },
    create: async (req, res, next) => {
      const client = database(res);
      if (!client) return;
      try {
        let payload = normalizeCatalogPayload(resource, req.body);
        if (resource === "material-analysis") payload = await materialCostSnapshot(client, payload);
        const { data, error } = await client.from(table).insert(payload).select("*").single();
        if (error) return sendDatabaseError(error, res, next);
        return res.status(201).json({ status: "success", data });
      } catch (error) {
        if (error.statusCode) return res.status(error.statusCode).json({ status: "error", message: error.message });
        return sendDatabaseError(error, res, next);
      }
    },
    update: async (req, res, next) => {
      const client = database(res);
      if (!client) return;
      if (!UUID_PATTERN.test(req.params.id)) {
        return res.status(400).json({ status: "error", message: "Record id must be a valid UUID." });
      }
      try {
        const existing = await getRecord(client, resource, req.params.id);
        if (!existing) return res.status(404).json({ status: "error", message: "Record not found." });
        let payload = normalizeCatalogPayload(resource, req.body, existing);
        if (resource === "material-analysis") payload = await materialCostSnapshot(client, payload);
        const { data, error } = await client
          .from(table)
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq("id", req.params.id)
          .select("*")
          .single();
        if (error) return sendDatabaseError(error, res, next);
        return res.status(200).json({ status: "success", data });
      } catch (error) {
        if (error.statusCode) return res.status(error.statusCode).json({ status: "error", message: error.message });
        return sendDatabaseError(error, res, next);
      }
    },
    remove: async (req, res, next) => {
      const client = database(res);
      if (!client) return;
      if (!UUID_PATTERN.test(req.params.id)) {
        return res.status(400).json({ status: "error", message: "Record id must be a valid UUID." });
      }
      try {
        const { data, error } = await client.from(table).delete().eq("id", req.params.id).select("id").maybeSingle();
        if (error) return sendDatabaseError(error, res, next);
        if (!data) return res.status(404).json({ status: "error", message: "Record not found." });
        return res.status(200).json({ status: "success", data });
      } catch (error) {
        return sendDatabaseError(error, res, next);
      }
    },
  };
};

export const calculateMaterialAnalysis = createCatalogController("material-analysis").create;
