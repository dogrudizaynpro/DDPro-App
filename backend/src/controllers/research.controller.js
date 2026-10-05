// ============================================================
// RESEARCH CONTROLLER
// ============================================================
// Business logic and database interactions for research_items domain
// ============================================================

import { getIntegrationAdmin } from "../config/integration-admin.js";
import { searchResearchProvider } from "../services/research-provider.service.js";

const DEFAULT_RESEARCH_STATUS = "Aktif";
const RESEARCH_API_URL = process.env.RESEARCH_API_URL;
const RESEARCH_API_KEY = process.env.RESEARCH_API_KEY;

export const getResearchProviderStatus = (_req, res) => {
  res.status(200).json({
    status: "success",
    data: {
      configured: Boolean(RESEARCH_API_URL && RESEARCH_API_KEY),
      provider: (() => {
        try {
          return RESEARCH_API_URL ? new URL(RESEARCH_API_URL).hostname : null;
        } catch {
          return null;
        }
      })(),
    },
  });
};

export const createResearchSearch = async (req, res, next) => {
  const query = typeof req.body?.query === "string" ? req.body.query.trim() : "";
  if (!query || query.length > 500) {
    return res.status(400).json({
      status: "error",
      message: "Research query is required and must be at most 500 characters.",
    });
  }

  try {
    const results = await searchResearchProvider(query);
    return res.status(200).json({ status: "success", data: results });
  } catch (error) {
    return next(error);
  }
};

export const getResearchPayload = (body = {}, existing = {}) => {
  const values = { ...existing, ...body };
  const title =
    typeof values.title === "string"
      ? values.title.trim()
      : typeof values.name === "string"
        ? values.name.trim()
        : "";

  if (!title || title.length > 200) {
    const error = new Error("Research item title is required and must be at most 200 characters.");
    error.statusCode = 400;
    error.expose = true;
    throw error;
  }

  const description =
    typeof values.description === "string" && values.description.trim()
      ? values.description.trim()
      : typeof values.note === "string" && values.note.trim()
        ? values.note.trim()
        : typeof values.notes === "string" && values.notes.trim()
          ? values.notes.trim()
          : null;

  const status =
    typeof values.status === "string" && values.status.trim()
      ? values.status.trim()
      : DEFAULT_RESEARCH_STATUS;
  const procurementStatus = values.procurement_status || values.procurementStatus || "RESEARCH";
  if (!["RESEARCH", "QUOTE_RECEIVED", "ORDERED", "RECEIVED", "CANCELLED"].includes(procurementStatus)) {
    const error = new Error("Procurement status is invalid.");
    error.statusCode = 400;
    error.expose = true;
    throw error;
  }
  const url =
    typeof values.url === "string" && values.url.trim()
      ? values.url.trim()
      : null;

  if (url && !/^https?:\/\/\S+$/i.test(url)) {
    const error = new Error("Research source URL must use HTTP or HTTPS.");
    error.statusCode = 400;
    error.expose = true;
    throw error;
  }
  const priceVerification = values.price_verification ?? values.priceVerification ?? "Doğrulanmadı";
  if (!["Doğrulanmadı", "Kullanıcı kaynağı kontrol etti"].includes(priceVerification)) {
    const error = new Error("Price verification status is invalid.");
    error.statusCode = 400;
    error.expose = true;
    throw error;
  }
  if (
    priceVerification === "Kullanıcı kaynağı kontrol etti" &&
    (!values.price || !url)
  ) {
    const error = new Error("A user-verified research price requires a source price and URL.");
    error.statusCode = 400;
    error.expose = true;
    throw error;
  }
  const uuid = (value, label) => {
    if (value === undefined || value === null || value === "") return null;
    if (typeof value !== "string" || !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(value)) {
      const error = new Error(`${label} must be a valid UUID.`);
      error.statusCode = 400;
      error.expose = true;
      throw error;
    }
    return value;
  };

  return {
    title,
    description,
    status,
    source: typeof values.source === "string" ? values.source.trim() || null : null,
    supplier: typeof values.supplier === "string" ? values.supplier.trim() || null : null,
    product: typeof values.product === "string" ? values.product.trim() || null : null,
    manufacturer:
      typeof values.manufacturer === "string"
        ? values.manufacturer.trim() || null
        : null,
    technical_info:
      typeof values.technical_info === "string" || typeof values.technicalInfo === "string"
        ? String(values.technical_info ?? values.technicalInfo).trim() || null
        : null,
    price: typeof values.price === "string" ? values.price.trim() || null : null,
    price_verification: priceVerification,
    url,
    project_id: uuid(values.project_id ?? values.projectId, "Project"),
    product_id: uuid(values.product_id ?? values.productId, "Product"),
    system_id: uuid(values.system_id ?? values.systemId, "System"),
    procurement_status: procurementStatus,
  };
};

// ============================================================
// GET RESEARCH ITEMS
// ============================================================
// Read all research_items from the "research_items" table
// Ordered by created_at descending
// ============================================================

export const getResearchItems = async (req, res, next) => {
  try {
    // Check if Supabase is available
    const supabase = getIntegrationAdmin();
    if (!supabase) {
      return res.status(503).json({
        status: "error",
        message: "Database service-role configuration is required",
      });
    }

    // Fetch all research_items ordered by created_at descending
    const { data, error } = await supabase
      .from("research_items")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching research items:", error.message);
      return next(error);
    }

    res.status(200).json({
      status: "success",
      data: data || [],
    });
  } catch (error) {
    console.error("Unexpected error in getResearchItems:", error.message);
    next(error);
  }
};

// ============================================================
// GET RESEARCH ITEM BY ID
// ============================================================
// Read one research_item using its UUID id
// Returns HTTP 404 if not found
// ============================================================

export const getResearchItemById = async (req, res, next) => {
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

    // Fetch research_item by id
    const { data, error } = await supabase
      .from("research_items")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      // Handle "no rows returned" error
      if (error.code === "PGRST116") {
        return res.status(404).json({
          status: "error",
          message: "Research item not found",
        });
      }

      console.error("Error fetching research item:", error.message);
      return next(error);
    }

    res.status(200).json({
      status: "success",
      data,
    });
  } catch (error) {
    console.error("Unexpected error in getResearchItemById:", error.message);
    next(error);
  }
};

// ============================================================
// CREATE RESEARCH ITEM
// ============================================================

export const createResearchItem = async (req, res, next) => {
  try {
    const supabase = getIntegrationAdmin();
    if (!supabase) {
      return res.status(503).json({
        status: "error",
        message: "Database service-role configuration is required",
      });
    }

    const payload = getResearchPayload(req.body);

    const { data, error } = await supabase
      .from("research_items")
      .insert(payload)
      .select("*")
      .single();

    if (error) {
      console.error("Error creating research item:", error.message);
      return next(error);
    }

    res.status(201).json({
      status: "success",
      data,
    });
  } catch (error) {
    console.error("Unexpected error in createResearchItem:", error.message);
    next(error);
  }
};

export const updateResearchItem = async (req, res, next) => {
  try {
    if (!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(req.params.id)) {
      return res.status(400).json({ status: "error", message: "Research item id must be a valid UUID." });
    }
    const supabase = getIntegrationAdmin();
    if (!supabase) {
      return res.status(503).json({ status: "error", message: "Database service-role configuration is required" });
    }
    const { data: existing, error: lookupError } = await supabase
      .from("research_items")
      .select("*")
      .eq("id", req.params.id)
      .maybeSingle();
    if (lookupError) return next(lookupError);
    if (!existing) return res.status(404).json({ status: "error", message: "Research item not found." });

    const payload = getResearchPayload(req.body, existing);
    const { data, error } = await supabase
      .from("research_items")
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq("id", req.params.id)
      .select("*")
      .single();
    if (error) return next(error);
    return res.status(200).json({ status: "success", data });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ status: "error", message: error.message });
    return next(error);
  }
};

// ============================================================
// DELETE RESEARCH ITEM
// ============================================================

export const deleteResearchItem = async (req, res, next) => {
  try {
    const { id } = req.params;

    const supabase = getIntegrationAdmin();
    if (!supabase) {
      return res.status(503).json({
        status: "error",
        message: "Database service-role configuration is required",
      });
    }

    const { data: existingResearchItem, error: lookupError } = await supabase
      .from("research_items")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (lookupError) {
      console.error("Error looking up research item:", lookupError.message);
      return next(lookupError);
    }

    if (!existingResearchItem) {
      return res.status(404).json({
        status: "error",
        message: "Research item not found",
      });
    }

    const { error } = await supabase
      .from("research_items")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting research item:", error.message);
      return next(error);
    }

    res.status(200).json({
      status: "success",
      data: existingResearchItem,
    });
  } catch (error) {
    console.error("Unexpected error in deleteResearchItem:", error.message);
    next(error);
  }
};
