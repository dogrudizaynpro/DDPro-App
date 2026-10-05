import express from "express";
import rateLimit from "express-rate-limit";
import {
  createAiCompletion,
  getAiStatus,
} from "../controllers/ai.controller.js";
import { requireGoogleSession } from "../services/google-integration.service.js";

const router = express.Router();
const aiChatRateLimit = rateLimit({
  windowMs: 60_000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { status: "error", message: "Too many AI requests. Try again later." },
});

router.get("/status", getAiStatus);
router.post("/chat", requireGoogleSession, aiChatRateLimit, createAiCompletion);

export default router;
