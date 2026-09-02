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
  const projectId = item.project_id || item.projectId || null;
  const product =
    typeof item.product === "string" && item.product.trim()
      ? item.product.trim()
      : "";
  const material =
    typeof item.material === "string" && item.material.trim()
      ? item.material.trim()
      : "";
  const supplier =
    typeof item.supplier === "string" && item.supplier.trim()
      ? item.supplier.trim()
      : "";
  const price =
    typeof item.price === "string" && item.price.trim()
      ? item.price.trim()
      : "";

  const source =
    item.source ||
    (item.created_at || item.updated_at ? "api" : "local");

  return {
    id: item.id,
    name,
    note,
    status: item.status || "",
    date: formatResearchDate(createdAt),
    createdAt,
    updatedAt,
    projectId,
    product,
    material,
    supplier,
    price,
    source,
    raw: item,
  };
};

export const mapResearchItemsToViewModel = (items = []) =>
  items.filter(Boolean).map((item) => mapResearchItemToViewModel(item));

const toResearchPayload = (item = {}) => {
  const name =
    typeof item?.name === "string" && item.name.trim()
      ? item.name.trim()
      : typeof item?.title === "string" && item.title.trim()
        ? item.title.trim()
        : "";

  if (!name) {
    throw new Error("Research name is required");
  }

  return {
    name,
    note:
      typeof item?.note === "string" && item.note.trim()
        ? item.note.trim()
        : "Not eklenmedi.",
    project_id:
      typeof item?.projectId === "string" && item.projectId.trim()
        ? item.projectId.trim()
        : null,
    product:
      typeof item?.product === "string" && item.product.trim()
        ? item.product.trim()
        : null,
    material:
      typeof item?.material === "string" && item.material.trim()
        ? item.material.trim()
        : null,
    supplier:
      typeof item?.supplier === "string" && item.supplier.trim()
        ? item.supplier.trim()
        : null,
    price:
      typeof item?.price === "string" && item.price.trim()
        ? item.price.trim()
        : null,
  };
};

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

// ============================================================
// CREATE RESEARCH ITEM
// ============================================================

export const createResearchItem = async (item) => {
  const payload = toResearchPayload(item);

  try {
    const data = await fetchAPI("/api/research", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    return data.data ? mapResearchItemToViewModel(data.data) : null;
  } catch (error) {
    console.error("Failed to create research item:", error.message);
    throw error;
  }
};

// ============================================================
// DELETE RESEARCH ITEM
// ============================================================

export const deleteResearchItemById = async (id) => {
  if (!id) {
    throw new Error("Research item ID is required");
  }

  try {
    const data = await fetchAPI(`/api/research/${id}`, {
      method: "DELETE",
    });

    return data.data ? mapResearchItemToViewModel(data.data) : null;
  } catch (error) {
    console.error("Failed to delete research item:", error.message);
    throw error;
  }
};
