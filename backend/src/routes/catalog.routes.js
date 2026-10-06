import express from "express";
import rateLimit from "express-rate-limit";
import { createCatalogController, calculateMaterialAnalysis } from "../controllers/catalog.controller.js";
import { requireGoogleSession } from "../services/google-integration.service.js";

const router = express.Router();
const catalogMutationLimit = rateLimit({
  windowMs: 60_000,
  limit: 60,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { status: "error", message: "Too many catalog changes. Try again later." },
});

const resources = [
  ["products", "products"],
  ["systems", "systems"],
  ["price-analysis", "price-analysis"],
  ["material-analysis", "material-analysis"],
];

for (const [path, resource] of resources) {
  const controller = createCatalogController(resource);
  router.get(`/${path}`, requireGoogleSession, controller.list);
  router.post(`/${path}`, requireGoogleSession, catalogMutationLimit, controller.create);
  router.patch(`/${path}/:id`, requireGoogleSession, catalogMutationLimit, controller.update);
  router.delete(`/${path}/:id`, requireGoogleSession, catalogMutationLimit, controller.remove);
}

router.post(
  "/material-analysis/calculate",
  requireGoogleSession,
  catalogMutationLimit,
  calculateMaterialAnalysis
);

export default router;
