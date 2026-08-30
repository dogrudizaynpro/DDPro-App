import express from "express";
import cors from "cors";
import helmet from "helmet";
import { notFound } from "./middleware/notFound.js";
import { errorHandler } from "./middleware/errorHandler.js";
import projectsRouter from "./routes/projects.routes.js";

const app = express();

// ============================================================
// MIDDLEWARE
// ============================================================

// Security headers
app.use(helmet());

// CORS
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(",")
      : ["http://localhost:3000", "http://localhost:5173"],
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
