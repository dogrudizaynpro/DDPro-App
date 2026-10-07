import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { getIntegrationAdmin } from "../config/integration-admin.js";
import { createCrmContact } from "./crm.service.js";
import { recordAiUsage } from "./ai.service.js";
import { getWhatsAppAiAccount, requestWhatsAppAiReply } from "./whatsapp-ai.service.js";

const safeError = (message, statusCode = 502) =>
  Object.assign(new Error(message), { statusCode, expose: true });
const validCredential = (value) =>
  typeof value === "string" && /^[^\s\x00-\x1f\x7f]{1,4096}$/.test(value);
const configuration = () => ({
  token: process.env.WHATSAPP_ACCESS_TOKEN,
  phoneId: process.env.WHATSAPP_PHONE_NUMBER_ID,
  version: process.env.WHATSAPP_API_VERSION || "v23.0",
});
const validSendConfiguration = ({ token, phoneId, version }) =>
  validCredential(token) && /^\d{1,40}$/.test(phoneId || "") &&
  /^v[1-9]\d{0,2}\.\d{1,2}$/.test(version);

export const getWhatsAppConfigurationStatus = () => {
  const sendConfigured = validSendConfiguration(configuration());
  const webhookConfigured = validCredential(process.env.WHATSAPP_APP_SECRET) &&
    validCredential(process.env.WHATSAPP_VERIFY_TOKEN);
  return { configured: sendConfigured && webhookConfigured, sendConfigured, webhookConfigured };
};

export const verifyWhatsAppSignature = (rawBody, signatureHeader) => {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!validCredential(secret) || !Buffer.isBuffer(rawBody) ||
      typeof signatureHeader !== "string" || !/^sha256=[\da-f]{64}$/i.test(signatureHeader) ||
      !signatureHeader.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest();
  return timingSafeEqual(Buffer.from(signatureHeader.slice(7), "hex"), expected);
};

export const verifyWhatsAppChallenge = (query) => {
  const token = process.env.WHATSAPP_VERIFY_TOKEN;
  if (!validCredential(token) || !query || query["hub.mode"] !== "subscribe" ||
      typeof query["hub.verify_token"] !== "string" || query["hub.verify_token"].length > 4096 ||
      typeof query["hub.challenge"] !== "string" ||
      !/^[\da-z_-]{1,256}$/i.test(query["hub.challenge"])) return false;
  return timingSafeEqual(
    createHash("sha256").update(query["hub.verify_token"]).digest(),
    createHash("sha256").update(token).digest()
  );
};

const graphRequest = async (suffix, options = {}) => {
  const config = configuration();
  if (!validSendConfiguration(config)) {
    throw safeError("WhatsApp Business Cloud API is not configured.", 503);
  }
  try {
    const response = await fetch(
      `https://graph.facebook.com/${config.version}/${config.phoneId}${suffix}`,
      {
        ...options,
        headers: { Authorization: "Bearer " + config.token, "Content-Type": "application/json" },
        signal: AbortSignal.timeout(15_000),
      }
    );
    if (!response.ok) throw new Error();
    const data = await response.json();
    if (!data || typeof data !== "object" || Array.isArray(data) || data.error) throw new Error();
    return data;
  } catch {
    throw safeError("WhatsApp provider request failed. Please retry.");
  }
};

export const testWhatsAppConnection = async () => {
  const data = await graphRequest("?fields=id,display_phone_number", { method: "GET" });
  if (data.id !== configuration().phoneId || typeof data.display_phone_number !== "string" ||
      !/^[+\d ()-]{3,80}$/.test(data.display_phone_number)) {
    throw safeError("WhatsApp provider returned an invalid phone record.");
  }
  return { id: data.id, display_phone_number: data.display_phone_number };
};

export const sendWhatsAppMessage = async ({ to, text } = {}) => {
  const recipient = typeof to === "string" && /^[+\d ()-]+$/.test(to)
    ? to.replace(/[^\d]/g, "") : "";
  const message = typeof text === "string" ? text.trim() : "";
  if (!/^\d{8,20}$/.test(recipient) || !message || message.length > 4_000) {
    throw safeError("WhatsApp recipient or message is invalid.", 400);
  }
  const data = await graphRequest("/messages", {
    method: "POST",
    body: JSON.stringify({
      messaging_product: "whatsapp", recipient_type: "individual", to: recipient,
      type: "text", text: { body: message },
    }),
  });
  const id = data.messages?.[0]?.id;
  if (typeof id !== "string" || !id || id.length > 500) {
    throw safeError("WhatsApp provider returned an invalid message receipt.");
  }
  return { id };
};

const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const invalidPayload = () => safeError("WhatsApp webhook payload is invalid.", 400);

export const extractWhatsAppMessages = (body) => {
  if (!object(body) || body.object !== "whatsapp_business_account" || !Array.isArray(body.entry)) {
    throw invalidPayload();
  }
  const messages = [];
  for (const entry of body.entry) {
    if (!object(entry) || !Array.isArray(entry.changes)) throw invalidPayload();
    for (const change of entry.changes) {
      if (!object(change) || !object(change.value)) throw invalidPayload();
      const value = change.value;
      if (value.messages === undefined) continue; // Delivery/read status notifications.
      if (!Array.isArray(value.messages) ||
          (value.contacts !== undefined && !Array.isArray(value.contacts))) throw invalidPayload();
      for (const message of value.messages) {
        if (!object(message) || typeof message.id !== "string" ||
            !/^[^\s\x00-\x1f\x7f]{1,500}$/.test(message.id) ||
            typeof message.from !== "string" || !/^\d{8,20}$/.test(message.from)) throw invalidPayload();
        let text;
        if (message.type === "text") text = message.text?.body;
        else if (message.type === "button") text = message.button?.text;
        else if (message.type === "interactive") {
          text = message.interactive?.button_reply?.title ?? message.interactive?.list_reply?.title;
        } else continue;
        if (typeof text !== "string" || !text.trim() || text.length > 8_000) throw invalidPayload();
        const contact = value.contacts?.find((candidate) => object(candidate) && candidate.wa_id === message.from);
        messages.push({
          id: message.id, from: message.from, type: message.type, text: text.trim(),
          name: typeof contact?.profile?.name === "string" ? contact.profile.name.slice(0, 250) : message.from,
        });
        if (messages.length > 20) throw invalidPayload();
      }
    }
  }
  return messages;
};

export const saveWhatsAppMessages = async (body, dependencies = {}) => {
  const messages = extractWhatsAppMessages(body);
  if (!messages.length) return 0;
  const admin = dependencies.admin || getIntegrationAdmin();
  if (!admin) throw safeError("WhatsApp inbound storage is unavailable.", 503);
  const createContact = dependencies.createContact || createCrmContact;
  const aiReply = dependencies.aiReply || requestWhatsAppAiReply;
  const usage = dependencies.recordUsage || recordAiUsage;
  const send = dependencies.send || sendWhatsAppMessage;
  let processed = 0;
  const started = Date.now();
  for (const message of messages) {
    if (Date.now() - started > 60_000) throw safeError("WhatsApp processing requires redelivery.", 503);
    const leaseToken = randomUUID();
    const { data: claimed, error: claimError } = await admin.rpc("claim_whatsapp_inbound", {
      p_message_id: message.id, p_sender: message.from, p_lease_token: leaseToken,
    });
    if (claimError) throw safeError("WhatsApp inbound storage is unavailable.", 503);
    if (!claimed) {
      const { data: existing, error } = await admin.from("whatsapp_inbound_messages")
        .select("status,sender").eq("message_id", message.id).maybeSingle();
      if (!error && existing?.status === "completed" && existing.sender === message.from) continue;
      throw safeError("WhatsApp message is being processed. Please retry.", 503);
    }
    let state = claimed;
    const checkpoint = async (patch) => {
      const { data, error } = await admin.from("whatsapp_inbound_messages")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("message_id", message.id).eq("lease_token", leaseToken)
        .eq("status", "processing").select("*").maybeSingle();
      if (error || !data) throw safeError("WhatsApp processing checkpoint failed.", 503);
      state = data;
    };
    try {
      if (!state.contact_id) {
        const result = await createContact({
          name: message.name, phone: message.from, request: `WhatsApp: ${message.text}`,
          source: "whatsapp", source_external_id: message.id, status: "Yeni",
        }, { inbound: true });
        await checkpoint({ contact_id: result.contact.id });
      }
      const account = getWhatsAppAiAccount(message.from);
      if (account && (!state.owner_account || state.owner_account === account)) {
        const { data: existingAccount, error } = await admin.from("integration_tokens")
          .select("account").eq("provider", "google").eq("account", account).maybeSingle();
        if (error) throw error;
        if (existingAccount) {
          if (!state.owner_account) await checkpoint({ owner_account: account });
          if (!state.reply_chunks) {
            const reply = await aiReply({
              message, sender: message.from, account, admin, state, checkpoint,
            });
            await checkpoint(reply);
          }
          if (!state.usage_recorded) {
            await usage(account);
            await checkpoint({ usage_recorded: true });
          }
          for (let index = state.next_chunk; index < state.reply_chunks.length; index += 1) {
            await send({ to: message.from, text: state.reply_chunks[index] });
            // A provider acceptance followed by a crash before this checkpoint can
            // duplicate a reply on redelivery; external sends are not exactly-once.
            await checkpoint({ next_chunk: index + 1 });
          }
        }
      }
      await checkpoint({ status: "completed", lease_token: null, leased_until: null });
      processed += 1;
    } catch {
      try {
        await checkpoint({ status: "retry", lease_token: null, leased_until: null });
      } catch {
        // If release fails, the durable lease expires and redelivery can retry.
      }
      throw safeError("WhatsApp message processing failed. Please retry.", 503);
    }
  }
  return processed;
};
