import express from "express";
import rateLimit from "express-rate-limit";
import {
  getCrmContacts,
  patchCrmContact,
  postCrmContact,
  removeCrmContact,
} from "../controllers/crm.controller.js";
import { requireGoogleSession } from "../services/google-integration.service.js";

const router = express.Router();
const crmMutationLimit = rateLimit({
  windowMs: 60_000,
  limit: 60,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { status: "error", message: "Too many CRM changes. Try again later." },
});

router.use(requireGoogleSession);
router.get("/", getCrmContacts);
router.post("/", crmMutationLimit, postCrmContact);
router.patch("/:id", crmMutationLimit, patchCrmContact);
router.delete("/:id", crmMutationLimit, removeCrmContact);

export default router;
