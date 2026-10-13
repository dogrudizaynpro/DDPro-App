import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { after, before, beforeEach, test } from "node:test";

const environmentKeys = [
  "WEBSITE_WEBHOOK_SECRET",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
];
const previousEnvironment = Object.fromEntries(
  environmentKeys.map((key) => [key, process.env[key]]),
);
let server;
let baseUrl;

before(async () => {
  for (const key of environmentKeys) delete process.env[key];
  const { default: app } = await import("../src/app.js");
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

beforeEach(() => {
  process.env.WEBSITE_WEBHOOK_SECRET = "test-website-webhook-secret";
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  for (const key of environmentKeys) {
    if (previousEnvironment[key] === undefined) delete process.env[key];
    else process.env[key] = previousEnvironment[key];
  }
});

const leadBody = JSON.stringify({ name: "Ada", email: "ada@example.com" });
const signatureFor = (body) =>
  `sha256=${createHmac("sha256", process.env.WEBSITE_WEBHOOK_SECRET).update(body).digest("hex")}`;

const postLead = (body, signature) =>
  fetch(`${baseUrl}/webhooks/website/leads`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(signature ? { "x-ddpro-signature": signature } : {}),
    },
    body,
  });

test("website lead webhook rejects absent or invalid signatures", async () => {
  const absent = await postLead(leadBody);
  assert.equal(absent.status, 401);

  const invalid = await postLead(leadBody, `sha256=${"0".repeat(64)}`);
  assert.equal(invalid.status, 401);
});

test("website lead webhook accepts the raw-body HMAC format before requiring CRM storage", async () => {
  const response = await postLead(leadBody, signatureFor(leadBody));
  assert.equal(response.status, 503);
  assert.match((await response.json()).message, /service-role configuration is required/);
});
