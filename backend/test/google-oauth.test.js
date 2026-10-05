import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { after, before, test } from "node:test";

const keys = [
  "NODE_ENV", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REDIRECT_URI",
  "GOOGLE_ALLOWED_EMAILS", "FRONTEND_URL", "INTEGRATION_SESSION_SECRET",
  "INTEGRATION_TOKEN_ENCRYPTION_KEY", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY",
];
const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
const originalFetch = globalThis.fetch;
let savedToken;
let exchangeGrant;
let server;
let baseUrl;
let workspaceResponse;
let refreshedAccessToken;

before(async () => {
  Object.assign(process.env, {
    NODE_ENV: "production",
    GOOGLE_CLIENT_ID: "test-client",
    GOOGLE_CLIENT_SECRET: "test-secret",
    GOOGLE_REDIRECT_URI: "https://ddpro-app.onrender.com/api/integrations/google/callback",
    GOOGLE_ALLOWED_EMAILS: "owner@example.com",
    FRONTEND_URL: "https://dogrudizaynpro.github.io/DDPro-App/",
    INTEGRATION_SESSION_SECRET: "test-session-secret",
    INTEGRATION_TOKEN_ENCRYPTION_KEY: "a".repeat(64),
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "test-service-role",
  });
  globalThis.fetch = async (input, options = {}) => {
    const url = String(input);
    if (url.includes("/rest/v1/integration_tokens")) {
      if (options.method === "POST") {
        const payload = JSON.parse(options.body);
        const record = Array.isArray(payload) ? payload[0] : payload;
        if (record.provider === "google_session_exchange") exchangeGrant = record;
        else savedToken = record;
        return new Response("", { status: 201 });
      }
      if (options.method === "DELETE") {
        const record = exchangeGrant && url.includes(encodeURIComponent(exchangeGrant.account))
          ? exchangeGrant : null;
        exchangeGrant = null;
        return Response.json(record ? [{ encrypted_token: record.encrypted_token }] : []);
      }
      if (url.includes("select=encrypted_token") && url.includes("provider=eq.google")) {
        return Response.json(savedToken ? [{ encrypted_token: savedToken.encrypted_token }] : []);
      }
      if (url.includes("provider=eq.google") && url.includes("account=eq.owner")) {
        return Response.json(savedToken ? [{ provider: "google" }] : []);
      }
      return Response.json([]);
    }
    if (url === "https://oauth2.googleapis.com/token") {
      if (new URLSearchParams(options.body).get("grant_type") === "refresh_token") {
        assert.equal(new URLSearchParams(options.body).get("refresh_token"), "test-refresh");
        return Response.json({ access_token: refreshedAccessToken || "test-access", expires_in: 3600 });
      }
      return Response.json({ access_token: "test-access", refresh_token: "test-refresh", expires_in: 3600 });
    }
    if (url === "https://www.googleapis.com/oauth2/v2/userinfo") {
      return Response.json({ email: "owner@example.com", verified_email: true });
    }
    if (url === "https://www.googleapis.com/gmail/v1/users/me/profile" ||
        url.startsWith("https://www.googleapis.com/calendar/v3/users/me/calendarList")) {
      assert.equal(options.headers.Authorization, ["Bearer", refreshedAccessToken || "test-access"].join(" "));
      if (workspaceResponse) return workspaceResponse();
      return Response.json({});
    }
    throw new Error(`Unexpected request: ${url}`);
  };
  const { default: app } = await import("../src/app.js");
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  globalThis.fetch = originalFetch;
  for (const key of keys) {
    if (previous[key] === undefined) delete process.env[key];
    else process.env[key] = previous[key];
  }
});

test("OAuth readiness requires a valid redirect and encryption key", async () => {
  const { getGoogleConfigurationStatus } = await import("../src/services/google-integration.service.js");
  const originalKey = process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY;
  const originalRedirect = process.env.GOOGLE_REDIRECT_URI;
  process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY = "invalid-key";
  try {
    const status = await getGoogleConfigurationStatus();
    assert.equal(status.oauthFlowAvailable, false);
    assert.ok(status.missingRequirements.includes("INTEGRATION_TOKEN_ENCRYPTION_KEY"));
    const response = await originalFetch(`${baseUrl}/api/integrations/google/start`, { redirect: "manual" });
    assert.equal(response.status, 503);
    process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY = originalKey;
    process.env.GOOGLE_REDIRECT_URI = "https://example.com/wrong-callback";
    const redirectStatus = await getGoogleConfigurationStatus();
    assert.ok(redirectStatus.missingRequirements.includes("GOOGLE_REDIRECT_URI"));
  } finally {
    process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY = originalKey;
    process.env.GOOGLE_REDIRECT_URI = originalRedirect;
  }
});

test("local OAuth keeps the frontend redirect fallback", async () => {
  const { getGoogleConfigurationStatus } = await import("../src/services/google-integration.service.js");
  const originalUrl = process.env.FRONTEND_URL;
  const originalMode = process.env.NODE_ENV;
  process.env.NODE_ENV = "development";
  delete process.env.FRONTEND_URL;
  try {
    assert.equal((await getGoogleConfigurationStatus()).oauthFlowAvailable, true);
  } finally {
    process.env.FRONTEND_URL = originalUrl;
    process.env.NODE_ENV = originalMode;
  }
});

test("OAuth start redirects to Google and callback stores encrypted token and session", async () => {
  assert.equal((await originalFetch(`${baseUrl}/api/integrations/google/start`, { redirect: "manual" })).status, 400);
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const start = await originalFetch(`${baseUrl}/api/integrations/google/start?challenge=${challenge}`, { redirect: "manual" });
  assert.equal(start.status, 302);
  const destination = new URL(start.headers.get("location"));
  assert.equal(destination.origin, "https://accounts.google.com");
  assert.equal(destination.searchParams.get("redirect_uri"), process.env.GOOGLE_REDIRECT_URI);
  assert.ok(destination.searchParams.get("scope").split(" ").includes("https://www.googleapis.com/auth/gmail.readonly"));
  const stateCookie = start.headers.get("set-cookie").split(";")[0];
  assert.match(start.headers.get("set-cookie"), /HttpOnly.*Secure; SameSite=None/);
  const callback = new URL(`${baseUrl}/api/integrations/google/callback`);
  callback.searchParams.set("state", destination.searchParams.get("state"));
  callback.searchParams.set("code", "test-code");
  const result = await originalFetch(callback, { redirect: "manual", headers: { cookie: stateCookie } });
  assert.equal(result.status, 302);
  assert.match(result.headers.get("location"), /integration=google_connected/);
  assert.match(result.headers.get("set-cookie"), /ddpro_integration_session=/);
  const exchangeCode = new URL(result.headers.get("location").replace("#", "?")).searchParams.get("exchange_code");
  assert.ok(exchangeCode);
  const exchange = async (providedCode, providedVerifier, origin = "https://dogrudizaynpro.github.io") =>
    originalFetch(`${baseUrl}/api/integrations/google/exchange`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: origin },
      body: JSON.stringify({ code: providedCode, verifier: providedVerifier }),
    });
  assert.equal((await exchange(exchangeCode, verifier, "https://evil.example")).status, 403);
  assert.equal((await exchange(exchangeCode, "x".repeat(43))).status, 401);
  assert.equal(savedToken.provider, "google");
  assert.equal(savedToken.account, "owner@example.com");
  assert.notEqual(savedToken.encrypted_token.ciphertext, "test-access");
});

test("one-time exchange authenticates browser status and real provider test route", async () => {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const start = await originalFetch(`${baseUrl}/api/integrations/google/start?challenge=${challenge}`, { redirect: "manual" });
  const stateCookie = start.headers.get("set-cookie").split(";")[0];
  const state = new URL(start.headers.get("location")).searchParams.get("state");
  const callback = `${baseUrl}/api/integrations/google/callback?state=${encodeURIComponent(state)}&code=test-code`;
  const result = await originalFetch(callback, { redirect: "manual", headers: { cookie: stateCookie } });
  const code = new URLSearchParams(result.headers.get("location").split("?")[1]).get("exchange_code");
  assert.ok(code);
  const exchange = await originalFetch(`${baseUrl}/api/integrations/google/exchange`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://dogrudizaynpro.github.io" },
    body: JSON.stringify({ code, verifier }),
  });
  assert.equal(exchange.status, 200);
  const session = (await exchange.json()).data.session;
  assert.equal((await originalFetch(`${baseUrl}/api/integrations/google/exchange`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://dogrudizaynpro.github.io" },
    body: JSON.stringify({ code, verifier }),
  })).status, 401);
  const headers = { Origin: "https://dogrudizaynpro.github.io", Authorization: ["Bearer", session].join(" ") };
  const status = await originalFetch(`${baseUrl}/api/integrations/status`, { headers });
  const data = (await status.json()).data;
  assert.equal(data.gmail.connected, true);
  assert.equal(data.googleCalendar.connected, true);
  for (const provider of ["gmail", "googleCalendar"]) {
    const tested = await originalFetch(`${baseUrl}/api/integrations/test/${provider}`, {
      method: "POST", headers: { ...headers, "Content-Type": "application/json" },
    });
    assert.equal(tested.status, 200);
    assert.equal((await tested.json()).data.connected, true);
  }
  assert.equal((await originalFetch(`${baseUrl}/api/integrations/calendar/events`, {
    headers: { Authorization: ["Bearer", session].join(" "), Origin: "https://evil.example" },
  })).status, 403);

  const testProvider = (provider = "gmail") => originalFetch(`${baseUrl}/api/integrations/test/${provider}`, {
    method: "POST", headers: { ...headers, "Content-Type": "application/json" },
  });
  const getStatus = async () => (await (await originalFetch(`${baseUrl}/api/integrations/status`, { headers })).json()).data;
  const encryptedBefore = structuredClone(savedToken.encrypted_token);
  try {
    for (const [httpStatus, reason, category] of [
      [401, "authError", "authorization"],
      [403, "accessNotConfigured", "access_denied"],
      [429, "rateLimitExceeded", "rate_limit"],
      [400, "badRequest", "api_error"],
      [503, "backendError", "api_error"],
    ]) {
      workspaceResponse = () => Response.json({
        error: {
          code: httpStatus,
          message: `Google failure: ${reason}`,
          errors: [{ reason }],
          // Unrelated provider fields must never be forwarded.
          details: [{ access_token: "test-access", refresh_token: "test-refresh" }],
        },
      }, { status: httpStatus });
      const failure = await testProvider();
      assert.equal(failure.status, httpStatus);
      const failureBody = await failure.json();
      assert.equal(failureBody.message, `Google failure: ${reason}`);
      assert.deepEqual(failureBody.googleApiError, {
        httpStatus, category, message: `Google failure: ${reason}`, reasons: [reason],
      });
      assert.equal(failureBody.data.connected, true);
      assert.equal(failureBody.data.testSucceeded, false);
      assert.doesNotMatch(JSON.stringify(failureBody), /test-access|test-refresh/);
      const current = await getStatus();
      assert.equal(current.gmail.connected, true);
      assert.equal(current.gmail.status, "connected");
      assert.equal(current.gmail.lastTest.testSucceeded, false);
      assert.equal(current.gmail.lastTest.googleApiError.httpStatus, httpStatus);
      assert.equal(current.google.connected, true);
      assert.equal(current.googleCalendar.connected, true);
      assert.deepEqual(savedToken.encrypted_token, encryptedBefore);
    }

    const anonymousStatus = (await (await originalFetch(`${baseUrl}/api/integrations/status`)).json()).data;
    assert.equal(anonymousStatus.gmail.lastTest, null);
    assert.equal(anonymousStatus.gmail.connected, false);

    workspaceResponse = () => new Response("<html>Unavailable</html>", { status: 502 });
    const malformed = await testProvider();
    assert.equal(malformed.status, 502);
    assert.equal((await malformed.json()).googleApiError.message, "Google API request failed (HTTP 502).");

    workspaceResponse = () => { throw new Error("network diagnostic contains test-access"); };
    const unavailable = await testProvider();
    assert.equal(unavailable.status, 502);
    assert.doesNotMatch(JSON.stringify(await unavailable.json()), /test-access/);

    workspaceResponse = () => Response.json({ error: { message: "Calendar access denied", errors: [{ reason: "forbidden" }] } }, { status: 403 });
    assert.equal((await testProvider("googleCalendar")).status, 403);
    const calendarFailure = await getStatus();
    assert.equal(calendarFailure.googleCalendar.status, "test_failed");
    assert.equal(calendarFailure.googleCalendar.connected, false);
    assert.equal(calendarFailure.gmail.connected, true);
    assert.equal(calendarFailure.google.connected, true);

    workspaceResponse = null;
    const { encryptIntegrationToken, decryptIntegrationToken } = await import("../src/services/integration-vault.service.js");
    savedToken.encrypted_token = encryptIntegrationToken({
      ...decryptIntegrationToken(savedToken.encrypted_token), expiresAt: Date.now() - 1,
    });
    refreshedAccessToken = "test-refreshed-access";
    const recovered = await testProvider();
    assert.equal(recovered.status, 200);
    assert.equal((await recovered.json()).data.testSucceeded, true);
    const stored = decryptIntegrationToken(savedToken.encrypted_token);
    assert.equal(stored.accessToken, refreshedAccessToken);
    assert.equal(stored.refreshToken, "test-refresh");
    assert.notEqual(savedToken.encrypted_token.ciphertext, refreshedAccessToken);
    const current = await getStatus();
    assert.equal(current.gmail.status, "connected");
    assert.equal(current.gmail.lastTest.error, "");
    assert.equal(current.gmail.lastTest.testSucceeded, true);
  } finally {
    workspaceResponse = null;
    refreshedAccessToken = null;
  }
});
