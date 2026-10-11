import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import {
  createIntegrationStatusStore,
  isIntegrationStatusStale,
} from "../src/services/integrations.service.js";

const source = await readFile(
  new URL("../src/modules/OperationsModule.jsx", import.meta.url),
  "utf8",
);
const start = source.indexOf("const integrationProbes =");
const end = source.indexOf("\nfunction IntegrationSettings", start);
assert.ok(start >= 0 && end > start);

const createProbeHelpers = ({ getIntegrationStatus, testIntegrationConnection, clock, getSnapshot }) => {
  class ClockDate extends Date {
    static now() { return clock.now; }
  }
  return runInNewContext(
    `${source.slice(start, end)}; ({ testIntegrationConnectionOnce, hasStaleIntegrationTest, probeConfiguredIntegrations });`,
    {
      getIntegrationStatus,
      testIntegrationConnection,
      getIntegrationStatusSnapshot: getSnapshot || (() => ({ updatedAt: clock.now })),
      isIntegrationStatusStale,
      Date: ClockDate,
      INTEGRATION_STATUS_MAX_AGE: 5 * 60 * 1000,
      Map,
      Promise,
    },
  );
};

test("shared integration snapshot remains available across module subscriptions", async () => {
  const clock = { now: 1_000_000 };
  const status = {
    ai: {
      configured: true,
      connected: true,
      lastTest: { testedAt: new Date(clock.now).toISOString() },
    },
  };
  let statusRequests = 0;
  const store = createIntegrationStatusStore(async () => {
    statusRequests += 1;
    return status;
  }, () => clock.now);

  const unsubscribe = store.subscribe(() => {});
  assert.equal(await store.refresh(), status);
  unsubscribe();
  assert.equal(store.getSnapshot().status, status);
  assert.equal(store.getSnapshot().updatedAt, clock.now);
  store.subscribe(() => {})(); // A subsequent module mount observes the same app-session state.
  assert.equal(store.getSnapshot().status, status);
  assert.equal(statusRequests, 1);
});

test("overlapping status refreshes share one request and failures preserve the last verified result", async () => {
  const clock = { now: 2_000_000 };
  const status = { ai: { configured: true, connected: true } };
  let statusRequests = 0;
  const store = createIntegrationStatusStore(() => {
    statusRequests += 1;
    return statusRequests === 1
      ? Promise.resolve(status)
      : Promise.reject(new Error("Backend unavailable"));
  }, () => clock.now);

  assert.equal(await store.refresh(), status);
  clock.now += 5 * 60 * 1000 + 1;
  assert.equal(isIntegrationStatusStale({
    ...status.ai,
    lastTest: { testedAt: new Date(clock.now - 5 * 60 * 1000 - 1).toISOString() },
  }, clock.now), true);
  const first = store.refresh();
  const second = store.refresh();
  assert.equal(first, second);
  await assert.rejects(first, /Backend unavailable/);
  assert.equal(statusRequests, 2);
  assert.equal(store.getSnapshot().status, status);
  assert.equal(store.getSnapshot().error.message, "Backend unavailable");
  assert.equal(store.getSnapshot().refreshing, false);
});

test("provider health probes remain deduplicated and independent", async () => {
  const clock = { now: 3_000_000 };
  const testedProviders = [];
  const helpers = createProbeHelpers({
    clock,
    getIntegrationStatus: async () => ({}),
    testIntegrationConnection: async (provider) => {
      testedProviders.push(provider);
      return { data: { connected: true } };
    },
  });
  const status = {
    ai: { configured: true },
    google: { authenticated: true },
    gmail: { configured: true },
    googleCalendar: { configured: true },
    crm: { configured: true },
    supabase: { configured: true },
  };

  await helpers.probeConfiguredIntegrations(status);
  assert.deepEqual(testedProviders.sort(), ["ai", "crm", "gmail", "googleCalendar", "supabase"]);
});

test("fresh provider tests are not repeated and overlapping provider requests are shared", async () => {
  const clock = { now: 4_000_000 };
  let resolveTest;
  let testRequests = 0;
  const helpers = createProbeHelpers({
    clock,
    getIntegrationStatus: async () => ({}),
    testIntegrationConnection: () => {
      testRequests += 1;
      return new Promise((resolve) => { resolveTest = resolve; });
    },
  });

  const first = helpers.testIntegrationConnectionOnce("ai");
  const second = helpers.testIntegrationConnectionOnce("ai");
  assert.equal(testRequests, 1);
  resolveTest({ data: { connected: true } });
  assert.equal(await first, await second);

  const freshStatus = {
    ai: {
      configured: true,
      connected: true,
      lastTest: { testedAt: new Date(clock.now).toISOString() },
    },
    google: {},
    gmail: {},
    googleCalendar: {},
    whatsapp: {},
    crm: {},
    supabase: {},
    web: {},
    appStore: {},
    research: {},
  };
  await helpers.probeConfiguredIntegrations(freshStatus);
  assert.equal(testRequests, 1);
});

test("new verification stays fresh with an older render clock and server clock skew", () => {
    const receivedAt = 1_000_000;
    const serverTime = receivedAt + 120_000;
    const connection = {
      connected: true,
      checkedAt: new Date(serverTime).toISOString(),
      lastTest: { testedAt: new Date(serverTime).toISOString() },
    };
    assert.equal(isIntegrationStatusStale(connection, receivedAt - 29_000, receivedAt), false);
    assert.equal(isIntegrationStatusStale(connection, receivedAt + 299_999, receivedAt), false);
    assert.equal(isIntegrationStatusStale(connection, receivedAt + 300_000, receivedAt), true);
    assert.equal(isIntegrationStatusStale({
      ...connection, lastTest: { testedAt: new Date(serverTime - 300_000).toISOString() },
    }, receivedAt, receivedAt), true);
    assert.equal(isIntegrationStatusStale({ checkedAt: "invalid" }, receivedAt, receivedAt), true);
  });

  test("a background GET during AI probing cannot change the receipt time of older provider evidence", async () => {
    const clock = { now: 6_000_000 };
    let snapshot = { updatedAt: clock.now };
    const status = {
      ai: { configured: true },
      google: { authenticated: true },
      gmail: { configured: true, connected: true, checkedAt: new Date(clock.now).toISOString(),
        lastTest: { testedAt: new Date(clock.now - 299_000).toISOString() } },
    };
    const tested = [];
    const helpers = createProbeHelpers({
      clock,
      getSnapshot: () => snapshot,
      getIntegrationStatus: async () => status,
      testIntegrationConnection: async (provider) => {
        tested.push(provider);
        if (provider === "ai") {
          clock.now += 2_000;
          snapshot = { updatedAt: clock.now };
        }
        return { data: { connected: true } };
      },
    });
    await helpers.probeConfiguredIntegrations(status);
    assert.deepEqual(tested, ["ai", "gmail"]);
  });

  test("a provider test invalidates an older GET for all subscribers and awaiting callers", async () => {
    let finishOldRead;
    let requests = 0;
    const verified = { ai: { connected: true } };
    const store = createIntegrationStatusStore(() => {
      requests += 1;
      if (requests === 1) return { ai: { connected: false } };
      if (requests === 2) return new Promise((resolve) => { finishOldRead = resolve; });
      return verified;
    });
    await store.refresh();
    const observed = [];
    const unsubscribe = store.subscribe(() => observed.push(store.getSnapshot().status));
    const oldRead = store.refresh();
    await Promise.resolve();
    store.invalidate();
    const postTestRead = store.refresh();
    finishOldRead({ ai: { connected: false, obsolete: true } });
    assert.equal(await postTestRead, verified);
    assert.equal(await oldRead, verified);
    assert.equal(requests, 3);
    assert.equal(store.getSnapshot().status, verified);
    assert.equal(observed.some((status) => status?.ai?.obsolete), false);
    unsubscribe();
    assert.equal(store.getSnapshot().status, verified);
  });

  test("an obsolete GET failure cannot erase a newer verification or poison its error state", async () => {
    let failOldRead;
    let requests = 0;
    const verified = { gmail: { connected: true }, google: { authenticated: true } };
    const store = createIntegrationStatusStore(() => {
      requests += 1;
      if (requests === 1) return new Promise((_, reject) => { failOldRead = reject; });
      return verified;
    });
    const oldRead = store.refresh();
    await Promise.resolve();
    store.invalidate();
    failOldRead(new Error("obsolete failure"));
    assert.equal(await oldRead, verified);
    assert.equal(store.getSnapshot().error, null);
    assert.equal(store.getSnapshot().status.google.authenticated, true);
  });

  test("navigation during a slow probe keeps the shared last verified provider state", async () => {
    const clock = { now: 5_000_000 };
    const verified = {
      ai: { configured: true, connected: true, checkedAt: new Date(clock.now).toISOString(),
        lastTest: { testedAt: new Date(clock.now - 301_000).toISOString() } },
      google: { authenticated: true },
      gmail: { configured: true, connected: true, checkedAt: new Date(clock.now).toISOString(),
        lastTest: { testedAt: new Date(clock.now).toISOString() } },
    };
    let finishProbe;
    const store = createIntegrationStatusStore(() => verified, () => clock.now);
    await store.refresh();
    const helpers = createProbeHelpers({
      clock, getIntegrationStatus: store.refresh,
      testIntegrationConnection: () => new Promise((resolve) => { finishProbe = resolve; }),
    });
    const unsubscribeSettings = store.subscribe(() => {});
    const probe = helpers.probeConfiguredIntegrations(verified);
    unsubscribeSettings();
    const unsubscribeHub = store.subscribe(() => {});
    assert.equal(store.getSnapshot().status.gmail.connected, true);
    assert.equal(store.getSnapshot().status.ai.connected, true);
    finishProbe({ data: { connected: true, testSucceeded: true } });
    await probe;
    assert.equal(store.getSnapshot().status, verified);
    unsubscribeHub();
  });
