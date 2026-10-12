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
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  globalThis.fetch = async (input, options) => {
    const url = new URL(typeof input === "string" ? input : input.url);
    if (url.origin !== "https://health-check.test") {
      return originalFetch(input, options);
    }

    const table = url.pathname.split("/").at(-1);
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
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  if (previousSupabaseUrl === undefined) delete process.env.SUPABASE_URL;
  else process.env.SUPABASE_URL = previousSupabaseUrl;
  if (previousServiceRoleKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  else process.env.SUPABASE_SERVICE_ROLE_KEY = previousServiceRoleKey;
});

test("health reports degraded when the system images table is unavailable", async () => {
  const response = await fetch(`${baseUrl}/health`);
  const body = await response.json();

  assert.equal(response.status, 503);
  assert.equal(body.database.ready, false);
  assert.deepEqual(body.database.unavailableTables, [unavailableTable]);
  assert.ok(probedTables.includes(unavailableTable));
});
