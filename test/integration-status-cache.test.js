import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

const source = await readFile(
  new URL("../src/modules/OperationsModule.jsx", import.meta.url),
  "utf8",
);
const start = source.indexOf("const integrationProbes =");
const end = source.indexOf("\nfunction IntegrationSettings", start);
assert.ok(start >= 0 && end > start);

const createCache = ({ getIntegrationStatus, testIntegrationConnection, clock }) => {
  class ClockDate extends Date {
    static now() { return clock.now; }
  }
  const context = {
    getIntegrationStatus,
    testIntegrationConnection,
    Date: ClockDate,
    Map,
    Promise,
  };
  return runInNewContext(
    `${source.slice(start, end)}; ({ getCachedIntegrationStatus, getIntegrationStatusOnce, testIntegrationConnectionOnce, hasStaleIntegrationTest, probeConfiguredIntegrations });`,
    context,
  );
};

test("Integration Center snapshot survives module switches and expires after five minutes", async () => {
  const clock = { now: 1_000_000 };
  const status = {
    ai: {
      configured: true,
      connected: true,
      lastTest: { testedAt: new Date(clock.now).toISOString() },
    },
    google: {},
  };
  let statusRequests = 0;
  const cache = createCache({
    clock,
    getIntegrationStatus: async () => {
      statusRequests += 1;
      return status;
    },
    testIntegrationConnection: async () => ({ data: { connected: true } }),
  });
  const first = await cache.getIntegrationStatusOnce();
  assert.equal(first, status);
  assert.equal(cache.getCachedIntegrationStatus(), status);
  assert.equal(cache.getCachedIntegrationStatus(), status); // Projects → Integration Center.
  assert.equal(statusRequests, 1);
  clock.now += 5 * 60 * 1000;
  assert.equal(cache.getCachedIntegrationStatus(), null);
});

test("overlapping health-test calls share one provider request and fresh tests are not repeated", async () => {
  const clock = { now: 2_000_000 };
  let resolveTest;
  let testRequests = 0;
  const cache = createCache({
    clock,
    getIntegrationStatus: async () => ({ ai: { configured: true } }),
    testIntegrationConnection: () => {
      testRequests += 1;
      return new Promise((resolve) => { resolveTest = resolve; });
    },
  });
  const first = cache.testIntegrationConnectionOnce("ai");
  const second = cache.testIntegrationConnectionOnce("ai");
  assert.equal(testRequests, 1);
  resolveTest({ data: { connected: true } });
  assert.equal(await first, await second);

  const freshStatus = {
    ai: {
      configured: true,
      connected: true,
      lastTest: { testedAt: new Date(clock.now).toISOString() },
    },
    gmail: {},
    googleCalendar: {},
    whatsapp: {},
    crm: {},
    supabase: {},
    web: {},
    appStore: {},
    research: {},
  };
  await cache.probeConfiguredIntegrations(freshStatus);
  assert.equal(testRequests, 1);
});

test("expired failed health tests are not retained as current status", async () => {
  const clock = { now: 3_000_000 };
  const staleFailure = {
    ai: {
      configured: true,
      connected: false,
      lastTest: { testedAt: new Date(clock.now - 5 * 60 * 1000 - 1).toISOString() },
    },
  };
  const cache = createCache({
    clock,
    getIntegrationStatus: async () => staleFailure,
    testIntegrationConnection: async () => ({ data: { connected: true } }),
  });
  await cache.getIntegrationStatusOnce();
  assert.equal(cache.getCachedIntegrationStatus(), null);
});
