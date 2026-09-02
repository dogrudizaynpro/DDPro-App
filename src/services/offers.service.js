// ============================================================
// OFFERS SERVICE
// ============================================================
// Offers module API service layer
// Read-only operations for fetching offers data
// ============================================================

import { fetchAPI } from "./api.js";

const CURRENCY_SYMBOLS = {
  TRY: "₺",
  EUR: "€",
  USD: "$",
  GBP: "£",
};

const STATUS_LABELS = {
  draft: "Hazırlanıyor",
  preparing: "Hazırlanıyor",
  pending: "Beklemede",
  sent: "Gönderildi",
  submitted: "Gönderildi",
  approved: "Onaylandı",
  accepted: "Onaylandı",
  rejected: "Reddedildi",
  cancelled: "İptal",
};

const toDisplayDate = (value) => {
  if (!value) return "Tarih belirtilmedi";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const toStatusLabel = (value) => {
  if (!value) return "Belirtilmedi";

  const normalizedValue = String(value).trim();
  const lookupKey = normalizedValue.toLowerCase();
  return STATUS_LABELS[lookupKey] || normalizedValue;
};

const toAmountDisplay = (rawAmount, rawCurrency) => {
  if (rawAmount === undefined || rawAmount === null || rawAmount === "") {
    return "Tutar belirtilmedi";
  }

  const amountAsNumber = Number(rawAmount);
  const currency = String(rawCurrency || "TRY").toUpperCase();

  if (Number.isNaN(amountAsNumber)) {
    return String(rawAmount);
  }

  const symbol = CURRENCY_SYMBOLS[currency] || currency;
  return `${amountAsNumber.toLocaleString("tr-TR")} ${symbol}`;
};

const normalizeOffer = (offer) => {
  if (!offer || typeof offer !== "object") return null;

  const title = offer.title || offer.name || "Adsız Teklif";
  const amountDisplay = toAmountDisplay(
    offer.amount ?? offer.totalAmount ?? offer.amountDisplay,
    offer.currency
  );
  const createdDate = offer.created_at || offer.createdAt || offer.date;
  const updatedDate = offer.updated_at || offer.updatedAt;
  const statusRaw = offer.status || "Belirtilmedi";

  return {
    id: offer.id,
    title,
    amountDisplay,
    date: toDisplayDate(createdDate),
    createdAt: createdDate || null,
    updatedAt: updatedDate || null,
    projectId: offer.project_id || offer.projectId || null,
    status: toStatusLabel(statusRaw),
    statusRaw: String(statusRaw),
    notes: offer.notes || "",
    source: offer.created_at ? "api" : "local",
    raw: offer,
  };
};

// ============================================================
// GET ALL OFFERS
// ============================================================
// Fetch all offers from the backend
// Returns array of offers ordered by created_at descending

export const getOffers = async () => {
  try {
    const data = await fetchAPI("/api/offers");
    const offers = Array.isArray(data?.data) ? data.data : [];
    return offers.map(normalizeOffer).filter(Boolean);
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
    return normalizeOffer(data.data);
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
