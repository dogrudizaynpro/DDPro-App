import express from "express";
import cors from "cors";
import helmet from "helmet";
import { notFound } from "./middleware/notFound.js";
import { errorHandler } from "./middleware/errorHandler.js";
import projectsRouter from "./routes/projects.routes.js";
import researchRouter from "./routes/research.routes.js";
import offersRouter from "./routes/offers.routes.js";
import { getSupabaseClient, isSupabaseAvailable } from "./config/supabase.js";

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
app.use("/api/research", researchRouter);
app.use("/api/offers", offersRouter);

// ============================================================
// HEALTH CHECK ENDPOINT
// ============================================================

app.get("/health", async (req, res) => {
  if (!isSupabaseAvailable()) {
    return res.status(503).json({
      status: "degraded",
      service: "ddpro-backend",
      database: {
        provider: "supabase",
        ready: false,
      },
      timestamp: new Date().toISOString(),
    });
  }

  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from("projects")
      .select("id", { head: true });

     if (error) {
  console.error("❌ Supabase health check error:", error);
      return res.status(503).json({
        status: "degraded",
        service: "ddpro-backend",
        database: {
          provider: "supabase",
          ready: false,
        },
        timestamp: new Date().toISOString(),
      });
    }

    return res.status(200).json({
      status: "ok",
      service: "ddpro-backend",
      database: {
        provider: "supabase",
        ready: true,
      },
      timestamp: new Date().toISOString(),
    });
  } catch {
    return res.status(503).json({
      status: "degraded",
      service: "ddpro-backend",
      database: {
        provider: "supabase",
        ready: false,
      },
      timestamp: new Date().toISOString(),
    });
  }
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
