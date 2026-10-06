// ============================================================
// RESEARCH ROUTES
// ============================================================
// Route handlers for research_items domain
// Uses research controller functions
// ============================================================

import express from "express";
import rateLimit from "express-rate-limit";
import { requireGoogleSession } from "../services/google-integration.service.js";
import {
  createResearchItem,
  createResearchSearch,
  deleteResearchItem,
  getResearchProviderStatus,
  getResearchItemById,
  getResearchItems,
  updateResearchItem,
} from "../controllers/research.controller.js";

const router = express.Router();
const researchMutationLimit = rateLimit({
  windowMs: 60_000,
  limit: 60,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { status: "error", message: "Too many procurement changes. Try again later." },
});

router.use(requireGoogleSession);

router.get("/provider-status", getResearchProviderStatus);
router.post("/agent", researchMutationLimit, createResearchSearch);

// ============================================================
// GET ROUTES
// ============================================================

// GET / - Get all research items
router.get("/", getResearchItems);

// GET /:id - Get research item by ID
router.get("/:id", getResearchItemById);

// POST / - Create research item
router.post("/", researchMutationLimit, createResearchItem);
router.patch("/:id", researchMutationLimit, updateResearchItem);

// DELETE /:id - Delete research item by ID
router.delete("/:id", researchMutationLimit, deleteResearchItem);

export default router;
