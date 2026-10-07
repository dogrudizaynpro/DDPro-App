import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";

const originals = {
  window: globalThis.window,
  sessionStorage: globalThis.sessionStorage,
  fetch: globalThis.fetch,
};
const storage = new Map();
let requests;
let response;
let fetchAPI;
let testIntegrationConnection;
let getIntegrationStatus;
let formatGoogleIntegrationError;
let completeGoogleConnection;
let setBrowserSession;
let clearBrowserSession;
let confirmAiAction;
let disconnectGoogle;
let sendWhatsAppText;

before(async () => {
  globalThis.window = {
    location: { hostname: "localhost", pathname: "/DDPro-App/", search: "", hash: "" },
    history: { replaceState: (_state, _title, url) => {
      window.location.hash = new URL(url, "http://localhost").hash;
    } },
  };
  globalThis.sessionStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key),
  };
  globalThis.fetch = async (url, options) => {
    requests.push({ url, options });
    return response(url, options);
  };
  ({ fetchAPI, setBrowserSession, clearBrowserSession } = await import("../src/services/api.js"));
  ({ testIntegrationConnection, getIntegrationStatus } = await import("../src/services/integrations.service.js"));
  ({ formatGoogleIntegrationError, completeGoogleConnection, disconnectGoogle, sendWhatsAppText } = await import("../src/services/operations-integrations.service.js"));
  ({ confirmAiAction } = await import("../src/services/ai.service.js"));
});

beforeEach(() => {
  requests = [];
  storage.clear();
  setBrowserSession("existing-browser-session");
  window.location.hash = "";
});

test("API requests abort on timeout and expose a stable timeout error", async () => {
  response = (_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener("abort", () => reject(options.signal.reason), {
      once: true,
    });
  });

  await assert.rejects(fetchAPI("/slow", { timeoutMs: 5 }), (error) => {
    assert.equal(error.name, "TimeoutError");
    assert.equal(error.code, "API_TIMEOUT_ERROR");
    assert.match(error.message, /timed out after 5 ms/);
    return true;
  });
  assert.equal(requests.length, 1);
  assert.equal("timeoutMs" in requests[0].options, false);
});

test("AI write confirmation posts only the opaque action ID through the authenticated backend API", async () => {
  response = () => Response.json({ status: "success", data: { saved: true } });
  const actionId = "4bc6f5a6-0b6c-4ddb-b29b-208c84c344d0";
  const result = await confirmAiAction(actionId);

  assert.deepEqual(result, { saved: true });
  assert.equal(requests.length, 1);
  assert.match(requests[0].url, /\/api\/ai\/tools\/confirm$/);
  assert.equal(requests[0].options.method, "POST");
  assert.deepEqual(JSON.parse(requests[0].options.body), { confirmationId: actionId });
  assert.equal(requests[0].options.headers.Authorization, ["Bearer", "existing-browser-session"].join(" "));
});

test("WhatsApp outbound requests use the authenticated backend without provider credentials", async () => {
  response = () => Response.json({ status: "success", data: { id: "wamid.test" } });
  const result = await sendWhatsAppText("905550000000", "Merhaba");
  assert.equal(result.data.id, "wamid.test");
  assert.equal(requests.length, 1);
  assert.match(requests[0].url, /\/api\/integrations\/whatsapp\/send$/);
  assert.equal(requests[0].options.method, "POST");
  assert.equal(requests[0].options.headers.Authorization, ["Bearer", "existing-browser-session"].join(" "));
  assert.deepEqual(JSON.parse(requests[0].options.body), { to: "905550000000", text: "Merhaba" });
});

test("WhatsApp readiness and safe test failures are supplied by the backend without discarding the session", async () => {
  response = () => Response.json({ data: {
    whatsapp: { configured: false, connected: false, sendConfigured: true, webhookConfigured: false, status: "credentials_required" },
  } });
  const current = await getIntegrationStatus();
  assert.equal(current.whatsapp.sendConfigured, true);
  assert.equal(current.whatsapp.webhookConfigured, false);
  assert.equal(current.whatsapp.connected, false);
  response = () => Response.json({
    status: "error", message: "WhatsApp provider request failed.",
    data: { provider: "whatsapp", connected: false, testSucceeded: false },
  }, { status: 502 });
  await assert.rejects(testIntegrationConnection("whatsapp"), /WhatsApp provider request failed/);
  assert.match(requests.at(-1).url, /\/api\/integrations\/test\/whatsapp$/);
  assert.equal(storage.get("ddpro_browser_session"), "existing-browser-session");
  assert.equal(requests.some(({ url }) => url.endsWith("/google/logout")), false);
});

test("OAuth exchange precedes concurrent Gmail and Calendar status reads and stores only the browser session", async () => {
  storage.delete("ddpro_browser_session");
  storage.set("ddpro_oauth_verifier", "browser-verifier");
  window.location.hash = "#/ayarlar?integration=google_connected&exchange_code=one-time-code";
  let resolveExchange;
  response = () => new Promise((resolve) => { resolveExchange = resolve; });
  const first = getIntegrationStatus();
  const second = getIntegrationStatus();
  const replay = completeGoogleConnection("one-time-code");
  assert.equal(requests.length, 1);
  assert.match(requests[0].url, /google\/exchange$/);
  assert.equal(storage.get("ddpro_oauth_verifier"), "browser-verifier");
  assert.match(window.location.hash, /exchange_code=/);
  response = () => Response.json({ data: { gmail: { connected: true }, googleCalendar: { connected: true } } });
  resolveExchange(Response.json({ data: { session: "exchanged-browser-session" } }));
  const [gmailStatus, calendarStatus] = await Promise.all([first, second, replay]);
  assert.equal(gmailStatus.gmail.connected, true);
  assert.equal(calendarStatus.googleCalendar.connected, true);
  assert.equal(requests.length, 3);
  assert.ok(requests.slice(1).every(({ options }) =>
    options.headers.Authorization === ["Bearer", "exchanged-browser-session"].join(" ")));
  assert.equal(storage.get("ddpro_browser_session"), "exchanged-browser-session");
  assert.equal(storage.has("ddpro_oauth_verifier"), false);
  assert.doesNotMatch(window.location.hash, /exchange_code/);
  assert.deepEqual([...storage.keys()], ["ddpro_browser_session"]);
});

test("a fresh API module after page reload uses the exchanged session without another exchange", async () => {
  storage.set("ddpro_oauth_verifier", "browser-verifier");
  window.location.hash = "#/ayarlar?integration=google_connected&exchange_code=reload-code";
  response = () => Response.json({ data: { session: "reload-browser-session" } });
  await completeGoogleConnection();
  const { fetchAPI: reloadedFetchAPI } = await import("../src/services/api.js?reload");
  response = () => Response.json({ data: { gmail: { connected: true }, googleCalendar: { connected: true } } });
  const status = await reloadedFetchAPI("/api/integrations/status");
  assert.equal(status.data.gmail.connected, true);
  assert.equal(status.data.googleCalendar.connected, true);
  assert.equal(requests.length, 2);
  assert.equal(requests[1].options.headers.Authorization, ["Bearer", "reload-browser-session"].join(" "));
});

test("failed exchange retains callback and verifier for retry without claiming a connection", async () => {
  storage.set("ddpro_oauth_verifier", "browser-verifier");
  window.location.hash = "#/ayarlar?integration=google_connected&exchange_code=retry-code";
  response = () => { throw new Error("Backend temporarily unreachable"); };
  await assert.rejects(getIntegrationStatus(), /temporarily unreachable/);
  assert.equal(requests.length, 1);
  assert.match(window.location.hash, /exchange_code=retry-code/);
  assert.equal(storage.get("ddpro_oauth_verifier"), "browser-verifier");
  assert.equal(storage.get("ddpro_browser_session"), "existing-browser-session");
  response = () => Response.json({ data: { session: "retry-browser-session" } });
  await completeGoogleConnection();
  assert.equal(storage.get("ddpro_browser_session"), "retry-browser-session");
});

test("google_connected URL alone does not authenticate Gmail or Calendar", async () => {
  storage.clear();
  window.location.hash = "#/ayarlar?integration=google_connected";
  response = (url) => url.endsWith("/google/restore")
    ? Response.json({ code: "BROWSER_SESSION_REQUIRED", message: "Browser authorization required." }, { status: 401 })
    : Response.json({ data: { gmail: { connected: false }, googleCalendar: { connected: false } } });
  const status = await getIntegrationStatus();
  assert.equal(status.gmail.connected, false);
  assert.equal(status.googleCalendar.connected, false);
  assert.equal(requests.length, 2);
  assert.equal(requests[0].options.headers.Authorization, undefined);
});

test("browser restart restores once before concurrent Projects, CRM, offers and procurement reads", async () => {
  storage.clear();
  let finishRestore;
  response = (url) => url.endsWith("/google/restore")
    ? new Promise((resolve) => { finishRestore = resolve; })
    : Response.json({ data: [{ id: "backend-record" }] });
  const endpoints = ["/api/projects", "/api/crm", "/api/offers", "/api/research"];
  const pending = endpoints.map((endpoint) => fetchAPI(endpoint));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(requests.length, 1);
  assert.match(requests[0].url, /google\/restore$/);
  assert.equal(requests[0].options.credentials, "include");
  assert.equal(requests[0].options.method, "POST");
  assert.equal(requests[0].options.headers.Authorization, undefined);
  finishRestore(Response.json({ data: { session: "restored-session" } }));
  const results = await Promise.all(pending);
  assert.ok(results.every((result) => result.data[0].id === "backend-record"));
  assert.equal(requests.length, 5);
  assert.ok(requests.slice(1).every(({ options }) =>
    options.headers.Authorization === ["Bearer", "restored-session"].join(" ")));
  assert.deepEqual([...storage.keys()], ["ddpro_browser_session"]);
});

test("an expired browser session restores with cookies and retries the protected request only once", async () => {
  response = (url, options) => url.endsWith("/google/restore")
    ? Response.json({ data: { session: "renewed-session" } })
    : options.headers.Authorization === ["Bearer", "renewed-session"].join(" ")
      ? Response.json({ data: ["real-project"] })
      : Response.json({ message: "Browser session expired." }, { status: 401 });
  const result = await fetchAPI("/api/projects");
  assert.deepEqual(result.data, ["real-project"]);
  assert.equal(requests.length, 3);
  assert.equal(requests[1].options.headers.Authorization, undefined);
  assert.equal(storage.get("ddpro_browser_session"), "renewed-session");
});

test("known session expiry restores before the public integration status read", async () => {
  setBrowserSession(`${btoa(JSON.stringify({
    email: "owner@example.com", expiresAt: Date.now() - 1000,
  }))}.signature`);
  response = (url) => url.endsWith("/google/restore")
    ? Response.json({ data: { session: "fresh-session" } })
    : Response.json({ data: { google: { connected: true } } });
  assert.equal((await getIntegrationStatus()).google.connected, true);
  assert.equal(requests.length, 2);
  assert.match(requests[0].url, /google\/restore$/);
  assert.equal(requests[1].options.headers.Authorization, ["Bearer", "fresh-session"].join(" "));
});

test("a late concurrent 401 reuses the already renewed session instead of restoring again", async () => {
  let finishLateResponse;
  response = (url, options) => {
    if (url.endsWith("/google/restore")) return Response.json({ data: { session: "shared-renewal" } });
    if (options.headers.Authorization === ["Bearer", "shared-renewal"].join(" ")) {
      return Response.json({ data: ["backend-record"] });
    }
    if (url.endsWith("/api/crm")) return new Promise((resolve) => { finishLateResponse = resolve; });
    return Response.json({ message: "Session expired." }, { status: 401 });
  };
  const projects = fetchAPI("/api/projects");
  const crm = fetchAPI("/api/crm");
  await projects;
  finishLateResponse(Response.json({ message: "Session expired." }, { status: 401 }));
  assert.deepEqual((await crm).data, ["backend-record"]);
  assert.equal(requests.filter(({ url }) => url.endsWith("/google/restore")).length, 1);
  assert.equal(storage.get("ddpro_browser_session"), "shared-renewal");
});

test("missing restoration proof never calls protected APIs or assumes a saved Google account", async () => {
  storage.clear();
  response = () => Response.json({
    code: "BROWSER_SESSION_REQUIRED", message: "Browser authorization required.",
  }, { status: 401 });
  await assert.rejects(fetchAPI("/api/projects"), (error) => error.code === "BROWSER_SESSION_REQUIRED");
  await assert.rejects(fetchAPI("/api/crm"), (error) => error.status === 401);
  assert.equal(requests.length, 1);
  assert.equal(storage.has("ddpro_browser_session"), false);
});

test("a transient restoration failure is retryable without clearing a Google connection", async () => {
  storage.clear();
  response = () => Response.json({ message: "Storage unavailable." }, { status: 503 });
  await assert.rejects(fetchAPI("/api/projects"), (error) => error.status === 503);
  response = (url) => url.endsWith("/google/restore")
    ? Response.json({ data: { session: "recovered-session" } })
    : Response.json({ data: ["backend-project"] });
  assert.deepEqual((await fetchAPI("/api/projects")).data, ["backend-project"]);
  assert.equal(requests.length, 3);
  assert.ok(requests.every(({ url }) => !url.includes("logout")));
});

test("simultaneous rejected bearers share one restore and all retries use its session", async () => {
  let finishRestore;
  response = (url, options) => url.endsWith("/google/restore")
    ? new Promise((resolve) => { finishRestore = resolve; })
    : options.headers.Authorization === ["Bearer", "shared-session"].join(" ")
      ? Response.json({ data: ["real-project"] })
      : Response.json({ code: "BROWSER_SESSION_REQUIRED" }, { status: 401 });
  const pending = ["/api/projects", "/api/crm", "/api/offers"].map((endpoint) => fetchAPI(endpoint));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(requests.filter(({ url }) => url.endsWith("/google/restore")).length, 1);
  finishRestore(Response.json({ data: { session: "shared-session" } }));
  assert.ok((await Promise.all(pending)).every(({ data }) => data[0] === "real-project"));
  assert.equal(requests.length, 7);
});

test("status with an unrecognized stale bearer restores before claiming Gmail is disconnected", async () => {
  response = (url, options) => url.endsWith("/google/restore")
    ? Response.json({ data: { session: "status-session" } })
    : options.headers.Authorization === ["Bearer", "status-session"].join(" ")
      ? Response.json({ data: { gmail: { connected: true }, googleCalendar: { connected: true } } })
      : Response.json({ code: "BROWSER_SESSION_REQUIRED" }, { status: 401 });
  const status = await getIntegrationStatus();
  assert.equal(status.gmail.connected, true);
  assert.equal(status.googleCalendar.connected, true);
  assert.equal(requests.length, 3);
  assert.match(requests[1].url, /google\/restore$/);
});

test("anonymous integration status retains the actual restoration failure diagnostics", async () => {
  storage.clear();
  response = (url) => url.endsWith("/google/restore")
    ? Response.json({ code: "BROWSER_SESSION_REQUIRED", message: "Restore cookie expired or invalid." }, { status: 401 })
    : Response.json({ data: { gmail: { connected: false } } });
  const status = await getIntegrationStatus();
  assert.deepEqual(status.browserSession, {
    status: "authorization_required", code: "BROWSER_SESSION_REQUIRED",
    message: "Restore cookie expired or invalid.",
  });
  assert.equal(status.gmail.connected, false);
  assert.equal(requests.length, 2);
  await assert.rejects(fetchAPI("/api/projects"), (error) =>
    error.code === status.browserSession.code && error.message === status.browserSession.message);
  assert.equal(requests.length, 2);
});

test("status can fall back to anonymous diagnostics after a stale bearer and missing cookie", async () => {
  response = (url, options) => url.endsWith("/google/restore")
    ? Response.json({ code: "BROWSER_SESSION_REQUIRED", message: "No restore cookie." }, { status: 401 })
    : options.headers.Authorization
      ? Response.json({ code: "BROWSER_SESSION_REQUIRED" }, { status: 401 })
      : Response.json({ data: { gmail: { connected: false } } });
  const status = await getIntegrationStatus();
  assert.equal(status.gmail.connected, false);
  assert.equal(status.browserSession.message, "No restore cookie.");
  assert.equal(storage.has("ddpro_browser_session"), false);
  assert.equal(requests.length, 3);
});

test("missing stored Google connection is not retried as a browser-session failure", async () => {
  response = () => Response.json({
    code: "GOOGLE_CONNECTION_REQUIRED", message: "Stored Google connection is missing.",
  }, { status: 401 });
  await assert.rejects(fetchAPI("/api/projects"), (error) => error.code === "GOOGLE_CONNECTION_REQUIRED");
  assert.equal(requests.length, 1);
  assert.equal(storage.get("ddpro_browser_session"), "existing-browser-session");
});

test("a negative restore cache expires so a browser authorized in another tab can recover", async () => {
  storage.clear();
  response = () => Response.json({ code: "BROWSER_SESSION_REQUIRED" }, { status: 401 });
  await assert.rejects(fetchAPI("/api/projects"), (error) => error.status === 401);
  const originalNow = Date.now;
  const now = originalNow();
  Date.now = () => now + 6_000;
  try {
    response = (url) => url.endsWith("/google/restore")
      ? Response.json({ data: { session: "other-tab-session" } })
      : Response.json({ data: ["persistent-project"] });
    assert.deepEqual((await fetchAPI("/api/projects")).data, ["persistent-project"]);
    assert.equal(requests.length, 3);
  } finally {
    Date.now = originalNow;
  }
});

test("an older restore cannot overwrite a newer OAuth exchange session", async () => {
  storage.clear();
  let finishRestore;
  response = (url) => url.endsWith("/google/restore")
    ? new Promise((resolve) => { finishRestore = resolve; })
    : Response.json({ data: [] });
  const pending = fetchAPI("/api/projects");
  await new Promise((resolve) => setImmediate(resolve));
  setBrowserSession("new-oauth-session");
  finishRestore(Response.json({ data: { session: "old-restored-session" } }));
  await pending;
  assert.equal(storage.get("ddpro_browser_session"), "new-oauth-session");
  assert.equal(requests[1].options.headers.Authorization, ["Bearer", "new-oauth-session"].join(" "));
});

test("an older restore failure reuses a newer OAuth session without poisoning later restores", async () => {
  storage.clear();
  let finishRestore;
  response = (url) => url.endsWith("/google/restore")
    ? new Promise((resolve) => { finishRestore = resolve; })
    : Response.json({ data: [] });
  const pending = fetchAPI("/api/projects");
  await new Promise((resolve) => setImmediate(resolve));
  setBrowserSession("new-oauth-session");
  finishRestore(Response.json({ code: "BROWSER_SESSION_REQUIRED" }, { status: 401 }));
  await pending;
  assert.equal(requests[1].options.headers.Authorization, ["Bearer", "new-oauth-session"].join(" "));
  storage.clear();
  response = (url) => url.endsWith("/google/restore")
    ? Response.json({ data: { session: "current-restored-session" } })
    : Response.json({ data: [] });
  await fetchAPI("/api/projects");
  assert.equal(storage.get("ddpro_browser_session"), "current-restored-session");
});

test("an in-flight restore cannot resurrect a cleared browser session", async () => {
  storage.clear();
  let finishRestore;
  response = () => new Promise((resolve) => { finishRestore = resolve; });
  const pending = fetchAPI("/api/projects");
  await new Promise((resolve) => setImmediate(resolve));
  clearBrowserSession();
  finishRestore(Response.json({ data: { session: "logged-out-session" } }));
  await assert.rejects(pending, (error) => error.code === "BROWSER_SESSION_CHANGED");
  assert.equal(storage.has("ddpro_browser_session"), false);
  assert.equal(requests.length, 1);
});

test("refresh and browser restart with empty sessionStorage restore before project writes and reads", async () => {
  for (const lifecycle of ["refresh", "restart"]) {
    storage.clear();
    const { fetchAPI: freshFetchAPI } = await import(`../src/services/api.js?${lifecycle}-empty`);
    response = (url) => url.endsWith("/google/restore")
      ? Response.json({ data: { session: `${lifecycle}-session` } })
      : Response.json({ data: { id: "persistent-project" } });
    const before = requests.length;
    await freshFetchAPI("/api/projects", { method: "POST", body: JSON.stringify({ name: "Live project" }) });
    await freshFetchAPI("/api/projects");
    await freshFetchAPI("/api/projects/persistent-project", { method: "PATCH", body: JSON.stringify({ status: "Aktif" }) });
    await freshFetchAPI("/api/projects/persistent-project", { method: "DELETE" });
    const lifecycleRequests = requests.slice(before);
    assert.equal(lifecycleRequests.length, 5);
    assert.match(lifecycleRequests[0].url, /google\/restore$/);
    assert.ok(lifecycleRequests.every(({ options }) => options.credentials === "include"));
    assert.ok(lifecycleRequests.slice(1).every(({ options }) =>
      options.headers.Authorization === ["Bearer", `${lifecycle}-session`].join(" ")));
  }
});

test("Projects waits for the OAuth handoff as well as integration status", async () => {
  storage.clear();
  storage.set("ddpro_oauth_verifier", "verifier");
  window.location.hash = "#/ayarlar?integration=google_connected&exchange_code=projects-code";
  response = (url) => url.endsWith("/google/exchange")
    ? Response.json({ data: { session: "oauth-project-session" } })
    : Response.json({ data: ["oauth-project"] });
  assert.deepEqual((await fetchAPI("/api/projects")).data, ["oauth-project"]);
  assert.equal(requests.length, 2);
  assert.match(requests[0].url, /google\/exchange$/);
  assert.equal(requests[1].options.headers.Authorization, ["Bearer", "oauth-project-session"].join(" "));
});

test("non-Google provider tests remain usable without browser authorization", async () => {
  storage.clear();
  response = () => Response.json({ data: { provider: "ai", connected: true } });
  assert.equal((await testIntegrationConnection("ai")).data.connected, true);
  assert.equal(requests.length, 1);
  assert.match(requests[0].url, /test\/ai$/);
  response = () => Response.json({ message: "Provider authorization failed." }, { status: 401 });
  await assert.rejects(testIntegrationConnection("ai"), (error) => error.status === 401);
  assert.equal(requests.length, 2);
  assert.ok(requests.every(({ url }) => !url.includes("restore")));
});

test("disconnect clears the browser bearer only after backend success", async () => {
  response = () => Response.json({ message: "Revocation unavailable." }, { status: 502 });
  await assert.rejects(disconnectGoogle(), (error) => error.status === 502);
  assert.equal(storage.get("ddpro_browser_session"), "existing-browser-session");
  response = () => Response.json({ data: { disconnected: true } });
  await disconnectGoogle();
  assert.equal(storage.has("ddpro_browser_session"), false);
  response = () => Response.json({ code: "BROWSER_SESSION_REQUIRED" }, { status: 401 });
  await assert.rejects(fetchAPI("/api/projects"), (error) => error.status === 401);
  assert.equal(requests.length, 3);
  assert.match(requests[2].url, /google\/restore$/);
});

test("a consumed exchange cannot block backend status or discard an existing session", async () => {
  storage.set("ddpro_oauth_verifier", "browser-verifier");
  window.location.hash = "#/ayarlar?integration=google_connected&exchange_code=consumed-code";
  response = () => requests.length === 1
    ? Response.json({ message: "Authorization expired or already used." }, { status: 401 })
    : Response.json({ data: { gmail: { connected: true }, googleCalendar: { connected: true } } });
  const status = await getIntegrationStatus();
  assert.equal(status.gmail.connected, true);
  assert.equal(status.googleCalendar.connected, true);
  assert.equal(storage.get("ddpro_browser_session"), "existing-browser-session");
  assert.equal(storage.has("ddpro_oauth_verifier"), false);
  assert.doesNotMatch(window.location.hash, /exchange_code/);
  await getIntegrationStatus();
  assert.equal(requests.length, 3);
  assert.ok(requests.slice(1).every(({ url }) => url.endsWith("/api/integrations/status")));
});

test("missing exchange session never overwrites a saved browser session", async () => {
  for (const session of [undefined, null, "", "   ", {}]) {
    assert.throws(() => setBrowserSession(session), /oturumu alınamadı/);
    assert.equal(storage.get("ddpro_browser_session"), "existing-browser-session");
  }
});

test("a callback with no verifier cannot block a valid saved session", async () => {
  window.location.hash = "#/ayarlar?integration=google_connected&exchange_code=stale-code";
  response = () => Response.json({ data: { gmail: { connected: true }, googleCalendar: { connected: true } } });
  const status = await getIntegrationStatus();
  assert.equal(status.gmail.connected, true);
  assert.equal(status.googleCalendar.connected, true);
  assert.equal(requests.length, 1);
  assert.ok(requests[0].url.endsWith("/api/integrations/status"));
  assert.doesNotMatch(window.location.hash, /exchange_code/);
  assert.equal(storage.get("ddpro_browser_session"), "existing-browser-session");
});

after(() => {
  for (const [key, value] of Object.entries(originals)) {
    if (value === undefined) delete globalThis[key];
    else globalThis[key] = value;
  }
});

test("Google 401/403/429 diagnostics do not expire the browser session or call logout", async () => {
  for (const [upstreamStatus, category, code] of [
    [401, "authorization", "GOOGLE_API_AUTH_ERROR"],
    [403, "access_denied", "GOOGLE_API_ACCESS_DENIED"],
    [429, "rate_limit", "GOOGLE_API_RATE_LIMIT"],
  ]) {
    const googleApiError = { httpStatus: upstreamStatus, category, message: "Safe Google failure", reasons: ["providerReason"] };
    response = () => Response.json({
      status: "error", code, provider: "gmail", upstreamStatus,
      message: googleApiError.message, googleApiError,
      data: { connected: true, testSucceeded: false },
    }, { status: upstreamStatus === 401 ? 502 : upstreamStatus });
    await assert.rejects(testIntegrationConnection("gmail"), (error) => {
      assert.equal(error.status, upstreamStatus === 401 ? 502 : upstreamStatus);
      assert.equal(error.statusCode, error.status);
      assert.equal(error.code, code);
      assert.equal(error.upstreamStatus, upstreamStatus);
      assert.equal(error.provider, "gmail");
      assert.equal(error.data.data.connected, true);
      assert.match(formatGoogleIntegrationError(error), /korunuyor/);
      assert.match(formatGoogleIntegrationError(error), new RegExp(`HTTP ${upstreamStatus}`));
      assert.match(formatGoogleIntegrationError(error), /providerReason/);
      return true;
    });
    assert.equal(storage.get("ddpro_browser_session"), "existing-browser-session");
    response = () => Response.json({ data: { gmail: { connected: true }, googleCalendar: { connected: true } } });
    const status = await getIntegrationStatus();
    assert.equal(status.gmail.connected, true);
    assert.equal(status.googleCalendar.connected, true);
  }
  assert.equal(requests.length, 6);
  assert.ok(requests.every(({ url }) => !url.includes("logout")));
  assert.ok(requests.every(({ options }) => options.headers.Authorization === ["Bearer", "existing-browser-session"].join(" ")));
});

test("legacy upstream 401 is not exposed as a browser session 401", async () => {
  for (const metadata of [
    { googleApiError: { httpStatus: 401, category: "authorization", message: "Google denied" } },
    { code: "GOOGLE_API_AUTH_ERROR", upstreamStatus: 401 },
  ]) {
    response = () => Response.json({ message: "Google denied", ...metadata }, { status: 401 });
    await assert.rejects(testIntegrationConnection("gmail"), (error) => {
      assert.equal(error.status, 502);
      assert.equal(error.statusCode, 502);
      assert.equal(error.upstreamStatus, 401);
      return true;
    });
    assert.equal(storage.get("ddpro_browser_session"), "existing-browser-session");
  }
});

test("successful Gmail and Calendar tests retain the browser session and connection", async () => {
  for (const provider of ["gmail", "googleCalendar"]) {
    response = () => Response.json({ data: { provider, connected: true, testSucceeded: true } });
    const result = await testIntegrationConnection(provider);
    assert.equal(result.data.connected, true);
    assert.equal(result.data.testSucceeded, true);
    assert.equal(storage.get("ddpro_browser_session"), "existing-browser-session");
  }
});

test("real browser session 401 remains 401 for existing session-expiry consumers", async () => {
  for (const endpoint of ["/api/integrations/test/gmail", "/api/crm"]) {
    response = () => Response.json({ status: "error", message: "Google account connection is required." }, { status: 401 });
    await assert.rejects(fetchAPI(endpoint), (error) => {
      assert.equal(error.status, 401);
      assert.equal(error.statusCode, 401);
      assert.equal(error.googleApiError, undefined);
      assert.equal(error.upstreamStatus, undefined);
      return true;
    });
  }
});
