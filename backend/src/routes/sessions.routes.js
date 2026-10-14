import express from "express";
import rateLimit from "express-rate-limit";
import { requireGoogleSession, beginSessionReauth, logoutBrowserSession, revokeAllBrowserSessions } from "../services/browser-session.service.js";

const router = express.Router();
router.use(rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: "draft-8", legacyHeaders: false }));
router.use(requireGoogleSession);
router.post("/logout", logoutBrowserSession);
router.post("/revoke-all", revokeAllBrowserSessions);
router.post("/reauth", beginSessionReauth);
export default router;
