import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { createServer } from "node:http";
import { test } from "node:test";
import app from "../src/app.js";
import { testIntegrationConnection } from "../src/services/integration-health.service.js";

test("website lead webhook and Integration Center test reach CRM and CMS providers", async () => {
  const contacts = [];
  const requests = [];
  const provider = createServer(async (req, res) => {
    const url = new URL(req.url, "http://127.0.0.1");
    requests.push({ method: req.method, path: url.pathname, authorization: req.headers.authorization });

    if (url.pathname === "/pages") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ data: [] }));
      return;
    }
    if (url.pathname !== "/rest/v1/crm_contacts") {
      res.writeHead(404).end();
      return;
    }
    if (req.method === "HEAD") {
      res.writeHead(200, { "content-range": "0-0/0" }).end();
      return;
    }
    if (req.method === "GET") {
      const filters = [...url.searchParams.entries()].filter(([, value]) => value.startsWith("eq."));
      const matches = contacts.filter((contact) =>
        filters.every(([field, value]) => contact[field] === value.slice(3))
      );
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(matches));
      return;
    }
    if (req.method === "POST") {
      let body = "";
      for await (const chunk of req) body += chunk;
      const contact = {
        ...JSON.parse(body),
        id: "4bc6f5a6-0b6c-4ddb-b29b-208c84c344d0",
      };
      contacts.push(contact);
      res.writeHead(201, { "content-type": "application/json" });
      res.end(JSON.stringify(req.headers.accept?.includes("vnd.pgrst.object") ? contact : [contact]));
      return;
    }
    res.writeHead(405).end();
  });

  const appServer = createServer(app);
  const originalEnv = {
    WEBSITE_WEBHOOK_SECRET: process.env.WEBSITE_WEBHOOK_SECRET,
    WEBSITE_CMS_API_URL: process.env.WEBSITE_CMS_API_URL,
    WEBSITE_CMS_API_TOKEN: process.env.WEBSITE_CMS_API_TOKEN,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
  const listen = (server) => new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve(server.address().port));
  });
  const close = (server) => new Promise((resolve) => server.close(resolve));

  try {
    const providerPort = await listen(provider);
    const providerUrl = `http://127.0.0.1:${providerPort}`;
    process.env.WEBSITE_WEBHOOK_SECRET = "test-website-secret";
    process.env.WEBSITE_CMS_API_URL = providerUrl;
    process.env.WEBSITE_CMS_API_TOKEN = "test-cms-token";
    process.env.SUPABASE_URL = providerUrl;
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
    const appPort = await listen(appServer);
    const webhookUrl = `http://127.0.0.1:${appPort}/webhooks/website/leads`;

    const missingSecret = process.env.WEBSITE_WEBHOOK_SECRET;
    delete process.env.WEBSITE_WEBHOOK_SECRET;
    await assert.rejects(testIntegrationConnection("website"), /webhook secret is not configured/);
    process.env.WEBSITE_WEBHOOK_SECRET = missingSecret;

    const testResult = await testIntegrationConnection("website");
    assert.equal(testResult.connected, true);
    assert.ok(requests.some((request) =>
      request.method === "GET" &&
      request.path === "/pages" &&
      request.authorization === ["Bearer", process.env.WEBSITE_CMS_API_TOKEN].join(" ")
    ));
    assert.ok(requests.some((request) =>
      request.method === "HEAD" && request.path === "/rest/v1/crm_contacts"
    ));

    const leadBody = JSON.stringify({
      name: "Ada Yılmaz",
      email: "ADA@example.com",
      request: "Mimari proje",
    });
    const signature = createHmac("sha256", missingSecret).update(leadBody).digest("hex");
    const createResponse = await fetch(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json", "x-ddpro-signature": `sha256=${signature}` },
      body: leadBody,
    });
    assert.equal(createResponse.status, 201);
    const created = await createResponse.json();
    assert.equal(created.data.source, "website");
    assert.equal(created.data.email, "ada@example.com");

    const duplicateResponse = await fetch(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json", "x-ddpro-signature": signature },
      body: leadBody,
    });
    assert.equal(duplicateResponse.status, 200);
    assert.equal((await duplicateResponse.json()).duplicate, true);

    const invalidResponse = await fetch(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json", "x-ddpro-signature": signature },
      body: JSON.stringify({ name: "Tampered lead" }),
    });
    assert.equal(invalidResponse.status, 401);
    assert.equal(contacts.length, 1);
  } finally {
    await close(appServer);
    await close(provider);
    for (const [name, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});
