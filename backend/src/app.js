import express from "express";
import cors from "cors";
import helmet from "helmet";
import { notFound } from "./middleware/notFound.js";
import { errorHandler } from "./middleware/errorHandler.js";
import projectsRouter from "./routes/projects.routes.js";
import researchRouter from "./routes/research.routes.js";
import offersRouter from "./routes/offers.routes.js";

const app = express();
app.disable("x-powered-by");

// ============================================================
// MIDDLEWARE
// ============================================================

// Security headers
app.use(helmet());

const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:5173",
];

const allowedOrigins = (
  process.env.ALLOWED_ORIGINS ||
  DEFAULT_ALLOWED_ORIGINS.join(",")
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowRequestsWithoutOrigin = process.env.NODE_ENV !== "production";

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        if (allowRequestsWithoutOrigin) {
          return callback(null, true);
        }

        const error = new Error("Origin header is required");
        error.statusCode = 403;
        return callback(error);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      const error = new Error("Origin not allowed by CORS");
      error.statusCode = 403;
      return callback(error);
    },
    credentials: true,
  })
);

// Body parser
app.use(express.json({ limit: "250kb" }));
app.use(express.urlencoded({ extended: true, limit: "250kb" }));

// ============================================================
// API ROUTES
// ============================================================

app.use("/api/projects", projectsRouter);
app.use("/api/research", researchRouter);
app.use("/api/offers", offersRouter);

// ============================================================
// HEALTH CHECK ENDPOINT
// ============================================================

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "ddpro-backend",
    timestamp: new Date().toISOString(),
  });
});

// ============================================================
// ROOT ENDPOINT
// ============================================================

app.get("/", (req, res) => {
  res.status(200).json({
    name: "DDPRO Backend API",
    version: "1.0.0",
    status: "running",
    environment: process.env.NODE_ENV || "development",
  });
});

// ============================================================
// 404 NOT FOUND MIDDLEWARE
// ============================================================

app.use(notFound);

// ============================================================
// ERROR HANDLING MIDDLEWARE
// ============================================================

app.use(errorHandler);

export default app;
