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
  getProjectById,
  getProjects,
  updateProject,
} from "../controllers/projects.controller.js";

const router = express.Router();

// ============================================================
// GET ROUTES
// ============================================================

// GET / - Get all projects
router.get("/", getProjects);

// GET /:id - Get project by ID
router.get("/:id", getProjectById);

// POST / - Create project
router.post("/", createProject);

// PUT /:id - Update project
router.put("/:id", updateProject);

// DELETE /:id - Delete project
router.delete("/:id", deleteProject);

export default router;
