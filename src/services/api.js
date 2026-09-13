// ============================================================
// API CONFIGURATION
// ============================================================
// Centralized backend API configuration and utilities
// ============================================================

const DEFAULT_LOCAL_API_URL = "http://localhost:3001";

const trimTrailingSlash = (value = "") => value.replace(/\/+$/, "");

const isLocalHost = (hostname = "") =>
  ["localhost", "127.0.0.1", "::1"].includes(hostname);

const isProductionEnvironment =
  typeof window !== "undefined" && !isLocalHost(window.location.hostname);

const resolveApiBaseUrl = () => {
  const envUrl = trimTrailingSlash(
    String(import.meta.env.VITE_API_URL || "").trim()
  );

  if (envUrl) {
    return envUrl;
  }

  if (!isProductionEnvironment) {
    return DEFAULT_LOCAL_API_URL;
  }

  return "";
};

const API_BASE_URL = resolveApiBaseUrl();

const API_CONFIGURATION_ERROR = (() => {
  if (!API_BASE_URL) {
    return "API adresi tanımlı değil. Production ortamında VITE_API_URL değişkenini yayınlanan backend adresiyle ayarlayın.";
  }

  if (
    typeof window !== "undefined" &&
    !isLocalHost(window.location.hostname) &&
    /localhost|127\.0\.0\.1|::1/i.test(API_BASE_URL)
  ) {
    return "API adresi localhost olarak ayarlı. GitHub Pages ortamında localhost API erişilemez; VITE_API_URL değerini canlı backend adresiyle güncelleyin.";
  }

  return "";
})();

const buildApiUrl = (endpoint) => {
  const normalizedEndpoint = endpoint.startsWith("/")
    ? endpoint
    : `/${endpoint}`;

  return `${API_BASE_URL}${normalizedEndpoint}`;
};

const parseResponseBody = async (response) => {
  const contentType = response.headers.get("content-type");

  if (contentType && contentType.includes("application/json")) {
    return response.json();
  }

  return response.text();
};

// ============================================================
// FETCH WRAPPER
// ============================================================
// Generic fetch wrapper with error handling

export const fetchAPI = async (endpoint, options = {}) => {
  if (API_CONFIGURATION_ERROR) {
    const error = new Error(API_CONFIGURATION_ERROR);
    error.code = "API_CONFIGURATION_ERROR";
    throw error;
  }

  try {
    const url = buildApiUrl(endpoint);

    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      ...options,
    });
    const data = await parseResponseBody(response);

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

export const getApiHealth = async () => {
  if (API_CONFIGURATION_ERROR) {
    return {
      status: "error",
      message: API_CONFIGURATION_ERROR,
    };
  }

  try {
    const response = await fetch(buildApiUrl("/health"), {
      headers: {
        "Content-Type": "application/json",
      },
    });
    const data = await parseResponseBody(response);

    return {
      httpStatus: response.status,
      ...data,
    };
  } catch (error) {
    console.error("API Health Error:", error.message);
    throw error;
  }
};

// ============================================================
// EXPORTS
// ============================================================

export { API_BASE_URL, isProductionEnvironment };
