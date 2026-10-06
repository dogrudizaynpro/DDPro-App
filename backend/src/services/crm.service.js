import { getIntegrationAdmin } from "../config/integration-admin.js";

const CRM_FIELDS = [
  "name",
  "contact_date",
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
  const source = inbound && ["website", "whatsapp", "gmail"].includes(body.source)
    ? body.source
    : "manual";
  const area = body.area_m2 ?? body.area;
  const areaM2 = area === "" || area === null || area === undefined ? null : Number(area);
  const rawContactDate = body.contact_date ?? body.date;
  const contactDate = rawContactDate === undefined || rawContactDate === null || rawContactDate === ""
    ? new Date().toISOString().slice(0, 10)
    : typeof rawContactDate === "string" ? rawContactDate.trim() : "";
  const parsedContactDate = new Date(`${contactDate}T00:00:00Z`);

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
  if (!/^\d{4}-\d{2}-\d{2}$/.test(contactDate) ||
      Number.isNaN(parsedContactDate.getTime()) ||
      parsedContactDate.toISOString().slice(0, 10) !== contactDate) {
    throw Object.assign(new Error("CRM contact date must be a valid YYYY-MM-DD date."), {
      statusCode: 400,
      expose: true,
    });
  }
  const projectId = cleanText(body.project_id ?? body.projectId, 80) || null;
  if (projectId && !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(projectId)) {
    throw Object.assign(new Error("CRM project reference must be a valid UUID."), {
      statusCode: 400,
      expose: true,
    });
  }

  const result = {
    name: name || email || phone,
    contact_date: contactDate,
    company: cleanText(body.company, 500) || null,
    phone: phone || null,
    email: email || null,
    request: cleanText(body.request, 20_000) || null,
    project_id: projectId,
    system: cleanText(body.system, 500) || null,
    area_m2: areaM2,
    status: cleanText(body.status, 100) || "Yeni",
    notes: cleanText(body.notes, 20_000) || null,
    source,
    source_external_id:
      inbound ? cleanText(body.source_external_id || body.externalId, 500) || null : null,
  };
  return Object.fromEntries(
    Object.entries(result).filter(([key, value]) =>
      inbound || CRM_FIELDS.includes(key) ? value !== undefined : true
    )
  );
};

const findNaturalDuplicate = async (client, payload, excludeId = null) => {
  for (const field of ["email", "phone"]) {
    if (!payload[field]) continue;
    let query = client.from("crm_contacts").select("*").eq(field, payload[field]);
    if (excludeId) query = query.neq("id", excludeId);
    const { data, error } = await query.limit(1).maybeSingle();
    if (error) throw error;
    if (data) return data;
  }
  return null;
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
  const duplicate = await findNaturalDuplicate(client, payload);
  if (duplicate) return { contact: duplicate, duplicate: true };
  const { data, error } = await client
    .from("crm_contacts")
    .insert(payload)
    .select("*")
    .single();
  if (error?.code === "23505" && payload.source_external_id) {
    const { data: existing, error: lookupError } = await client
      .from("crm_contacts")
      .select("*")
      .eq("source", payload.source)
      .eq("source_external_id", payload.source_external_id)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (existing) return { contact: existing, duplicate: true };
  }
  if (error) throw error;
  return { contact: data, duplicate: false };
};

export const updateCrmContact = async (id, body) => {
  if (!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(id)) {
    throw Object.assign(new Error("CRM contact id must be a valid UUID."), {
      statusCode: 400,
      expose: true,
    });
  }
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
  payload.source = current.source;
  payload.source_external_id = current.source_external_id;
  const duplicate = await findNaturalDuplicate(client, payload, id);
  if (duplicate) {
    throw Object.assign(new Error("Another CRM contact already uses this email address or phone number."), {
      statusCode: 409,
      expose: true,
    });
  }
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
  if (!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(id)) {
    throw Object.assign(new Error("CRM contact id must be a valid UUID."), {
      statusCode: 400,
      expose: true,
    });
  }
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
