// ============================================================
// OFFERS ROUTES
// ============================================================
// Route handlers for offers domain
// Uses offers controller functions
// ============================================================

import express from "express";
import { getOffers, getOfferById } from "../controllers/offers.controller.js";

const router = express.Router();

// ============================================================
// GET ROUTES
// ============================================================

// GET / - Get all offers
router.get("/", getOffers);

// GET /:id - Get offer by ID
router.get("/:id", getOfferById);

export default router;
