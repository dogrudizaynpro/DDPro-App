import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { randomBytes } from "node:crypto";

const keys = [
  "WHATSAPP_ACCESS_TOKEN", "WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_API_VERSION",
  "WHATSAPP_APP_SECRET", "WHATSAPP_VERIFY_TOKEN", "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET",
  "GOOGLE_REDIRECT_URI", "INTEGRATION_SESSION_SECRET",
];
const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
const originalFetch = globalThis.fetch;
let server;
let baseUrl;
let providerResponse;
let providerRequests;

before(async () => {
  for (const key of keys) delete process.env[key];
  const { default: app } = await import("../src/app.js");
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  globalThis.fetch = async (url, options) => {
    if (new URL(url).hostname === "graph.facebook.com") {
      providerRequests.push({ url: String(url), options });
      return providerResponse(url, options);
    }
    return originalFetch(url, options);
  };
});

beforeEach(() => {
  for (const key of keys) delete process.env[key];
  Object.assign(process.env, {
    WHATSAPP_ACCESS_TOKEN: randomBytes(24).toString("hex"),
    WHATSAPP_PHONE_NUMBER_ID: "123456789012345",
    WHATSAPP_APP_SECRET: randomBytes(24).toString("hex"),
    WHATSAPP_VERIFY_TOKEN: randomBytes(24).toString("hex"),
  });
  providerRequests = [];
  providerResponse = () => Response.json({ id: process.env.WHATSAPP_PHONE_NUMBER_ID, display_phone_number: "+90 555 000 0000" });
});

const status = async () => {
  const response = await originalFetch(`${baseUrl}/api/integrations/status`);
  assert.equal(response.status, 200);
  return (await response.json()).data.whatsapp;
};
const runTest = () => originalFetch(`${baseUrl}/api/integrations/test/whatsapp`, { method: "POST" });

test("WhatsApp status requires both outbound and webhook configuration, without exposing secrets", async () => {
  const ready = await status();
  assert.equal(ready.configured, true);
  assert.equal(ready.connected, true);
  assert.equal(ready.status, "connected");
  assert.equal(ready.sendConfigured, true);
  assert.equal(ready.webhookConfigured, true);
  for (const key of keys.filter((key) => key.startsWith("WHATSAPP_") && key !== "WHATSAPP_PHONE_NUMBER_ID")) {
    if (process.env[key]) assert.ok(!JSON.stringify(ready).includes(process.env[key]));
  }
  assert.equal(providerRequests.length, 0);
  for (const key of ["WHATSAPP_ACCESS_TOKEN", "WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_APP_SECRET", "WHATSAPP_VERIFY_TOKEN"]) {
    const value = process.env[key];
    delete process.env[key];
    const incomplete = await status();
    assert.equal(incomplete.configured, false);
    assert.equal(incomplete.connected, false);
    assert.equal(incomplete.status, "credentials_required");
    process.env[key] = value;
  }
});

test("WhatsApp test endpoint makes a real Graph request with server-only authorization and default version", async () => {
  const response = await runTest();
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.data.testSucceeded, true);
  assert.equal(providerRequests.length, 1);
  const request = providerRequests[0];
  assert.match(request.url, /\/v23\.0\/123456789012345\?/);
  assert.equal(new URL(request.url).searchParams.get("fields"), "id,display_phone_number");
  assert.equal(new URL(request.url).searchParams.has("access_token"), false);
  assert.equal(request.options.headers.Authorization, ["Bearer", process.env.WHATSAPP_ACCESS_TOKEN].join(" "));
  assert.ok(!JSON.stringify(result).includes(process.env.WHATSAPP_ACCESS_TOKEN));
  assert.equal((await status()).lastTest.testSucceeded, true);
});

test("an outbound-only successful test cannot mark the webhook configured", async () => {
  delete process.env.WHATSAPP_APP_SECRET;
  delete process.env.WHATSAPP_VERIFY_TOKEN;
  assert.equal((await runTest()).status, 200);
  const current = await status();
  assert.equal(current.sendConfigured, true);
  assert.equal(current.webhookConfigured, false);
  assert.equal(current.connected, false);
  assert.equal(current.status, "credentials_required");
});

test("WhatsApp test errors redact provider responses and network details, preserving configuration separately", async () => {
  const secrets = ["WHATSAPP_ACCESS_TOKEN", "WHATSAPP_APP_SECRET", "WHATSAPP_VERIFY_TOKEN"].map((key) => process.env[key]);
  for (const failure of [
    () => Response.json({ error: { message: secrets.join(" ") } }, { status: 401 }),
    () => { throw new Error(secrets.join(" ")); },
    () => new Response(secrets.join(" "), { status: 200 }),
  ]) {
    providerResponse = failure;
    const response = await runTest();
    assert.equal(response.status, 502);
    const body = await response.json();
    assert.equal(body.data.testSucceeded, false);
    for (const secret of secrets) assert.ok(!JSON.stringify(body).includes(secret));
    const current = await status();
    assert.equal(current.connected, true);
    assert.equal(current.lastTest.testSucceeded, false);
    for (const secret of secrets) assert.ok(!JSON.stringify(current).includes(secret));
  }
});

test("invalid WhatsApp configuration fails closed before calling Graph", async () => {
  for (const [key, value] of [
    ["WHATSAPP_ACCESS_TOKEN", ""],
    ["WHATSAPP_PHONE_NUMBER_ID", "../messages?access_token=bad"],
    ["WHATSAPP_API_VERSION", "v23.0/../../bad"],
  ]) {
    const previousValue = process.env[key];
    process.env[key] = value;
    assert.equal((await runTest()).status, 503);
    assert.equal((await status()).sendConfigured, false);
    if (previousValue === undefined) delete process.env[key];
    else process.env[key] = previousValue;
  }
  assert.equal(providerRequests.length, 0);
});

test("outbound WhatsApp endpoint keeps existing session authorization", async () => {
  const response = await originalFetch(`${baseUrl}/api/integrations/whatsapp/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ to: "905550000000", text: "Test" }),
  });
  assert.equal(response.status, 401);
  assert.equal(providerRequests.length, 0);
});

after(async () => {
  globalThis.fetch = originalFetch;
  await new Promise((resolve) => server.close(resolve));
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});
