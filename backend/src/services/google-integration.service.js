import {
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import {
  hasStoredIntegrationToken,
  isSecureTokenStorageReady,
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
const pendingOAuthStates = new Map();

const getOAuthConfig = () => ({
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  redirectUri: process.env.GOOGLE_REDIRECT_URI,
});

export const getGoogleConfigurationStatus = async () => {
  const config = getOAuthConfig();
  const credentialsReady = Boolean(
    config.clientId && config.clientSecret && config.redirectUri
  );
  const storageReady = isSecureTokenStorageReady();
  const hasConnection =
    credentialsReady && storageReady
      ? await hasStoredIntegrationToken("google")
      : false;
  return {
    configured: credentialsReady && storageReady,
    credentialsReady,
    secureStorageReady: storageReady,
    connected: hasConnection,
    oauthFlowAvailable: credentialsReady && storageReady,
  };
};

const cookieValue = (req, name) => {
  const cookieHeader = req.headers.cookie || "";
  const entry = cookieHeader
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${name}=`));
  return entry ? decodeURIComponent(entry.slice(name.length + 1)) : "";
};

const setCookie = (res, name, value, maxAge, path = "/api") => {
  const secure = process.env.NODE_ENV === "production";
  res.append(
    "Set-Cookie",
    `${name}=${encodeURIComponent(value)}; HttpOnly; Path=${path}; Max-Age=${maxAge}; SameSite=${secure ? "None; Secure" : "Lax"}`
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

export const beginGoogleOAuth = (req, res) => {
  const { clientId, redirectUri } = getOAuthConfig();
  if (
    !clientId ||
    !process.env.GOOGLE_CLIENT_SECRET ||
    !redirectUri ||
    !isSecureTokenStorageReady() ||
    !process.env.INTEGRATION_SESSION_SECRET ||
    allowedGoogleEmails().size === 0
  ) {
    return res.status(503).json({
      status: "error",
      message:
        "Google OAuth requires Google credentials, a 32-byte token encryption key, Supabase service-role access, an integration session secret, and an allowlisted Google account.",
    });
  }

  const state = randomBytes(32).toString("base64url");
  const browserNonce = randomBytes(32).toString("base64url");
  for (const [key, value] of pendingOAuthStates) {
    if (value.expiresAt < Date.now()) pendingOAuthStates.delete(key);
  }
  pendingOAuthStates.set(state, {
    browserNonce,
    expiresAt: Date.now() + 10 * 60 * 1000,
  });
  setCookie(res, "ddpro_oauth_state", browserNonce, 600, "/api/integrations/google/callback");

  const url = new URL(GOOGLE_AUTH_URL);
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_SCOPES.join(" "),
    state,
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
  const pending = pendingOAuthStates.get(state);
  pendingOAuthStates.delete(state);
  const cookieNonce = cookieValue(req, "ddpro_oauth_state");
  res.append(
    "Set-Cookie",
    `ddpro_oauth_state=; HttpOnly; Path=/api/integrations/google/callback; Max-Age=0; SameSite=${process.env.NODE_ENV === "production" ? "None; Secure" : "Lax"}`
  );
  if (
    !pending ||
    pending.expiresAt < Date.now() ||
    !safeEqual(cookieNonce, pending.browserNonce)
  ) {
    return res.status(400).json({ status: "error", message: "OAuth state validation failed." });
  }
  if (req.query.error || !code) {
    return res.status(400).json({ status: "error", message: "Google OAuth was cancelled or denied." });
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
      return res.status(502).json({ status: "error", message: "Google token exchange failed." });
    }

    const profileResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: "Bearer " + token.access_token },
      signal: AbortSignal.timeout(10_000),
    });
    const profile = await profileResponse.json();
    const email = typeof profile.email === "string" ? profile.email.toLowerCase() : "";
    if (!profileResponse.ok || profile.verified_email !== true || !allowedGoogleEmails().has(email)) {
      return res.status(403).json({ status: "error", message: "Google account is not authorized for DDPro integrations." });
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
    setCookie(res, "ddpro_integration_session", `${session}.${sign(session)}`, 8 * 60 * 60);
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    return res.redirect(`${frontendUrl.replace(/\/+$/, "")}/#/ayarlar?integration=google_connected`);
  } catch (error) {
    return next(error);
  }
};

export const requireGoogleSession = (req, res, next) => {
  const secret = process.env.INTEGRATION_SESSION_SECRET;
  const allowedEmails = allowedGoogleEmails();
  const raw = cookieValue(req, "ddpro_integration_session");
  const separator = raw.lastIndexOf(".");
  if (!secret || separator < 0) {
    return res.status(401).json({ status: "error", message: "Google account connection is required." });
  }
  const session = raw.slice(0, separator);
  const signature = raw.slice(separator + 1);
  if (!safeEqual(signature, sign(session))) {
    return res.status(401).json({ status: "error", message: "Integration session is invalid." });
  }
  try {
    const payload = JSON.parse(Buffer.from(session, "base64url").toString("utf8"));
    if (
      payload.expiresAt < Date.now() ||
      !allowedEmails.has(String(payload.email || "").toLowerCase())
    ) {
      return res.status(401).json({ status: "error", message: "Integration session has expired or is not authorized." });
    }
    req.integrationAccount = String(payload.email).toLowerCase();
    return next();
  } catch {
    return res.status(401).json({ status: "error", message: "Integration session is invalid." });
  }
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

export const revokeGoogleSession = (req, res) => {
  res.append(
    "Set-Cookie",
    `ddpro_integration_session=; HttpOnly; Path=/api; Max-Age=0; SameSite=${process.env.NODE_ENV === "production" ? "None; Secure" : "Lax"}`
  );
  return res.status(200).json({ status: "success", data: { disconnected: true } });
};
