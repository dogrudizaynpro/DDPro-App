// ============================================================
// API CONFIGURATION
// ============================================================
// Centralized backend API configuration and utilities
// ============================================================

const normalizeBaseUrl = (value) => {
  if (!value || typeof value !== "string") {
    return "";
  }

  return value.trim().replace(/\/+$/, "");
};

const resolveApiBaseUrl = () => {
  const configuredUrl = normalizeBaseUrl(import.meta.env.VITE_API_URL);

  if (configuredUrl) {
    return configuredUrl;
  }

  const host =
    typeof window !== "undefined" ? window.location.hostname : "localhost";
  const isLocalHost =
    host === "localhost" || host === "127.0.0.1" || host === "::1";

  if (isLocalHost) {
    return "http://localhost:3001";
  }

  return "";
};

// API base URL - configurable for development/production
const API_BASE_URL = resolveApiBaseUrl();

// ============================================================
// FETCH WRAPPER
// ============================================================
// Generic fetch wrapper with error handling

export const fetchAPI = async (endpoint, options = {}) => {
  try {
    if (!API_BASE_URL) {
      throw new Error(
        "Production API URL is not configured. Set VITE_API_URL for deployment."
      );
    }

    const url = `${API_BASE_URL}${endpoint}`;

    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      ...options,
    });

    // Handle non-JSON responses
    const contentType = response.headers.get("content-type");
    let data;

    if (contentType && contentType.includes("application/json")) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    // Handle HTTP errors
    if (!response.ok) {
      const error = new Error(
        data.message || `HTTP Error: ${response.status}`
      );
      error.status = response.status;
      error.data = data;
      throw error;
    }

    return data;
  } catch (error) {
    // Re-throw with additional context
    console.error("API Error:", error.message);
    throw error;
  }
};

// ============================================================
// EXPORTS
// ============================================================

export { API_BASE_URL };
