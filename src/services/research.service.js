// ============================================================
// RESEARCH SERVICE
// ============================================================
// Research module API service layer
// Read-only operations for fetching research items data
// ============================================================

import { fetchAPI } from "./api.js";

const formatResearchDate = (value) => {
  if (!value) {
    return "Tarih belirtilmedi";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString("tr-TR", {
    dateStyle: "short",
    timeStyle: "short",
  });
};

export const mapResearchItemToViewModel = (item = {}) => {
  const name =
    typeof item.name === "string" && item.name.trim()
      ? item.name.trim()
      : typeof item.title === "string" && item.title.trim()
        ? item.title.trim()
        : "Adsız araştırma";
  const note =
    typeof item.note === "string" && item.note.trim()
      ? item.note.trim()
      : typeof item.notes === "string" && item.notes.trim()
        ? item.notes.trim()
        : typeof item.description === "string" && item.description.trim()
          ? item.description.trim()
          : "Not eklenmedi.";
  const createdAt = item.created_at || item.createdAt || item.date;
  const updatedAt = item.updated_at || item.updatedAt || null;

  return {
    id: item.id,
    name,
    note,
    status: item.status || "",
    date: formatResearchDate(createdAt),
    createdAt,
    updatedAt,
    source: "api",
    raw: item,
  };
};

export const mapResearchItemsToViewModel = (items = []) =>
  items.filter(Boolean).map((item) => mapResearchItemToViewModel(item));

// ============================================================
// GET ALL RESEARCH ITEMS
// ============================================================
// Fetch all research items from the backend
// Returns array of research items ordered by created_at descending

export const getResearchItems = async () => {
  try {
    const data = await fetchAPI("/api/research");
    return mapResearchItemsToViewModel(data.data || []);
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
    return data.data ? mapResearchItemToViewModel(data.data) : null;
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
