// ============================================================
// RESEARCH CONTROLLER
// ============================================================
// Business logic and database interactions for research_items domain
// ============================================================

import { getSupabaseClient, isSupabaseAvailable } from "../config/supabase.js";

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
