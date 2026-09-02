import express from "express";
import cors from "cors";
import helmet from "helmet";
import { notFound } from "./middleware/notFound.js";
import { errorHandler } from "./middleware/errorHandler.js";
import projectsRouter from "./routes/projects.routes.js";
import researchRouter from "./routes/research.routes.js";
import offersRouter from "./routes/offers.routes.js";

const app = express();

const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:5000",
  "https://dogrudizaynpro.github.io",
];

const configuredOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
      .map((origin) => origin.trim().replace(/\/+$/, ""))
      .filter(Boolean)
  : [];

const allowedOrigins =
  configuredOrigins.length > 0 ? configuredOrigins : DEFAULT_ALLOWED_ORIGINS;

// ============================================================
// MIDDLEWARE
// ============================================================

// Security headers
app.use(helmet());

// CORS
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(
        new Error(`CORS blocked for origin: ${origin}`)
      );
    },
    credentials: true,
  })
);

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
