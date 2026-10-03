import { createHmac, timingSafeEqual } from "node:crypto";
import { createCrmContact } from "../services/crm.service.js";
import {
  createGoogleCalendarEvent,
  getGoogleCalendarEvents,
  importGmailMessages,
} from "../services/google-workspace.service.js";
import {
  saveWhatsAppMessages,
  sendWhatsAppMessage,
  verifyWhatsAppChallenge,
  verifyWhatsAppSignature,
} from "../services/whatsapp.service.js";
import { requestWebsiteCms } from "../services/website-cms.service.js";

export const postGmailImport = async (req, res, next) => {
  try {
    const result = await importGmailMessages(req.integrationAccount, req.body?.limit);
    return res.status(200).json({ status: "success", data: result });
  } catch (error) {
    return next(error);
  }
};

export const getCalendarEvents = async (req, res, next) => {
  try {
    const data = await getGoogleCalendarEvents(
      req.integrationAccount,
      req.query.start,
      req.query.end
    );
    return res.status(200).json({ status: "success", data });
  } catch (error) {
    return next(error);
  }
};

export const postCalendarEvent = async (req, res, next) => {
  try {
    const data = await createGoogleCalendarEvent(req.integrationAccount, req.body);
    return res.status(201).json({ status: "success", data });
  } catch (error) {
    return next(error);
  }
};

export const getWhatsAppWebhookChallenge = (req, res) => {
  if (!verifyWhatsAppChallenge(req.query)) {
    return res.status(403).send("Webhook verification failed.");
  }
  return res.status(200).type("text/plain").send(req.query["hub.challenge"]);
};

export const postWhatsAppWebhook = async (req, res, next) => {
  if (!verifyWhatsAppSignature(req.rawBody, req.get("x-hub-signature-256"))) {
    return res.status(401).json({ status: "error", message: "Webhook signature is invalid." });
  }
  try {
    const processed = await saveWhatsAppMessages(req.body || {});
    return res.status(200).json({ status: "success", data: { processed } });
  } catch (error) {
    return next(error);
  }
};

export const postWhatsAppMessage = async (req, res, next) => {
  try {
    const data = await sendWhatsAppMessage(req.body || {});
    return res.status(200).json({ status: "success", data });
  } catch (error) {
    return next(error);
  }
};

const verifyWebsiteSignature = (rawBody, signatureHeader) => {
  const secret = process.env.WEBSITE_WEBHOOK_SECRET;
  if (!secret || !Buffer.isBuffer(rawBody)) return false;
  const received = String(signatureHeader || "").replace(/^sha256=/, "");
  if (!/^[\da-f]{64}$/i.test(received)) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest();
  return timingSafeEqual(Buffer.from(received, "hex"), expected);
};

export const postWebsiteLead = async (req, res, next) => {
  if (!verifyWebsiteSignature(req.rawBody, req.get("x-ddpro-signature"))) {
    return res.status(401).json({ status: "error", message: "Website lead signature is invalid." });
  }
  try {
    const result = await createCrmContact(
      { ...req.body, source: "website" },
      { inbound: true }
    );
    return res.status(result.duplicate ? 200 : 201).json({
      status: "success",
      data: result.contact,
      duplicate: result.duplicate,
    });
  } catch (error) {
    return next(error);
  }
};

export const getWebsiteContent = async (req, res, next) => {
  try {
    const data = await requestWebsiteCms({
      method: "GET",
      contentType: req.params.contentType,
      id: req.params.id,
    });
    return res.status(200).json({ status: "success", data });
  } catch (error) {
    return next(error);
  }
};

export const postWebsiteContent = async (req, res, next) => {
  try {
    const data = await requestWebsiteCms({
      method: "POST",
      contentType: req.params.contentType,
      body: req.body,
    });
    return res.status(201).json({ status: "success", data });
  } catch (error) {
    return next(error);
  }
};

export const patchWebsiteContent = async (req, res, next) => {
  try {
    const data = await requestWebsiteCms({
      method: "PATCH",
      contentType: req.params.contentType,
      id: req.params.id,
      body: req.body,
    });
    return res.status(200).json({ status: "success", data });
  } catch (error) {
    return next(error);
  }
};
