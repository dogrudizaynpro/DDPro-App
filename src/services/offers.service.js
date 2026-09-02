// ============================================================
// OFFERS SERVICE
// ============================================================
// Offers module API service layer
// Read-only operations for fetching offers data
// ============================================================

import { fetchAPI } from "./api.js";

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

const toStatusLabel = (value) => {
  if (!value) {
    return "Hazırlanıyor";
  }

  const normalizedValue = String(value).trim();
  const lookupKey = normalizedValue.toLowerCase();

  return STATUS_LABELS[lookupKey] || normalizedValue;
};

const formatOfferAmount = (amount, currency) => {
  if (amount === null || amount === undefined || amount === "") {
    return "Tutar belirtilmedi";
  }

  const numericAmount =
    typeof amount === "number"
      ? amount
      : Number(String(amount).replace(",", "."));

  if (Number.isFinite(numericAmount)) {
    if (currency) {
      try {
        return new Intl.NumberFormat("tr-TR", {
          style: "currency",
          currency,
          maximumFractionDigits: 2,
        }).format(numericAmount);
      } catch {
        return `${numericAmount.toLocaleString("tr-TR")} ${currency}`;
      }
    }

    return numericAmount.toLocaleString("tr-TR");
  }

  return [amount, currency].filter(Boolean).join(" ");
};

const formatOfferDate = (value) => {
  if (!value) {
    return "Tarih belirtilmedi";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("tr-TR", {
    dateStyle: "short",
    timeStyle: "short",
  });
};

export const mapOfferToViewModel = (offer = {}) => {
  const title = offer.title || offer.name || "Adsız teklif";
  const amountValue =
    offer.amount ?? offer.amountValue ?? offer.totalAmount ?? "";
  const currency = offer.currency || offer.currencyCode || "";
  const createdAt = offer.created_at || offer.createdAt || offer.date || null;
  const updatedAt = offer.updated_at || offer.updatedAt || null;
  const source =
    offer.source ||
    (offer.created_at ||
    offer.createdAt ||
    offer.updated_at ||
    offer.updatedAt
      ? "api"
      : "local");
  const statusRaw = offer.status || (source === "local" ? "Hazırlanıyor" : "");

  return {
    id: offer.id,
    title,
    name: title,
    amount: amountValue,
    amountValue,
    amountDisplay:
      offer.amountDisplay || formatOfferAmount(amountValue, currency),
    currency,
    status: toStatusLabel(statusRaw),
    statusRaw,
    date:
      offer.date && !createdAt ? offer.date : formatOfferDate(createdAt),
    createdAt,
    updatedAt,
    projectId: offer.project_id || offer.projectId || null,
    notes: offer.notes || "",
    source,
    raw: offer,
  };
};

export const mapOffersToViewModel = (offers = []) =>
  offers
    .filter(Boolean)
    .map((offer) => mapOfferToViewModel(offer));

// ============================================================
// GET ALL OFFERS
// ============================================================
// Fetch all offers from the backend
// Returns array of offers ordered by created_at descending

export const getOffers = async () => {
  try {
    const data = await fetchAPI("/api/offers");
    return mapOffersToViewModel(data.data || []);
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
    return data.data ? mapOfferToViewModel(data.data) : null;
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
