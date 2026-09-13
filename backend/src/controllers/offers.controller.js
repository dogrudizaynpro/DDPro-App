// ============================================================
// OFFERS CONTROLLER
// ============================================================
// Business logic and database interactions for offers domain
// ============================================================

import { getSupabaseClient, isSupabaseAvailable } from "../config/supabase.js";
import { getOfferPayload, validateUuidParam } from "../utils/validation.js";

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
    const id = validateUuidParam(req.params.id, "Offer ID");

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

// ============================================================
// CREATE OFFER
// ============================================================

export const createOffer = async (req, res, next) => {
  try {
    if (!isSupabaseAvailable()) {
      return res.status(503).json({
        status: "error",
        message: "Database service is not configured",
      });
    }

    const supabase = getSupabaseClient();
    const payload = getOfferPayload(req.body);

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
    const id = validateUuidParam(req.params.id, "Offer ID");
    const payload = getOfferPayload(req.body);

    if (!isSupabaseAvailable()) {
      return res.status(503).json({
        status: "error",
        message: "Database service is not configured",
      });
    }

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("offers")
      .update({
        ...payload,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return res.status(404).json({
          status: "error",
          message: "Offer not found",
        });
      }

      console.error("Error updating offer:", error.message);
      return next(error);
    }

    res.status(200).json({
      status: "success",
      data,
    });
  } catch (error) {
    console.error("Unexpected error in updateOffer:", error.message);
    next(error);
  }
};

// ============================================================
// DELETE OFFER
// ============================================================

export const deleteOffer = async (req, res, next) => {
  try {
    const id = validateUuidParam(req.params.id, "Offer ID");

    if (!isSupabaseAvailable()) {
      return res.status(503).json({
        status: "error",
        message: "Database service is not configured",
      });
    }

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("offers")
      .delete()
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return res.status(404).json({
          status: "error",
          message: "Offer not found",
        });
      }

      console.error("Error deleting offer:", error.message);
      return next(error);
    }

    res.status(200).json({
      status: "success",
      data,
    });
  } catch (error) {
    console.error("Unexpected error in deleteOffer:", error.message);
    next(error);
  }
};
