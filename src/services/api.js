// ============================================================
// API CONFIGURATION
// ============================================================
// Centralized backend API configuration and utilities
// ============================================================

import { completeGoogleConnection } from "./operations-integrations.service.js";

const DEFAULT_LOCAL_API_URL = "http://localhost:3001";
const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;

const trimTrailingSlash = (value = "") => value.replace(/\/+$/, "");

const isLocalHost = (hostname = "") =>
  ["localhost", "127.0.0.1", "::1"].includes(hostname);

const getRuntimeHostname = () =>
  typeof window !== "undefined" ? window.location.hostname : "";

const IS_PRODUCTION_RUNTIME = !isLocalHost(getRuntimeHostname());
const CAN_USE_LOCAL_FALLBACK = !IS_PRODUCTION_RUNTIME;

const resolveApiBaseUrl = () => {
  const envUrl = trimTrailingSlash(
    String(import.meta.env?.VITE_API_URL || "").trim()
  );

  if (envUrl) {
    return envUrl;
  }

  if (
    typeof window !== "undefined" &&
    isLocalHost(window.location.hostname)
  ) {
    return DEFAULT_LOCAL_API_URL;
  }

  return "";
};

const API_BASE_URL = resolveApiBaseUrl();
const SESSION_KEY = "ddpro_browser_session";
let pendingSessionRestore;
let sessionRestoreError;
export const clearBrowserSession = () => {
  sessionStorage.removeItem(SESSION_KEY);
  sessionRestoreError = undefined;
};
export const setBrowserSession = (session) => {
  if (typeof session !== "string" || !session.trim()) {
    throw new Error("Google OAuth tarayıcı oturumu alınamadı; tekrar bağlanın.");
  }
  sessionStorage.setItem(SESSION_KEY, session);
  sessionRestoreError = undefined;
};

export const restoreBrowserSession = () => {
  if (pendingSessionRestore) return pendingSessionRestore;
  const pending = fetchAPI("/api/integrations/google/restore", {
    method: "POST",
    body: JSON.stringify({}),
  }).then((response) => {
    setBrowserSession(response.data?.session);
  }).catch((error) => {
    if (error.status === 401) sessionRestoreError = error;
    throw error;
  });
  pendingSessionRestore = pending;
  pending.finally(() => {
    if (pendingSessionRestore === pending) pendingSessionRestore = undefined;
  }).catch(() => {});
  return pending;
};

const requiresBrowserSession = (endpoint) => {
  if (endpoint === "/api/integrations/status") return false;
  const providerTest = endpoint.match(/^\/api\/integrations\/test\/([^/?]+)$/);
  return !providerTest || ["gmail", "googleCalendar", "crm"].includes(providerTest[1]);
};

const prepareBrowserSession = async (endpoint) => {
  try {
    await completeGoogleConnection();
  } catch (error) {
    if (![400, 401].includes(error.status)) throw error;
  }
  if (!requiresBrowserSession(endpoint) && endpoint !== "/api/integrations/status") return;
  const session = sessionStorage.getItem(SESSION_KEY);
  if (session) {
    let expired = false;
    try {
      const encoded = session.split(".")[0].replaceAll("-", "+").replaceAll("_", "/");
      const payload = JSON.parse(atob(encoded));
      expired = !Number.isFinite(payload.expiresAt) || payload.expiresAt <= Date.now();
    } catch {
      // The backend remains authoritative for unrecognized/legacy session formats.
    }
    if (!expired) return;
    clearBrowserSession();
  }
  try {
    if (sessionRestoreError) throw sessionRestoreError;
    await restoreBrowserSession();
  } catch (error) {
    if (error.status !== 401 || endpoint !== "/api/integrations/status") throw error;
  }
};

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

  const normalizedEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const sessionControl = [
    "/api/integrations/google/exchange",
    "/api/integrations/google/restore",
  ].includes(normalizedEndpoint);
  const needsSession = normalizedEndpoint.startsWith("/api/") && !sessionControl;
  if (needsSession) await prepareBrowserSession(normalizedEndpoint);
  const attemptedSession = sessionStorage.getItem(SESSION_KEY);
  try {
    return await requestAPI(normalizedEndpoint, options, sessionControl);
  } catch (error) {
    if (!needsSession || !requiresBrowserSession(normalizedEndpoint) || error.status !== 401) throw error;
    // Only DDPro authentication failures may restore/retry, never Google API failures.
    const currentSession = sessionStorage.getItem(SESSION_KEY);
    if (currentSession && currentSession !== attemptedSession) {
      return requestAPI(normalizedEndpoint, options);
    }
    if (!currentSession && sessionRestoreError) throw sessionRestoreError;
    clearBrowserSession();
    await restoreBrowserSession();
    return requestAPI(normalizedEndpoint, options);
  }
};

const requestAPI = async (endpoint, options, sessionControl = false) => {
  const {
    timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
    signal: callerSignal,
    ...fetchOptions
  } = options;
  const requestTimeoutMs =
    Number.isFinite(timeoutMs) && timeoutMs > 0
      ? timeoutMs
      : DEFAULT_REQUEST_TIMEOUT_MS;
  const controller = new AbortController();
  let requestTimedOut = false;
  const abortFromCaller = () => controller.abort(callerSignal?.reason);
  if (callerSignal?.aborted) {
    abortFromCaller();
  } else {
    callerSignal?.addEventListener("abort", abortFromCaller, { once: true });
  }
  const timeoutId = setTimeout(() => {
    requestTimedOut = true;
    controller.abort();
  }, requestTimeoutMs);

  try {
    const normalizedEndpoint = endpoint.startsWith("/")
      ? endpoint
      : `/${endpoint}`;
    const url = `${API_BASE_URL}${normalizedEndpoint}`;

    const response = await fetch(url, {
      ...fetchOptions,
      headers: {
        "Content-Type": "application/json",
        ...(!sessionControl && sessionStorage.getItem(SESSION_KEY)
          ? { Authorization: ["Bearer", sessionStorage.getItem(SESSION_KEY)].join(" ") }
          : {}),
        ...options.headers,
      },
      credentials: "include",
      signal: controller.signal,
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
      // Older backends may still return a Google upstream 401 as HTTP 401.
      const isGoogleApiError = Boolean(data.googleApiError) ||
        String(data.code || "").startsWith("GOOGLE_API_");
      error.status = response.status === 401 && isGoogleApiError ? 502 : response.status;
      error.statusCode = error.status;
      error.code = data.code;
      error.provider = data.provider;
      error.upstreamStatus = data.upstreamStatus ?? data.googleApiError?.httpStatus;
      error.data = data;
      error.googleApiError = data.googleApiError;
      throw error;
    }

    return data;
  } catch (error) {
    if (requestTimedOut) {
      error = new Error(`API request timed out after ${requestTimeoutMs} ms.`);
      error.name = "TimeoutError";
      error.code = "API_TIMEOUT_ERROR";
    }
    // Re-throw with additional context
    console.warn("API request unavailable:", { status: error.status, code: error.code });
    throw error;
  } finally {
    clearTimeout(timeoutId);
    callerSignal?.removeEventListener("abort", abortFromCaller);
  }
};

export const getApiHealth = async () => fetchAPI("/health");

// ============================================================
// EXPORTS
// ============================================================

export { API_BASE_URL, CAN_USE_LOCAL_FALLBACK, IS_PRODUCTION_RUNTIME };
