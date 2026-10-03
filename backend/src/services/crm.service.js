import { getIntegrationAdmin } from "../config/integration-admin.js";

const CRM_FIELDS = [
  "name",
  "company",
  "phone",
  "email",
  "request",
  "project_id",
  "system",
  "area_m2",
  "status",
  "notes",
  "source",
  "source_external_id",
];

const cleanText = (value, max = 20_000) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

export const normalizeCrmContact = (body = {}, { inbound = false } = {}) => {
  const name = cleanText(body.name, 250);
  const email = cleanText(body.email, 320).toLowerCase();
  const phone = cleanText(body.phone, 80);
  const source = inbound
    ? body.source
    : ["website", "whatsapp", "gmail"].includes(body.source)
      ? body.source
      : "manual";
  const area = body.area_m2 ?? body.area;
  const areaM2 = area === "" || area === null || area === undefined ? null : Number(area);

  if (!name && !email && !phone) {
    throw Object.assign(
      new Error("CRM contact requires a name, email address, or phone number."),
      { statusCode: 400, expose: true }
    );
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw Object.assign(new Error("CRM email address is invalid."), {
      statusCode: 400,
      expose: true,
    });
  }
  if (areaM2 !== null && (!Number.isFinite(areaM2) || areaM2 < 0)) {
    throw Object.assign(new Error("CRM area must be a non-negative number."), {
      statusCode: 400,
      expose: true,
    });
  }

  const result = {
    name: name || email || phone,
    company: cleanText(body.company, 500) || null,
    phone: phone || null,
    email: email || null,
    request: cleanText(body.request, 20_000) || null,
    project_id: cleanText(body.project_id || body.projectId, 80) || null,
    system: cleanText(body.system, 500) || null,
    area_m2: areaM2,
    status: cleanText(body.status, 100) || "Yeni",
    notes: cleanText(body.notes, 20_000) || null,
    source,
    source_external_id: cleanText(body.source_external_id || body.externalId, 500) || null,
  };
  return Object.fromEntries(
    Object.entries(result).filter(([key, value]) =>
      inbound || CRM_FIELDS.includes(key) ? value !== undefined : true
    )
  );
};

export const listCrmContacts = async () => {
  const client = getIntegrationAdmin();
  if (!client) {
    throw Object.assign(new Error("CRM database service-role configuration is required."), {
      statusCode: 503,
      expose: true,
    });
  }
  const { data, error } = await client
    .from("crm_contacts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return data || [];
};

export const createCrmContact = async (body, options) => {
  const client = getIntegrationAdmin();
  if (!client) {
    throw Object.assign(new Error("CRM database service-role configuration is required."), {
      statusCode: 503,
      expose: true,
    });
  }
  const payload = normalizeCrmContact(body, options);
  if (payload.source_external_id) {
    const { data: existing, error: lookupError } = await client
      .from("crm_contacts")
      .select("*")
      .eq("source", payload.source)
      .eq("source_external_id", payload.source_external_id)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (existing) return { contact: existing, duplicate: true };
  }
  const { data, error } = await client
    .from("crm_contacts")
    .insert(payload)
    .select("*")
    .single();
  if (error) throw error;
  return { contact: data, duplicate: false };
};

export const updateCrmContact = async (id, body) => {
  const client = getIntegrationAdmin();
  if (!client) {
    throw Object.assign(new Error("CRM database service-role configuration is required."), {
      statusCode: 503,
      expose: true,
    });
  }
  const { data: current, error: lookupError } = await client
    .from("crm_contacts")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (lookupError) throw lookupError;
  if (!current) return null;
  const payload = normalizeCrmContact({ ...current, ...body });
  const { data, error } = await client
    .from("crm_contacts")
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data;
};

export const deleteCrmContact = async (id) => {
  const client = getIntegrationAdmin();
  if (!client) {
    throw Object.assign(new Error("CRM database service-role configuration is required."), {
      statusCode: 503,
      expose: true,
    });
  }
  const { data, error } = await client
    .from("crm_contacts")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
};
