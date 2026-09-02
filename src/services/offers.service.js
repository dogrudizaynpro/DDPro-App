// ============================================================
// OFFERS SERVICE
// ============================================================
// Offers module API service layer
// Read-only operations for fetching offers data
// ============================================================

import { fetchAPI } from "./api.js";

const DEFAULT_OFFER_STATUS = "Hazırlanıyor";

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

const toStatusLabel = (value) => {
  if (!value) {
    return DEFAULT_OFFER_STATUS;
  }

  const normalizedValue = String(value).trim();
  const lookupKey = normalizedValue.toLowerCase();

  return STATUS_LABELS[lookupKey] || normalizedValue;
};

const toAmountDisplay = (rawAmount, rawCurrency) => {
  if (rawAmount === undefined || rawAmount === null || rawAmount === "") {
    return "Tutar belirtilmedi";
  }

  const amountAsNumber = Number(rawAmount);
  const currency = String(rawCurrency || "").toUpperCase();

  if (Number.isNaN(amountAsNumber)) {
    return String(rawAmount);
  }

  if (currency) {
    try {
      return new Intl.NumberFormat("tr-TR", {
        style: "currency",
        currency,
        maximumFractionDigits: 2,
      }).format(amountAsNumber);
    } catch {
      const symbol = CURRENCY_SYMBOLS[currency] || currency;
      return `${symbol}${amountAsNumber.toLocaleString("tr-TR")}`;
    }
  }

  return amountAsNumber.toLocaleString("tr-TR");
};

const parseOfferAmount = (rawAmount) => {
  if (typeof rawAmount === "number" && Number.isFinite(rawAmount)) {
    return {
      amount: rawAmount,
      currency: null,
    };
  }

  if (typeof rawAmount !== "string") {
    return {
      amount: null,
      currency: null,
    };
  }

  const trimmedAmount = rawAmount.trim();

  if (!trimmedAmount) {
    return {
      amount: null,
      currency: null,
    };
  }

  let currency = null;

  if (/₺|TL|TRY/i.test(trimmedAmount)) {
    currency = "TRY";
  } else if (/€|EUR/i.test(trimmedAmount)) {
    currency = "EUR";
  } else if (/\$|USD/i.test(trimmedAmount)) {
    currency = "USD";
  } else if (/£|GBP/i.test(trimmedAmount)) {
    currency = "GBP";
  }

  const matchedNumber = trimmedAmount.match(/-?\d[\d.,]*/);

  if (!matchedNumber) {
    return {
      amount: null,
      currency,
    };
  }

  let normalizedAmount = matchedNumber[0];

  if (normalizedAmount.includes(".") && normalizedAmount.includes(",")) {
    normalizedAmount = normalizedAmount.replace(/\./g, "").replace(",", ".");
  } else if (normalizedAmount.includes(".")) {
    const dotGroups = normalizedAmount.split(".");

    if (
      dotGroups.length > 1 &&
      dotGroups.slice(1).every((group) => group.length === 3)
    ) {
      normalizedAmount = normalizedAmount.replace(/\./g, "");
    }
  } else if (normalizedAmount.includes(",")) {
    normalizedAmount = normalizedAmount.replace(",", ".");
  }

  const amount = Number(normalizedAmount);

  return {
    amount: Number.isNaN(amount) ? null : amount,
    currency,
  };
};

const normalizeOffer = (offer) => {
  if (!offer || typeof offer !== "object") {
    return null;
  }

  const title =
    typeof offer.title === "string" && offer.title.trim()
      ? offer.title.trim()
      : typeof offer.name === "string" && offer.name.trim()
        ? offer.name.trim()
        : "Adsız Teklif";

  const createdAt = offer.created_at || offer.createdAt || offer.date || null;
  const updatedAt = offer.updated_at || offer.updatedAt || null;
  const amountValue =
    offer.amount ?? offer.totalAmount ?? offer.amountDisplay ?? null;
  const amountDisplay =
    typeof amountValue === "string" &&
    amountValue.trim() &&
    !offer.currency &&
    Number.isNaN(Number(amountValue))
      ? amountValue.trim()
      : toAmountDisplay(amountValue, offer.currency);
  const statusRaw = offer.status || DEFAULT_OFFER_STATUS;

  return {
    id: offer.id,
    title,
    name: title,
    amountDisplay,
    amount: amountDisplay,
    date: toDisplayDate(createdAt),
    createdAt,
    updatedAt,
    projectId: offer.project_id || offer.projectId || null,
    status: toStatusLabel(statusRaw),
    statusRaw: String(statusRaw),
    notes: offer.notes || "",
    source: offer.created_at ? "api" : offer.source || "local",
    raw: offer,
  };
};

const toOfferPayload = (offer) => {
  const title =
    typeof offer?.title === "string" && offer.title.trim()
      ? offer.title.trim()
      : typeof offer?.name === "string"
        ? offer.name.trim()
        : "";

  if (!title) {
    throw new Error("Offer name is required");
  }

  const amountSource =
    typeof offer?.amountDisplay === "string" && offer.amountDisplay.trim()
      ? offer.amountDisplay
      : offer?.amount;
  const { amount, currency } = parseOfferAmount(amountSource);

  return {
    title,
    amount,
    currency,
    status:
      typeof offer?.statusRaw === "string" && offer.statusRaw.trim()
        ? offer.statusRaw.trim()
        : typeof offer?.status === "string" && offer.status.trim()
          ? offer.status.trim()
          : DEFAULT_OFFER_STATUS,
    project_id:
      typeof offer?.projectId === "string" && offer.projectId.trim()
        ? offer.projectId.trim()
        : null,
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
    if (error.status === 404) {
      console.warn(`Offer not found: ${id}`);
      return null;
    }

    console.error("Failed to fetch offer:", error.message);
    throw error;
  }
};

// ============================================================
// CREATE OFFER
// ============================================================

export const createOffer = async (offer) => {
  const payload = toOfferPayload(offer);

  try {
    const data = await fetchAPI("/api/offers", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    return normalizeOffer(data.data);
  } catch (error) {
    console.error("Failed to create offer:", error.message);
    throw error;
  }
};

// ============================================================
// DELETE OFFER
// ============================================================

export const deleteOffer = async (id) => {
  if (!id) {
    throw new Error("Offer ID is required");
  }

  try {
    const data = await fetchAPI(`/api/offers/${id}`, {
      method: "DELETE",
    });

    return normalizeOffer(data.data);
  } catch (error) {
    console.error("Failed to delete offer:", error.message);
    throw error;
  }
};
