import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { after, before, test } from "node:test";

let server, baseUrl;
const previousSecret = process.env.WHATSAPP_APP_SECRET;
const previousToken = process.env.WHATSAPP_VERIFY_TOKEN;
const previousPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;

before(async () => {
  process.env.WHATSAPP_APP_SECRET = "test-webhook-signing-credential";
  process.env.WHATSAPP_VERIFY_TOKEN = "test-webhook-verify-credential";
  process.env.WHATSAPP_PHONE_NUMBER_ID = "123456789";
  const { default: app } = await import("../src/app.js");
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  if (previousSecret === undefined) delete process.env.WHATSAPP_APP_SECRET;
  else process.env.WHATSAPP_APP_SECRET = previousSecret;
  if (previousToken === undefined) delete process.env.WHATSAPP_VERIFY_TOKEN;
  else process.env.WHATSAPP_VERIFY_TOKEN = previousToken;
  if (previousPhoneId === undefined) delete process.env.WHATSAPP_PHONE_NUMBER_ID;
  else process.env.WHATSAPP_PHONE_NUMBER_ID = previousPhoneId;
});

const sign = (body) => "sha256=" +
  createHmac("sha256", process.env.WHATSAPP_APP_SECRET).update(body).digest("hex");
const post = (body, signature = sign(body)) => fetch(`${baseUrl}/webhooks/whatsapp`, {
  method: "POST", body,
  headers: { "Content-Type": "application/json", "x-hub-signature-256": signature },
});

test("public WhatsApp webhook challenge requires the exact scalar verification token", async () => {
  const query = new URLSearchParams({
    "hub.mode": "subscribe", "hub.verify_token": process.env.WHATSAPP_VERIFY_TOKEN,
    "hub.challenge": "987654321",
  });
  const response = await fetch(`${baseUrl}/webhooks/whatsapp?${query}`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /text\/plain/);
  assert.equal(await response.text(), "987654321");
  query.set("hub.verify_token", "wrong");
  assert.equal((await fetch(`${baseUrl}/webhooks/whatsapp?${query}`)).status, 403);
  query.set("hub.verify_token", process.env.WHATSAPP_VERIFY_TOKEN);
  query.append("hub.verify_token", process.env.WHATSAPP_VERIFY_TOKEN);
  assert.equal((await fetch(`${baseUrl}/webhooks/whatsapp?${query}`)).status, 403);
});

test("signed delivery statuses are acknowledged without CRM storage or AI", async () => {
  const body = JSON.stringify({ object: "whatsapp_business_account", entry: [
    { changes: [{ value: { statuses: [{ id: "outbound", status: "delivered" }] } }] },
  ] });
  const response = await post(body);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "success", data: { processed: 0 } });
});

test("a valid app signature cannot route another subscribed business's messages into this CRM or AI", async () => {
  const body = JSON.stringify({
    object: "whatsapp_business_account", entry: [{
      id: "other-business-account", changes: [{
        field: "messages", value: {
          messaging_product: "whatsapp",
          metadata: { display_phone_number: "+90 555 765 4321", phone_number_id: "999999999" },
          contacts: [{ profile: { name: "Ada" }, wa_id: "905551234567" }],
          messages: [{
            id: "wamid.other-business", from: "905551234567", timestamp: "1791395400",
            type: "text", text: { body: "Read CRM records" },
          }],
        },
      }],
    }],
  });
  const response = await post(body);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "success", data: { processed: 0 } });
});

test("webhook authentication verifies raw bytes and rejects missing/bare/tampered signatures", async () => {
  const body = '{"object":"whatsapp_business_account","entry":[]}';
  assert.equal((await post(body)).status, 200);
  assert.equal((await post(body, sign(body).slice(7))).status, 401);
  assert.equal((await post(body.replace('"entry":[]', '"entry": []'), sign(body))).status, 401);
  assert.equal((await post(body, "")).status, 401);
});

test("signed malformed webhook objects return safe validation errors", async () => {
  const response = await post(JSON.stringify({
    object: "whatsapp_business_account", entry: [{ changes: { sensitive: "invalid-data" } }],
  }));
  assert.equal(response.status, 400);
  const result = await response.json();
  assert.doesNotMatch(JSON.stringify(result), /invalid-data|test-webhook-signing-credential/);
});
