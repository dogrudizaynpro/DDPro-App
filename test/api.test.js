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
    return response();
  };
  ({ fetchAPI, setBrowserSession } = await import("../src/services/api.js"));
  ({ testIntegrationConnection, getIntegrationStatus } = await import("../src/services/integrations.service.js"));
  ({ formatGoogleIntegrationError, completeGoogleConnection } = await import("../src/services/operations-integrations.service.js"));
});

beforeEach(() => {
  requests = [];
  storage.clear();
  storage.set("ddpro_browser_session", "existing-browser-session");
  window.location.hash = "";
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
  response = () => Response.json({ data: { gmail: { connected: false }, googleCalendar: { connected: false } } });
  const status = await getIntegrationStatus();
  assert.equal(status.gmail.connected, false);
  assert.equal(status.googleCalendar.connected, false);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].options.headers.Authorization, undefined);
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
