import express from "express";
import { getIntegrationStatus } from "../controllers/integrations.controller.js";
import {
  completeGoogleOAuth,
  beginGoogleOAuth,
  requireGoogleSession,
  revokeGoogleSession,
} from "../services/google-integration.service.js";
import {
  getCalendarEvents,
  getWebsiteContent,
  patchWebsiteContent,
  postCalendarEvent,
  postGmailImport,
  postWebsiteContent,
  postWhatsAppMessage,
} from "../controllers/integration-workspace.controller.js";

const router = express.Router();

router.get("/status", getIntegrationStatus);
router.get("/google/start", beginGoogleOAuth);
router.get("/google/callback", completeGoogleOAuth);
router.post("/google/logout", requireGoogleSession, revokeGoogleSession);
router.post("/gmail/import", requireGoogleSession, postGmailImport);
router.get("/calendar/events", requireGoogleSession, getCalendarEvents);
router.post("/calendar/events", requireGoogleSession, postCalendarEvent);
router.post("/whatsapp/send", requireGoogleSession, postWhatsAppMessage);
router.get("/website/content/:contentType/:id?", requireGoogleSession, getWebsiteContent);
router.post("/website/content/:contentType", requireGoogleSession, postWebsiteContent);
router.patch("/website/content/:contentType/:id", requireGoogleSession, patchWebsiteContent);

export default router;
