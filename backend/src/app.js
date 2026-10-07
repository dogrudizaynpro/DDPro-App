import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { notFound } from "./middleware/notFound.js";
import { errorHandler } from "./middleware/errorHandler.js";
import projectsRouter from "./routes/projects.routes.js";
import researchRouter from "./routes/research.routes.js";
import offersRouter from "./routes/offers.routes.js";
import aiRouter from "./routes/ai.routes.js";
import integrationsRouter from "./routes/integrations.routes.js";
import crmRouter from "./routes/crm.routes.js";
import catalogRouter from "./routes/catalog.routes.js";
import reportsRouter from "./routes/reports.routes.js";
import financeRouter from "./routes/finance.routes.js";
import messagesRouter from "./routes/messages.routes.js";
import documentsRouter from "./routes/documents.routes.js";
import {
  getWhatsAppWebhookChallenge,
  postWebsiteLead,
  postWhatsAppWebhook,
} from "./controllers/integration-workspace.controller.js";
import { getIntegrationAdmin } from "./config/integration-admin.js";

const app = express();
const isProduction = process.env.NODE_ENV === "production";
if (isProduction) app.set("trust proxy", 1);
const parseOrigin = (value) => {
  try {
    return new URL(value).origin;
  } catch {
    return "";
  }
};
const allowedOrigins = [
  ...(process.env.ALLOWED_ORIGINS || (isProduction ? "" : "http://localhost:3000,http://localhost:5173"))
    .split(",")
    .map((origin) => parseOrigin(origin.trim()))
    .filter(Boolean),
  parseOrigin(process.env.FRONTEND_URL || ""),
].filter((origin, index, origins) =>
  origins.indexOf(origin) === index &&
  (!isProduction || !/^https?:\/\/(localhost|127(?:\.\d{1,3}){3}|\[::1\])(?::\d+)?$/i.test(origin))
);

// ============================================================
// MIDDLEWARE
// ============================================================

// Security headers
app.use(helmet());

// CORS
app.use(
  cors({
    origin: (origin, callback) =>
      callback(null, !origin || allowedOrigins.includes(origin)),
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
app.use("/webhooks/whatsapp", (error, _req, res, next) => {
  if (error.type === "entity.parse.failed") {
    return res.status(400).json({ status: "error", message: "WhatsApp webhook payload is invalid." });
  }
  return next(error);
});

// ============================================================
// API ROUTES
// ============================================================

app.use("/api/projects", projectsRouter);
app.use("/api/research", researchRouter);
app.use("/api/offers", offersRouter);
app.use("/api/ai", aiRouter);
app.use("/api/integrations", integrationsRouter);
app.use("/api/crm", crmRouter);
app.use("/api/reports", reportsRouter);
app.use("/api/finance", financeRouter);
app.use("/api/messages", messagesRouter);
app.use("/api/documents", documentsRouter);
app.use("/api", catalogRouter);
app.get(
  "/webhooks/whatsapp",
  rateLimit({
    windowMs: 60_000,
    limit: 120,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { status: "error", message: "Too many webhook requests. Try again later." },
  }),
  getWhatsAppWebhookChallenge
);
app.post(
  "/webhooks/whatsapp",
  rateLimit({
    windowMs: 60_000,
    limit: 600,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { status: "error", message: "Too many webhook requests. Try again later." },
  }),
  postWhatsAppWebhook
);
app.post(
  "/webhooks/website/leads",
  rateLimit({
    windowMs: 60_000,
    limit: 120,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { status: "error", message: "Too many webhook requests. Try again later." },
  }),
  postWebsiteLead
);

// ============================================================
// HEALTH CHECK ENDPOINT
// ============================================================

app.get("/health", async (req, res) => {
  const supabase = getIntegrationAdmin();
  if (!supabase) {
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
    const coreTables = [
      ["projects", "id"],
      ["offers", "offer_snapshot"],
      ["crm_contacts", "id"],
      ["report_records", "id"],
      ["project_costs", "id"],
      ["message_conversations", "id"],
      ["messages", "id"],
      ["document_records", "id"],
      ["ai_usage_events", "id"],
      ["research_items", "procurement_status"],
      ["crm_contacts", "id"],
      ["integration_tokens", "provider"],
      ["products", "id"],
      ["systems", "id"],
      ["price_analysis", "id"],
      ["material_analysis", "id"],
    ];
    const results = await Promise.all(
      coreTables.map(([table, column]) =>
        supabase.from(table).select(column, { head: true }).limit(1)
      )
    );
    const unavailableTables = results.flatMap(({ error }, index) =>
      error ? [coreTables[index][0]] : []
    );
    if (unavailableTables.length > 0) {
      console.error("❌ Supabase health check failed:", unavailableTables);
      return res.status(503).json({
        status: "degraded",
        service: "ddpro-backend",
        database: {
          provider: "supabase",
          ready: false,
          unavailableTables,
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
        unavailableTables: [],
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
