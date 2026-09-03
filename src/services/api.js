// ============================================================
// API CONFIGURATION
// ============================================================
// Centralized backend API configuration and utilities
// ============================================================

const DEFAULT_LOCAL_API_URL = "http://localhost:3001";

const trimTrailingSlash = (value = "") => value.replace(/\/+$/, "");

const isLocalHost = (hostname = "") =>
  ["localhost", "127.0.0.1", "::1"].includes(hostname);

const getHostname = () =>
  typeof window !== "undefined" ? window.location.hostname : "";

const getEnvApiUrl = () =>
  trimTrailingSlash(String(import.meta.env.VITE_API_URL || "").trim());

const resolveRuntimeDataLayer = () => {
  const hostname = getHostname();
  const envUrl = getEnvApiUrl();
  const isLocalRuntime = isLocalHost(hostname);
  const isInvalidProductionLocalhostUrl =
    !!envUrl &&
    !isLocalRuntime &&
    /localhost|127\.0\.0\.1|::1/i.test(envUrl);

  if (envUrl && !isInvalidProductionLocalhostUrl) {
    return {
      mode: "api",
      label: "Canlı API",
      apiBaseUrl: envUrl,
      message: "Canlı API veri akışı aktif.",
    };
  }

  if (isLocalRuntime) {
    return {
      mode: "api",
      label: "Yerel API",
      apiBaseUrl: DEFAULT_LOCAL_API_URL,
      message: "Yerel geliştirme API bağlantısı aktif.",
    };
  }

  return {
    mode: "persistent-local",
    label: "Kalıcı Yerel Veri",
    apiBaseUrl: "",
    message: isInvalidProductionLocalhostUrl
      ? "Production ortamında localhost API adresi geçersiz olduğu için kalıcı yerel veri katmanı kullanılıyor."
      : "Static production ortamında canlı backend tanımlı olmadığı için kalıcı yerel veri katmanı kullanılıyor.",
  };
};

const RUNTIME_DATA_LAYER = resolveRuntimeDataLayer();
const API_BASE_URL = RUNTIME_DATA_LAYER.apiBaseUrl;

const API_CONFIGURATION_ERROR =
  RUNTIME_DATA_LAYER.mode === "api"
    ? ""
    : "Bu oturumda uzak API kullanılmıyor.";

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
    const normalizedEndpoint = endpoint.startsWith("/")
      ? endpoint
      : `/${endpoint}`;
    const url = `${API_BASE_URL}${normalizedEndpoint}`;

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

export const getRuntimeDataLayer = () => RUNTIME_DATA_LAYER;

export { API_BASE_URL };
