import { getIntegrationAdmin } from "../config/integration-admin.js";

const UUID_PATTERN = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
const COST_TYPES = new Set(["MATERIAL", "LABOR", "OTHER"]);
const VERIFICATION_STATUSES = new Set(["VERIFIED", "UNVERIFIED", "MISSING"]);
const fail = (message, statusCode = 400) => Object.assign(new Error(message), {
  statusCode,
  expose: true,
});

export const normalizeCostPayload = (body = {}, existing = {}) => {
  const values = { ...existing, ...body };
  const read = (...keys) => {
    for (const key of keys) {
      if (Object.hasOwn(body, key)) return body[key];
    }
    for (const key of keys) {
      if (Object.hasOwn(existing, key)) return existing[key];
    }
    return undefined;
  };
  const name = typeof values.name === "string" ? values.name.trim() : "";
  if (!name || name.length > 200) throw fail("Cost record name is required and must be at most 200 characters.");

  const costType = read("cost_type", "costType");
  if (!COST_TYPES.has(costType)) throw fail("Cost type must be MATERIAL, LABOR, or OTHER.");

  const currency = typeof values.currency === "string" ? values.currency.trim().toUpperCase() : "";
  if (!/^[A-Z]{3}$/.test(currency)) throw fail("Cost currency must be a three-letter ISO code.");

  const uuid = (value, label, required = false) => {
    if (value === undefined || value === null || value === "") {
      if (required) throw fail(`${label} reference is required.`);
      return null;
    }
    if (typeof value !== "string" || !UUID_PATTERN.test(value)) throw fail(`${label} reference must be a valid UUID.`);
    return value;
  };

  const projectId = uuid(read("project_id", "projectId"), "Project", true);
  const budgetValue = read("budget_amount", "budgetAmount");
  const budgetAmount = budgetValue === undefined || budgetValue === null || budgetValue === ""
    ? null
    : Number(budgetValue);
  if (budgetAmount !== null && (!Number.isFinite(budgetAmount) || budgetAmount < 0)) {
    throw fail("Budget amount must be a non-negative number.");
  }

  const actualValue = read("actual_amount", "actualAmount", "amount");
  const actualAmount = actualValue === undefined || actualValue === null || actualValue === ""
    ? null
    : Number(actualValue);
  if (actualAmount !== null && (!Number.isFinite(actualAmount) || actualAmount <= 0)) {
    throw fail("Actual cost must be a positive number.");
  }

  const verificationStatus = read("verification_status", "verificationStatus") ?? "UNVERIFIED";
  if (!VERIFICATION_STATUSES.has(verificationStatus)) throw fail("Cost verification status is invalid.");
  const source = typeof values.source === "string" ? values.source.trim() || null : null;
  const verifiedAtValue = read("verified_at", "verifiedAt");
  const verifiedAt = typeof verifiedAtValue === "string" && verifiedAtValue.trim()
    ? new Date(verifiedAtValue.trim())
    : null;
  if (verificationStatus === "VERIFIED" &&
      (!actualAmount || !source || !verifiedAt || Number.isNaN(verifiedAt.getTime()))) {
    throw fail("Verified actual costs require a positive amount, source, and valid verification timestamp.");
  }
  if (verificationStatus === "MISSING" && actualAmount !== null) {
    throw fail("Missing cost records cannot include an actual amount.");
  }

  const occurredOn = read("occurred_on", "occurredOn") ?? null;
  if (occurredOn) {
    const parsedDate = typeof occurredOn === "string"
      ? new Date(`${occurredOn}T00:00:00Z`)
      : null;
    if (typeof occurredOn !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(occurredOn) ||
        !parsedDate ||
        Number.isNaN(parsedDate.getTime()) ||
        parsedDate.toISOString().slice(0, 10) !== occurredOn) {
      throw fail("Cost date must be a valid YYYY-MM-DD date.");
    }
  }

  return {
    project_id: projectId,
    system_id: uuid(read("system_id", "systemId"), "System"),
    product_id: uuid(read("product_id", "productId"), "Product"),
    material_analysis_id: uuid(read("material_analysis_id", "materialAnalysisId"), "Material analysis"),
    name,
    cost_type: costType,
    currency,
    budget_amount: budgetAmount,
    actual_amount: actualAmount,
    source,
    verification_status: verificationStatus,
    verified_at: verificationStatus === "VERIFIED" ? verifiedAt.toISOString() : null,
    occurred_on: occurredOn || null,
    notes: typeof values.notes === "string" ? values.notes.trim().slice(0, 10_000) : "",
  };
};

const requireDatabase = () => {
  const client = getIntegrationAdmin();
  if (!client) throw fail("Finance database service-role configuration is required.", 503);
  return client;
};

export const listCostRecords = async (ownerAccount) => {
  const client = requireDatabase();
  const { data, error } = await client.from("project_costs")
    .select("*")
    .eq("owner_account", ownerAccount)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return data || [];
};

export const createCostRecord = async (ownerAccount, body) => {
  const client = requireDatabase();
  const payload = normalizeCostPayload(body);
  const { data, error } = await client.from("project_costs")
    .insert({ ...payload, owner_account: ownerAccount })
    .select("*")
    .single();
  if (error) throw error;
  return data;
};

export const updateCostRecord = async (ownerAccount, id, body) => {
  if (!UUID_PATTERN.test(id || "")) throw fail("Cost record id must be a valid UUID.");
  const client = requireDatabase();
  const { data: existing, error: lookupError } = await client.from("project_costs")
    .select("*")
    .eq("id", id)
    .eq("owner_account", ownerAccount)
    .maybeSingle();
  if (lookupError) throw lookupError;
  if (!existing) return null;

  const payload = normalizeCostPayload(body, existing);
  const { data, error } = await client.from("project_costs")
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("owner_account", ownerAccount)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data;
};

export const deleteCostRecord = async (ownerAccount, id) => {
  if (!UUID_PATTERN.test(id || "")) throw fail("Cost record id must be a valid UUID.");
  const client = requireDatabase();
  const { data, error } = await client.from("project_costs")
    .delete()
    .eq("id", id)
    .eq("owner_account", ownerAccount)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
};
