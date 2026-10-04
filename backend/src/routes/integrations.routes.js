import express from "express";
import rateLimit from "express-rate-limit";
import {
  getIntegrationStatus,
  postIntegrationTest,
} from "../controllers/integrations.controller.js";
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
const googleOAuthRateLimit = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});
const integrationActionRateLimit = rateLimit({
  windowMs: 60_000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

router.get("/status", getIntegrationStatus);
router.post(
  "/test/:provider",
  rateLimit({
    windowMs: 60_000,
    limit: 12,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  }),
  (req, res, next) =>
    ["gmail", "googleCalendar", "crm"].includes(req.params.provider)
      ? requireGoogleSession(req, res, next)
      : next(),
  postIntegrationTest
);
router.get("/google/start", googleOAuthRateLimit, beginGoogleOAuth);
router.get("/google/callback", googleOAuthRateLimit, completeGoogleOAuth);
router.post("/google/logout", integrationActionRateLimit, requireGoogleSession, revokeGoogleSession);
router.post("/gmail/import", integrationActionRateLimit, requireGoogleSession, postGmailImport);
router.get("/calendar/events", integrationActionRateLimit, requireGoogleSession, getCalendarEvents);
router.post("/calendar/events", integrationActionRateLimit, requireGoogleSession, postCalendarEvent);
router.post("/whatsapp/send", integrationActionRateLimit, requireGoogleSession, postWhatsAppMessage);
router.get("/website/content/:contentType/:id?", integrationActionRateLimit, requireGoogleSession, getWebsiteContent);
router.post("/website/content/:contentType", integrationActionRateLimit, requireGoogleSession, postWebsiteContent);
router.patch("/website/content/:contentType/:id", integrationActionRateLimit, requireGoogleSession, patchWebsiteContent);

export default router;
