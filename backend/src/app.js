import express from "express";
import cors from "cors";
import helmet from "helmet";

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
// ERROR HANDLING
// ============================================================

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    status: "error",
    message: "Internal server error",
  });
});

export default app;
