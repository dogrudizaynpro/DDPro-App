// ============================================================
// RESEARCH ROUTES
// ============================================================
// Route handlers for research_items domain
// Uses research controller functions
// ============================================================

import express from "express";
import { getResearchItems, getResearchItemById } from "../controllers/research.controller.js";

const router = express.Router();

// ============================================================
// GET ROUTES
// ============================================================

// GET / - Get all research items
router.get("/", getResearchItems);

// GET /:id - Get research item by ID
router.get("/:id", getResearchItemById);

export default router;
