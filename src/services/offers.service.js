// ============================================================
// OFFERS SERVICE
// ============================================================
// Offers module API service layer
// Read-only operations for fetching offers data
// ============================================================

import { fetchAPI } from "./api.js";

const DEFAULT_OFFER_STATUS = "Hazırlanıyor";
const CURRENCY_SYMBOL_BY_CODE = {
  TRY: "₺",
  EUR: "€",
  USD: "$",
  GBP: "£",
};

const formatOfferDate = (value) => {
  if (!value) {
    return new Date().toLocaleString("tr-TR", {
      dateStyle: "short",
      timeStyle: "short",
    });
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

const formatOfferAmount = (amount, currency) => {
  if (amount === null || amount === undefined || amount === "") {
    return "Tutar belirtilmedi";
  }

  const numericAmount = Number(amount);

  if (Number.isNaN(numericAmount)) {
    return "Tutar belirtilmedi";
  }

  const normalizedCurrency =
    typeof currency === "string" ? currency.trim().toUpperCase() : "";

  if (normalizedCurrency) {
    try {
      return new Intl.NumberFormat("tr-TR", {
        style: "currency",
        currency: normalizedCurrency,
        maximumFractionDigits: 2,
      }).format(numericAmount);
    } catch {
      const symbol = CURRENCY_SYMBOL_BY_CODE[normalizedCurrency];

      if (symbol) {
        return `${symbol}${numericAmount.toLocaleString("tr-TR")}`;
      }
    }
  }

  return numericAmount.toLocaleString("tr-TR");
};

const parseOfferAmount = (amount) => {
  if (typeof amount === "number" && Number.isFinite(amount)) {
    return {
      amount,
      currency: null,
    };
  }

  if (typeof amount !== "string") {
    return {
      amount: null,
      currency: null,
    };
  }

  const trimmedAmount = amount.trim();

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

  const parsedAmount = Number(normalizedAmount);

  return {
    amount: Number.isNaN(parsedAmount) ? null : parsedAmount,
    currency,
  };
};

const normalizeOfferRecord = (offer) => {
  if (!offer || typeof offer !== "object") {
    return null;
  }

  return {
    id: offer.id,
    name:
      typeof offer.title === "string" && offer.title.trim()
        ? offer.title.trim()
        : typeof offer.name === "string" && offer.name.trim()
          ? offer.name.trim()
          : "İsimsiz teklif",
    amount:
      typeof offer.amount === "string" && offer.amount.trim() && !offer.currency
        ? offer.amount.trim()
        : formatOfferAmount(offer.amount, offer.currency),
    status:
      typeof offer.status === "string" && offer.status.trim()
        ? offer.status.trim()
        : DEFAULT_OFFER_STATUS,
    date: formatOfferDate(offer.created_at || offer.updated_at || offer.date),
  };
};

const toOfferPayload = (offer) => {
  const normalizedName =
    typeof offer?.name === "string" ? offer.name.trim() : "";

  if (!normalizedName) {
    throw new Error("Offer name is required");
  }

  const { amount, currency } = parseOfferAmount(offer.amount);

  return {
    title: normalizedName,
    amount,
    currency,
    status:
      typeof offer?.status === "string" && offer.status.trim()
        ? offer.status.trim()
        : DEFAULT_OFFER_STATUS,
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
    return Array.isArray(data.data)
      ? data.data.map(normalizeOfferRecord).filter(Boolean)
      : [];
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
    return normalizeOfferRecord(data.data);
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

    return normalizeOfferRecord(data.data);
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

    return normalizeOfferRecord(data.data);
  } catch (error) {
    console.error("Failed to delete offer:", error.message);
    throw error;
  }
};
