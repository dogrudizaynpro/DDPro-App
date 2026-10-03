import express from "express";
import { getIntegrationStatus } from "../controllers/integrations.controller.js";

const router = express.Router();

router.get("/status", getIntegrationStatus);

export default router;
