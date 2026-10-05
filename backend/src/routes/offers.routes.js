// ============================================================
// OFFERS ROUTES
// ============================================================
// Route handlers for offers domain
// Uses offers controller functions
// ============================================================

import express from "express";
import { requireGoogleSession } from "../services/google-integration.service.js";
import {
  createOffer,
  deleteOffer,
  getOfferById,
  getOffers,
  updateOffer,
} from "../controllers/offers.controller.js";

const router = express.Router();

router.use(requireGoogleSession);

// ============================================================
// GET ROUTES
// ============================================================

// GET / - Get all offers
router.get("/", getOffers);

// GET /:id - Get offer by ID
router.get("/:id", getOfferById);

// POST / - Create new offer
router.post("/", createOffer);
router.patch("/:id", updateOffer);

// DELETE /:id - Delete offer by ID
router.delete("/:id", deleteOffer);

export default router;
