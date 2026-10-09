// ============================================================
// PROJECTS ROUTES
// ============================================================
// Route handlers for projects domain
// Uses projects controller functions
// ============================================================

import express from "express";
import rateLimit from "express-rate-limit";
import { requireGoogleSession } from "../services/google-integration.service.js";
import {
  createProject,
  deleteProject,
  getProjectById,
  getProjects,
  updateProject,
} from "../controllers/projects.controller.js";
import {
  importAiFileProjects,
  importGoogleProjects,
} from "../controllers/project-import.controller.js";

const router = express.Router();

router.use(requireGoogleSession);

// ============================================================
// GET ROUTES
// ============================================================

// GET / - Get all projects
router.get("/", getProjects);

// POST /import/google-sheets - Import the authenticated user's Projects sheet
router.post("/import/google-sheets", rateLimit({
  windowMs: 60_000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
}), importGoogleProjects);

router.post("/import/ai-file", rateLimit({
  windowMs: 60_000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
}), importAiFileProjects);

// GET /:id - Get project by ID
router.get("/:id", getProjectById);

// POST / - Create project
router.post("/", createProject);

// PATCH /:id - Update project operations details
router.patch("/:id", updateProject);

// DELETE /:id - Delete project by ID
router.delete("/:id", deleteProject);

export default router;
