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
  getResearchItems,
  getResearchItemById,
} from "../controllers/research.controller.js";

const router = express.Router();

// ============================================================
// GET ROUTES
// ============================================================

// GET / - Get all research items
router.get("/", getResearchItems);

// GET /:id - Get research item by ID
router.get("/:id", getResearchItemById);

// POST / - Create new research item
router.post("/", createResearchItem);

// DELETE /:id - Delete research item by ID
router.delete("/:id", deleteResearchItem);

export default router;
