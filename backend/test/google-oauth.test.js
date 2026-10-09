import assert from "node:assert/strict";
import { createHash, createHmac, randomBytes } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:https";
import { after, before, test } from "node:test";

const keys = [
  "NODE_ENV", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REDIRECT_URI",
  "GOOGLE_ALLOWED_EMAILS", "FRONTEND_URL", "INTEGRATION_SESSION_SECRET",
  "INTEGRATION_TOKEN_ENCRYPTION_KEY", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "ALLOWED_ORIGINS",
  "AI_API_URL", "AI_API_KEY", "AI_MODEL",
];
const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
const originalFetch = globalThis.fetch;
let savedToken;
let exchangeGrant;
let server;
let baseUrl;
let workspaceResponse;
let projectsSheetValues;
let refreshedAccessToken;
let refreshResponse;
let googleTokenDeletes = 0;
let browserSession;
let restoreCookie;
let callbackCookie;
let providerRequests = 0;
let googleTokenUpserts = 0;
let nextProjectId = 2;
let beforeConditionalTokenUpdate;
const calendarRequests = [];
const projectRows = [{
  id: "10000000-0000-4000-8000-000000000001",
  name: "Restored browser project",
  project_type: "Genel Proje",
  status: "Aktif",
}];
const crmRows = [{
  id: "20000000-0000-4000-8000-000000000001",
  name: "Restored browser customer",
  email: "customer@example.com",
  project_id: projectRows[0].id,
  status: "Yeni",
}];

before(async () => {
  Object.assign(process.env, {
    NODE_ENV: "production",
    GOOGLE_CLIENT_ID: "test-client",
    GOOGLE_CLIENT_SECRET: "test-secret",
    GOOGLE_REDIRECT_URI: "https://ddpro-app.onrender.com/api/integrations/google/callback",
    GOOGLE_ALLOWED_EMAILS: "owner@example.com",
    FRONTEND_URL: "https://dogrudizaynpro.github.io/DDPro-App/",
    ALLOWED_ORIGINS: "https://other.example",
    INTEGRATION_SESSION_SECRET: "test-session-secret",
    INTEGRATION_TOKEN_ENCRYPTION_KEY: "a".repeat(64),
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "test-service-role",
    AI_API_URL: "https://ai.example/v1/chat/completions",
    AI_API_KEY: "test-ai-provider-key",
    AI_MODEL: "test-model",
  });
  globalThis.fetch = async (input, options = {}) => {
    const url = String(input);
    if (url.includes("/rest/v1/integration_tokens")) {
      if (options.method === "POST") {
        const payload = JSON.parse(options.body);
        const record = Array.isArray(payload) ? payload[0] : payload;
        if (record.provider === "google_session_exchange") exchangeGrant = record;
        else {
          assert.equal(record.provider, "google");
          googleTokenUpserts += 1;
          savedToken = record;
        }
        return new Response("", { status: 201 });
      }
      if (options.method === "PATCH") {
        if (beforeConditionalTokenUpdate) {
          const updateHook = beforeConditionalTokenUpdate;
          beforeConditionalTokenUpdate = null;
          await updateHook();
        }
        const query = new URL(url).searchParams;
        assert.equal(query.get("provider"), "eq.google");
        assert.equal(query.get("account"), "eq.owner@example.com");
        const expected = `eq.${JSON.stringify(savedToken?.encrypted_token)}`;
        if (!savedToken || query.get("encrypted_token") !== expected) return Response.json([]);
        savedToken = { ...savedToken, ...JSON.parse(options.body) };
        return Response.json([{ provider: "google" }]);
      }
      if (options.method === "DELETE") {
        if (new URL(url).searchParams.get("provider") === "eq.google") {
          googleTokenDeletes += 1;
          savedToken = null;
        }
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
    if (url.includes("/rest/v1/")) {
      const table = new URL(url).pathname.split("/").at(-1);
      const rows = {
        projects: projectRows, crm_contacts: crmRows, offers: [], research_items: [],
      }[table];
      if (rows) {
        if (table === "projects") {
          const id = new URL(url).searchParams.get("id")?.replace(/^eq\./, "");
          const index = projectRows.findIndex((row) => row.id === id);
          if (options.method === "POST") {
            const body = JSON.parse(options.body);
            const row = {
              id: `10000000-0000-4000-8000-${String(nextProjectId++).padStart(12, "0")}`,
              ...(Array.isArray(body) ? body[0] : body),
            };
            projectRows.push(row);
            return Response.json(row, { status: 201 });
          }
          if (options.method === "PATCH") {
            if (index < 0) return Response.json([]);
            projectRows[index] = { ...projectRows[index], ...JSON.parse(options.body) };
            return Response.json([projectRows[index]]);
          }
          if (options.method === "DELETE") {
            if (index >= 0) projectRows.splice(index, 1);
            return new Response(null, { status: 204 });
          }
          if (id) return Response.json(index < 0 ? [] : [projectRows[index]]);
        }
        return options.method === "HEAD"
          ? new Response(null, { status: 200 })
          : Response.json(rows);
      }
    }
    if (url.startsWith("https://sheets.googleapis.com/v4/spreadsheets/")) {
      assert.equal(options.headers.Authorization, ["Bearer", refreshedAccessToken || "test-access"].join(" "));
      if (url.includes("/values/")) return Response.json({ values: projectsSheetValues || [] });
      return Response.json({ sheets: [{ properties: { sheetId: 123, title: "Projects" } }] });
    }
    providerRequests += 1;
    if (url === "https://oauth2.googleapis.com/revoke") {
      return new Response(null, { status: 200 });
    }
    if (url === "https://oauth2.googleapis.com/token") {
      if (new URLSearchParams(options.body).get("grant_type") === "refresh_token") {
        assert.equal(new URLSearchParams(options.body).get("refresh_token"), "test-refresh");
        if (refreshResponse) return refreshResponse();
        return Response.json({ access_token: refreshedAccessToken || "test-access", expires_in: 3600 });
      }
      return Response.json({
        access_token: "test-access",
        refresh_token: "test-refresh",
        expires_in: 3600,
        scope: "openid email https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/spreadsheets.readonly",
      });
    }
    if (url === "https://www.googleapis.com/oauth2/v2/userinfo") {
      return Response.json({ email: "owner@example.com", verified_email: true });
    }
    if (url === process.env.AI_API_URL) {
      assert.ok(options.headers.Authorization);
      return Response.json({ choices: [{ message: { content: "ok" } }] });
    }
    if (url === "https://www.googleapis.com/gmail/v1/users/me/profile" ||
        url.startsWith("https://www.googleapis.com/calendar/v3/users/me/calendarList") ||
        url.startsWith("https://www.googleapis.com/calendar/v3/calendars/primary/events")) {
      assert.equal(options.headers.Authorization, ["Bearer", refreshedAccessToken || "test-access"].join(" "));
      if (workspaceResponse) return workspaceResponse();
      if (url.includes("/events/")) {
        calendarRequests.push({ method: options.method, url, body: options.body ? JSON.parse(options.body) : null });
        if (options.method === "DELETE") return new Response(null, { status: 204 });
        return Response.json({ id: "event_12345", ...JSON.parse(options.body || "{}") });
      }
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
  assert.ok(destination.searchParams.get("scope").split(" ").includes("https://www.googleapis.com/auth/calendar.events"));
  assert.ok(destination.searchParams.get("scope").split(" ").includes("https://www.googleapis.com/auth/spreadsheets.readonly"));
  const stateCookie = start.headers.get("set-cookie").split(";")[0];
  assert.match(start.headers.get("set-cookie"), /HttpOnly.*Secure; SameSite=None/);
  const callback = new URL(`${baseUrl}/api/integrations/google/callback`);
  callback.searchParams.set("state", destination.searchParams.get("state"));
  callback.searchParams.set("code", "test-code");
  const result = await originalFetch(callback, { redirect: "manual", headers: { cookie: stateCookie } });
  assert.equal(result.status, 302);
  assert.match(result.headers.get("location"), /integration=google_connected/);
  assert.match(result.headers.get("set-cookie"), /ddpro_integration_session=/);
  assert.doesNotMatch(result.headers.get("set-cookie"), /ddpro_session_restore|Partitioned/);
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
  callbackCookie = result.headers.getSetCookie().find((value) => value.startsWith("ddpro_integration_session=")).split(";")[0];
  const code = new URLSearchParams(result.headers.get("location").split("?")[1]).get("exchange_code");
  assert.ok(code);
  const exchange = await originalFetch(`${baseUrl}/api/integrations/google/exchange`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://dogrudizaynpro.github.io" },
    body: JSON.stringify({ code, verifier }),
  });
  assert.equal(exchange.status, 200);
  const persistent = exchange.headers.getSetCookie().find((value) => value.startsWith("ddpro_session_restore="));
  assert.match(persistent, /HttpOnly; Path=\/api\/integrations\/google; Max-Age=2592000; Secure; SameSite=None; Partitioned$/);
  restoreCookie = persistent.split(";")[0];
  assert.equal(exchange.headers.get("cache-control"), "no-store");
  const session = (await exchange.json()).data.session;
  browserSession = session;
  projectsSheetValues = [
    ["Proje Adı", "Müşteri", "Firma", "Lokasyon", "Proje Türü", "Ürün", "Metraj", "Sistem", "Durum", "Başlangıç Tarihi", "Bitiş Tarihi", "Notlar", "Ek sütun"],
    ["Restored browser project", "Existing customer", "Existing company", "Bursa", "Hospital", "Glass", "80", "Curtain wall", "Aktif", "01.01.2020", "31.12.2020", "Keep existing", "verbatim"],
    ["Past project from Sheets", "Customer A", "Company A", "İstanbul", "Hospital", "Facade", "125.5", "Unitized", "Tamamlandı", "01.03.2020", "31.08.2020", "Historical notes", "extra value"],
    ["Missing status project", "Customer B", "Company B", "Ankara", "Office", "Window", "not numeric", "Stick", "", "", "", "", "original value"],
  ];
  const sheetsImportUrl = `${baseUrl}/api/projects/import/google-sheets`;
  const importHeaders = {
    Origin: "https://dogrudizaynpro.github.io",
    Authorization: ["Bearer", session].join(" "),
    "Content-Type": "application/json",
  };
  const firstImport = await originalFetch(sheetsImportUrl, {
    method: "POST",
    headers: importHeaders,
    body: JSON.stringify({ spreadsheetId: "1Abcdefghijklmnopqrstuv12345" }),
  });
  assert.equal(firstImport.status, 200);
  const firstImportData = (await firstImport.json()).data;
  assert.equal(firstImportData.sourceRows, 3);
  assert.deepEqual(firstImportData.added.map(({ name }) => name), ["Past project from Sheets"]);
  assert.equal(firstImportData.existing[0].name, "Restored browser project");
  assert.equal(firstImportData.errors[0].message, "Project status is missing.");
  const importedProject = projectRows.find(({ name }) => name === "Past project from Sheets");
  assert.equal(importedProject.area_m2, 125.5);
  assert.deepEqual(importedProject.systems, ["Unitized"]);
  assert.equal(importedProject.start_date, "01.03.2020");
  assert.equal(importedProject.end_date, "31.08.2020");
  assert.equal(importedProject.source_data.values[12], "extra value");
  const repeatedImport = await originalFetch(sheetsImportUrl, {
    method: "POST",
    headers: importHeaders,
    body: JSON.stringify({ spreadsheetId: "1Abcdefghijklmnopqrstuv12345" }),
  });
  assert.equal((await repeatedImport.json()).data.added.length, 0);
  assert.equal(projectRows.filter(({ name }) => name === "Past project from Sheets").length, 1);
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
  assert.equal(data.crm.connected, true);
  assert.equal(data.crm.status, "connected");
  assert.equal(data.crm.lastTest, null);
  for (const provider of ["gmail", "googleCalendar"]) {
    const tested = await originalFetch(`${baseUrl}/api/integrations/test/${provider}`, {
      method: "POST", headers: { ...headers, "Content-Type": "application/json" },
    });
    assert.equal(tested.status, 200);
    assert.equal((await tested.json()).data.connected, true);
    const afterSuccess = (await (await originalFetch(`${baseUrl}/api/integrations/status`, { headers })).json()).data;
    assert.equal(afterSuccess.gmail.connected, true);
    assert.equal(afterSuccess.googleCalendar.connected, true);
  }
  const calendarHeaders = { ...headers, "Content-Type": "application/json" };
  const calendarBase = `${baseUrl}/api/integrations/calendar/events`;
  const eventUpdate = await originalFetch(`${calendarBase}/event_12345`, {
    method: "PATCH",
    headers: calendarHeaders,
    body: JSON.stringify({
      summary: "Updated event",
      start: "2026-10-07T10:00:00.000Z",
      end: "2026-10-07T11:00:00.000Z",
    }),
  });
  assert.equal(eventUpdate.status, 200);
  assert.equal(calendarRequests.at(-1).method, "PATCH");
  assert.equal(calendarRequests.at(-1).body.summary, "Updated event");
  const invalidEventUpdate = await originalFetch(`${calendarBase}/event_12345`, {
    method: "PATCH",
    headers: calendarHeaders,
    body: JSON.stringify({ start: "not-a-date", end: "2026-10-07T11:00:00.000Z" }),
  });
  assert.equal(invalidEventUpdate.status, 400);
  const eventDelete = await originalFetch(`${calendarBase}/event_12345`, {
    method: "DELETE",
    headers,
  });
  assert.equal(eventDelete.status, 200);
  assert.equal(calendarRequests.at(-1).method, "DELETE");
  for (const method of ["PATCH", "DELETE"]) {
    const protectedResponse = await originalFetch(`${calendarBase}/event_12345`, {
      method,
      headers: { Origin: "https://dogrudizaynpro.github.io", "Content-Type": "application/json" },
      body: JSON.stringify({ summary: "Unauthorized" }),
    });
    assert.equal(protectedResponse.status, 401);
  }
  const unauthenticated = await originalFetch(`${baseUrl}/api/integrations/calendar/events`, {
    method: "POST", headers: { Origin: "https://dogrudizaynpro.github.io" },
  });
  assert.equal(unauthenticated.status, 401);
  assert.equal((await unauthenticated.json()).googleApiError, undefined);
  const invalidSession = await originalFetch(`${baseUrl}/api/integrations/calendar/events`, {
    method: "POST", headers: { ...headers, Authorization: ["Bearer", "invalid-session"].join(" ") },
  });
  assert.equal(invalidSession.status, 401);
  const expiredPayload = Buffer.from(JSON.stringify({
    email: "owner@example.com", expiresAt: Date.now() - 1,
  })).toString("base64url");
  const expiredSignature = createHmac("sha256", process.env.INTEGRATION_SESSION_SECRET)
    .update(`browser:${expiredPayload}`).digest("base64url");
  const expiredSession = await originalFetch(`${baseUrl}/api/integrations/calendar/events`, {
    headers: { ...headers, Authorization: ["Bearer", `${expiredPayload}.${expiredSignature}`].join(" ") },
  });
  assert.equal(expiredSession.status, 401);
  assert.equal((await expiredSession.json()).googleApiError, undefined);
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
      assert.equal(failure.status, httpStatus === 401 ? 502 : httpStatus);
      assert.equal(failure.headers.get("set-cookie"), null);
      const failureBody = await failure.json();
      assert.equal(failureBody.upstreamStatus, httpStatus);
      assert.equal(failureBody.provider, "gmail");
      assert.equal(failureBody.code, httpStatus === 401 ? "GOOGLE_API_AUTH_ERROR"
        : httpStatus === 403 ? "GOOGLE_API_ACCESS_DENIED"
          : httpStatus === 429 ? "GOOGLE_API_RATE_LIMIT" : "GOOGLE_API_ERROR");
      assert.equal(failureBody.message, `Google failure: ${reason}`);
      assert.deepEqual(failureBody.googleApiError, {
        httpStatus, operation: "gmail.profile", category,
        message: `Google failure: ${reason}`, reasons: [reason],
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
      assert.equal(current.googleCalendar.lastTest.testSucceeded, true);
      assert.equal(googleTokenDeletes, 0);
      assert.deepEqual(savedToken.encrypted_token, encryptedBefore);
      const workspaceFailure = await originalFetch(`${baseUrl}/api/integrations/calendar/events`, { headers });
      assert.equal(workspaceFailure.status, httpStatus === 401 ? 502 : httpStatus);
      const workspaceBody = await workspaceFailure.json();
      assert.equal(workspaceBody.provider, "googleCalendar");
      assert.equal(workspaceBody.upstreamStatus, httpStatus);
      assert.equal(workspaceBody.googleApiError.operation, "calendar.events");
    }

    const anonymousStatus = (await (await originalFetch(`${baseUrl}/api/integrations/status`)).json()).data;
    assert.equal(anonymousStatus.gmail.lastTest, null);
    assert.equal(anonymousStatus.gmail.connected, false);
    assert.equal(anonymousStatus.crm.connected, false);
    assert.equal(anonymousStatus.crm.status, "authorization_required");

    workspaceResponse = () => new Response("<html>Unavailable</html>", { status: 502 });
    const malformed = await testProvider();
    assert.equal(malformed.status, 502);
    assert.equal((await malformed.json()).googleApiError.message, "Google API request failed (HTTP 502).");

    workspaceResponse = () => { throw new Error("network diagnostic contains test-access"); };
    const unavailable = await testProvider();
    assert.equal(unavailable.status, 502);
    assert.doesNotMatch(JSON.stringify(await unavailable.json()), /test-access/);

    workspaceResponse = () => Response.json({ error: { message: "Calendar access denied", errors: [{ reason: "forbidden" }] } }, { status: 403 });
    const failedCalendar = await testProvider("googleCalendar");
    assert.equal(failedCalendar.status, 403);
    assert.equal((await failedCalendar.json()).data.connected, true);
    const calendarFailure = await getStatus();
    assert.equal(calendarFailure.googleCalendar.status, "connected");
    assert.equal(calendarFailure.googleCalendar.connected, true);
    assert.equal(calendarFailure.googleCalendar.lastTest.testSucceeded, false);
    assert.equal(calendarFailure.gmail.connected, true);
    assert.equal(calendarFailure.google.connected, true);

    workspaceResponse = null;
    const { encryptIntegrationToken, decryptIntegrationToken } = await import("../src/services/integration-vault.service.js");
    savedToken.encrypted_token = encryptIntegrationToken({
      ...decryptIntegrationToken(savedToken.encrypted_token), expiresAt: Date.now() - 1,
    });
    const expiredToken = structuredClone(savedToken.encrypted_token);
    for (const httpStatus of [400, 401, 403, 429]) {
      refreshResponse = () => Response.json({
        error: "invalid_grant",
        error_description: "Refresh denied test-refresh test-access test-secret",
      }, { status: httpStatus });
      const refreshFailure = await originalFetch(`${baseUrl}/api/integrations/calendar/events`, { headers });
      assert.equal(refreshFailure.status, httpStatus === 401 ? 502 : httpStatus);
      const body = await refreshFailure.json();
      assert.equal(body.upstreamStatus, httpStatus);
      assert.ok(body.googleApiError);
      assert.equal(body.googleApiError.operation, "oauth.token.refresh");
      assert.doesNotMatch(JSON.stringify(body), /test-refresh|test-access|test-secret/);
      assert.deepEqual(savedToken.encrypted_token, expiredToken);
      assert.equal(googleTokenDeletes, 0);
      const current = await getStatus();
      assert.equal(current.gmail.connected, true);
      assert.equal(current.googleCalendar.connected, true);
    }
    const { getGoogleAccessToken } = await import("../src/services/google-integration.service.js");
    refreshResponse = () => new Response("<html>test-refresh</html>", { status: 401 });
    await assert.rejects(getGoogleAccessToken("owner@example.com"), (error) => {
      assert.equal(error.statusCode, 502);
      assert.equal(error.code, "GOOGLE_API_AUTH_ERROR");
      assert.equal(error.upstreamStatus, 401);
      assert.equal(error.googleApiError.operation, "oauth.token.refresh");
      assert.doesNotMatch(error.message, /test-refresh/);
      return true;
    });
    refreshResponse = () => { throw new Error("Network failure test-refresh test-secret"); };
    await assert.rejects(getGoogleAccessToken("owner@example.com"), (error) => {
      assert.equal(error.statusCode, 502);
      assert.doesNotMatch(error.message, /test-refresh|test-secret/);
      return true;
    });
    savedToken.encrypted_token = encryptIntegrationToken({
      ...decryptIntegrationToken(expiredToken), refreshToken: "",
    });
    await assert.rejects(getGoogleAccessToken("owner@example.com"), (error) => {
      assert.equal(error.statusCode, 502);
      assert.equal(error.code, "GOOGLE_API_AUTH_ERROR");
      return true;
    });
    assert.equal(googleTokenDeletes, 0);
    savedToken.encrypted_token = expiredToken;
    refreshResponse = null;
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
    assert.equal((await testProvider("googleCalendar")).status, 200);
    assert.equal((await getStatus()).googleCalendar.connected, true);
  } finally {
    workspaceResponse = null;
    refreshedAccessToken = null;
    refreshResponse = null;
  }
});

test("integration status does not treat a cached AI provider test as live connectivity", async () => {
  const { testIntegrationConnection } = await import("../src/services/integration-health.service.js");
  const testData = await testIntegrationConnection("ai");
  assert.equal(testData.connected, true);

  const status = await originalFetch(`${baseUrl}/api/integrations/status`, {
    headers: { Origin: "https://dogrudizaynpro.github.io" },
  });
  const body = await status.json();
  assert.equal(body.data.ai.connected, false);
  assert.equal(body.data.ai.status, "configured_not_tested");
  assert.equal(body.data.ai.lastTest.connected, true);
  assert.doesNotMatch(JSON.stringify(body), /test-ai-provider-key/);
});

test("exchanged browser session keeps Gmail and Calendar connected on cookie-free reload", async () => {
  const headers = {
    Origin: "https://dogrudizaynpro.github.io",
    Authorization: ["Bearer", browserSession].join(" "),
  };
  const response = await originalFetch(`${baseUrl}/api/integrations/status`, { headers });
  assert.equal(response.status, 200);
  const { data } = await response.json();
  assert.equal(data.gmail.connected, true);
  assert.equal(data.googleCalendar.connected, true);
  const anonymous = await originalFetch(`${baseUrl}/api/integrations/status`);
  const anonymousData = (await anonymous.json()).data;
  assert.equal(anonymousData.gmail.connected, false);
  assert.equal(anonymousData.googleCalendar.connected, false);
});

test("failed Gmail 401 preserves the exchanged session, encrypted token and Calendar OAuth connection", async () => {
  const headers = {
    Origin: "https://dogrudizaynpro.github.io",
    Authorization: ["Bearer", browserSession].join(" "),
    "X-Forwarded-For": "192.0.2.80",
  };
  const encryptedBefore = structuredClone(savedToken.encrypted_token);
  const deletesBefore = googleTokenDeletes;
  const { decryptIntegrationToken } = await import("../src/services/integration-vault.service.js");
  refreshedAccessToken = decryptIntegrationToken(encryptedBefore).accessToken;
  workspaceResponse = () => Response.json({
    error: { message: "Gmail authorization failed", errors: [{ reason: "authError" }] },
  }, { status: 401 });
  try {
    const failed = await originalFetch(`${baseUrl}/api/integrations/test/gmail`, { method: "POST", headers });
    assert.equal(failed.status, 502);
    assert.equal(failed.headers.get("set-cookie"), null);
    const failure = await failed.json();
    assert.equal(failure.code, "GOOGLE_API_AUTH_ERROR");
    assert.equal(failure.data.connected, true);
    const status = await originalFetch(`${baseUrl}/api/integrations/status`, { headers });
    const { data } = await status.json();
    assert.equal(data.gmail.connected, true);
    assert.equal(data.googleCalendar.connected, true);
    assert.equal(data.gmail.lastTest.testSucceeded, false);
    assert.equal(googleTokenDeletes, deletesBefore);
    assert.deepEqual(savedToken.encrypted_token, encryptedBefore);
  } finally {
    workspaceResponse = null;
    refreshedAccessToken = null;
  }
});

const frontendOrigin = "https://dogrudizaynpro.github.io";
const signedPayload = (payload, prefix = "") => {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${createHmac("sha256", process.env.INTEGRATION_SESSION_SECRET)
    .update(`${prefix}${encoded}`).digest("base64url")}`;
};
const restore = (cookie = restoreCookie, headers = {}) =>
  originalFetch(`${baseUrl}/api/integrations/google/restore`, {
    method: "POST",
    headers: {
      Origin: frontendOrigin, "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}), ...headers,
    },
    body: "{}",
  });
const restorePayload = () => JSON.parse(Buffer.from(
  decodeURIComponent(restoreCookie.split("=")[1]).split(".")[0], "base64url",
).toString("utf8"));

test("restoration survives backend restart, issues only a short private bearer and never slides expiry", async () => {
  const beforePayload = restorePayload();
  const tokenBefore = structuredClone(savedToken);
  const { default: app } = await import("../src/app.js");
  await new Promise((resolve) => server.close(resolve));
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  const requestsBefore = providerRequests;
  const response = await restore(restoreCookie, { Authorization: ["Bearer", "invalid"].join(" ") });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("access-control-allow-origin"), frontendOrigin);
  assert.equal(response.headers.get("access-control-allow-credentials"), "true");
  assert.equal(response.headers.get("set-cookie"), null);
  const body = await response.json();
  assert.deepEqual(Object.keys(body.data), ["session"]);
  assert.doesNotMatch(JSON.stringify(body), /test-access|test-refresh|test-refreshed-access|clientSecret/);
  const [encoded, signature] = body.data.session.split(".");
  assert.equal(signature, createHmac("sha256", process.env.INTEGRATION_SESSION_SECRET)
    .update(`browser:${encoded}`).digest("base64url"));
  const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  assert.equal(payload.email, "owner@example.com");
  assert.equal(payload.sessionVersion, beforePayload.sessionVersion);
  assert.ok(payload.expiresAt <= Date.now() + 8 * 60 * 60 * 1000);
  assert.ok(payload.expiresAt <= beforePayload.expiresAt);
  assert.ok(beforePayload.expiresAt > Date.now() + 29 * 24 * 60 * 60 * 1000);
  assert.equal(providerRequests, requestsBefore);
  assert.deepEqual(savedToken, tokenBefore);
  assert.equal((await restore()).headers.get("set-cookie"), null);
  const status = await originalFetch(`${baseUrl}/api/integrations/status`, {
    headers: { Origin: frontendOrigin, Authorization: ["Bearer", body.data.session].join(" ") },
  });
  assert.equal((await status.json()).data.gmail.connected, true);
  for (const [path, rows] of [["/api/projects", projectRows], ["/api/crm", crmRows]]) {
    const response = await originalFetch(`${baseUrl}${path}`, {
      headers: { Origin: frontendOrigin, Authorization: ["Bearer", body.data.session].join(" ") },
    });
    assert.equal(response.status, 200, path);
    assert.deepEqual((await response.json()).data, rows);
    const anonymous = await originalFetch(`${baseUrl}${path}`, {
      headers: { Origin: frontendOrigin },
    });
    assert.equal(anonymous.status, 401, `${path} must not disclose rows anonymously`);
    assert.equal((await anonymous.json()).code, "BROWSER_SESSION_REQUIRED");
  }
});

test("restoration requires exact frontend origin and JSON, with credentialed CORS preflight", async () => {
  for (const Origin of ["", "null", "https://evil.example", `${frontendOrigin}.evil.example`]) {
    const response = await restore(restoreCookie, { Origin });
    assert.equal(response.status, 403);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.headers.get("set-cookie"), null);
    if (Origin) assert.equal(response.headers.get("access-control-allow-origin"), null);
  }
  for (const type of ["text/plain", "application/x-www-form-urlencoded", "multipart/form-data"]) {
    const response = await restore(restoreCookie, { "Content-Type": type });
    assert.equal(response.status, 415);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.headers.get("set-cookie"), null);
  }
  const preflight = await originalFetch(`${baseUrl}/api/integrations/google/restore`, {
    method: "OPTIONS",
    headers: { Origin: frontendOrigin, "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "content-type,authorization" },
  });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get("access-control-allow-origin"), frontendOrigin);
  assert.equal(preflight.headers.get("access-control-allow-credentials"), "true");
  assert.match(preflight.headers.get("access-control-allow-headers"), /content-type/);
  assert.match(preflight.headers.get("access-control-allow-headers"), /authorization/);
  assert.match(preflight.headers.get("vary"), /Origin/);
  for (const Origin of ["https://evil.example", "http://localhost:5173"]) {
    const denied = await originalFetch(`${baseUrl}/api/projects`, {
      method: "OPTIONS",
      headers: { Origin, "Access-Control-Request-Method": "POST" },
    });
    assert.equal(denied.headers.get("access-control-allow-origin"), null);
  }
  const otherOrigin = await restore(restoreCookie, { Origin: "https://other.example" });
  assert.equal(otherOrigin.status, 403);
  assert.equal(otherOrigin.headers.get("access-control-allow-origin"), "https://other.example");
});

test("restored production session authorizes project CRUD and persists across another restoration", async () => {
  const forwarded = { "X-Forwarded-For": "192.0.2.90" };
  const restored = await restore(restoreCookie, forwarded);
  assert.equal(restored.status, 200);
  const session = (await restored.json()).data.session;
  const headers = { ...forwarded, Origin: frontendOrigin,
    Authorization: ["Bearer", session].join(" "), "Content-Type": "application/json" };
  for (const method of ["POST", "PATCH", "DELETE"]) {
    const unauthorized = await originalFetch(`${baseUrl}/api/projects${method === "POST" ? "" : `/${projectRows[0].id}`}`, {
      method, headers: { Origin: frontendOrigin, "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Unauthorized", status: "Aktif" }),
    });
    assert.equal(unauthorized.status, 401);
    assert.equal((await unauthorized.json()).code, "BROWSER_SESSION_REQUIRED");
  }
  const created = await originalFetch(`${baseUrl}/api/projects`, {
    method: "POST", headers, body: JSON.stringify({ name: "Persistent production project" }),
  });
  assert.equal(created.status, 201);
  assert.equal(created.headers.get("access-control-allow-origin"), frontendOrigin);
  assert.equal(created.headers.get("access-control-allow-credentials"), "true");
  const row = (await created.json()).data;
  assert.equal(row.name, "Persistent production project");
  const reloaded = await restore(restoreCookie, forwarded);
  assert.equal(reloaded.status, 200);
  headers.Authorization = ["Bearer", (await reloaded.json()).data.session].join(" ");
  const list = await originalFetch(`${baseUrl}/api/projects`, { headers });
  assert.equal(list.status, 200);
  assert.ok((await list.json()).data.some(({ id }) => id === row.id));
  const updated = await originalFetch(`${baseUrl}/api/projects/${row.id}`, {
    method: "PATCH", headers, body: JSON.stringify({ status: "Tamamlandı" }),
  });
  assert.equal(updated.status, 200);
  assert.equal((await updated.json()).data.status, "Tamamlandı");
  const denied = await originalFetch(`${baseUrl}/api/projects`, {
    headers: { ...headers, Origin: "https://other.example" },
  });
  assert.equal(denied.status, 403);
  const deleted = await originalFetch(`${baseUrl}/api/projects/${row.id}`, { method: "DELETE", headers });
  assert.equal(deleted.status, 200);
  const final = await originalFetch(`${baseUrl}/api/projects`, { headers });
  assert.equal((await final.json()).data.some(({ id }) => id === row.id), false);
});

test("authenticated integration status reports a stale bearer as a browser-session 401, not disconnected Google", async () => {
  const response = await originalFetch(`${baseUrl}/api/integrations/status`, {
    headers: { Origin: frontendOrigin, Authorization: ["Bearer", "invalid-browser-session"].join(" ") },
  });
  assert.equal(response.status, 401);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal((await response.json()).code, "BROWSER_SESSION_REQUIRED");
  const anonymous = await originalFetch(`${baseUrl}/api/integrations/status`, { headers: { Origin: frontendOrigin } });
  assert.equal(anonymous.status, 200);
  assert.equal(anonymous.headers.get("cache-control"), "no-store");
  assert.equal((await anonymous.json()).data.gmail.connected, false);
});

test("Chromium accepts the production-origin CHIPS cookie and restores after refresh and browser restart", {
  skip: !existsSync(process.env.DDPRO_CHROMIUM_PATH || "/usr/bin/chromium") ||
    typeof WebSocket === "undefined" ? "Chromium and native WebSocket are required" : false,
  timeout: 60_000,
}, async () => {
  const profile = await mkdtemp(join(tmpdir(), "ddpro-browser-session-"));
  const { encryptIntegrationToken } = await import("../src/services/integration-vault.service.js");
  const code = randomBytes(32).toString("base64url");
  const verifier = randomBytes(32).toString("base64url");
  exchangeGrant = {
    provider: "google_session_exchange",
    account: createHash("sha256").update(code).digest("base64url"),
    encrypted_token: encryptIntegrationToken({
      session: browserSession.split(".")[0],
      challenge: createHash("sha256").update(verifier).digest("base64url"),
      expiresAt: Date.now() + 120_000,
    }),
  };
  const certificate = spawnSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes",
    "-keyout", join(profile, "key.pem"), "-out", join(profile, "cert.pem"),
    "-subj", "/CN=ddpro-app.onrender.com", "-days", "1"], { stdio: "ignore" });
  assert.equal(certificate.status, 0, "A temporary browser-fixture certificate must be generated");
  const { default: app } = await import("../src/app.js");
  const calls = [];
  const httpsServer = createServer({
    key: await readFile(join(profile, "key.pem")), cert: await readFile(join(profile, "cert.pem")),
  }, (req, res) => {
    if (req.method === "POST") calls.push(req.url);
    req.headers["x-forwarded-for"] = "192.0.2.100";
    app(req, res);
  }).listen(0, "127.0.0.1");
  await once(httpsServer, "listening");
  const apiOrigin = `https://ddpro-app.onrender.com:${httpsServer.address().port}`;
  const frontend = `${frontendOrigin}/DDPro-App/`;
  let browser;
  let websocket;
  let command;
  let browserClosed;
  let proxyError;
  const networkFailures = [];
  const pageHtml = `<!doctype html><script>
    (async () => {
      const exchange = new URLSearchParams(location.search).get("phase") === "exchange";
      const auth = await fetch(${JSON.stringify(apiOrigin)} + "/api/integrations/google/" + (exchange ? "exchange" : "restore"), {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(exchange ? ${JSON.stringify({ code, verifier })} : {})
      });
      const body = await auth.json();
      if (!auth.ok) throw new Error(body.code || body.message);
      sessionStorage.setItem("ddpro_browser_session", body.data.session);
      const headers = { Authorization: ["Bearer", body.data.session].join(" "), "Content-Type": "application/json" };
      if (exchange) {
        const created = await fetch(${JSON.stringify(apiOrigin)} + "/api/projects", {
          method: "POST", credentials: "include", headers, body: JSON.stringify({ name: "CHIPS browser project" })
        });
        if (created.status !== 201) throw new Error("Project creation failed");
      }
      const [projects, status] = await Promise.all([
        fetch(${JSON.stringify(apiOrigin)} + "/api/projects", { credentials: "include", headers }).then(r => r.json()),
        fetch(${JSON.stringify(apiOrigin)} + "/api/integrations/status", { credentials: "include", headers }).then(r => r.json())
      ]);
      window.result = { projects: projects.data, gmail: status.data.gmail.connected, calendar: status.data.googleCalendar.connected };
    })().catch(error => { window.result = { error: error.message }; });
  </script>`;
  const startBrowser = async () => {
    browser = spawn(process.env.DDPRO_CHROMIUM_PATH || "/usr/bin/chromium", [
      "--headless", "--no-sandbox", "--disable-gpu", "--disable-background-networking",
      // This isolated test browser accepts the fixture certificate; application TLS is unchanged.
      "--ignore-certificate-errors", "--host-resolver-rules=MAP ddpro-app.onrender.com 127.0.0.1",
      "--no-proxy-server", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank",
    ], { stdio: "ignore" });
    browserClosed = once(browser, "exit");
    let port;
    for (let attempt = 0; attempt < 300; attempt += 1) {
      try {
        port = Number((await readFile(join(profile, "DevToolsActivePort"), "utf8")).split("\n")[0]);
        if (port) break;
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    assert.ok(port, "Chromium debugging endpoint must start");
    const targets = await (await originalFetch(`http://127.0.0.1:${port}/json`)).json();
    websocket = new WebSocket(targets.find((target) => target.type === "page").webSocketDebuggerUrl);
    await once(websocket, "open");
    const pending = new Map();
    let id = 0;
    command = (method, params = {}) => new Promise((resolve, reject) => {
      const next = ++id;
      const timeout = setTimeout(() => { pending.delete(next); reject(new Error(`CDP timeout: ${method}`)); }, 10_000);
      pending.set(next, (message) => {
        clearTimeout(timeout);
        if (message.error) reject(new Error(message.error.message));
        else resolve(message.result);
      });
      websocket.send(JSON.stringify({ id: next, method, params }));
    });
    websocket.addEventListener("message", async (event) => {
      const message = JSON.parse(event.data);
      if (Number.isSafeInteger(message.id)) {
        const handler = pending.get(message.id);
        if (typeof handler !== "function") return;
        pending.delete(message.id);
        handler(message);
      } else if (message.method === "Network.loadingFailed") {
        networkFailures.push({ error: message.params.errorText, reason: message.params.blockedReason });
      } else if (message.method === "Fetch.requestPaused") {
        const { requestId } = message.params;
        try {
          await command("Fetch.fulfillRequest", { requestId, responseCode: 200,
            responseHeaders: [{ name: "Content-Type", value: "text/html" }],
            body: Buffer.from(pageHtml).toString("base64") });
        } catch (error) {
          proxyError = error;
          await command("Fetch.failRequest", { requestId, errorReason: "Failed" }).catch(() => {});
        }
      }
    });
    // The frontend document is a fixture; real backend responses go through Chromium's cookie/CORS stack.
    await command("Fetch.enable", { patterns: [
      { urlPattern: `${frontend}*` },
    ] });
    await command("Network.enable");
    // The Render hostname maps to a loopback fixture, not a public production address.
    await command("Browser.grantPermissions", {
      origin: frontendOrigin, permissions: ["localNetworkAccess", "loopbackNetwork"],
    });
  };
  const waitForResult = async () => {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      if (proxyError) throw proxyError;
      const { result } = await command("Runtime.evaluate", { expression: "window.result", returnByValue: true });
      if (result.value) {
        assert.equal(result.value.error, undefined, JSON.stringify(networkFailures));
        assert.equal(result.value.gmail, true);
        assert.equal(result.value.calendar, true);
        assert.ok(result.value.projects.some((project) => project.name === "CHIPS browser project"));
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    assert.fail("Browser restoration must complete");
  };
  const closeBrowser = async () => {
    await command("Browser.close");
    await browserClosed;
    websocket.close();
    browser = null;
    await rm(join(profile, "DevToolsActivePort"), { force: true });
  };
  try {
    await startBrowser();
    await command("Page.navigate", { url: `${frontend}?phase=exchange#/projects` });
    await waitForResult();
    const { cookies } = await command("Storage.getCookies");
    const cookie = cookies.find(({ name }) => name === "ddpro_session_restore");
    assert.ok(cookie);
    assert.equal(cookie.httpOnly, true);
    assert.equal(cookie.secure, true);
    assert.equal(cookie.sameSite, "None");
    assert.equal(cookie.path, "/api/integrations/google");
    assert.equal(cookie.partitionKey?.topLevelSite, frontendOrigin);
    assert.ok(cookie.expires * 1000 > Date.now() + 29 * 24 * 60 * 60 * 1000);
    await command("Runtime.evaluate", { expression: "sessionStorage.clear()" });
    await command("Page.navigate", { url: `${frontend}?phase=restore#/projects` });
    await waitForResult();
    await command("Runtime.evaluate", { expression: "sessionStorage.clear(); window.result = undefined" });
    await command("Page.reload");
    await waitForResult();
    await closeBrowser();
    await startBrowser();
    await command("Page.navigate", { url: `${frontend}?phase=restore#/projects` });
    await waitForResult();
    assert.equal(calls.filter((url) => url.endsWith("/google/exchange")).length, 1);
    assert.equal(calls.filter((url) => url.endsWith("/google/restore")).length, 3);
    await closeBrowser();
  } finally {
    if (browser) { browser.kill("SIGTERM"); await browserClosed; }
    websocket?.close();
    await new Promise((resolve) => httpsServer.close(resolve));
    await rm(profile, { recursive: true, force: true });
    const index = projectRows.findIndex((row) => row.name === "CHIPS browser project");
    if (index >= 0) projectRows.splice(index, 1);
  }
});

test("missing, expired, tampered and malformed restoration proof require browser authorization", async () => {
  const payload = restorePayload();
  const cookies = [
    "", `${restoreCookie}tampered`, "ddpro_session_restore=%ZZ",
    ...[Date.now() - 1, null, "9999999999999"].map((expiresAt) =>
      `ddpro_session_restore=${signedPayload({ ...payload, expiresAt }, "restore:")}`),
    `ddpro_session_restore=${signedPayload({ ...payload, email: "other@example.com" }, "restore:")}`,
    `ddpro_session_restore=${signedPayload({ ...payload, sessionVersion: undefined }, "restore:")}`,
  ];
  for (const Cookie of cookies) {
    const response = await restore(Cookie, { Authorization: ["Bearer", browserSession].join(" ") });
    assert.equal(response.status, 401);
    const body = await response.json();
    assert.equal(body.code, "BROWSER_SESSION_REQUIRED");
    assert.match(body.message, /Browser authorization/);
    assert.doesNotMatch(body.message, /connection is required/);
    assert.match(response.headers.get("set-cookie"),
      /ddpro_session_restore=; HttpOnly; Path=\/api\/integrations\/google; Max-Age=0; Secure; SameSite=None; Partitioned/);
  }
  const invalidWithFallback = await restore(`ddpro_session_restore=invalid; ${callbackCookie}`);
  assert.equal((await invalidWithFallback.json()).code, "BROWSER_SESSION_REQUIRED");
});

test("valid callback cookie bootstraps restoration only from browser-origin JSON", async () => {
  const response = await restore(callbackCookie);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("set-cookie"), /ddpro_session_restore=.*Partitioned/);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const bearer = (await response.json()).data.session;
  assert.ok(bearer);
  const invalid = await restore("ddpro_integration_session=invalid");
  assert.equal((await invalid.json()).code, "BROWSER_SESSION_REQUIRED");
});

test("legacy callback upgrade stores a version only in the encrypted Google token", async () => {
  const { encryptIntegrationToken, decryptIntegrationToken } = await import("../src/services/integration-vault.service.js");
  const previousToken = structuredClone(savedToken);
  const { sessionVersion: _version, ...legacyToken } = decryptIntegrationToken(savedToken.encrypted_token);
  savedToken.encrypted_token = encryptIntegrationToken(legacyToken);
  const legacyCookie = `ddpro_integration_session=${signedPayload({
    email: "owner@example.com", expiresAt: Date.now() + 60_000,
  })}`;
  try {
    const response = await restore(legacyCookie);
    assert.equal(response.status, 200);
    assert.equal(savedToken.provider, "google");
    const token = decryptIntegrationToken(savedToken.encrypted_token);
    assert.match(token.sessionVersion, /^[A-Za-z0-9_-]{43}$/);
    assert.equal(savedToken.sessionVersion, undefined);
    assert.equal(token.accessToken, legacyToken.accessToken);
    const cookie = response.headers.getSetCookie().find((value) => value.startsWith("ddpro_session_restore=")).split(";")[0];
    assert.equal((await restore(cookie)).status, 200);
    assert.doesNotMatch(JSON.stringify(await response.json()), /test-refresh|test-access|test-refreshed-access/);
    const staleLegacy = await restore(legacyCookie);
    assert.equal(staleLegacy.status, 401);
    assert.equal((await staleLegacy.json()).code, "BROWSER_SESSION_REQUIRED");
  } finally {
    savedToken = previousToken;
  }
});

test("restoration bearer cannot extend the absolute cookie expiry", async () => {
  const expiresAt = Date.now() + 60_000;
  const cookie = `ddpro_session_restore=${signedPayload({ ...restorePayload(), expiresAt }, "restore:")}`;
  const expiredBearer = signedPayload({ email: "owner@example.com", expiresAt: Date.now() - 1 }, "browser:");
  const response = await restore(cookie, { Authorization: ["Bearer", expiredBearer].join(" ") });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("set-cookie"), null);
  const bearer = (await response.json()).data.session;
  const payload = JSON.parse(Buffer.from(bearer.split(".")[0], "base64url").toString("utf8"));
  assert.equal(payload.expiresAt, expiresAt);
});

test("proven browser without stored Google token gets connection-required, including cookie middleware", async () => {
  const previousToken = savedToken;
  savedToken = null;
  try {
    const response = await restore();
    assert.equal(response.status, 401);
    assert.equal((await response.json()).code, "GOOGLE_CONNECTION_REQUIRED");
    assert.match(response.headers.get("set-cookie"), /Max-Age=0.*Partitioned/);
    const protectedResponse = await originalFetch(`${baseUrl}/api/integrations/calendar/events`, {
      headers: { Cookie: callbackCookie, "X-Forwarded-For": "192.0.2.30" },
    });
    assert.equal(protectedResponse.status, 401);
    assert.equal((await protectedResponse.json()).code, "GOOGLE_CONNECTION_REQUIRED");
  } finally {
    savedToken = previousToken;
  }
});

test("session parsing rejects non-finite expiry while legacy signed bearers still authenticate", async () => {
  for (const expiresAt of [null, "9999999999999", undefined]) {
    const session = signedPayload({ email: "owner@example.com", expiresAt }, "browser:");
    const response = await originalFetch(`${baseUrl}/api/integrations/status`, {
      headers: { Origin: frontendOrigin, Authorization: ["Bearer", session].join(" ") },
    });
    assert.equal(response.status, 401);
    assert.equal((await response.json()).code, "BROWSER_SESSION_REQUIRED");
  }
  const legacy = signedPayload({ email: "owner@example.com", expiresAt: Date.now() + 60_000 }, "browser:");
  const { encryptIntegrationToken, decryptIntegrationToken } = await import("../src/services/integration-vault.service.js");
  const previousToken = structuredClone(savedToken);
  const { sessionVersion: _version, ...legacyToken } = decryptIntegrationToken(savedToken.encrypted_token);
  savedToken.encrypted_token = encryptIntegrationToken(legacyToken);
  try {
    for (const proof of [
      { Authorization: ["Bearer", legacy].join(" ") },
      { Cookie: `ddpro_integration_session=${signedPayload({
        email: "owner@example.com", expiresAt: Date.now() + 60_000,
      })}` },
    ]) {
      const response = await originalFetch(`${baseUrl}/api/integrations/status`, {
        headers: { Origin: frontendOrigin, ...proof },
      });
      assert.equal((await response.json()).data.gmail.connected, true);
      const protectedResponse = await originalFetch(`${baseUrl}/api/integrations/calendar/events/bad`, {
        headers: { Origin: frontendOrigin, "X-Forwarded-For": "192.0.2.70", ...proof },
      });
      assert.equal(protectedResponse.status, 400);
    }
  } finally {
    savedToken = previousToken;
  }
  const versioned = await originalFetch(`${baseUrl}/api/integrations/status`, {
    headers: { Origin: frontendOrigin, Authorization: ["Bearer", legacy].join(" ") },
  });
  assert.equal(versioned.status, 401);
  assert.equal((await versioned.json()).code, "BROWSER_SESSION_REQUIRED");
});

test("restoration rate limit returns no-store without changing cookies or contacting Google", async () => {
  const requestsBefore = providerRequests;
  for (let index = 0; index < 30; index += 1) {
    assert.equal((await restore(restoreCookie, { "X-Forwarded-For": "192.0.2.40" })).status, 200);
  }
  const blocked = await restore(restoreCookie, { "X-Forwarded-For": "192.0.2.40" });
  assert.equal(blocked.status, 429);
  assert.equal(blocked.headers.get("cache-control"), "no-store");
  assert.equal(blocked.headers.get("set-cookie"), null);
  assert.equal(providerRequests, requestsBefore);
});

test("disconnect clears matching cookies and reconnect cannot revive old restore cookies or versioned sessions", async () => {
  const { decryptIntegrationToken } = await import("../src/services/integration-vault.service.js");
  const oldVersion = decryptIntegrationToken(savedToken.encrypted_token).sessionVersion;
  const legacyPayload = { email: "owner@example.com", expiresAt: Date.now() + 60_000 };
  const legacyCookie = `ddpro_integration_session=${signedPayload(legacyPayload)}`;
  const legacyBearer = signedPayload(legacyPayload, "browser:");
  const disconnected = await originalFetch(`${baseUrl}/api/integrations/google/logout`, {
    method: "POST",
    headers: { Origin: frontendOrigin, Authorization: ["Bearer", browserSession].join(" "),
      "X-Forwarded-For": "192.0.2.50" },
  });
  assert.equal(disconnected.status, 200);
  assert.equal(savedToken, null);
  assert.deepEqual((await disconnected.json()).data, { disconnected: true, providerRevoked: true });
  const cleared = disconnected.headers.getSetCookie();
  assert.ok(cleared.some((cookie) => /ddpro_integration_session=; HttpOnly; Path=\/api; Max-Age=0; Secure; SameSite=None$/.test(cookie)));
  assert.ok(cleared.some((cookie) => /ddpro_session_restore=; HttpOnly; Path=\/api\/integrations\/google; Max-Age=0; Secure; SameSite=None; Partitioned$/.test(cookie)));
  assert.equal((await (await restore(restoreCookie, { "X-Forwarded-For": "192.0.2.50" })).json()).code, "GOOGLE_CONNECTION_REQUIRED");
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const headers = { "X-Forwarded-For": "192.0.2.60" };
  const start = await originalFetch(`${baseUrl}/api/integrations/google/start?challenge=${challenge}`, {
    redirect: "manual", headers,
  });
  const state = new URL(start.headers.get("location")).searchParams.get("state");
  const callback = await originalFetch(`${baseUrl}/api/integrations/google/callback?state=${encodeURIComponent(state)}&code=reconnect`, {
    redirect: "manual", headers: { ...headers, Cookie: start.headers.get("set-cookie").split(";")[0] },
  });
  assert.equal(callback.status, 302);
  assert.doesNotMatch(callback.headers.get("set-cookie"), /ddpro_session_restore/);
  assert.notEqual(decryptIntegrationToken(savedToken.encrypted_token).sessionVersion, oldVersion);
  assert.equal((await (await restore(restoreCookie, { "X-Forwarded-For": "192.0.2.60" })).json()).code, "BROWSER_SESSION_REQUIRED");
  const legacyRestore = await restore(legacyCookie, headers);
  assert.equal(legacyRestore.status, 401);
  assert.equal((await legacyRestore.json()).code, "BROWSER_SESSION_REQUIRED");
  for (const proof of [
    { Authorization: ["Bearer", browserSession].join(" ") }, { Cookie: callbackCookie },
    { Authorization: ["Bearer", legacyBearer].join(" ") }, { Cookie: legacyCookie },
  ]) {
    const response = await originalFetch(`${baseUrl}/api/integrations/calendar/events`, {
      headers: { ...headers, Origin: frontendOrigin, ...proof },
    });
    assert.equal(response.status, 401);
    assert.equal((await response.json()).code, "BROWSER_SESSION_REQUIRED");
    const staleStatus = await originalFetch(`${baseUrl}/api/integrations/status`, {
      headers: { Origin: frontendOrigin, ...proof },
    });
    if (proof.Authorization) {
      assert.equal(staleStatus.status, 401);
      assert.equal((await staleStatus.json()).code, "BROWSER_SESSION_REQUIRED");
    } else {
      assert.equal(staleStatus.status, 200);
      assert.equal((await staleStatus.json()).data.gmail.connected, false);
    }
  }
  const staleStatus = await originalFetch(`${baseUrl}/api/integrations/status`, {
    headers: { Origin: frontendOrigin, Authorization: ["Bearer", browserSession].join(" ") },
  });
  assert.equal(staleStatus.status, 401);
  assert.equal((await staleStatus.json()).code, "BROWSER_SESSION_REQUIRED");
  const code = new URLSearchParams(callback.headers.get("location").split("?")[1]).get("exchange_code");
  const exchanged = await originalFetch(`${baseUrl}/api/integrations/google/exchange`, {
    method: "POST", headers: { ...headers, Origin: frontendOrigin, "Content-Type": "application/json" },
    body: JSON.stringify({ code, verifier }),
  });
  assert.equal(exchanged.status, 200);
  const newCookie = exchanged.headers.getSetCookie().find((value) => value.startsWith("ddpro_session_restore=")).split(";")[0];
  assert.equal((await restore(newCookie, headers)).status, 200);
});

test("refresh racing disconnect or OAuth reconnection cannot resurrect or overwrite the saved Google token", async () => {
  const { getGoogleAccessToken } = await import("../src/services/google-integration.service.js");
  const { encryptIntegrationToken, decryptIntegrationToken, removeIntegrationToken, saveIntegrationToken } =
    await import("../src/services/integration-vault.service.js");
  const previousToken = structuredClone(savedToken);
  try {
    for (const change of ["disconnect", "reconnect"]) {
      savedToken = structuredClone(previousToken);
      const oldToken = decryptIntegrationToken(savedToken.encrypted_token);
      savedToken.encrypted_token = encryptIntegrationToken({ ...oldToken, expiresAt: Date.now() - 1 });
      let releaseRefresh;
      let refreshStarted;
      const started = new Promise((resolve) => { refreshStarted = resolve; });
      refreshResponse = async () => {
        refreshStarted();
        await new Promise((resolve) => { releaseRefresh = resolve; });
        return Response.json({ access_token: "stale-refreshed-access", expires_in: 3600 });
      };
      const refreshing = getGoogleAccessToken("owner@example.com");
      await started;
      if (change === "disconnect") {
        await removeIntegrationToken({ provider: "google", account: "owner@example.com" });
      } else {
        await saveIntegrationToken({
          provider: "google", account: "owner@example.com",
          value: { ...oldToken, accessToken: "reconnected-access",
            sessionVersion: randomBytes(32).toString("base64url") },
        });
      }
      const expectedToken = structuredClone(savedToken);
      const upsertsAfterChange = googleTokenUpserts;
      releaseRefresh();
      await assert.rejects(refreshing, (error) => {
        assert.equal(error.statusCode, 409);
        return true;
      });
      assert.deepEqual(savedToken, expectedToken, change);
      assert.equal(googleTokenUpserts, upsertsAfterChange, "stale refresh must never upsert");
    }
  } finally {
    savedToken = previousToken;
    refreshResponse = null;
  }
});

test("legacy restoration bootstrap racing disconnect or reconnect never replaces the changed Google token", async () => {
  const { encryptIntegrationToken, decryptIntegrationToken, removeIntegrationToken, saveIntegrationToken } =
    await import("../src/services/integration-vault.service.js");
  const previousToken = structuredClone(savedToken);
  const { sessionVersion: _version, ...legacyToken } = decryptIntegrationToken(savedToken.encrypted_token);
  const legacyCookie = `ddpro_integration_session=${signedPayload({
    email: "owner@example.com", expiresAt: Date.now() + 60_000,
  })}`;
  try {
    for (const change of ["disconnect", "reconnect"]) {
      savedToken = { ...previousToken, encrypted_token: encryptIntegrationToken(legacyToken) };
      let expectedToken;
      let upsertsAfterChange;
      beforeConditionalTokenUpdate = async () => {
        if (change === "disconnect") {
          await removeIntegrationToken({ provider: "google", account: "owner@example.com" });
        } else {
          await saveIntegrationToken({
            provider: "google", account: "owner@example.com",
            value: { ...legacyToken, sessionVersion: randomBytes(32).toString("base64url") },
          });
        }
        expectedToken = structuredClone(savedToken);
        upsertsAfterChange = googleTokenUpserts;
      };
      const response = await restore(legacyCookie, { "X-Forwarded-For": "192.0.2.90" });
      assert.equal(response.status, 401);
      assert.equal((await response.json()).code, "BROWSER_SESSION_REQUIRED");
      assert.equal(response.headers.get("set-cookie"), null);
      assert.deepEqual(savedToken, expectedToken, change);
      assert.equal(googleTokenUpserts, upsertsAfterChange, "stale bootstrap must never upsert");
    }
  } finally {
    savedToken = previousToken;
    beforeConditionalTokenUpdate = null;
  }
});
