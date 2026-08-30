// ============================================================
// PROJECTS SERVICE
// ============================================================
// Projects module API service layer
// Read-only operations for fetching projects data
// ============================================================

import { fetchAPI } from "./api.js";

// ============================================================
// GET ALL PROJECTS
// ============================================================
// Fetch all projects from the backend
// Returns array of projects ordered by created_at descending

export const getProjects = async () => {
  try {
    const data = await fetchAPI("/api/projects");
    return data.data || [];
  } catch (error) {
    console.error("Failed to fetch projects:", error.message);
    throw error;
  }
};

// ============================================================
// GET PROJECT BY ID
// ============================================================
// Fetch a single project by its UUID id
// Returns the project object or null if not found

export const getProjectById = async (id) => {
  if (!id) {
    throw new Error("Project ID is required");
  }

  try {
    const data = await fetchAPI(`/api/projects/${id}`);
    return data.data || null;
  } catch (error) {
    // Handle 404 errors gracefully
    if (error.status === 404) {
      console.warn(`Project not found: ${id}`);
      return null;
    }
    console.error("Failed to fetch project:", error.message);
    throw error;
  }
};
