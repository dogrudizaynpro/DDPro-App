import assert from "node:assert/strict";
import { createHash, createHmac, randomBytes } from "node:crypto";
import { afterEach, beforeEach, test } from "node:test";
import {
  extractWhatsAppMessages, getWhatsAppConfigurationStatus, saveWhatsAppMessages,
  sendWhatsAppMessage, testWhatsAppConnection, verifyWhatsAppChallenge, verifyWhatsAppSignature,
} from "../src/services/whatsapp.service.js";
import { getWhatsAppAiAccount, requestWhatsAppAiReply } from "../src/services/whatsapp-ai.service.js";
import { createCrmContact } from "../src/services/crm.service.js";
import { encryptIntegrationToken } from "../src/services/integration-vault.service.js";

const originalEnv = { ...process.env };
const originalFetch = globalThis.fetch;
beforeEach(() => {
  process.env.WHATSAPP_PHONE_NUMBER_ID = "123456789";
  process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY = randomBytes(32).toString("hex");
});
afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) delete process.env[key];
  }
  Object.assign(process.env, originalEnv);
});

const phone = "905551234567";
const otherPhone = "905557654321";
const account = "owner@example.com";
const uuid = "4bc6f5a6-0b6c-4ddb-b29b-208c84c344d0";
const sessionVersion = "test-google-session-version-123456";
const connectionVersion = createHash("sha256").update(`session:${sessionVersion}`).digest("hex");
const googleToken = () => ({
  accessToken: "test-google-access-credential",
  refreshToken: "test-google-refresh-credential",
  expiresAt: Date.now() + 3_600_000,
  sessionVersion,
});
const payload = (id = "wamid.1", text = "Merhaba", sender = phone, type = "text") => ({
  object: "whatsapp_business_account",
  entry: [{ id: "business-account", changes: [{ field: "messages", value: {
    messaging_product: "whatsapp",
    metadata: { phone_number_id: "123456789", display_phone_number: "+90 555 123 4567" },
    contacts: [{ wa_id: sender, profile: { name: "Ada" } }],
    messages: [{ id, from: sender, timestamp: "1791395400", type,
      ...(type === "text" ? { text: { body: text } } : {}),
      ...(type === "button" ? { button: { text } } : {}),
      ...(type === "interactive" ? { interactive: { button_reply: { id: uuid, title: text } } } : {}),
    }],
  } }] }],
});

const authorize = () => {
  process.env.GOOGLE_ALLOWED_EMAILS = `${account},other@example.com`;
  process.env.WHATSAPP_AI_ACCOUNTS = JSON.stringify({ [phone]: account, [otherPhone]: "other@example.com" });
};
const configureSend = () => {
  process.env.WHATSAPP_ACCESS_TOKEN = "test-access-credential";
  process.env.WHATSAPP_PHONE_NUMBER_ID = "123456789";
  delete process.env.WHATSAPP_API_VERSION;
};

// A query-compatible in-memory store exercises checkpoints, uniqueness and claims
// without substituting production processing logic.
class Store {
  messages = new Map();
  contacts = [];
  usageEvents = [];
  tokens = [
    { provider: "google", account, encrypted_token: encryptIntegrationToken(googleToken()) },
    { provider: "google", account: "other@example.com", encrypted_token: encryptIntegrationToken(googleToken()) },
  ];
  async rpc(name, { p_message_id: id, p_sender: sender, p_lease_token: token }) {
    assert.equal(name, "claim_whatsapp_inbound");
    if (!this.messages.has(id)) this.messages.set(id, {
      message_id: id, sender, status: "retry", next_chunk: 0, contact_id: null,
      reply_chunks: null, usage_recorded: false, confirmation_attempted: false,
    });
    const row = this.messages.get(id);
    if ([...this.messages.values()].some((item) => item.sender === sender &&
        item.status === "processing" && Date.parse(item.leased_until) > Date.now()) ||
        row.status === "completed" || row.sender !== sender) return { data: null };
    Object.assign(row, { status: "processing", lease_token: token,
      leased_until: new Date(Date.now() + 600_000).toISOString() });
    return { data: { ...row } };
  }
  from(table) {
    const store = this;
    const filters = [];
    let patch, insert, countRequested;
    const query = {
      select(_columns, options) { countRequested = options?.count === "exact"; return this; },
      update(value) { patch = value; return this; },
      insert(value) { insert = value; return this; },
      eq(key, value) { filters.push((row) => row[key] === value); return this; },
      neq(key, value) { filters.push((row) => row[key] !== value); return this; },
      gt(key, value) { filters.push((row) => row[key] > value); return this; },
      gte(key, value) { filters.push((row) => row[key] >= value); return this; },
      limit() { return this; },
      async maybeSingle() {
        const rows = table === "whatsapp_inbound_messages" ? [...store.messages.values()]
          : table === "crm_contacts" ? store.contacts
          : table === "ai_usage_events" ? store.usageEvents : store.tokens;
        if (countRequested) return { count: rows.filter((row) => filters.every((filter) => filter(row))).length };
        if (insert) {
          assert.equal(table, "crm_contacts");
          if (store.contacts.some((row) => row.source === insert.source &&
              row.source_external_id === insert.source_external_id && insert.source_external_id)) {
            return { data: null, error: { code: "23505" } };
          }
          const row = { ...insert, id: `contact-${store.contacts.length + 1}` };
          store.contacts.push(row);
          return { data: { ...row } };
        }
        const row = rows.find((candidate) => filters.every((filter) => filter(candidate)));
        if (row && patch) Object.assign(row, patch);
        return { data: row ? { ...row } : null };
      },
      single() { return this.maybeSingle(); },
      then(resolve, reject) { return this.maybeSingle().then(resolve, reject); },
    };
    return query;
  }
}

const dependencies = (store, overrides = {}) => ({
  admin: store,
  createContact: (body, options) => createCrmContact(body, options, store),
  aiReply: async () => ({ reply_chunks: ["AI reply"] }),
  recordUsage: async (owner) => store.usageEvents.push({
    owner_account: owner, created_at: new Date().toISOString(),
  }),
  send: async () => ({ id: "outbound-id" }),
  ...overrides,
});

test("WhatsApp signatures require sha256= and the exact raw-body bytes", () => {
  process.env.WHATSAPP_APP_SECRET = "test-signing-credential";
  const body = Buffer.from('{"entry":[]}');
  const digest = createHmac("sha256", process.env.WHATSAPP_APP_SECRET).update(body).digest("hex");
  assert.equal(verifyWhatsAppSignature(body, `sha256=${digest}`), true);
  for (const signature of [digest, `SHA256=${digest}`, `sha1=${digest}`, `sha256=${digest} `, [], null]) {
    assert.equal(verifyWhatsAppSignature(body, signature), false);
  }
  assert.equal(verifyWhatsAppSignature(Buffer.from('{"entry": []}'), `sha256=${digest}`), false);
  assert.equal(verifyWhatsAppSignature(body.toString(), `sha256=${digest}`), false);
  delete process.env.WHATSAPP_APP_SECRET;
  assert.equal(verifyWhatsAppSignature(body, `sha256=${digest}`), false);
});

test("WhatsApp challenge compares only typed tokens and safe challenges", () => {
  process.env.WHATSAPP_VERIFY_TOKEN = "verify-credential";
  const query = { "hub.mode": "subscribe", "hub.verify_token": "verify-credential", "hub.challenge": "12345" };
  assert.equal(verifyWhatsAppChallenge(query), true);
  for (const changes of [
    { "hub.verify_token": "wrong" }, { "hub.verify_token": ["verify-credential"] },
    { "hub.verify_token": null }, { "hub.challenge": {} }, { "hub.challenge": "<script>" },
    { "hub.mode": "unsubscribe" },
  ]) assert.equal(verifyWhatsAppChallenge({ ...query, ...changes }), false);
  assert.equal(verifyWhatsAppChallenge(null), false);
});

test("WhatsApp extraction accepts text/button/interactive names and ignores statuses/unsupported media", () => {
  for (const type of ["text", "button", "interactive"]) {
    assert.deepEqual(extractWhatsAppMessages(payload("id", "Hello", phone, type)), [
      { id: "id", from: phone, name: "Ada", type, text: "Hello" },
    ]);
  }
  const status = { object: "whatsapp_business_account", entry: [{ changes: [{ value: { statuses: [{}] } }] }] };
  assert.deepEqual(extractWhatsAppMessages(status), []);
  assert.deepEqual(extractWhatsAppMessages(payload("media", "", phone, "image")), []);
  const list = payload("list", "ignored", phone, "interactive");
  list.entry[0].changes[0].value.messages[0].interactive = { list_reply: { id: uuid, title: "Choice" } };
  assert.equal(extractWhatsAppMessages(list)[0].text, "Choice");
});

test("WhatsApp malformed payloads fail safely before saving anything", async () => {
  for (const body of [null, [], {}, { object: "whatsapp_business_account", entry: {} },
    { object: "whatsapp_business_account", entry: [null] }]) {
    assert.throws(() => extractWhatsAppMessages(body), (error) => error.statusCode === 400);
  }
  for (const field of [{ from: {} }, { id: "" }, { type: {} }, { text: { body: [] } }, { text: { body: "a".repeat(8001) } }]) {
    const body = payload();
    Object.assign(body.entry[0].changes[0].value.messages[0], field);
    assert.throws(() => extractWhatsAppMessages(body), (error) => error.statusCode === 400);
  }
  const tooMany = payload();
  tooMany.entry[0].changes[0].value.messages = Array.from({ length: 21 }, (_, id) => ({
    id: `id${id}`, from: phone, type: "text", text: { body: "Hello" },
  }));
  await assert.rejects(saveWhatsAppMessages(tooMany), (error) => error.statusCode === 400);
});

test("Meta message deliveries are bound to the configured receiving business phone", async () => {
  authorize();
  const store = new Store();
  const foreignBusiness = payload("wrong-business");
  foreignBusiness.entry[0].changes[0].value.metadata.phone_number_id = "999999999";
  const deps = dependencies(store, {
    createContact: async () => assert.fail("another business must not create a lead"),
    aiReply: async () => assert.fail("another business must not access AI"),
    send: async () => assert.fail("another business must not receive a reply"),
  });
  assert.equal(await saveWhatsAppMessages(foreignBusiness, deps), 0);
  assert.equal(store.messages.size, 0);
  const missingMetadata = payload("missing-business");
  delete missingMetadata.entry[0].changes[0].value.metadata;
  await assert.rejects(saveWhatsAppMessages(missingMetadata, deps), (error) => error.statusCode === 400);
  const invalidMetadata = payload("invalid-business");
  invalidMetadata.entry[0].changes[0].value.metadata.phone_number_id = 123456789;
  await assert.rejects(saveWhatsAppMessages(invalidMetadata, deps), (error) => error.statusCode === 400);
  delete process.env.WHATSAPP_PHONE_NUMBER_ID;
  await assert.rejects(saveWhatsAppMessages(payload("unconfigured-business"), deps),
    (error) => error.statusCode === 503);
});

test("WhatsApp configuration validates send credentials/version and webhook independently", () => {
  configureSend();
  process.env.WHATSAPP_APP_SECRET = "signing-credential";
  process.env.WHATSAPP_VERIFY_TOKEN = "verify-credential";
  assert.deepEqual(getWhatsAppConfigurationStatus(), { configured: true, sendConfigured: true, webhookConfigured: true });
  process.env.WHATSAPP_API_VERSION = "../../unsafe";
  assert.equal(getWhatsAppConfigurationStatus().sendConfigured, false);
  process.env.WHATSAPP_API_VERSION = "v23.0";
  process.env.WHATSAPP_PHONE_NUMBER_ID = "123/messages";
  assert.equal(getWhatsAppConfigurationStatus().sendConfigured, false);
  assert.equal(getWhatsAppConfigurationStatus().webhookConfigured, true);
  process.env.WHATSAPP_PHONE_NUMBER_ID = "123";
  process.env.WHATSAPP_ACCESS_TOKEN = "white space";
  assert.equal(getWhatsAppConfigurationStatus().sendConfigured, false);
  process.env.WHATSAPP_VERIFY_TOKEN = "";
  assert.equal(getWhatsAppConfigurationStatus().webhookConfigured, false);
});

test("webhook readiness depends only on app secret and verify token, independently of the outbound phone ID", () => {
  configureSend();
  process.env.WHATSAPP_APP_SECRET = "test-signing-credential";
  process.env.WHATSAPP_VERIFY_TOKEN = "test-verify-credential";
  delete process.env.WHATSAPP_PHONE_NUMBER_ID;
  assert.deepEqual(getWhatsAppConfigurationStatus(), {
    webhookConfigured: true, sendConfigured: false, configured: false,
  });
});

test("WhatsApp outbound sends validated JSON/auth with bounded timeout and v23.0 default", async () => {
  configureSend();
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "https://graph.facebook.com/v23.0/123456789/messages");
    assert.equal(options.method, "POST");
    assert.equal(options.headers.Authorization, "Bearer " + process.env.WHATSAPP_ACCESS_TOKEN);
    assert.ok(options.signal instanceof AbortSignal);
    assert.deepEqual(JSON.parse(options.body), {
      messaging_product: "whatsapp", recipient_type: "individual", to: phone,
      type: "text", text: { body: "Hello" },
    });
    return { ok: true, json: async () => ({ messages: [{ id: "wamid.sent" }] }) };
  };
  assert.deepEqual(await sendWhatsAppMessage({ to: "+90 555 123 4567", text: " Hello " }), { id: "wamid.sent" });
  for (const input of [{ to: "bad905551234567", text: "Hello" }, { to: phone, text: "a".repeat(4001) }, { to: phone, text: "" }]) {
    await assert.rejects(sendWhatsAppMessage(input), (error) => error.statusCode === 400);
  }
});

test("WhatsApp provider JSON/network/auth/timeout errors never expose provider text or credentials", async () => {
  configureSend();
  for (const fetcher of [
    async () => { throw new Error(`network ${process.env.WHATSAPP_ACCESS_TOKEN}`); },
    async () => { throw Object.assign(new Error("timeout sensitive"), { name: "TimeoutError" }); },
    async () => ({ ok: false, status: 401, json: async () => ({ error: { message: "provider sensitive" } }) }),
    async () => ({ ok: true, json: async () => { throw new Error("invalid JSON sensitive"); } }),
    async () => ({ ok: true, json: async () => ({ error: { message: "sensitive" } }) }),
    async () => ({ ok: true, json: async () => ({}) }),
  ]) {
    globalThis.fetch = fetcher;
    await assert.rejects(sendWhatsAppMessage({ to: phone, text: "Hello" }), (error) => {
      assert.equal(error.statusCode, 502);
      assert.doesNotMatch(error.message, /sensitive|test-access-credential/);
      return true;
    });
  }
  delete process.env.WHATSAPP_ACCESS_TOKEN;
  await assert.rejects(sendWhatsAppMessage({ to: phone, text: "Hello" }), (error) => error.statusCode === 503);
});

test("WhatsApp connection probe performs an authenticated actual Graph phone read", async () => {
  configureSend();
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "https://graph.facebook.com/v23.0/123456789?fields=id,display_phone_number");
    assert.equal(options.method, "GET");
    assert.equal(options.headers.Authorization, "Bearer " + process.env.WHATSAPP_ACCESS_TOKEN);
    return { ok: true, json: async () => ({ id: "123456789", display_phone_number: "+90 555 123 4567" }) };
  };
  assert.equal((await testWhatsAppConnection()).id, "123456789");
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ id: "wrong", display_phone_number: "provider sensitive" }) });
  await assert.rejects(testWhatsAppConnection(), (error) => error.statusCode === 502 && !error.message.includes("sensitive"));
});

test("AI account mapping is explicitly enabled, one-to-one, allowed and fail-closed", () => {
  authorize();
  assert.equal(getWhatsAppAiAccount(phone), account);
  assert.equal(getWhatsAppAiAccount("905550000000"), null);
  for (const mapping of ["not-json", "[]", "null",
    JSON.stringify({ [phone]: "attacker@example.com" }),
    JSON.stringify({ [phone]: account, [otherPhone]: account }),
    JSON.stringify({ ["+" + phone]: account }),
    JSON.stringify({ [phone]: "OWNER@example.com" }),
  ]) {
    process.env.WHATSAPP_AI_ACCOUNTS = mapping;
    assert.equal(getWhatsAppAiAccount(phone), null);
  }
  authorize();
  delete process.env.GOOGLE_ALLOWED_EMAILS;
  assert.equal(getWhatsAppAiAccount(phone), null);
});

test("unmapped phones and nonexistent Google accounts save CRM only; status callbacks need no storage", async () => {
  const store = new Store();
  delete process.env.WHATSAPP_AI_ACCOUNTS;
  const deps = dependencies(store, {
    aiReply: async () => assert.fail("AI must not run"),
    recordUsage: async () => assert.fail("AI usage must not run"),
    send: async () => assert.fail("AI replies must not send"),
  });
  assert.equal(await saveWhatsAppMessages(payload("unknown"), deps), 1);
  authorize();
  store.tokens = [];
  assert.equal(await saveWhatsAppMessages(payload("no-account"), deps), 1);
  assert.equal(store.contacts.length, 2);
  assert.equal(store.contacts[0].source, "whatsapp");
  assert.equal(store.contacts[0].source_external_id, "unknown");
  assert.equal(store.contacts[0].request, "WhatsApp: Merhaba");
  assert.equal(await saveWhatsAppMessages({ object: "whatsapp_business_account", entry: [] }), 0);
});

test("missing vault readiness, corrupt encryption and malformed/stale Google tokens fail closed to CRM only", async () => {
  authorize();
  const invalidTokens = [
    {},
    { ...googleToken(), accessToken: "" },
    { ...googleToken(), expiresAt: "invalid" },
    { ...googleToken(), expiresAt: Date.now() - 1_000, refreshToken: null },
  ];
  for (const [index, token] of invalidTokens.entries()) {
    const store = new Store();
    store.tokens[0].encrypted_token = encryptIntegrationToken(token);
    const deps = dependencies(store, {
      aiReply: async () => assert.fail("invalid Google token must not access AI"),
      send: async () => assert.fail("invalid Google token must not receive data"),
    });
    assert.equal(await saveWhatsAppMessages(payload(`invalid-token-${index}`), deps), 1);
    assert.equal(store.usageEvents.length, 0);
    assert.equal(store.contacts.length, 1);
  }
  const corruptStore = new Store();
  corruptStore.tokens[0].encrypted_token.tag = randomBytes(16).toString("base64");
  assert.equal(await saveWhatsAppMessages(payload("corrupt-token"), dependencies(corruptStore, {
    aiReply: async () => assert.fail("undecryptable Google token must not access AI"),
  })), 1);
  const missingKeyStore = new Store();
  delete process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY;
  assert.equal(await saveWhatsAppMessages(payload("missing-key"), dependencies(missingKeyStore, {
    aiReply: async () => assert.fail("unconfigured vault must not access AI"),
  })), 1);
});

test("decryptable expired Google access remains eligible only when the existing token is refreshable", async () => {
  authorize();
  const store = new Store();
  store.tokens[0].encrypted_token = encryptIntegrationToken({ ...googleToken(), expiresAt: Date.now() - 1_000 });
  assert.equal(await saveWhatsAppMessages(payload("refreshable-token"), dependencies(store)), 1);
  assert.equal(store.usageEvents.length, 1);
});

test("OAuth removal during AI processing prevents replies and subsequent delivery cannot replay private data", async () => {
  authorize();
  const store = new Store();
  let ai = 0, sends = 0;
  const deps = dependencies(store, {
    aiReply: async () => {
      ai += 1;
      store.tokens = [];
      return { reply_chunks: ["private CRM data"] };
    },
    send: async () => { sends += 1; },
  });
  await assert.rejects(saveWhatsAppMessages(payload("disconnected-during-ai"), deps), /authorization changed/);
  assert.equal(store.messages.get("disconnected-during-ai").status, "retry");
  assert.equal(await saveWhatsAppMessages(payload("disconnected-during-ai"), deps), 1);
  assert.deepEqual([ai, sends], [1, 0]);
  assert.equal(store.contacts.length, 1);
});

test("OAuth removal immediately before confirmation blocks the write and releases the durable processing lease", async () => {
  authorize();
  const store = new Store();
  store.messages.set("disconnect-preview", {
    message_id: "disconnect-preview", sender: phone, owner_account: account, status: "completed",
    connection_version: connectionVersion,
    pending_action_id: uuid, pending_expires_at: new Date(Date.now() + 300_000).toISOString(),
  });
  const from = store.from.bind(store);
  store.from = (table) => {
    const query = from(table);
    const update = query.update;
    query.update = function (patch) {
      if (patch.confirmation_attempted) store.tokens = [];
      return update.call(this, patch);
    };
    return query;
  };
  let confirms = 0;
  const deps = dependencies(store, {
    aiReply: (input) => requestWhatsAppAiReply(input, {
      confirm: async () => { confirms += 1; },
      complete: async () => assert.fail("must not call AI completion for a confirmation"),
    }),
    send: async () => assert.fail("disconnected account must not receive a reply"),
  });
  await assert.rejects(saveWhatsAppMessages(payload("disconnect-confirm", `ONAYLA ${uuid}`), deps));
  assert.equal(store.messages.get("disconnect-confirm").status, "retry");
  assert.equal(store.messages.get("disconnect-confirm").lease_token, null);
  assert.equal(await saveWhatsAppMessages(payload("disconnect-confirm", `ONAYLA ${uuid}`), deps), 1);
  assert.equal(confirms, 0);
});

test("OAuth reconnection cannot resume old private replies or authorize a preview from the previous connection", async () => {
  authorize();
  const store = new Store();
  store.messages.set("old-preview", {
    message_id: "old-preview", sender: phone, owner_account: account, status: "completed",
    connection_version: connectionVersion,
    pending_action_id: uuid, pending_expires_at: new Date(Date.now() + 300_000).toISOString(),
  });
  const deps = dependencies(store, {
    send: async () => { throw new Error("send must retry"); },
  });
  await assert.rejects(saveWhatsAppMessages(payload("old-private-reply"), deps));
  store.tokens[0].encrypted_token = encryptIntegrationToken({
    ...googleToken(), sessionVersion: "new-google-session-version-654321",
  });
  assert.equal(await saveWhatsAppMessages(payload("old-private-reply"), dependencies(store, {
    send: async () => assert.fail("previous connection's reply must not send"),
  })), 1);
  let confirms = 0;
  const replies = [];
  const confirmDeps = dependencies(store, {
    aiReply: (input) => requestWhatsAppAiReply(input, {
      confirm: async () => { confirms += 1; },
      complete: async () => assert.fail("must use explicit confirmation path"),
    }),
    send: async ({ text }) => replies.push(text),
  });
  assert.equal(await saveWhatsAppMessages(payload("new-connection-confirm", `ONAYLA ${uuid}`), confirmDeps), 1);
  assert.equal(confirms, 0);
  assert.match(replies.join(""), /geçerli bir onay bulunamadı/);
});

test("ordinary encrypted OAuth access-token refresh preserves the connection-bound reply checkpoint", async () => {
  authorize();
  const store = new Store();
  let sends = 0, ai = 0;
  const deps = dependencies(store, {
    aiReply: async () => { ai += 1; return { reply_chunks: ["reply"] }; },
    send: async () => { sends += 1; if (sends === 1) throw new Error("send failure"); },
  });
  await assert.rejects(saveWhatsAppMessages(payload("refreshed-connection"), deps));
  store.tokens[0].encrypted_token = encryptIntegrationToken({
    ...googleToken(), accessToken: "test-refreshed-google-access-credential",
  });
  assert.equal(await saveWhatsAppMessages(payload("refreshed-connection"), deps), 1);
  assert.deepEqual([ai, sends], [1, 2]);
  assert.equal(store.usageEvents.length, 1);
});

test("durable message dedup preserves different messages from the same phone and skips AI/replies on duplicates", async () => {
  authorize();
  const store = new Store();
  let ai = 0, sends = 0, usage = 0;
  const deps = dependencies(store, {
    aiReply: async () => { ai += 1; return { reply_chunks: ["reply"] }; },
    recordUsage: async () => { usage += 1; },
    send: async () => { sends += 1; },
  });
  assert.equal(await saveWhatsAppMessages(payload("first"), deps), 1);
  assert.equal(await saveWhatsAppMessages(payload("first"), deps), 0);
  assert.equal(await saveWhatsAppMessages(payload("second", "Different message"), deps), 1);
  assert.equal(store.contacts.length, 2);
  assert.equal(store.contacts[1].request, "WhatsApp: Different message");
  assert.deepEqual([ai, usage, sends], [2, 2, 2]);
});

test("same-phone concurrent message claims prevent AI/reply races and remain retryable", async () => {
  authorize();
  const store = new Store();
  let release, entered;
  const waiting = new Promise((resolve) => { release = resolve; });
  const ready = new Promise((resolve) => { entered = resolve; });
  let calls = 0;
  const deps = dependencies(store, {
    aiReply: async () => { calls += 1; entered(); await waiting; return { reply_chunks: ["reply"] }; },
  });
  const first = saveWhatsAppMessages(payload("race-one"), deps);
  await ready;
  await assert.rejects(saveWhatsAppMessages(payload("race-one"), deps), (error) => error.statusCode === 503);
  await assert.rejects(saveWhatsAppMessages(payload("race-two"), deps), (error) => error.statusCode === 503);
  release();
  await first;
  await saveWhatsAppMessages(payload("race-two"), deps);
  assert.equal(calls, 2);
  assert.equal(store.contacts.length, 2);
});

test("WhatsApp durable AI quota allows 20 requests per owner/minute and keeps excess messages retryable", async () => {
  authorize();
  const store = new Store();
  let ai = 0, sends = 0;
  const deps = dependencies(store, {
    aiReply: async () => { ai += 1; return { reply_chunks: ["reply"] }; },
    send: async () => { sends += 1; },
  });
  for (let index = 0; index < 20; index += 1) {
    assert.equal(await saveWhatsAppMessages(payload(`quota-${index}`), deps), 1);
  }
  await assert.rejects(saveWhatsAppMessages(payload("quota-excess"), deps),
    (error) => error.statusCode === 503 && /request limit/.test(error.message));
  assert.equal(store.messages.get("quota-excess").status, "retry");
  assert.equal(store.contacts.length, 21);
  assert.equal(store.usageEvents.length, 20);
  assert.deepEqual([ai, sends], [20, 20]);
  assert.equal(await saveWhatsAppMessages(payload("quota-0"), deps), 0);
  store.usageEvents[0].created_at = new Date(Date.now() - 61_000).toISOString();
  assert.equal(await saveWhatsAppMessages(payload("quota-excess"), deps), 1);
  assert.equal(store.contacts.length, 21);
  assert.deepEqual([ai, sends], [21, 21]);
});

test("quota ignores expired and other-owner events and counts failed new AI attempts", async () => {
  authorize();
  const store = new Store();
  store.usageEvents.push(
    ...Array.from({ length: 20 }, () => ({ owner_account: "other@example.com", created_at: new Date().toISOString() })),
    ...Array.from({ length: 20 }, () => ({ owner_account: account, created_at: new Date(Date.now() - 61_000).toISOString() })),
  );
  let ai = 0;
  const deps = dependencies(store, {
    aiReply: async () => { ai += 1; throw new Error("private provider failure"); },
  });
  for (let index = 0; index < 20; index += 1) {
    await assert.rejects(saveWhatsAppMessages(payload("quota-failing-ai"), deps), /processing failed/);
  }
  await assert.rejects(saveWhatsAppMessages(payload("quota-failing-ai"), deps), /request limit/);
  assert.equal(ai, 20);
  assert.equal(store.contacts.length, 1);
  assert.equal(store.usageEvents.length, 60);
});

test("quota never blocks resumed reply chunks or duplicate deliveries after the AI request was recorded", async () => {
  authorize();
  const store = new Store();
  let ai = 0, sends = 0;
  const deps = dependencies(store, {
    aiReply: async () => { ai += 1; return { reply_chunks: ["first", "second"] }; },
    send: async () => { sends += 1; if (sends === 2) throw new Error("send failure"); },
  });
  await assert.rejects(saveWhatsAppMessages(payload("quota-resume"), deps));
  assert.equal(store.messages.get("quota-resume").next_chunk, 1);
  store.usageEvents.push(...Array.from({ length: 19 }, () => ({
    owner_account: account, created_at: new Date().toISOString(),
  })));
  assert.equal(await saveWhatsAppMessages(payload("quota-resume"), deps), 1);
  assert.equal(await saveWhatsAppMessages(payload("quota-resume"), deps), 0);
  assert.equal(store.usageEvents.length, 20);
  assert.deepEqual([ai, sends], [1, 3]);
});

test("new confirmations share the owner quota but a recorded confirmation reply can resume at the limit", async () => {
  authorize();
  const store = new Store();
  store.messages.set("quota-preview", {
    message_id: "quota-preview", sender: phone, owner_account: account, status: "completed",
    connection_version: connectionVersion,
    pending_action_id: uuid, pending_expires_at: new Date(Date.now() + 300_000).toISOString(),
  });
  store.usageEvents.push(...Array.from({ length: 20 }, () => ({
    owner_account: account, created_at: new Date().toISOString(),
  })));
  let confirms = 0, sends = 0;
  const deps = dependencies(store, {
    aiReply: (input) => requestWhatsAppAiReply(input, {
      confirm: async () => { confirms += 1; },
      complete: async () => assert.fail("only explicit confirmation is expected"),
    }),
    send: async () => { sends += 1; if (sends === 1) throw new Error("send failure"); },
  });
  await assert.rejects(saveWhatsAppMessages(payload("quota-confirm", `ONAYLA ${uuid}`), deps),
    /request limit/);
  assert.equal(confirms, 0);
  store.usageEvents.shift();
  await assert.rejects(saveWhatsAppMessages(payload("quota-confirm", `ONAYLA ${uuid}`), deps));
  assert.equal(confirms, 1);
  assert.equal(store.usageEvents.length, 20);
  await saveWhatsAppMessages(payload("quota-confirm", `ONAYLA ${uuid}`), deps);
  assert.equal(confirms, 1);
  assert.equal(sends, 2);
  assert.equal(store.usageEvents.length, 20);
});

test("AI failure retries without duplicate CRM and send failure resumes persisted chunks without rerunning AI", async () => {
  authorize();
  const store = new Store();
  let ai = 0, usage = 0, sends = 0;
  const deps = dependencies(store, {
    aiReply: async () => {
      ai += 1;
      if (ai === 1) throw new Error("private provider error");
      return { reply_chunks: ["first chunk", "second chunk"] };
    },
    recordUsage: async () => { usage += 1; },
    send: async () => {
      sends += 1;
      if (sends === 2) throw new Error("private network error");
    },
  });
  await assert.rejects(saveWhatsAppMessages(payload("retry"), deps), /processing failed/);
  assert.equal(store.messages.get("retry").status, "retry");
  await assert.rejects(saveWhatsAppMessages(payload("retry"), deps), /processing failed/);
  assert.equal(store.messages.get("retry").next_chunk, 1);
  assert.equal(await saveWhatsAppMessages(payload("retry"), deps), 1);
  assert.equal(store.contacts.length, 1);
  assert.deepEqual([ai, usage, sends], [2, 2, 3]);
});

test("usage reservation failure prevents AI until durable quota storage succeeds", async () => {
  authorize();
  const store = new Store();
  let ai = 0, usage = 0;
  const deps = dependencies(store, {
    aiReply: async () => { ai += 1; return { reply_chunks: ["reply"] }; },
    recordUsage: async () => { usage += 1; if (usage === 1) throw new Error("storage failure"); },
  });
  await assert.rejects(saveWhatsAppMessages(payload("usage-retry"), deps));
  assert.equal(ai, 0);
  await saveWhatsAppMessages(payload("usage-retry"), deps);
  assert.equal(ai, 1);
  assert.equal(usage, 2);
});

test("inbound CRM, AI, claim and database exceptions are sanitized before reaching the global handler", async () => {
  authorize();
  const confidential = "private-webhook-content private-provider-response private-database-credential";
  for (const stage of ["claim", "lookup", "crm", "ai", "quota", "usage", "checkpoint"]) {
    const store = new Store();
    const deps = dependencies(store);
    if (stage === "claim") store.rpc = async () => { throw new Error(confidential); };
    if (stage === "lookup") {
      store.rpc = async () => ({ data: null });
      store.from = () => { throw new Error(confidential); };
    }
    if (stage === "crm") deps.createContact = async () => { throw new Error(confidential); };
    if (stage === "ai") deps.aiReply = async () => { throw new Error(confidential); };
    if (stage === "quota") {
      const from = store.from.bind(store);
      store.from = (table) => {
        if (table === "ai_usage_events") throw new Error(confidential);
        return from(table);
      };
    }
    if (stage === "usage") deps.recordUsage = async () => { throw new Error(confidential); };
    if (stage === "checkpoint") {
      deps.createContact = async () => ({ contact: { id: "contact" } });
      store.from = () => { throw new Error(confidential); };
    }
    await assert.rejects(saveWhatsAppMessages(payload(stage, confidential), deps), (error) => {
      assert.equal(error.statusCode, 503);
      assert.equal(error.expose, true);
      assert.doesNotMatch(error.message, /private-/);
      assert.equal(error.cause, undefined);
      return true;
    });
  }
});

test("an expired crashed-worker lease is recoverable without duplicating the saved CRM lead", async () => {
  authorize();
  const store = new Store();
  const deps = dependencies(store);
  const body = payload("crashed");
  const result = await deps.createContact({
    name: "Ada", phone, source: "whatsapp", source_external_id: "crashed",
  }, { inbound: true });
  store.messages.set("crashed", {
    message_id: "crashed", sender: phone, status: "processing",
    leased_until: new Date(Date.now() - 1_000).toISOString(),
    contact_id: result.contact.id, owner_account: account, reply_chunks: null,
    next_chunk: 0, usage_recorded: false, confirmation_attempted: false,
  });
  assert.equal(await saveWhatsAppMessages(body, deps), 1);
  assert.equal(store.contacts.length, 1);
  assert.equal(store.messages.get("crashed").status, "completed");
});

test("changing or revoking the phone mapping cannot deliver a persisted previous owner's private reply", async () => {
  authorize();
  const store = new Store();
  let sends = 0;
  const deps = dependencies(store, {
    send: async () => { sends += 1; throw new Error("retry"); },
  });
  await assert.rejects(saveWhatsAppMessages(payload("owner-change"), deps));
  process.env.WHATSAPP_AI_ACCOUNTS = JSON.stringify({ [phone]: "other@example.com", [otherPhone]: account });
  assert.equal(await saveWhatsAppMessages(payload("owner-change"), deps), 1);
  assert.equal(sends, 1);
  assert.equal(store.messages.get("owner-change").owner_account, account);
});

test("authorized AI uses the bound account, sends preview chunks <=4000 and never automatically confirms", async () => {
  authorize();
  const store = new Store();
  let confirms = 0;
  const result = await requestWhatsAppAiReply({
    message: { type: "text", text: "Create a project" }, sender: phone, account,
    admin: store, state: {}, checkpoint: async () => {}, connectionVersion, authorize: async () => true,
  }, {
    complete: async (input) => {
      assert.deepEqual(input, { message: "Create a project", context: { channel: "whatsapp" }, integrationAccount: account });
      return { answer: "a".repeat(3999) + "😀", pendingAction: {
        id: uuid, summary: "Create?", preview: { proposed: { name: "Project" } },
        expiresAt: new Date(Date.now() + 300_000).toISOString(),
      } };
    },
    confirm: async () => { confirms += 1; },
  });
  assert.equal(confirms, 0);
  assert.equal(result.pending_action_id, uuid);
  assert.ok(result.reply_chunks.every((chunk) => chunk.length <= 4000));
  assert.match(result.reply_chunks.join(""), /Project/);
  assert.match(result.reply_chunks.join(""), new RegExp(`ONAYLA ${uuid}`));
});

test("confirmation requires explicit plain text, same phone/account, delivered preview and unexpired binding", async () => {
  const store = new Store();
  store.messages.set("preview", {
    message_id: "preview", sender: phone, owner_account: account, status: "completed",
    connection_version: connectionVersion,
    pending_action_id: uuid, pending_expires_at: new Date(Date.now() + 300_000).toISOString(),
  });
  let confirms = 0, checkpoints = 0, completes = 0;
  const call = (overrides = {}) => requestWhatsAppAiReply({
    message: { type: "text", text: `ONAYLA ${uuid}` }, sender: phone, account,
    connectionVersion, authorize: async () => true,
    admin: store, state: {}, checkpoint: async (patch) => {
      assert.equal(patch.confirmation_attempted, true); checkpoints += 1;
    }, ...overrides,
  }, {
    complete: async () => { completes += 1; return { answer: "not confirmed" }; },
    confirm: async (owner, id) => {
      assert.equal(owner, account); assert.equal(id, uuid);
      assert.ok(checkpoints > 0); confirms += 1;
    },
  });
  await call({ sender: otherPhone });
  await call({ account: "other@example.com" });
  store.messages.get("preview").status = "retry";
  await call();
  store.messages.get("preview").status = "completed";
  store.messages.get("preview").pending_expires_at = new Date(Date.now() - 1000).toISOString();
  await call();
  store.messages.get("preview").pending_expires_at = new Date(Date.now() + 300_000).toISOString();
  await call({ message: { type: "interactive", text: `ONAYLA ${uuid}` } });
  await call({ message: { type: "text", text: `Please ONAYLA ${uuid}` } });
  assert.equal(confirms, 0);
  assert.equal(completes, 2);
  await call();
  assert.equal(confirms, 1);
  await call({ state: { confirmation_attempted: true } });
  assert.equal(confirms, 1);
});

test("confirmation send retry never reexecutes a completed operational write", async () => {
  authorize();
  const store = new Store();
  store.messages.set("preview", {
    message_id: "preview", sender: phone, owner_account: account, status: "completed",
    connection_version: connectionVersion,
    pending_action_id: uuid, pending_expires_at: new Date(Date.now() + 300_000).toISOString(),
  });
  let confirms = 0, sends = 0;
  const deps = dependencies(store, {
    aiReply: (input) => requestWhatsAppAiReply(input, {
      confirm: async () => { confirms += 1; },
      complete: async () => assert.fail("must use confirmation path"),
    }),
    send: async () => { sends += 1; if (sends === 1) throw new Error("network failure"); },
  });
  await assert.rejects(saveWhatsAppMessages(payload("confirm", `ONAYLA ${uuid}`), deps));
  await saveWhatsAppMessages(payload("confirm", `ONAYLA ${uuid}`), deps);
  await saveWhatsAppMessages(payload("confirm", `ONAYLA ${uuid}`), deps);
  assert.equal(confirms, 1);
  assert.equal(sends, 2);
});
