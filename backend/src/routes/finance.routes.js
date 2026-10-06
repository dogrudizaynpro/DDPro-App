import express from "express";
import rateLimit from "express-rate-limit";
import {
  getCostRecords,
  patchCostRecord,
  postCostRecord,
  removeCostRecord,
} from "../controllers/finance.controller.js";
import { requireGoogleSession } from "../services/google-integration.service.js";

const router = express.Router();
const financeMutationLimit = rateLimit({
  windowMs: 60_000,
  limit: 60,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { status: "error", message: "Too many finance changes. Try again later." },
});

router.use(requireGoogleSession);
router.get("/costs", getCostRecords);
router.post("/costs", financeMutationLimit, postCostRecord);
router.patch("/costs/:id", financeMutationLimit, patchCostRecord);
router.delete("/costs/:id", financeMutationLimit, removeCostRecord);

export default router;
