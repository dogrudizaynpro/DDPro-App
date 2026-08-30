// ============================================================
// RESEARCH SERVICE
// ============================================================
// Research module API service layer
// Read-only operations for fetching research items data
// ============================================================

import { fetchAPI } from "./api.js";

// ============================================================
// GET ALL RESEARCH ITEMS
// ============================================================
// Fetch all research items from the backend
// Returns array of research items ordered by created_at descending

export const getResearchItems = async () => {
  try {
    const data = await fetchAPI("/api/research");
    return data.data || [];
  } catch (error) {
    console.error("Failed to fetch research items:", error.message);
    throw error;
  }
};

// ============================================================
// GET RESEARCH ITEM BY ID
// ============================================================
// Fetch a single research item by its UUID id
// Returns the research item object or null if not found

export const getResearchItemById = async (id) => {
  if (!id) {
    throw new Error("Research item ID is required");
  }

  try {
    const data = await fetchAPI(`/api/research/${id}`);
    return data.data || null;
  } catch (error) {
    // Handle 404 errors gracefully
    if (error.status === 404) {
      console.warn(`Research item not found: ${id}`);
      return null;
    }
    console.error("Failed to fetch research item:", error.message);
    throw error;
  }
};
