// ============================================================
// RESEARCH ROUTES
// ============================================================
// Route handlers for research_items domain
// Uses research controller functions
// ============================================================

import express from "express";
import {
  createResearchItem,
  deleteResearchItem,
  getResearchItemById,
  getResearchItems,
  updateResearchItem,
} from "../controllers/research.controller.js";

const router = express.Router();

// ============================================================
// GET ROUTES
// ============================================================

// GET / - Get all research items
router.get("/", getResearchItems);

// GET /:id - Get research item by ID
router.get("/:id", getResearchItemById);

// POST / - Create research item
router.post("/", createResearchItem);

// PUT /:id - Update research item
router.put("/:id", updateResearchItem);

// DELETE /:id - Delete research item
router.delete("/:id", deleteResearchItem);

export default router;
