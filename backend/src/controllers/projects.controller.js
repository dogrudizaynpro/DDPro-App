// ============================================================
// PROJECTS CONTROLLER
// ============================================================
// Business logic and database interactions for projects domain
// ============================================================

import { getSupabaseClient, isSupabaseAvailable } from "../config/supabase.js";

// ============================================================
// GET PROJECTS
// ============================================================
// Read all projects from the "projects" table
// Ordered by created_at descending
// ============================================================

export const getProjects = async (req, res, next) => {
  try {
    // Check if Supabase is available
    if (!isSupabaseAvailable()) {
      return res.status(503).json({
        status: "error",
        message: "Database service is not configured",
      });
    }

    const supabase = getSupabaseClient();

    // Fetch all projects ordered by created_at descending
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching projects:", error.message);
      return next(error);
    }

    res.status(200).json({
      status: "success",
      data: data || [],
    });
  } catch (error) {
    console.error("Unexpected error in getProjects:", error.message);
    next(error);
  }
};

// ============================================================
// GET PROJECT BY ID
// ============================================================
// Read one project using its UUID id
// Returns HTTP 404 if not found
// ============================================================

export const getProjectById = async (req, res, next) => {
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

    // Fetch project by id
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      // Handle "no rows returned" error
      if (error.code === "PGRST116") {
        return res.status(404).json({
          status: "error",
          message: "Project not found",
        });
      }

      console.error("Error fetching project:", error.message);
      return next(error);
    }

    res.status(200).json({
      status: "success",
      data,
    });
  } catch (error) {
    console.error("Unexpected error in getProjectById:", error.message);
    next(error);
  }
};
