import express from "express";
import rateLimit from "express-rate-limit";
import { createCatalogController, calculateMaterialAnalysis } from "../controllers/catalog.controller.js";
import {
  getSystemImages,
  postSystemImage,
  putSystemImage,
  removeSystemImage,
} from "../controllers/system-images.controller.js";
import { requireGoogleSession } from "../services/google-integration.service.js";

const router = express.Router();
const catalogMutationLimit = rateLimit({
  windowMs: 60_000,
  limit: 60,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { status: "error", message: "Too many catalog changes. Try again later." },
});
const parseSystemImage = express.raw({ type: "*/*", limit: "10mb" });
const imageUploadError = (error, _req, res, next) => {
  if (error.type === "entity.too.large") {
    return res.status(413).json({ status: "error", message: "Görsel boyutu 10 MB sınırını aşamaz." });
  }
  return next(error);
};

router.get("/systems/:systemId/images", requireGoogleSession, getSystemImages);
router.post(
  "/systems/:systemId/images",
  requireGoogleSession,
  catalogMutationLimit,
  parseSystemImage,
  postSystemImage,
  imageUploadError
);
router.put(
  "/systems/:systemId/images/:imageId",
  requireGoogleSession,
  catalogMutationLimit,
  parseSystemImage,
  putSystemImage,
  imageUploadError
);
router.delete(
  "/systems/:systemId/images/:imageId",
  requireGoogleSession,
  catalogMutationLimit,
  removeSystemImage
);

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
