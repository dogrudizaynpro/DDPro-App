import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import app from "../src/app.js";
import { supabaseRuntime } from "../src/config/supabase.js";

const createNotFoundClient = () => ({
  from() {
    return {
      select() {
        return this;
      },
      eq() {
        return this;
      },
      async single() {
        return {
          data: null,
          error: { code: "PGRST116", message: "No rows found" },
        };
      },
    };
  },
});

const createMutationErrorClient = () => ({
  from() {
    return {
      insert() {
        return this;
      },
      select() {
        return this;
      },
      async single() {
        return {
          data: null,
          error: new Error("Unexpected write failure"),
        };
      },
    };
  },
});

const originalIsSupabaseAvailable = supabaseRuntime.isSupabaseAvailable;
const originalGetSupabaseClient = supabaseRuntime.getSupabaseClient;

test.afterEach(() => {
  supabaseRuntime.isSupabaseAvailable = originalIsSupabaseAvailable;
  supabaseRuntime.getSupabaseClient = originalGetSupabaseClient;
});

test("GET /health returns service health", async () => {
  const response = await request(app).get("/health");

  assert.equal(response.status, 200);
  assert.equal(response.body.status, "ok");
  assert.equal(response.body.service, "ddpro-backend");
  assert.ok(response.body.timestamp);
});

test("GET /api/projects returns 503 when database configuration is missing", async () => {
  supabaseRuntime.isSupabaseAvailable = () => false;
  supabaseRuntime.getSupabaseClient = () => null;

  const response = await request(app).get("/api/projects");

  assert.equal(response.status, 503);
  assert.equal(response.body.status, "error");
  assert.equal(response.body.message, "Database service is not configured");
});

test("POST /api/offers returns 400 for invalid payload", async () => {
  supabaseRuntime.isSupabaseAvailable = () => true;
  supabaseRuntime.getSupabaseClient = () => ({});

  const response = await request(app).post("/api/offers").send({ amount: 1000 });

  assert.equal(response.status, 400);
  assert.equal(response.body.status, "error");
  assert.equal(response.body.message, "Internal server error");
});

test("GET /api/offers/:id returns 404 when offer does not exist", async () => {
  supabaseRuntime.isSupabaseAvailable = () => true;
  supabaseRuntime.getSupabaseClient = () => createNotFoundClient();

  const response = await request(app).get("/api/offers/non-existent-id");

  assert.equal(response.status, 404);
  assert.equal(response.body.status, "error");
  assert.equal(response.body.message, "Offer not found");
});

test("POST /api/offers returns controlled 500 response on write errors", async () => {
  supabaseRuntime.isSupabaseAvailable = () => true;
  supabaseRuntime.getSupabaseClient = () => createMutationErrorClient();

  const response = await request(app).post("/api/offers").send({ title: "Teklif A" });

  assert.equal(response.status, 500);
  assert.equal(response.body.status, "error");
  assert.equal(response.body.message, "Internal server error");
});
