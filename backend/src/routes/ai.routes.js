import express from "express";
import {
  createAiCompletion,
  getAiStatus,
} from "../controllers/ai.controller.js";

const router = express.Router();

router.get("/status", getAiStatus);
router.post("/chat", createAiCompletion);

export default router;
