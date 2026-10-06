import express from "express";
import rateLimit from "express-rate-limit";
import { requireGoogleSession } from "../services/google-integration.service.js";
import {
  getConversations,
  getMessages,
  patchConversation,
  patchMessageRead,
  postConversation,
  postMessage,
  removeConversation,
  removeMessage,
} from "../controllers/messages.controller.js";

const router = express.Router();
const mutationLimit = rateLimit({
  windowMs: 60_000,
  limit: 60,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { status: "error", message: "Too many message changes. Try again later." },
});

router.use(requireGoogleSession);
router.get("/conversations", getConversations);
router.post("/conversations", mutationLimit, postConversation);
router.patch("/conversations/:id", mutationLimit, patchConversation);
router.delete("/conversations/:id", mutationLimit, removeConversation);
router.get("/conversations/:id/messages", getMessages);
router.post("/conversations/:id/messages", mutationLimit, postMessage);
router.patch("/conversations/:id/messages/:messageId/read", mutationLimit, patchMessageRead);
router.delete("/conversations/:id/messages/:messageId", mutationLimit, removeMessage);

export default router;
