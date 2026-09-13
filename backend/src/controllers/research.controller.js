// ============================================================
// RESEARCH CONTROLLER
// ============================================================
// Business logic and database interactions for research_items domain
// ============================================================

import { getSupabaseClient, isSupabaseAvailable } from "../config/supabase.js";

const DEFAULT_RESEARCH_STATUS = "Aktif";

const getResearchPayload = (body = {}) => {
  const title =
    typeof body.title === "string"
      ? body.title.trim()
      : typeof body.name === "string"
        ? body.name.trim()
        : "";

  if (!title) {
    const error = new Error("Research item title is required");
    error.statusCode = 400;
    throw error;
  }

  const description =
    typeof body.description === "string" && body.description.trim()
      ? body.description.trim()
      : typeof body.note === "string" && body.note.trim()
        ? body.note.trim()
        : typeof body.notes === "string" && body.notes.trim()
          ? body.notes.trim()
          : null;

  const status =
    typeof body.status === "string" && body.status.trim()
      ? body.status.trim()
      : DEFAULT_RESEARCH_STATUS;

  return {
    title,
    description,
    status,
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
    if (!isSupabaseAvailable()) {
      return res.status(503).json({
        status: "error",
        message: "Database service is not configured",
      });
    }

    const supabase = getSupabaseClient();

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
    if (!isSupabaseAvailable()) {
      return res.status(503).json({
        status: "error",
        message: "Database service is not configured",
      });
    }

    const supabase = getSupabaseClient();

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
    if (!isSupabaseAvailable()) {
      return res.status(503).json({
        status: "error",
        message: "Database service is not configured",
      });
    }

    const supabase = getSupabaseClient();
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

// ============================================================
// DELETE RESEARCH ITEM
// ============================================================

export const deleteResearchItem = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isSupabaseAvailable()) {
      return res.status(503).json({
        status: "error",
        message: "Database service is not configured",
      });
    }

    const supabase = getSupabaseClient();
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
