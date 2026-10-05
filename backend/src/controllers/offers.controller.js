// ============================================================
// OFFERS CONTROLLER
// ============================================================
// Business logic and database interactions for offers domain
// ============================================================

import { getIntegrationAdmin } from "../config/integration-admin.js";

const ALLOWED_OFFER_STATUSES = [
  "Hazırlanıyor",
  "Gönderildi",
  "Onaylandı",
  "Reddedildi",
];
const UUID_PATTERN =
  /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
const STATUS_TRANSITIONS = {
  "Hazırlanıyor": ["Gönderildi", "Reddedildi"],
  "Gönderildi": ["Onaylandı", "Reddedildi"],
  "Onaylandı": [],
  "Reddedildi": [],
};

export const getOfferPayload = (body = {}, existing = {}) => {
  const values = { ...existing, ...body };
  const title =
    typeof values.title === "string"
      ? values.title.trim()
      : typeof values.name === "string"
        ? values.name.trim()
        : "";

  if (!title || title.length > 200) {
    const error = new Error("Offer title is required and must be at most 200 characters.");
    error.statusCode = 400;
    error.expose = true;
    throw error;
  }

  const rawStatus =
    typeof values.status === "string" ? values.status.trim() : "Hazırlanıyor";
  if (!ALLOWED_OFFER_STATUSES.includes(rawStatus)) {
    const error = new Error("Offer status is invalid.");
    error.statusCode = 400;
    error.expose = true;
    throw error;
  }
  const status = rawStatus;

  const amount =
    values.amount === null ||
    values.amount === undefined ||
    values.amount === ""
      ? null
      : Number(values.amount);

  if (amount !== null && (!Number.isFinite(amount) || amount < 0)) {
    const error = new Error("Offer amount must be a non-negative number.");
    error.statusCode = 400;
    error.expose = true;
    throw error;
  }

  const currency =
    typeof values.currency === "string" && values.currency.trim()
      ? values.currency.trim().toUpperCase()
      : null;
  if (currency && !/^[A-Z]{3}$/.test(currency)) {
    const error = new Error("Offer currency must be a three-letter code.");
    error.statusCode = 400;
    error.expose = true;
    throw error;
  }

  const optionalUuid = (value, name) => {
    if (value === undefined || value === null || value === "") return null;
    if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
      const error = new Error(`${name} must be a valid UUID.`);
      error.statusCode = 400;
      error.expose = true;
      throw error;
    }
    return value;
  };

  return {
    title,
    amount,
    currency,
    status,
    project_id: optionalUuid(values.project_id ?? values.projectId, "Project"),
    crm_contact_id: optionalUuid(values.crm_contact_id ?? values.crmContactId, "CRM contact"),
    system_id: optionalUuid(values.system_id ?? values.systemId, "System"),
    product_id: optionalUuid(values.product_id ?? values.productId, "Product"),
    material_analysis_id: optionalUuid(
      values.material_analysis_id ?? values.materialAnalysisId,
      "Material analysis"
    ),
  };
};

export const canTransitionOfferStatus = (from, to) =>
  from === to || Boolean(STATUS_TRANSITIONS[from]?.includes(to));

const buildOfferSnapshot = async (supabase, payload) => {
  let material = null;
  if (payload.material_analysis_id) {
    const { data, error } = await supabase
      .from("material_analysis")
      .select("id, project_id, system_id, product_id, name, quantity, unit, unit_price, total_cost, currency, source, verification_status")
      .eq("id", payload.material_analysis_id)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw Object.assign(new Error("Material analysis record not found."), {
      statusCode: 404,
      expose: true,
    });
    if (data.project_id && payload.project_id && data.project_id !== payload.project_id) {
      throw Object.assign(new Error("Material analysis does not belong to the selected project."), {
        statusCode: 400,
        expose: true,
      });
    }
    material = data;
  }
  return {
    title: payload.title,
    amount: payload.amount,
    currency: payload.currency,
    project_id: payload.project_id,
    crm_contact_id: payload.crm_contact_id,
    system_id: payload.system_id,
    product_id: payload.product_id,
    material_analysis_id: payload.material_analysis_id,
    material,
    captured_at: new Date().toISOString(),
  };
};
// ============================================================
// GET OFFERS
// ============================================================
// Read all offers from the "offers" table
// Ordered by created_at descending
// ============================================================

export const getOffers = async (req, res, next) => {
  try {
    // Check if Supabase is available
    const supabase = getIntegrationAdmin();
    if (!supabase) {
      return res.status(503).json({
        status: "error",
        message: "Database service-role configuration is required",
      });
    }

    // Fetch all offers ordered by created_at descending
    const { data, error } = await supabase
      .from("offers")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching offers:", error.message);
      return next(error);
    }

    res.status(200).json({
      status: "success",
      data: data || [],
    });
  } catch (error) {
    console.error("Unexpected error in getOffers:", error.message);
    next(error);
  }
};

// ============================================================
// GET OFFER BY ID
// ============================================================
// Read one offer using its UUID id
// Returns HTTP 404 if not found
// ============================================================

export const getOfferById = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if Supabase is available
    const supabase = getIntegrationAdmin();
    if (!supabase) {
      return res.status(503).json({
        status: "error",
        message: "Database service-role configuration is required",
      });
    }

    // Fetch offer by id
    const { data, error } = await supabase
      .from("offers")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      // Handle "no rows returned" error
      if (error.code === "PGRST116") {
        return res.status(404).json({
          status: "error",
          message: "Offer not found",
        });
      }

      console.error("Error fetching offer:", error.message);
      return next(error);
    }

    res.status(200).json({
      status: "success",
      data,
    });
  } catch (error) {
    console.error("Unexpected error in getOfferById:", error.message);
    next(error);
  }
};

// ============================================================
// CREATE OFFER
// ============================================================

export const createOffer = async (req, res, next) => {
  try {
    const supabase = getIntegrationAdmin();
    if (!supabase) {
      return res.status(503).json({
        status: "error",
        message: "Database service-role configuration is required",
      });
    }

    const payload = getOfferPayload(req.body);
    if (payload.status !== "Hazırlanıyor") {
      return res.status(400).json({
        status: "error",
        message: "New offers must start in the Hazırlanıyor status.",
      });
    }
    payload.offer_snapshot = await buildOfferSnapshot(supabase, payload);

    const { data, error } = await supabase
      .from("offers")
      .insert(payload)
      .select("*")
      .single();

    if (error) {
      console.error("Error creating offer:", error.message);
      return next(error);
    }

    res.status(201).json({
      status: "success",
      data,
    });
  } catch (error) {
    console.error("Unexpected error in createOffer:", error.message);
    next(error);
  }
};

export const updateOffer = async (req, res, next) => {
  try {
    const supabase = getIntegrationAdmin();
    if (!supabase) {
      return res.status(503).json({
        status: "error",
        message: "Database service-role configuration is required",
      });
    }
    if (!UUID_PATTERN.test(req.params.id)) {
      return res.status(400).json({ status: "error", message: "Offer id must be a valid UUID." });
    }
    const { data: existing, error: lookupError } = await supabase
      .from("offers")
      .select("*")
      .eq("id", req.params.id)
      .maybeSingle();
    if (lookupError) return next(lookupError);
    if (!existing) return res.status(404).json({ status: "error", message: "Offer not found." });

    const payload = getOfferPayload(req.body, existing);
    if (!canTransitionOfferStatus(existing.status, payload.status)) {
      return res.status(409).json({ status: "error", message: "Offer status transition is not allowed." });
    }
    const snapshotFields = [
      "title", "amount", "currency", "project_id", "crm_contact_id",
      "system_id", "product_id", "material_analysis_id",
    ];
    const snapshotChanged = snapshotFields.some((field) => payload[field] !== existing[field]);
    payload.offer_snapshot = snapshotChanged || !existing.offer_snapshot
      ? await buildOfferSnapshot(supabase, payload)
      : existing.offer_snapshot;

    const { data, error } = await supabase
      .from("offers")
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq("id", req.params.id)
      .select("*")
      .single();
    if (error) return next(error);
    return res.status(200).json({ status: "success", data });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ status: "error", message: error.message });
    }
    return next(error);
  }
};

// ============================================================
// DELETE OFFER
// ============================================================

export const deleteOffer = async (req, res, next) => {
  try {
    const { id } = req.params;

    const supabase = getIntegrationAdmin();
    if (!supabase) {
      return res.status(503).json({
        status: "error",
        message: "Database service-role configuration is required",
      });
    }

    const { data: existingOffer, error: lookupError } = await supabase
      .from("offers")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (lookupError) {
      console.error("Error looking up offer:", lookupError.message);
      return next(lookupError);
    }

    if (!existingOffer) {
      return res.status(404).json({
        status: "error",
        message: "Offer not found",
      });
    }

    const { error } = await supabase
      .from("offers")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting offer:", error.message);
      return next(error);
    }

    res.status(200).json({
      status: "success",
      data: existingOffer,
    });
  } catch (error) {
    console.error("Unexpected error in deleteOffer:", error.message);
    next(error);
  }
};
