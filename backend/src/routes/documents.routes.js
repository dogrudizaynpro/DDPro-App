import express from "express";
import rateLimit from "express-rate-limit";
import { requireGoogleSession } from "../services/google-integration.service.js";
import {
  getDocument,
  getDocuments,
  postDocument,
  removeDocument,
} from "../controllers/documents.controller.js";

const router = express.Router();
const mutationLimit = rateLimit({
  windowMs: 60_000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { status: "error", message: "Too many document changes. Try again later." },
});

router.use(requireGoogleSession);
router.get("/", getDocuments);
router.post("/", mutationLimit, express.raw({ type: "*/*", limit: "10mb" }), postDocument);
router.get("/:id/download", getDocument);
router.delete("/:id", mutationLimit, removeDocument);

export default router;
