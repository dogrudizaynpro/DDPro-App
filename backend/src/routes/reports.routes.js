import express from "express";
import rateLimit from "express-rate-limit";
import { getReports, postReport, removeReport } from "../controllers/reports.controller.js";
import { requireGoogleSession } from "../services/google-integration.service.js";

const router = express.Router();
const reportMutationLimit = rateLimit({
  windowMs: 60_000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { status: "error", message: "Too many report changes. Try again later." },
});

router.use(requireGoogleSession);
router.get("/", getReports);
router.post("/", reportMutationLimit, postReport);
router.delete("/:id", reportMutationLimit, removeReport);

export default router;
