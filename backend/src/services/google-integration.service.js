import {
  hasStoredIntegrationToken, isSecureTokenStorageReady, isTokenTableAvailable,
  readIntegrationTokenSnapshot, replaceIntegrationToken, removeIntegrationTokenSnapshot,
} from "./integration-vault.service.js";
import { GoogleApiError } from "./google-api-error.js";
export {
  beginGoogleOAuth, completeGoogleOAuth, exchangeGoogleSession, restoreGoogleSession,
  getGoogleSessionAccount, requireGoogleSession, revokeGoogleSession,
} from "./browser-session.service.js";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const GOOGLE_OPERATION_SCOPES = Object.freeze({
  gmail: "https://www.googleapis.com/auth/gmail.readonly",
  calendar: "https://www.googleapis.com/auth/calendar.events",
  sheets: "https://www.googleapis.com/auth/spreadsheets.readonly",
});
const GOOGLE_SCOPE_ALTERNATIVES = {
  [GOOGLE_OPERATION_SCOPES.gmail]: [
    "https://www.googleapis.com/auth/gmail.modify",
    "https://mail.google.com/",
  ],
  [GOOGLE_OPERATION_SCOPES.calendar]: ["https://www.googleapis.com/auth/calendar"],
  [GOOGLE_OPERATION_SCOPES.sheets]: ["https://www.googleapis.com/auth/spreadsheets"],
};
export const hasGoogleOperationScope = (grantedScopes, requiredScope) => {
  const granted = new Set(
    (typeof grantedScopes === "string" ? grantedScopes : "").split(/\s+/).filter(Boolean)
  );
  return [requiredScope, ...(GOOGLE_SCOPE_ALTERNATIVES[requiredScope] || [])]
    .some((scope) => granted.has(scope));
};
export const getMissingGoogleScopes = (grantedScopes) =>
  Object.values(GOOGLE_OPERATION_SCOPES).filter((scope) => !hasGoogleOperationScope(grantedScopes, scope));

const validOAuthUrl = (value, callback = false) => {
  try {
    const url = new URL(value);
    return (process.env.NODE_ENV !== "production" || url.protocol === "https:") &&
      ["https:", "http:"].includes(url.protocol) &&
      (!callback || url.pathname === "/api/integrations/google/callback") &&
      !url.search && !url.hash;
  } catch { return false; }
};
export const getGoogleConfigurationStatus = async (account = "") => {
  const credentialsReady = Boolean(process.env.GOOGLE_CLIENT_ID?.trim() &&
    process.env.GOOGLE_CLIENT_SECRET?.trim() && validOAuthUrl(process.env.GOOGLE_REDIRECT_URI, true));
  const storageReady = isSecureTokenStorageReady();
  const tokenTableReady = storageReady ? await isTokenTableAvailable() : false;
  const missingRequirements = [
    !process.env.GOOGLE_CLIENT_ID?.trim() && "GOOGLE_CLIENT_ID",
    !process.env.GOOGLE_CLIENT_SECRET?.trim() && "GOOGLE_CLIENT_SECRET",
    !validOAuthUrl(process.env.GOOGLE_REDIRECT_URI, true) && "GOOGLE_REDIRECT_URI",
    !validOAuthUrl(process.env.FRONTEND_URL ||
      (process.env.NODE_ENV === "production" ? "" : "http://localhost:5173")) && "FRONTEND_URL",
    !process.env.INTEGRATION_SESSION_SECRET?.trim() && "INTEGRATION_SESSION_SECRET",
    !process.env.SUPABASE_URL?.trim() && "SUPABASE_URL",
    !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() && "SUPABASE_SERVICE_ROLE_KEY",
    !/^[\da-f]{64}$/i.test(process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY || "") && "INTEGRATION_TOKEN_ENCRYPTION_KEY",
    storageReady && !tokenTableReady && "browser_authorization_storage",
    !(process.env.GOOGLE_ALLOWED_EMAILS || "").split(",").some((email) => email.trim()) && "GOOGLE_ALLOWED_EMAILS",
  ].filter(Boolean);
  const oauthFlowAvailable = missingRequirements.length === 0;
  return {
    configured: oauthFlowAvailable, credentialsReady, secureStorageReady: storageReady,
    connected: oauthFlowAvailable ? await hasStoredIntegrationToken("google", account) : false,
    oauthFlowAvailable, missingRequirements,
  };
};

export const getGoogleAccessToken = async (
  account, { requiredScope, provider, operation } = {}
) => {
  const snapshot = await readIntegrationTokenSnapshot({ provider: "google", account });
  const token = snapshot?.value;
  if (!token) throw Object.assign(new Error("Google account is not connected."), { statusCode: 401, code: "GOOGLE_CONNECTION_REQUIRED", expose: true });
  if (requiredScope && typeof token.scopes === "string" && token.scopes.trim() &&
      !hasGoogleOperationScope(token.scopes, requiredScope)) {
    const error = new GoogleApiError(403, {
      error: {
        message: "Google authorization is missing a required permission. The saved connection was kept; authorize again to grant the requested access.",
        errors: [{ reason: "insufficientPermissions" }],
      },
    }, [token.accessToken, token.refreshToken], provider, operation);
    error.googleApiError.requestSent = false;
    error.upstreamStatus = undefined;
    throw error;
  }
  if (token.expiresAt > Date.now() + 60_000) return token.accessToken;
  if (!token.refreshToken) throw Object.assign(
    new Error("Google access expired and cannot be refreshed. The saved connection was kept."),
    { statusCode: 401, code: "GOOGLE_CONNECTION_REQUIRED", expose: true }
  );
  let response;
  try {
    response = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET,
        refresh_token: token.refreshToken, grant_type: "refresh_token",
      }), signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    throw Object.assign(new Error(error.name === "TimeoutError"
      ? "Google token refresh timed out." : "Google token refresh is temporarily unreachable."),
    { statusCode: error.name === "TimeoutError" ? 504 : 502, expose: true,
      reachable: false, operation: "oauth.token.refresh" });
  }
  const refreshed = await response.json().catch(() => ({}));
  if (!response.ok || !refreshed.access_token) {
    const refreshError = new GoogleApiError(response.ok ? 502 : response.status, {
      error: { message: refreshed.error_description || "Google access refresh failed. The saved connection was kept.",
        errors: typeof refreshed.error === "string" ? [{ reason: refreshed.error }] : [] },
    }, [token.accessToken, token.refreshToken], "google", "oauth.token.refresh");
    if (refreshError.code === "GOOGLE_CONNECTION_REQUIRED") {
      const removed = await removeIntegrationTokenSnapshot({
        provider: "google", account, encryptedToken: snapshot.encryptedToken,
      });
      if (!removed) throw Object.assign(new Error("Google connection changed during token refresh. Retry the request."),
        { statusCode: 409, expose: true });
    }
    throw refreshError;
  }
  const updated = { ...token, accessToken: refreshed.access_token,
    refreshToken: refreshed.refresh_token || token.refreshToken,
    expiresAt: Date.now() + (Number(refreshed.expires_in) || 3600) * 1000 };
  const replaced = await replaceIntegrationToken({
    provider: "google", account, value: updated, encryptedToken: snapshot.encryptedToken,
  });
  if (!replaced) throw Object.assign(new Error("Google connection changed during token refresh. Retry the request."),
    { statusCode: 409, expose: true });
  return updated.accessToken;
};
