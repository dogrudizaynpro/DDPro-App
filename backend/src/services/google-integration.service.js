import {
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import {
  hasStoredIntegrationToken,
  isSecureTokenStorageReady,
  isTokenTableAvailable,
  removeIntegrationToken,
  readIntegrationToken,
  saveIntegrationToken,
} from "./integration-vault.service.js";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/calendar.events",
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

const setCookie = (res, name, value, maxAge, path = "/api") => {
  const secure = process.env.NODE_ENV === "production";
  res.append(
    "Set-Cookie",
    `${name}=${encodeURIComponent(value)}; HttpOnly; Path=${path}; Max-Age=${maxAge}; Secure; SameSite=${secure ? "None" : "Lax"}`
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

const allowedGoogleEmails = () =>
  new Set(
    (process.env.GOOGLE_ALLOWED_EMAILS || "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  );

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

  const state = randomBytes(32).toString("base64url");
  const browserNonce = randomBytes(32).toString("base64url");
  const statePayload = Buffer.from(
    JSON.stringify({ state, browserNonce, expiresAt: Date.now() + 10 * 60 * 1000 })
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
  const redirectOAuthResult = (integration, reason) => {
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
    frontendUrl.hash = `/ayarlar?${new URLSearchParams({ integration, reason })}`;
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
    stateDetails.expiresAt < Date.now() ||
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

    await saveIntegrationToken({
      provider: "google",
      account: email,
      value: {
        accessToken: token.access_token,
        refreshToken: token.refresh_token || null,
        expiresAt: Date.now() + (Number(token.expires_in) || 3600) * 1000,
        scopes: token.scope || "",
      },
    });
    const session = Buffer.from(
      JSON.stringify({ email, expiresAt: Date.now() + 8 * 60 * 60 * 1000 })
    ).toString("base64url");
    setCookie(res, "ddpro_integration_session", `${session}.${sign(session)}`, 8 * 60 * 60    );
    return redirectOAuthResult("google_connected", "");
  } catch {
    return redirectOAuthResult("google_error", "provider_unavailable");
  }
};

export const getGoogleSessionAccount = (req) => {
  const secret = process.env.INTEGRATION_SESSION_SECRET;
  const allowedEmails = allowedGoogleEmails();
  const raw = cookieValue(req, "ddpro_integration_session");
  const separator = raw.lastIndexOf(".");
  if (!secret || separator < 0) return "";
  const session = raw.slice(0, separator);
  const signature = raw.slice(separator + 1);
  if (!safeEqual(signature, sign(session))) return "";
  try {
    const payload = JSON.parse(Buffer.from(session, "base64url").toString("utf8"));
    if (
      payload.expiresAt < Date.now() ||
      !allowedEmails.has(String(payload.email || "").toLowerCase())
    ) {
      return "";
    }
    return String(payload.email).toLowerCase();
  } catch {
    return "";
  }
};

export const requireGoogleSession = (req, res, next) => {
  if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
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
  const account = getGoogleSessionAccount(req);
  if (!account) {
    return res.status(401).json({ status: "error", message: "Google account connection is required." });
  }
  req.integrationAccount = account;
  return next();
};

export const getGoogleAccessToken = async (account) => {
  const token = await readIntegrationToken({ provider: "google", account });
  if (!token) throw Object.assign(new Error("Google account is not connected."), { statusCode: 401, expose: true });
  if (token.expiresAt > Date.now() + 60_000) return token.accessToken;
  if (!token.refreshToken) throw Object.assign(new Error("Google access expired; reconnect the account."), { statusCode: 401, expose: true });

  const response = await fetch(GOOGLE_TOKEN_URL, {
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
  const refreshed = await response.json();
  if (!response.ok || !refreshed.access_token) {
    throw Object.assign(new Error("Google access refresh failed; reconnect the account."), { statusCode: 401, expose: true });
  }
  const updated = {
    ...token,
    accessToken: refreshed.access_token,
    expiresAt: Date.now() + (Number(refreshed.expires_in) || 3600) * 1000,
  };
  await saveIntegrationToken({ provider: "google", account, value: updated });
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
  res.append(
    "Set-Cookie",
    `ddpro_integration_session=; HttpOnly; Path=/api; Max-Age=0; Secure; SameSite=${process.env.NODE_ENV === "production" ? "None" : "Lax"}`
  );
  return res.status(200).json({
    status: "success",
    data: { disconnected: true, providerRevoked: revoked },
  });
};
