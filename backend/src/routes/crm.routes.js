import express from "express";
import {
  getCrmContacts,
  patchCrmContact,
  postCrmContact,
  removeCrmContact,
} from "../controllers/crm.controller.js";
import { requireGoogleSession } from "../services/google-integration.service.js";

const router = express.Router();

router.use(requireGoogleSession);
router.get("/", getCrmContacts);
router.post("/", postCrmContact);
router.patch("/:id", patchCrmContact);
router.delete("/:id", removeCrmContact);

export default router;
