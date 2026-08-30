// ============================================================
// PROJECTS ROUTES
// ============================================================
// Route handlers for projects domain
// Uses projects controller functions
// ============================================================

import express from "express";
import { getProjects, getProjectById } from "../controllers/projects.controller.js";

const router = express.Router();

// ============================================================
// GET ROUTES
// ============================================================

// GET / - Get all projects
router.get("/", getProjects);

// GET /:id - Get project by ID
router.get("/:id", getProjectById);

export default router;
