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

before(async () => {
  globalThis.window = { location: { hostname: "localhost" } };
  globalThis.sessionStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key),
  };
  globalThis.fetch = async (url, options) => {
    requests.push({ url, options });
    return response();
  };
  ({ fetchAPI } = await import("../src/services/api.js"));
  ({ testIntegrationConnection, getIntegrationStatus } = await import("../src/services/integrations.service.js"));
  ({ formatGoogleIntegrationError } = await import("../src/services/operations-integrations.service.js"));
});

beforeEach(() => {
  requests = [];
  storage.clear();
  storage.set("ddpro_browser_session", "existing-browser-session");
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
