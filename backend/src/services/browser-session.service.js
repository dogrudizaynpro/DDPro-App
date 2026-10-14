import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { getIntegrationAdmin } from "../config/integration-admin.js";
import { decryptIntegrationToken, encryptIntegrationToken, readIntegrationTokenSnapshot } from "./integration-vault.service.js";
import { getGoogleConfigurationStatus, getMissingGoogleScopes, GOOGLE_OPERATION_SCOPES } from "./google-integration.service.js";

const lifetime = 8 * 60 * 60 * 1000;
const restoreName = "ddpro_session_restore";
const restorePath = "/api/integrations/google";
const hash = (value) => createHash("sha256").update(value).digest("base64url");
const random = () => randomBytes(32).toString("base64url");
const sign = (value) => createHmac("sha256", process.env.INTEGRATION_SESSION_SECRET).update(value).digest("base64url");
const equal = (a, b) => typeof a === "string" && typeof b === "string" &&
  Buffer.byteLength(a) === Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const pack = (payload, prefix) => {
  const value = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${value}.${sign(`${prefix}${value}`)}`;
};
const unpack = (raw, prefix) => {
  try {
    const separator = raw.lastIndexOf(".");
    const value = raw.slice(0, separator);
    if (separator < 1 || !equal(raw.slice(separator + 1), sign(`${prefix}${value}`))) return null;
    const payload = JSON.parse(Buffer.from(value, "base64url").toString());
    return Number.isFinite(payload.expiresAt) && payload.expiresAt > Date.now() ? payload : null;
  } catch { return null; }
};
const allowedAccount = (email) => (process.env.GOOGLE_ALLOWED_EMAILS || "").split(",")
  .map((value) => value.trim().toLowerCase()).includes(email);
const originAllowed = (req) => {
  try { return req.get("origin") === new URL(process.env.FRONTEND_URL || "http://localhost:5173").origin; }
  catch { return false; }
};
const cookie = (req, name) => {
  try { return decodeURIComponent((req.headers.cookie || "").split(";")
    .map((value) => value.trim()).find((value) => value.startsWith(`${name}=`))?.slice(name.length + 1) || ""); }
  catch { return ""; }
};
const setCookie = (res, name, value, age, path) => res.append("Set-Cookie",
  `${name}=${encodeURIComponent(value)}; HttpOnly; Path=${path}; Max-Age=${age}; Secure; SameSite=${process.env.NODE_ENV === "production" ? "None" : "Lax"}${process.env.NODE_ENV === "production" && name === restoreName ? "; Partitioned" : ""}`);
const clearRestore = (res) => {
  setCookie(res, restoreName, "", 0, restorePath);
  setCookie(res, "ddpro_integration_session", "", 0, "/api");
};
const unauthorized = (res) => res.status(401).json({ status: "error", code: "BROWSER_SESSION_REQUIRED",
  message: "Browser authorization is required. Authorize this browser with Google." });
const jsonOrigin = (req, res) => {
  res.set("Cache-Control", "no-store");
  if (!originAllowed(req)) { res.status(403).json({ status: "error", message: "Request origin is not allowed." }); return false; }
  if (!req.is("application/json")) { res.status(415).json({ status: "error", message: "application/json is required." }); return false; }
  return true;
};
export const browserAuthRpc = async (op, args = {}) => {
  const client = getIntegrationAdmin();
  if (!client) throw Object.assign(new Error("Authorization storage is unavailable."), { statusCode: 503, expose: true });
  const { data, error } = await client.rpc("ddpro_auth", { op, args });
  if (error) throw Object.assign(new Error("Authorization transition could not be completed."), { statusCode: 409, expose: true });
  return data;
};
export const assertBrowserSessionActive = async (session) => {
  if (!session || !await browserAuthRpc("validate", session)) {
    throw Object.assign(new Error("Browser authorization expired or was revoked."), { statusCode: 401, expose: true });
  }
};
const bearerPayload = (req) => {
  if (!originAllowed(req)) return null;
  const header = req.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const value = unpack(header.slice(7), "browser:v2:");
  if (!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(value?.session || "") ||
      !Number.isSafeInteger(value.epoch) || !allowedAccount(value.account)) return null;
  return value;
};
export const getGoogleSessionAccount = async (req) => {
  const payload = bearerPayload(req);
  return payload && await browserAuthRpc("validate", payload) ? payload.account : "";
};
export const requireGoogleSession = async (req, res, next) => {
  res.set("Cache-Control", "no-store");
  if (req.get("authorization") && !originAllowed(req)) return res.status(403).json({ status: "error", message: "Request origin is not allowed." });
  try {
    const payload = bearerPayload(req);
    if (!payload || !await browserAuthRpc("validate", payload)) return unauthorized(res);
    req.integrationAccount = payload.account;
    req.browserSession = { account: payload.account, session: payload.session, epoch: payload.epoch };
    return next();
  } catch (error) { return next(error); }
};
const sessionBearer = (session) => pack({ account: session.account, session: session.session,
  epoch: Number(session.epoch), expiresAt: Math.min(Date.parse(session.expiresAt), Date.now() + lifetime) }, "browser:v2:");
const startOAuth = async (req, res, action = "login") => {
  const challenge = action === "login" ? req.query.challenge : req.body?.challenge;
  if (typeof challenge !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(challenge)) {
    return res.status(400).json({ status: "error", message: "Browser authorization challenge is required." });
  }
  if (!(await getGoogleConfigurationStatus()).oauthFlowAvailable) {
    return res.status(503).json({ status: "error", message: "Google OAuth configuration is required." });
  }
  const attempt = await browserAuthRpc("begin", { challenge, action, ...(action === "login" ? {} : req.browserSession) });
  const nonce = random();
  const details = { attempt: attempt.id, action, nonce, browserNonce: random(), expiresAt: Date.now() + 600_000 };
  setCookie(res, "ddpro_oauth_state", details.browserNonce, 600, "/api/integrations/google/callback");
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID, redirect_uri: process.env.GOOGLE_REDIRECT_URI,
    response_type: "code", scope: action === "login" ? ["openid", "email", ...Object.values(GOOGLE_OPERATION_SCOPES)].join(" ") : "openid email",
    state: pack(details, "oauth:v2:"), nonce,
    access_type: "offline", prompt: action === "login" ? "consent" : "select_account",
    ...(action === "login" ? { include_granted_scopes: "true" } : { max_age: "0" }),
  }).toString();
  res.set("Cache-Control", "no-store");
  return action === "login" ? res.redirect(url.toString()) : res.json({ status: "success", data: { url: url.toString() } });
};
export const beginGoogleOAuth = async (req, res, next) => {
  if (req.query.action || req.query.session) return res.status(400).json({ status: "error", message: "Use authenticated POST /api/sessions/reauth." });
  try { return await startOAuth(req, res); } catch (error) { return next(error); }
};
export const beginSessionReauth = async (req, res, next) => {
  if (!jsonOrigin(req, res)) return;
  if (!["revoke-all", "disconnect"].includes(req.body?.action)) return res.status(400).json({ status: "error", message: "Invalid action." });
  try { return await startOAuth(req, res, req.body.action); } catch (error) { return next(error); }
};
export const completeGoogleOAuth = async (req, res) => {
  const details = unpack(typeof req.query.state === "string" ? req.query.state : "", "oauth:v2:");
  const cookieNonce = cookie(req, "ddpro_oauth_state");
  setCookie(res, "ddpro_oauth_state", "", 0, "/api/integrations/google/callback");
  const redirect = (reason, code = "") => {
    const url = new URL(process.env.FRONTEND_URL || "http://localhost:5173");
    url.hash = `/ayarlar?${new URLSearchParams({ integration: reason ? "google_error" : "google_connected", reason,
      ...(code ? { exchange_code: code } : {}) })}`;
    res.set("Cache-Control", "no-store"); res.set("Referrer-Policy", "no-referrer");
    return res.redirect(url.toString());
  };
  if (!details || !equal(cookieNonce, details.browserNonce)) return redirect("state_invalid");
  if (req.query.error || typeof req.query.code !== "string") return redirect("access_denied");
  try {
    const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ code: req.query.code, client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET, redirect_uri: process.env.GOOGLE_REDIRECT_URI,
        grant_type: "authorization_code" }), signal: AbortSignal.timeout(15_000) });
    const token = await response.json();
    if (!response.ok || !token.access_token) return redirect("token_exchange_failed");
    const profileResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: "Bearer " + token.access_token }, signal: AbortSignal.timeout(10_000) });
    const profile = await profileResponse.json();
    const email = typeof profile.email === "string" ? profile.email.toLowerCase() : "";
    if (!profileResponse.ok || profile.verified_email !== true || !allowedAccount(email)) return redirect("account_not_allowed");
    if (details.action !== "login") {
      if (!token.id_token) return redirect("fresh_authentication_required");
      const verification = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token.id_token)}`,
        { signal: AbortSignal.timeout(10_000) });
      const identity = await verification.json();
      // tokeninfo verifies the exact JWT; Google may omit nonce/auth_time from
      // its response, so read those signed claims only after verification.
      const claims = JSON.parse(Buffer.from(token.id_token.split(".")[1], "base64url").toString());
      const now = Math.floor(Date.now() / 1000);
      if (!verification.ok || identity.aud !== process.env.GOOGLE_CLIENT_ID ||
          !["accounts.google.com", "https://accounts.google.com"].includes(identity.iss) ||
          identity.email?.toLowerCase() !== email || identity.sub !== profile.id ||
          claims.nonce !== details.nonce || Number(identity.exp) <= now ||
          !Number.isFinite(Number(claims.auth_time)) || Number(claims.auth_time) > now + 60 ||
          Number(claims.auth_time) < Math.floor((details.expiresAt - 600_000) / 1000) - 5) {
        return redirect("fresh_authentication_required");
      }
    }
    const snapshot = details.action === "login" ? await readIntegrationTokenSnapshot({ provider: "google", account: email }) : null;
    const existing = snapshot?.value;
    const scopes = typeof token.scope === "string" ? token.scope : existing?.scopes || "";
    const adequate = Boolean(existing && getMissingGoogleScopes(existing.scopes).length === 0 &&
      (existing.refreshToken || existing.expiresAt > Date.now() + 60_000));
    const pending = details.action === "login" ? await browserAuthRpc("pending", { account: email }) : null;
    if (details.action === "login" && !pending && !adequate && getMissingGoogleScopes(scopes).length) return redirect("scope_not_granted");
    const code = random();
    await browserAuthRpc("callback", { attempt: details.attempt, account: email, code: hash(code), adequate,
      snapshot: snapshot?.encryptedToken || null,
      ...(details.action === "login" ? { token: encryptIntegrationToken({
        accessToken: token.access_token, refreshToken: token.refresh_token || existing?.refreshToken || null,
        expiresAt: Date.now() + (Number(token.expires_in) || 3600) * 1000, scopes,
        sessionVersion: random(),
      }) } : {}) });
    return redirect("", code);
  } catch { return redirect("authorization_failed"); }
};
export const exchangeGoogleSession = async (req, res, next) => {
  if (!jsonOrigin(req, res)) return;
  const { code, verifier } = req.body || {};
  if (![code, verifier].every((value) => typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value))) return res.status(400).json({ status: "error", message: "Invalid authorization exchange." });
  try {
    const secret = random(), proof = random();
    const result = await browserAuthRpc("exchange", { code: hash(code), challenge: hash(verifier), session: randomUUID(), restore: hash(secret), proof: hash(proof) });
    if (!result) return unauthorized(res);
    if (result.action) return res.json({ status: "success", data: { action: result.action, proof } });
    setCookie(res, restoreName, `${result.session}.${secret}`, Math.max(0, Math.floor((Date.parse(result.expiresAt) - Date.now()) / 1000)), restorePath);
    return res.json({ status: "success", data: { session: sessionBearer(result) } });
  } catch (error) { return next(error); }
};
export const restoreGoogleSession = async (req, res, next) => {
  if (!jsonOrigin(req, res)) return;
  const [session, secret] = cookie(req, restoreName).split(".");
  if (!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(session || "") ||
      !/^[A-Za-z0-9_-]{43}$/.test(secret || "")) { clearRestore(res); return unauthorized(res); }
  try {
    const result = await browserAuthRpc("restore", { session, restore: hash(secret) });
    if (!result || !allowedAccount(result.account)) { clearRestore(res); return unauthorized(res); }
    return res.json({ status: "success", data: { session: sessionBearer(result) } });
  } catch (error) { return next(error); }
};
export const logoutBrowserSession = async (req, res, next) => {
  if (!jsonOrigin(req, res)) return;
  try {
    const result = await browserAuthRpc("logout", req.browserSession);
    if (!result) return unauthorized(res);
    clearRestore(res);
    return res.json({ status: "success", data: { revoked: true } });
  } catch (error) { return next(error); }
};
export const revokeAllBrowserSessions = async (req, res, next) => {
  if (!jsonOrigin(req, res)) return;
  if (!/^[A-Za-z0-9_-]{43}$/.test(req.body?.proof || "")) return unauthorized(res);
  try {
    const result = await browserAuthRpc("revoke-all", { ...req.browserSession, proof: hash(req.body.proof) });
    if (!result) return unauthorized(res);
    clearRestore(res);
    return res.json({ status: "success", data: { revoked: true } });
  } catch (error) { return next(error); }
};
const retryRevocation = async (account, job) => {
  if (!job?.id) return { providerRevoked: true, pendingRevocation: false };
  const lease = randomUUID();
  const requestDeadline = Date.now() + 10_000;
  const signal = AbortSignal.timeout(10_000);
  job = await browserAuthRpc("claim-revocation", { account, job: job.id, lease });
  if (!job) return { providerRevoked: false, pendingRevocation: true };
  // Keep the durable ciphertext until the provider positively acknowledges revocation.
  let succeeded = false;
  try {
    if (Date.now() >= requestDeadline) throw new Error("Revocation request window expired.");
    signal.throwIfAborted();
    const token = decryptIntegrationToken(job.encrypted_token);
    const response = await fetch("https://oauth2.googleapis.com/revoke", { method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token: token.refreshToken || token.accessToken }),
      signal });
    succeeded = response.ok;
  } catch { succeeded = false; }
  const recorded = await browserAuthRpc("finish-revocation", { account, job: job.id, lease, succeeded });
  if (!recorded?.recorded) succeeded = false;
  return { providerRevoked: succeeded, pendingRevocation: !succeeded };
};
export const disconnectGoogle = async (req, res, next) => {
  if (!jsonOrigin(req, res)) return;
  if (!/^[A-Za-z0-9_-]{43}$/.test(req.body?.proof || "")) return unauthorized(res);
  try {
    const job = await browserAuthRpc("disconnect", { ...req.browserSession, proof: hash(req.body.proof) });
    if (!job) return unauthorized(res);
    clearRestore(res);
    const result = await retryRevocation(req.integrationAccount, job);
    return res.json({ status: "success", data: { disconnected: true, ...result } });
  } catch (error) { return next(error); }
};
export const retryGoogleDisconnect = async (req, res, next) => {
  if (!jsonOrigin(req, res)) return;
  try {
    await assertBrowserSessionActive(req.browserSession);
    const job = await browserAuthRpc("pending", { account: req.integrationAccount });
    return res.json({ status: "success", data: await retryRevocation(req.integrationAccount, job) });
  } catch (error) { return next(error); }
};
export const revokeGoogleSession = (_req, res) => {
  res.set("Cache-Control", "no-store");
  return res.status(409).json({
    status: "error", code: "UPDATE_REQUIRED", message: "Update the application to use browser logout or verified Google disconnect." });
};
