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
    source: item.source || "",
    recordSource: "api",
    product: item.product || "",
    manufacturer: item.manufacturer || "",
    technicalInfo: item.technical_info || item.technicalInfo || "",
    price: item.price ?? "",
    priceVerification:
      item.price_verification || item.priceVerification || "Doğrulanmadı",
    url: item.url || "",
    status: item.status || "",
    date: formatResearchDate(createdAt),
    createdAt,
    updatedAt,
    projectId: item.project_id || item.projectId || null,
    productId: item.product_id || item.productId || null,
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
    console.warn("Research API unavailable:", error.message);
    throw error;
  }
};

export const runResearchAgent = async (query) => {
  const data = await fetchAPI("/api/research/agent", {
    method: "POST",
    body: JSON.stringify({ query }),
  });
  return data.data || [];
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
    console.warn("Research item API unavailable:", error.message);
    throw error;
  }
};

const toResearchPayload = (item = {}) => {
  const title =
    typeof item?.name === "string" && item.name.trim()
      ? item.name.trim()
      : typeof item?.title === "string" && item.title.trim()
        ? item.title.trim()
        : "";

  if (!title) {
    throw new Error("Research item title is required");
  }

  return {
    title,
    description:
      typeof item?.note === "string" && item.note.trim()
        ? item.note.trim()
        : typeof item?.notes === "string" && item.notes.trim()
          ? item.notes.trim()
          : typeof item?.description === "string" && item.description.trim()
            ? item.description.trim()
            : "",
    status:
      typeof item?.status === "string" && item.status.trim()
        ? item.status.trim()
        : "Aktif",
    source: typeof item?.source === "string" ? item.source.trim() || null : null,
    product: typeof item?.product === "string" ? item.product.trim() || null : null,
    manufacturer:
      typeof item?.manufacturer === "string"
        ? item.manufacturer.trim() || null
        : null,
    technical_info:
      typeof item?.technicalInfo === "string"
        ? item.technicalInfo.trim() || null
        : null,
    price: typeof item?.price === "string" ? item.price.trim() || null : null,
    price_verification:
      typeof item?.priceVerification === "string"
        ? item.priceVerification.trim() || "Doğrulanmadı"
        : "Doğrulanmadı",
    url: typeof item?.url === "string" ? item.url.trim() || null : null,
    project_id: typeof item?.projectId === "string" ? item.projectId.trim() || null : null,
    product_id: typeof item?.productId === "string" ? item.productId.trim() || null : null,
  };
};

export const createResearchItem = async (item) => {
  const payload = toResearchPayload(item);

  try {
    const data = await fetchAPI("/api/research", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    return data.data ? mapResearchItemToViewModel(data.data) : null;
  } catch (error) {
    console.warn("Research creation API unavailable:", error.message);
    throw error;
  }
};

export const deleteResearchItem = async (id) => {
  if (!id) {
    throw new Error("Research item ID is required");
  }

  try {
    const data = await fetchAPI(`/api/research/${id}`, {
      method: "DELETE",
    });

    return data.data ? mapResearchItemToViewModel(data.data) : null;
  } catch (error) {
    console.warn("Research deletion API unavailable:", error.message);
    throw error;
  }
};
