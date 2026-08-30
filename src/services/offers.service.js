// ============================================================
// OFFERS SERVICE
// ============================================================
// Offers module API service layer
// Read-only operations for fetching offers data
// ============================================================

import { fetchAPI } from "./api.js";

// ============================================================
// GET ALL OFFERS
// ============================================================
// Fetch all offers from the backend
// Returns array of offers ordered by created_at descending

export const getOffers = async () => {
  try {
    const data = await fetchAPI("/api/offers");
    return data.data || [];
  } catch (error) {
    console.error("Failed to fetch offers:", error.message);
    throw error;
  }
};

// ============================================================
// GET OFFER BY ID
// ============================================================
// Fetch a single offer by its UUID id
// Returns the offer object or null if not found

export const getOfferById = async (id) => {
  if (!id) {
    throw new Error("Offer ID is required");
  }

  try {
    const data = await fetchAPI(`/api/offers/${id}`);
    return data.data || null;
  } catch (error) {
    // Handle 404 errors gracefully
    if (error.status === 404) {
      console.warn(`Offer not found: ${id}`);
      return null;
    }
    console.error("Failed to fetch offer:", error.message);
    throw error;
  }
};
