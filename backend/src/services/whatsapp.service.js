import { createHmac, timingSafeEqual } from "node:crypto";
import { createCrmContact } from "./crm.service.js";

const safeEqualHex = (left, right) => {
  if (!/^[\da-f]{64}$/i.test(left || "") || !/^[\da-f]{64}$/i.test(right || "")) {
    return false;
  }
  return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
};

export const verifyWhatsAppSignature = (rawBody, signatureHeader) => {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret || !Buffer.isBuffer(rawBody)) return false;
  const signature = String(signatureHeader || "").replace(/^sha256=/, "");
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  return safeEqualHex(signature, expected);
};

export const verifyWhatsAppChallenge = (query) => {
  const token = process.env.WHATSAPP_VERIFY_TOKEN;
  return Boolean(
    token &&
      query["hub.mode"] === "subscribe" &&
      query["hub.verify_token"] === token &&
      typeof query["hub.challenge"] === "string" &&
      /^[\da-z_-]{1,256}$/i.test(query["hub.challenge"])
  );
};

export const saveWhatsAppMessages = async (body) => {
  const messages = (body.entry || []).flatMap((entry) =>
    (entry.changes || []).flatMap((change) => {
      const contacts = change.value?.contacts || [];
      return (change.value?.messages || []).map((message) => ({
        message,
        contact: contacts.find((candidate) => candidate.wa_id === message.from),
      }));
    })
  );
  const saved = [];
  for (const { message, contact } of messages) {
    const text =
      message.text?.body ||
      message.button?.text ||
      message.interactive?.button_reply?.title ||
      message.interactive?.list_reply?.title ||
      `[${message.type || "unsupported"} WhatsApp message]`;
    const result = await createCrmContact(
      {
        name: contact?.profile?.name || message.from,
        phone: message.from,
        request: `WhatsApp: ${String(text).slice(0, 19_000)}`,
        source: "whatsapp",
        source_external_id: message.id,
        status: "Yeni",
      },
      { inbound: true }
    );
    saved.push(result.contact);
  }
  return saved.length;
};

export const sendWhatsAppMessage = async ({ to, text }) => {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const version = process.env.WHATSAPP_API_VERSION || "v23.0";
  if (!accessToken || !phoneNumberId) {
    throw Object.assign(new Error("WhatsApp Business Cloud API is not configured."), {
      statusCode: 503,
      expose: true,
    });
  }
  const recipient = String(to || "").replace(/[^\d]/g, "");
  const message = typeof text === "string" ? text.trim() : "";
  if (recipient.length < 8 || recipient.length > 20 || !message || message.length > 4_000) {
    throw Object.assign(new Error("WhatsApp recipient or message is invalid."), {
      statusCode: 400,
      expose: true,
    });
  }

  const response = await fetch(
    `https://graph.facebook.com/${version}/${encodeURIComponent(phoneNumberId)}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: "Bearer " + accessToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: recipient,
        type: "text",
        text: { body: message },
      }),
      signal: AbortSignal.timeout(15_000),
    }
  );
  const result = await response.json();
  if (!response.ok) {
    throw Object.assign(new Error("WhatsApp provider rejected the message."), {
      statusCode: 502,
      expose: true,
    });
  }
  return { id: result.messages?.[0]?.id || null };
};
