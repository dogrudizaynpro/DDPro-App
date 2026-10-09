import {
  createHmac,
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import {
  hasStoredIntegrationToken,
  isSecureTokenStorageReady,
  isTokenTableAvailable,
  removeIntegrationToken,
  readIntegrationToken,
  readIntegrationTokenSnapshot,
  replaceIntegrationToken,
  saveIntegrationToken,
  encryptIntegrationToken,
  decryptIntegrationToken,
} from "./integration-vault.service.js";
import { getIntegrationAdmin } from "../config/integration-admin.js";
import { GoogleApiError } from "./google-api-error.js";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/spreadsheets.readonly",
];
const getOAuthConfig = () => ({
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  redirectUri: process.env.GOOGLE_REDIRECT_URI,
});

const validOAuthUrl = (value, callback = false) => {
  try {
    const url = new URL(value);
    return (
      (process.env.NODE_ENV !== "production" || url.protocol === "https:") &&
      ["https:", "http:"].includes(url.protocol) &&
      (!callback || url.pathname === "/api/integrations/google/callback") &&
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
};

export const getGoogleConfigurationStatus = async (account = "") => {
  const config = getOAuthConfig();
  const credentialsReady = Boolean(
    config.clientId?.trim() &&
    config.clientSecret?.trim() &&
    validOAuthUrl(config.redirectUri, true)
  );
  const storageReady = isSecureTokenStorageReady();
  const tokenTableReady = storageReady ? await isTokenTableAvailable() : false;
  const missingRequirements = [
    !config.clientId?.trim() && "GOOGLE_CLIENT_ID",
    !config.clientSecret?.trim() && "GOOGLE_CLIENT_SECRET",
    !validOAuthUrl(config.redirectUri, true) && "GOOGLE_REDIRECT_URI",
    !validOAuthUrl(process.env.FRONTEND_URL ||
      (process.env.NODE_ENV === "production" ? "" : "http://localhost:5173")) && "FRONTEND_URL",
    !process.env.INTEGRATION_SESSION_SECRET?.trim() && "INTEGRATION_SESSION_SECRET",
    !process.env.SUPABASE_URL?.trim() && "SUPABASE_URL",
    !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() && "SUPABASE_SERVICE_ROLE_KEY",
    !/^[\da-f]{64}$/i.test(process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY || "") && "INTEGRATION_TOKEN_ENCRYPTION_KEY",
    storageReady && !tokenTableReady && "integration_tokens",
    allowedGoogleEmails().size === 0 && "GOOGLE_ALLOWED_EMAILS",
  ].filter(Boolean);
  const oauthFlowAvailable = missingRequirements.length === 0;
  const hasConnection =
    oauthFlowAvailable
      ? await hasStoredIntegrationToken("google", account)
      : false;
  return {
    configured: oauthFlowAvailable,
    credentialsReady,
    secureStorageReady: storageReady,
    connected: hasConnection,
    oauthFlowAvailable,
    missingRequirements,
  };
};

const cookieValue = (req, name) => {
  const cookieHeader = req.headers.cookie || "";
  const entry = cookieHeader
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${name}=`));
  if (!entry) return "";
  try {
    return decodeURIComponent(entry.slice(name.length + 1));
  } catch {
    return "";
  }
};

const hasCookie = (req, name) => (req.headers.cookie || "")
  .split(";").some((entry) => entry.trim().startsWith(`${name}=`));

const restoreCookieName = "ddpro_session_restore";
const restoreCookiePath = "/api/integrations/google";
const browserSessionLifetime = 8 * 60 * 60 * 1000;
const restoreLifetime = 30 * 24 * 60 * 60 * 1000;
const setCookie = (res, name, value, maxAge, path = "/api") => {
  const secure = process.env.NODE_ENV === "production";
  res.append(
    "Set-Cookie",
    `${name}=${encodeURIComponent(value)}; HttpOnly; Path=${path}; Max-Age=${maxAge}; Secure; SameSite=${secure ? "None" : "Lax"}${secure && name === restoreCookieName ? "; Partitioned" : ""}`
  );
};

const sign = (value) =>
  createHmac("sha256", process.env.INTEGRATION_SESSION_SECRET)
    .update(value)
    .digest("base64url");

const safeEqual = (left, right) => {
  const a = Buffer.from(left || "");
  const b = Buffer.from(right || "");
  return a.length === b.length && timingSafeEqual(a, b);
};
const digest = (value) => createHash("sha256").update(value).digest("base64url");
const exchangeProvider = "google_session_exchange";
const allowedFrontendOrigin = (req) => {
  try {
    return req.get("origin") === new URL(process.env.FRONTEND_URL ||
      (process.env.NODE_ENV === "production" ? "" : "http://localhost:5173")).origin;
  } catch {
    return false;
  }
};

const allowedGoogleEmails = () =>
  new Set(
    (process.env.GOOGLE_ALLOWED_EMAILS || "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  );

const validExpiry = (expiresAt) =>
  Number.isFinite(expiresAt) && expiresAt > Date.now();

const readSignedSession = (raw, prefix = "") => {
  const separator = raw.lastIndexOf(".");
  if (!process.env.INTEGRATION_SESSION_SECRET || separator <= 0) return null;
  const session = raw.slice(0, separator);
  if (!safeEqual(raw.slice(separator + 1), sign(`${prefix}${session}`))) return null;
  try {
    const payload = JSON.parse(Buffer.from(session, "base64url").toString("utf8"));
    if (!validExpiry(payload.expiresAt) ||
        typeof payload.email !== "string" ||
        !allowedGoogleEmails().has(payload.email.toLowerCase()) ||
        (payload.sessionVersion !== undefined &&
          (typeof payload.sessionVersion !== "string" || !payload.sessionVersion))) return null;
    return { ...payload, email: payload.email.toLowerCase() };
  } catch {
    return null;
  }
};

const signedSession = (payload, prefix = "") => {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${sign(`${prefix}${encoded}`)}`;
};

const issueRestoreCookie = (res, payload) =>
  setCookie(res, restoreCookieName, signedSession(payload, "restore:"),
    Math.max(0, Math.ceil((payload.expiresAt - Date.now()) / 1000)), restoreCookiePath);

const clearRestoreCookie = (res) =>
  setCookie(res, restoreCookieName, "", 0, restoreCookiePath);

const browserSessionRequired = (res) => res.status(401).json({
  status: "error",
  code: "BROWSER_SESSION_REQUIRED",
  message: "Browser authorization is required. Authorize this browser with Google.",
});

const googleConnectionRequired = (res) => res.status(401).json({
  status: "error",
  code: "GOOGLE_CONNECTION_REQUIRED",
  message: "Google account connection is required.",
});

export const beginGoogleOAuth = async (req, res, next) => {
  const { clientId, redirectUri } = getOAuthConfig();
  let googleStatus;
  try {
    googleStatus = await getGoogleConfigurationStatus();
  } catch (error) {
    return next(error);
  }
  if (!googleStatus.oauthFlowAvailable) {
    console.warn("Google OAuth start unavailable; check backend configuration:", googleStatus.missingRequirements);
    return res.status(503).json({
      status: "error",
      message:
        "Google OAuth requires provider credentials, FRONTEND_URL, secure token storage, an integration session secret, and an allowlisted account.",
    });
  }
  const challenge = typeof req.query.challenge === "string" ? req.query.challenge : "";
  if (process.env.NODE_ENV === "production" && !/^[A-Za-z0-9_-]{43}$/.test(challenge)) {
    return res.status(400).json({ status: "error", message: "Browser authorization challenge is required." });
  }

  const state = randomBytes(32).toString("base64url");
  const browserNonce = randomBytes(32).toString("base64url");
  const statePayload = Buffer.from(
    JSON.stringify({ state, browserNonce, challenge, expiresAt: Date.now() + 10 * 60 * 1000 })
  ).toString("base64url");
  const signedState = `${statePayload}.${sign(`oauth:${statePayload}`)}`;
  setCookie(res, "ddpro_oauth_state", browserNonce, 600, "/api/integrations/google/callback");

  const url = new URL(GOOGLE_AUTH_URL);
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_SCOPES.join(" "),
    state: signedState,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
  }).toString();
  return res.redirect(url.toString());
};

export const completeGoogleOAuth = async (req, res, next) => {
  const { clientId, clientSecret, redirectUri } = getOAuthConfig();
  const state = typeof req.query.state === "string" ? req.query.state : "";
  const code = typeof req.query.code === "string" ? req.query.code : "";
  const cookieNonce = cookieValue(req, "ddpro_oauth_state");
  res.append(
    "Set-Cookie",
    `ddpro_oauth_state=; HttpOnly; Path=/api/integrations/google/callback; Max-Age=0; Secure; SameSite=${process.env.NODE_ENV === "production" ? "None" : "Lax"}`
  );
  const redirectOAuthResult = (integration, reason, exchangeCode = "") => {
    let frontendUrl;
    try {
      frontendUrl = new URL(
        process.env.FRONTEND_URL ||
          (process.env.NODE_ENV === "production" ? "" : "http://localhost:5173")
      );
    } catch {
      return res.status(503).json({
        status: "error",
        message: "FRONTEND_URL must be configured for the production OAuth redirect.",
      });
    }
    frontendUrl.hash = `/ayarlar?${new URLSearchParams({ integration, reason, ...(exchangeCode ? { exchange_code: exchangeCode } : {}) })}`;
    res.set("Cache-Control", "no-store");
    res.set("Referrer-Policy", "no-referrer");
    return res.redirect(frontendUrl.toString());
  };
  if (!process.env.INTEGRATION_SESSION_SECRET) {
    return redirectOAuthResult("google_error", "configuration_required");
  }
  const separator = state.lastIndexOf(".");
  const statePayload = separator > 0 ? state.slice(0, separator) : "";
  const signature = separator > 0 ? state.slice(separator + 1) : "";
  let stateDetails;
  try {
    stateDetails = JSON.parse(Buffer.from(statePayload, "base64url").toString("utf8"));
  } catch {
    stateDetails = null;
  }
  if (
    !stateDetails ||
    !safeEqual(signature, sign(`oauth:${statePayload}`)) ||
    !validExpiry(stateDetails.expiresAt) ||
    !safeEqual(cookieNonce, stateDetails.browserNonce)
  ) {
    return redirectOAuthResult("google_error", "state_invalid");
  }
  if (req.query.error || !code) {
    return redirectOAuthResult("google_error", "access_denied");
  }

  try {
    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const token = await response.json();
    if (!response.ok || !token.access_token) {
      return redirectOAuthResult("google_error", "token_exchange_failed");
    }

    const profileResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: "Bearer " + token.access_token },
      signal: AbortSignal.timeout(10_000),
    });
    const profile = await profileResponse.json();
    const email = typeof profile.email === "string" ? profile.email.toLowerCase() : "";
    if (!profileResponse.ok || profile.verified_email !== true || !allowedGoogleEmails().has(email)) {
      return redirectOAuthResult("google_error", "account_not_allowed");
    }

    const sessionVersion = randomBytes(32).toString("base64url");
    await saveIntegrationToken({
      provider: "google",
      account: email,
      value: {
        accessToken: token.access_token,
        refreshToken: token.refresh_token ||
          (await readIntegrationToken({ provider: "google", account: email }))?.refreshToken ||
          null,
        expiresAt: Date.now() + (Number(token.expires_in) || 3600) * 1000,
        scopes: token.scope || "",
        sessionVersion,
      },
    });
    const session = Buffer.from(
      JSON.stringify({ email, sessionVersion, expiresAt: Date.now() + browserSessionLifetime })
    ).toString("base64url");
    setCookie(res, "ddpro_integration_session", `${session}.${sign(session)}`, 8 * 60 * 60    );
    if (stateDetails.challenge) {
      const exchangeCode = randomBytes(32).toString("base64url");
      const { error } = await getIntegrationAdmin().from("integration_tokens").insert({
        provider: exchangeProvider,
        account: digest(exchangeCode),
        encrypted_token: encryptIntegrationToken({
          session,
          challenge: stateDetails.challenge,
          expiresAt: Date.now() + 2 * 60 * 1000,
        }),
      });
      if (error) throw error;
      return redirectOAuthResult("google_connected", "", exchangeCode);
    }
    return redirectOAuthResult("google_connected", "");
  } catch {
    return redirectOAuthResult("google_error", "provider_unavailable");
  }
};

export const exchangeGoogleSession = async (req, res, next) => {
  res.set("Cache-Control", "no-store");
  if (!allowedFrontendOrigin(req)) {
    return res.status(403).json({ status: "error", message: "Request origin is not allowed." });
  }
  if (!req.is("application/json")) {
    return res.status(415).json({ status: "error", message: "application/json is required." });
  }
  const { code, verifier } = req.body || {};
  if (typeof code !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(code) ||
      typeof verifier !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(verifier)) {
    return res.status(400).json({ status: "error", message: "Invalid authorization exchange." });
  }
  try {
    const { data, error } = await getIntegrationAdmin().from("integration_tokens")
      .delete().eq("provider", exchangeProvider).eq("account", digest(code))
      .select("encrypted_token").maybeSingle();
    if (error) throw error;
    if (!data) return res.status(401).json({ status: "error", message: "Authorization expired or already used." });
    const grant = decryptIntegrationToken(data.encrypted_token);
    if (!validExpiry(grant.expiresAt) || !safeEqual(grant.challenge, digest(verifier))) {
      return res.status(401).json({ status: "error", message: "Authorization expired or invalid." });
    }
    const payload = readSignedSession(`${grant.session}.${sign(grant.session)}`);
    if (!payload?.sessionVersion) return browserSessionRequired(res);
    const token = await readIntegrationToken({ provider: "google", account: payload.email });
    if (!token) return googleConnectionRequired(res);
    if (token.sessionVersion !== payload.sessionVersion) return browserSessionRequired(res);
    issueRestoreCookie(res, {
      email: payload.email, sessionVersion: payload.sessionVersion, expiresAt: Date.now() + restoreLifetime,
    });
    return res.json({
      status: "success",
      data: { session: `${grant.session}.${sign(`browser:${grant.session}`)}` },
    });
  } catch (error) {
    return next(error);
  }
};

export const restoreGoogleSession = async (req, res, next) => {
  res.set("Cache-Control", "no-store");
  if (!allowedFrontendOrigin(req)) {
    return res.status(403).json({ status: "error", message: "Request origin is not allowed." });
  }
  if (!req.is("application/json")) {
    return res.status(415).json({ status: "error", message: "application/json is required." });
  }
  const raw = cookieValue(req, restoreCookieName);
  const persistent = hasCookie(req, restoreCookieName);
  const payload = persistent
    ? readSignedSession(raw, "restore:")
    : readSignedSession(cookieValue(req, "ddpro_integration_session"));
  if (!payload || (persistent && !payload.sessionVersion)) {
    clearRestoreCookie(res);
    return browserSessionRequired(res);
  }
  try {
    const snapshot = await readIntegrationTokenSnapshot({ provider: "google", account: payload.email });
    const token = snapshot?.value;
    if (!token) {
      clearRestoreCookie(res);
      return googleConnectionRequired(res);
    }
    if ((payload.sessionVersion || undefined) !== token.sessionVersion) {
      clearRestoreCookie(res);
      return browserSessionRequired(res);
    }
    // A still-valid legacy callback session can bootstrap the browser partition once.
    if (!persistent && !token.sessionVersion) {
      token.sessionVersion = randomBytes(32).toString("base64url");
      const replaced = await replaceIntegrationToken({
        provider: "google", account: payload.email, value: token,
        encryptedToken: snapshot.encryptedToken,
      });
      if (!replaced) return browserSessionRequired(res);
    }
    const expiresAt = persistent ? payload.expiresAt : Date.now() + restoreLifetime;
    if (!persistent) issueRestoreCookie(res, {
      email: payload.email, sessionVersion: token.sessionVersion, expiresAt,
    });
    return res.json({
      status: "success",
      data: { session: signedSession({
        email: payload.email, sessionVersion: token.sessionVersion,
        expiresAt: Math.min(expiresAt, Date.now() + browserSessionLifetime),
      }, "browser:") },
    });
  } catch (error) {
    return next(error);
  }
};

const getGoogleSession = (req) => {
  const authorization = req.get("authorization");
  if (authorization && !allowedFrontendOrigin(req)) return null;
  const bearer = authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (authorization && !bearer) return null;
  const raw = bearer || cookieValue(req, "ddpro_integration_session");
  return readSignedSession(raw, bearer ? "browser:" : "");
};

export const getGoogleSessionAccount = async (req) => {
  const payload = getGoogleSession(req);
  if (!payload) return "";
  const token = await readIntegrationToken({ provider: "google", account: payload.email });
  if (!token || (payload.sessionVersion || undefined) !== token.sessionVersion) return "";
  return payload.email;
};

export const requireGoogleSession = async (req, res, next) => {
  if (req.get("authorization") && !allowedFrontendOrigin(req)) {
    return res.status(403).json({ status: "error", message: "Request origin is not allowed." });
  }
  if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method) && !req.get("authorization")) {
    const requestOrigin = req.get("origin");
    const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean);
    let frontendOrigin = "";
    try {
      if (process.env.FRONTEND_URL) {
        frontendOrigin = new URL(process.env.FRONTEND_URL).origin;
      }
    } catch {
      frontendOrigin = "";
    }
    if (
      !requestOrigin ||
      (!allowedOrigins.includes(requestOrigin) && requestOrigin !== frontendOrigin)
    ) {
      return res.status(403).json({ status: "error", message: "Request origin is not allowed." });
    }
  }
  const payload = getGoogleSession(req);
  if (!payload) {
    return browserSessionRequired(res);
  }
  const account = payload.email;
  try {
    const token = await readIntegrationToken({ provider: "google", account });
    if (!token) return googleConnectionRequired(res);
    if ((payload.sessionVersion || undefined) !== token.sessionVersion) {
      return browserSessionRequired(res);
    }
  } catch (error) {
    return next(error);
  }
  req.integrationAccount = account;
  return next();
};

export const getGoogleAccessToken = async (account) => {
  const snapshot = await readIntegrationTokenSnapshot({ provider: "google", account });
  const token = snapshot?.value;
  if (!token) throw Object.assign(new Error("Google account is not connected."), { statusCode: 401, expose: true });
  if (token.expiresAt > Date.now() + 60_000) return token.accessToken;
  if (!token.refreshToken) {
    throw new GoogleApiError(401, {
      error: { message: "Google access expired and cannot be refreshed. The saved connection was kept." },
    });
  }

  let response;
  try {
    response = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        refresh_token: token.refreshToken,
        grant_type: "refresh_token",
      }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    throw Object.assign(new Error(
      error.name === "TimeoutError" ? "Google token refresh timed out." : "Google token refresh is temporarily unreachable."
    ), { statusCode: error.name === "TimeoutError" ? 504 : 502, expose: true });
  }
  const refreshed = await response.json().catch(() => ({}));
  if (!response.ok || !refreshed.access_token) {
    throw new GoogleApiError(response.ok ? 502 : response.status, {
      error: {
        message: refreshed.error_description || "Google access refresh failed. The saved connection was kept.",
        errors: typeof refreshed.error === "string" ? [{ reason: refreshed.error }] : [],
      },
    }, [token.accessToken, token.refreshToken], "google", "oauth.token.refresh");
  }
  const updated = {
    ...token,
    accessToken: refreshed.access_token,
    expiresAt: Date.now() + (Number(refreshed.expires_in) || 3600) * 1000,
  };
  const replaced = await replaceIntegrationToken({
    provider: "google", account, value: updated, encryptedToken: snapshot.encryptedToken,
  });
  if (!replaced) {
    throw Object.assign(new Error("Google connection changed during token refresh. Retry the request."), {
      statusCode: 409,
      expose: true,
    });
  }
  return updated.accessToken;
};

export const revokeGoogleSession = async (req, res, next) => {
  let revoked = false;
  try {
    const stored = await readIntegrationToken({
      provider: "google",
      account: req.integrationAccount,
    });
    revoked = !stored?.refreshToken && !stored?.accessToken;
    if (stored?.refreshToken || stored?.accessToken) {
      const revoke = async (token) => fetch("https://oauth2.googleapis.com/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token }),
        signal: AbortSignal.timeout(10_000),
      });
      let response = await revoke(stored.refreshToken || stored.accessToken);
      if (response.status === 400 && stored.refreshToken && stored.accessToken) {
        response = await revoke(stored.accessToken);
      }
      if (!response.ok && response.status !== 400) {
        throw Object.assign(new Error("Google revocation failed; the saved connection was kept so you can retry."), {
          statusCode: 502,
          expose: true,
        });
      }
      revoked = response.ok;
    }
    await removeIntegrationToken({
      provider: "google",
      account: req.integrationAccount,
    });
  } catch (error) {
    return next(error);
  }
  setCookie(res, "ddpro_integration_session", "", 0);
  clearRestoreCookie(res);
  return res.status(200).json({
    status: "success",
    data: { disconnected: true, providerRevoked: revoked },
  });
};
