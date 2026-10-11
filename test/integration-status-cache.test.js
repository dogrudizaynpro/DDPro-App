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

const createProbeHelpers = ({ getIntegrationStatus, testIntegrationConnection, clock }) => {
  class ClockDate extends Date {
    static now() { return clock.now; }
  }
  return runInNewContext(
    `${source.slice(start, end)}; ({ testIntegrationConnectionOnce, hasStaleIntegrationTest, probeConfiguredIntegrations });`,
    {
      getIntegrationStatus,
      testIntegrationConnection,
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
