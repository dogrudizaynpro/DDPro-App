// ============================================================
// PROJECTS ROUTES
// ============================================================
// Route handlers for projects domain
// Uses projects controller functions
// ============================================================

import express from "express";
import {
  createProject,
  deleteProject,
  getProjects,
  getProjectById,
} from "../controllers/projects.controller.js";

const router = express.Router();

// ============================================================
// GET ROUTES
// ============================================================

// GET / - Get all projects
router.get("/", getProjects);

// GET /:id - Get project by ID
router.get("/:id", getProjectById);

// POST / - Create new project
router.post("/", createProject);

// DELETE /:id - Delete project by ID
router.delete("/:id", deleteProject);

export default router;
