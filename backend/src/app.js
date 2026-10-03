import express from "express";
import cors from "cors";
import helmet from "helmet";
import { notFound } from "./middleware/notFound.js";
import { errorHandler } from "./middleware/errorHandler.js";
import projectsRouter from "./routes/projects.routes.js";
import researchRouter from "./routes/research.routes.js";
import offersRouter from "./routes/offers.routes.js";
import aiRouter from "./routes/ai.routes.js";
import integrationsRouter from "./routes/integrations.routes.js";
import crmRouter from "./routes/crm.routes.js";
import {
  getWhatsAppWebhookChallenge,
  postWebsiteLead,
  postWhatsAppWebhook,
} from "./controllers/integration-workspace.controller.js";
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
app.use(express.json({
  limit: "1mb",
  verify: (req, _res, buffer) => {
    req.rawBody = Buffer.from(buffer);
  },
}));
app.use(express.urlencoded({ extended: true }));

// ============================================================
// API ROUTES
// ============================================================

app.use("/api/projects", projectsRouter);
app.use("/api/research", researchRouter);
app.use("/api/offers", offersRouter);
app.use("/api/ai", aiRouter);
app.use("/api/integrations", integrationsRouter);
app.use("/api/crm", crmRouter);
app.get("/webhooks/whatsapp", getWhatsAppWebhookChallenge);
app.post("/webhooks/whatsapp", postWhatsAppWebhook);
app.post("/webhooks/website/leads", postWebsiteLead);

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
    const { data, error } = await supabase
  .from("projects")
  .select("id")
  .limit(1);
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
  } catch (error) {
   console.error("❌ Supabase health check exception:", error);
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
