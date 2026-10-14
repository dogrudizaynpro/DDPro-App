import assert from "node:assert/strict";
import { after, before, test } from "node:test";

const originalFetch = globalThis.fetch;
const previousSupabaseUrl = process.env.SUPABASE_URL;
const previousServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const unavailableTable = "system_images";
let server;
let baseUrl;
const probedTables = [];

before(async () => {
  process.env.SUPABASE_URL = "https://health-check.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-only-service-key";
  const { default: app } = await import("../src/app.js");
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  globalThis.fetch = async (input, options) => {
    const url = new URL(typeof input === "string" ? input : input.url);
    if (url.origin !== "https://health-check.test") {
      return originalFetch(input, options);
    }

    const table = url.pathname.split("/").at(-1);
    if (table === "ddpro_auth") return Response.json({ ready: true });
    probedTables.push(table);
    if (table === unavailableTable) {
      return new Response(JSON.stringify({
        code: "PGRST205",
        message: "Could not find the table.",
      }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(null, {
      status: 200,
      headers: { "Content-Range": "*/0" },
    });
  };
});

after(async () => {
  globalThis.fetch = originalFetch;
  try {
    if (server?.listening) {
      server.closeAllConnections();
      await new Promise((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
      });
    }
  } finally {
    if (previousSupabaseUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = previousSupabaseUrl;
    if (previousServiceRoleKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = previousServiceRoleKey;
  }
  assert.equal(globalThis.fetch, originalFetch);
  assert.equal(process.env.SUPABASE_URL, previousSupabaseUrl);
  assert.equal(process.env.SUPABASE_SERVICE_ROLE_KEY, previousServiceRoleKey);
  assert.equal(server?.listening ?? false, false);
});

test("health reports degraded when the system images table is unavailable", async () => {
  const response = await fetch(`${baseUrl}/health`);
  const body = await response.json();

  assert.equal(response.status, 503);
  assert.equal(body.database.ready, false);
  assert.deepEqual(body.database.unavailableTables, [unavailableTable]);
  for (const table of [
    "projects",
    "offers",
    "report_records",
    "project_costs",
    "message_conversations",
    "messages",
    "document_records",
    "ai_usage_events",
    "project_ai_analyses",
    "ai_file_imports",
    "research_items",
    "integration_tokens",
    "products",
    "systems",
    unavailableTable,
    "price_analysis",
    "material_analysis",
  ]) {
    assert.ok(probedTables.includes(table), `Expected health check to probe ${table}`);
  }
  assert.equal(probedTables.filter((table) => table === "crm_contacts").length, 1);
});
