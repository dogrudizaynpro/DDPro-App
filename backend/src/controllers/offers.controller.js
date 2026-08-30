// ============================================================
// OFFERS CONTROLLER
// ============================================================
// Business logic and database interactions for offers domain
// ============================================================

import { getSupabaseClient, isSupabaseAvailable } from "../config/supabase.js";

// ============================================================
// GET OFFERS
// ============================================================
// Read all offers from the "offers" table
// Ordered by created_at descending
// ============================================================

export const getOffers = async (req, res, next) => {
  try {
    // Check if Supabase is available
    if (!isSupabaseAvailable()) {
      return res.status(503).json({
        status: "error",
        message: "Database service is not configured",
      });
    }

    const supabase = getSupabaseClient();

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
    if (!isSupabaseAvailable()) {
      return res.status(503).json({
        status: "error",
        message: "Database service is not configured",
      });
    }

    const supabase = getSupabaseClient();

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
