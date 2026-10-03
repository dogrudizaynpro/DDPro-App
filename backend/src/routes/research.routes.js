// ============================================================
// RESEARCH ROUTES
// ============================================================
// Route handlers for research_items domain
// Uses research controller functions
// ============================================================

import express from "express";
import {
  createResearchItem,
  createResearchSearch,
  deleteResearchItem,
  getResearchProviderStatus,
  getResearchItemById,
  getResearchItems,
} from "../controllers/research.controller.js";

const router = express.Router();

router.get("/provider-status", getResearchProviderStatus);
router.post("/agent", createResearchSearch);

// ============================================================
// GET ROUTES
// ============================================================

// GET / - Get all research items
router.get("/", getResearchItems);

// GET /:id - Get research item by ID
router.get("/:id", getResearchItemById);

// POST / - Create research item
router.post("/", createResearchItem);

// DELETE /:id - Delete research item by ID
router.delete("/:id", deleteResearchItem);

export default router;
