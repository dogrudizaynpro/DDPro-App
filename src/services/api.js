// ============================================================
// API CONFIGURATION
// ============================================================
// Centralized backend API configuration and utilities
// ============================================================

import { completeGoogleConnection } from "./operations-integrations.service.js";
import { resolveApiBaseUrl } from "./api-config.js";

const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;

const isLocalHost = (hostname = "") =>
  ["localhost", "127.0.0.1", "::1"].includes(hostname);

const getRuntimeHostname = () =>
  typeof window !== "undefined" ? window.location.hostname : "";

const IS_PRODUCTION_RUNTIME = !isLocalHost(getRuntimeHostname());
const CAN_USE_LOCAL_FALLBACK = !IS_PRODUCTION_RUNTIME;

const API_BASE_URL = resolveApiBaseUrl({
  apiUrl: import.meta.env?.VITE_API_URL || "",
  deploymentEnvironment: import.meta.env?.VERCEL_ENV || "",
  hostname: getRuntimeHostname(),
});
const SESSION_KEY = "ddpro_browser_session";
const LOGOUT_KEY = "ddpro_session_logout";
let pendingSessionRestore;
let sessionRestoreError;
let sessionRestoreErrorExpiresAt = 0;
let sessionRevision = 0;
let explicitlyEnded = false;
const logoutPending = () => {
  if (explicitlyEnded || sessionStorage.getItem(LOGOUT_KEY)) return true;
  try {
    return Boolean(localStorage.getItem(LOGOUT_KEY));
  } catch {
    return false;
  }
};
const sessionRequired = () => Object.assign(new Error("Bu tarayıcıdan çıkış yapıldı; yeniden giriş yapın."), {
  status: 401, code: "BROWSER_SESSION_REQUIRED",
});
export const getBrowserSessionRevision = () => sessionRevision;
export const clearBrowserSession = () => {
  sessionStorage.removeItem(SESSION_KEY);
  sessionRestoreError = undefined;
  sessionRestoreErrorExpiresAt = 0;
  sessionRevision += 1;
};
export const endBrowserSession = ({ broadcast = true } = {}) => {
  explicitlyEnded = true;
  clearBrowserSession();
  sessionStorage.setItem(LOGOUT_KEY, "ended");
  sessionStorage.removeItem("ddpro_oauth_verifier");
  sessionStorage.removeItem("ddpro_oauth_action");
  if (broadcast) {
    try {
      localStorage.setItem(LOGOUT_KEY, `${Date.now()}:${Math.random()}`);
    } catch {
      // Server revocation remains authoritative when browser storage is unavailable.
    }
  }
  window.dispatchEvent?.(new Event("ddpro:session-ended"));
};
globalThis.window?.addEventListener?.("storage", (event) => {
  if (event.key !== LOGOUT_KEY) return;
  if (event.newValue) endBrowserSession({ broadcast: false });
  else {
    explicitlyEnded = false;
    sessionStorage.removeItem(LOGOUT_KEY);
    clearBrowserSession();
  }
});
export const setBrowserSession = (session, { restored = false } = {}) => {
  if (typeof session !== "string" || !session.trim()) {
    throw new Error("Google OAuth tarayıcı oturumu alınamadı; tekrar bağlanın.");
  }
  if (restored && logoutPending()) throw sessionRequired();
  if (!restored) {
    explicitlyEnded = false;
    sessionStorage.removeItem(LOGOUT_KEY);
    try { localStorage.removeItem(LOGOUT_KEY); } catch { /* Optional cross-tab signal. */ }
  }
  sessionStorage.setItem(SESSION_KEY, session);
  sessionRestoreError = undefined;
  sessionRestoreErrorExpiresAt = 0;
  sessionRevision += 1;
};

export const restoreBrowserSession = () => {
  if (logoutPending()) return Promise.reject(sessionRequired());
  if (pendingSessionRestore) return pendingSessionRestore;
  if (sessionRestoreError && Date.now() < sessionRestoreErrorExpiresAt) {
    return Promise.reject(sessionRestoreError);
  }
  const revision = sessionRevision;
  const pending = fetchAPI("/api/integrations/google/restore", {
    method: "POST",
    body: JSON.stringify({}),
  }).then((response) => {
    // A completed OAuth exchange or logout must win over an older restore response.
    if (revision !== sessionRevision) {
      if (sessionStorage.getItem(SESSION_KEY)) return;
      throw Object.assign(new Error("Browser session changed during restoration."), {
        status: 401, code: "BROWSER_SESSION_CHANGED",
      });
    }
    setBrowserSession(response.data?.session, { restored: true });
  }).catch((error) => {
    if (revision !== sessionRevision && sessionStorage.getItem(SESSION_KEY)) return;
    if (error.status === 401 && revision === sessionRevision) {
      sessionRestoreError = error;
      sessionRestoreErrorExpiresAt = Date.now() + 5_000;
      window.dispatchEvent?.(new Event("ddpro:session-invalid"));
    }
    throw error;
  });
  pendingSessionRestore = pending;
  pending.finally(() => {
    if (pendingSessionRestore === pending) pendingSessionRestore = undefined;
  }).catch(() => {});
  return pending;
};

const requiresBrowserSession = (endpoint) => {
  if (endpoint.split("?")[0] === "/api/integrations/status") return false;
  const providerTest = endpoint.match(/^\/api\/integrations\/test\/([^/?]+)$/);
  return !providerTest || ["gmail", "googleCalendar", "crm"].includes(providerTest[1]);
};

const prepareBrowserSession = async (endpoint) => {
  try {
    await completeGoogleConnection();
  } catch (error) {
    if (![400, 401].includes(error.status)) throw error;
  }
  if (!requiresBrowserSession(endpoint) && endpoint.split("?")[0] !== "/api/integrations/status") return;
  if (logoutPending()) {
    if (endpoint.split("?")[0] === "/api/integrations/status") return sessionRequired();
    throw sessionRequired();
  }
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
    await restoreBrowserSession();
  } catch (error) {
    if (error.status !== 401 || endpoint.split("?")[0] !== "/api/integrations/status") throw error;
    return error;
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
  let restoreError = needsSession ? await prepareBrowserSession(normalizedEndpoint) : undefined;
  const attemptedSession = sessionStorage.getItem(SESSION_KEY);
  const isStatus = normalizedEndpoint.split("?")[0] === "/api/integrations/status";
  const withRestoreDiagnostics = (response) => restoreError && isStatus
    ? { ...response, data: { ...response.data, browserSession: {
      status: "authorization_required", code: restoreError.code, message: restoreError.message,
    } } }
    : response;
  try {
    return withRestoreDiagnostics(await requestWithSafeRetry(normalizedEndpoint, options, sessionControl));
  } catch (error) {
    if (logoutPending() || !needsSession || (!requiresBrowserSession(normalizedEndpoint) && !isStatus) ||
        error.status !== 401 || error.code === "GOOGLE_CONNECTION_REQUIRED") throw error;
    // Only DDPro authentication failures may restore/retry, never Google API failures.
    const currentSession = sessionStorage.getItem(SESSION_KEY);
    if (currentSession && currentSession !== attemptedSession) {
      return requestWithSafeRetry(normalizedEndpoint, options);
    }
    if (!pendingSessionRestore && currentSession) clearBrowserSession();
    try {
      await restoreBrowserSession();
      restoreError = undefined;
    } catch (restoreFailure) {
      if (!isStatus || restoreFailure.status !== 401) throw restoreFailure;
      restoreError = restoreFailure;
    }
    return withRestoreDiagnostics(await requestWithSafeRetry(normalizedEndpoint, options));
  }
};

const requestWithSafeRetry = async (endpoint, options, sessionControl = false) => {
  const method = (options.method || "GET").toUpperCase();
  const retryableMethod = ["GET", "HEAD", "OPTIONS"].includes(method);
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await requestAPI(endpoint, options, sessionControl);
    } catch (error) {
      const transient = ["API_TIMEOUT_ERROR", "API_NETWORK_ERROR"].includes(error.code);
      if (!retryableMethod || !transient || attempt >= 1 || options.signal?.aborted) throw error;
      await new Promise((resolve) => setTimeout(resolve, 200));
      if (options.signal?.aborted) {
        const aborted = new Error("API request was aborted.");
        aborted.name = "AbortError";
        throw aborted;
      }
    }
  }
};

const requestAPI = async (endpoint, options, sessionControl = false) => {
  const revision = sessionRevision;
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
  const isFormData = typeof FormData !== "undefined" && fetchOptions.body instanceof FormData;
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
        ...(!isFormData ? { "Content-Type": "application/json" } : {}),
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

    if (!sessionControl && revision !== sessionRevision && !sessionStorage.getItem(SESSION_KEY)) {
      throw Object.assign(new Error("Browser session changed during the request."), {
        status: 401, code: "BROWSER_SESSION_CHANGED",
      });
    }
    return data;
  } catch (error) {
    if (requestTimedOut) {
      error = new Error(`API request timed out after ${requestTimeoutMs} ms.`);
      error.name = "TimeoutError";
      error.code = "API_TIMEOUT_ERROR";
    } else if (error.name === "TypeError" && !error.status) {
      error = new Error("Network connection to the API failed.");
      error.name = "NetworkError";
      error.code = "API_NETWORK_ERROR";
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

export const requestBrowserLogout = () => {
  const session = sessionStorage.getItem(SESSION_KEY);
  try {
    if (API_CONFIGURATION_ERROR) return Promise.reject(new Error(API_CONFIGURATION_ERROR));
    return requestAPI("/api/sessions/logout", {
      method: "POST",
      body: JSON.stringify({}),
      headers: session ? { Authorization: ["Bearer", session].join(" ") } : {},
    }, true);
  } finally {
    endBrowserSession();
  }
};

// ============================================================
// EXPORTS
// ============================================================

export { API_BASE_URL, CAN_USE_LOCAL_FALLBACK, IS_PRODUCTION_RUNTIME };
