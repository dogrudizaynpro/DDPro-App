import assert from "node:assert/strict";
import { after, before, test } from "node:test";

let server;
let baseUrl;
const previousNodeEnv = process.env.NODE_ENV;
const previousFrontendUrl = process.env.FRONTEND_URL;

before(async () => {
  process.env.NODE_ENV = "production";
  process.env.FRONTEND_URL = "https://dogrudizaynpro.github.io/DDPro-App/";
  const { default: app } = await import("../src/app.js");
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
  if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = previousNodeEnv;
  if (previousFrontendUrl === undefined) delete process.env.FRONTEND_URL;
  else process.env.FRONTEND_URL = previousFrontendUrl;
});

test("AI chat requires an authenticated Google browser session", async () => {
  const response = await fetch(`${baseUrl}/api/ai/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://dogrudizaynpro.github.io",
    },
    body: JSON.stringify({ message: "Summarize the project." }),
  });
  assert.equal(response.status, 401);
  assert.equal((await response.json()).code, "BROWSER_SESSION_REQUIRED");
});

test("AI file uploads require the authenticated Google browser session", async () => {
  const body = new FormData();
  body.set("message", "Analyze this file.");
  body.set("file", new Blob(["file contents"]), "notes.txt");
  const response = await fetch(`${baseUrl}/api/ai/chat`, {
    method: "POST",
    headers: { Origin: "https://dogrudizaynpro.github.io" },
    body,
  });
  assert.equal(response.status, 401);
  assert.equal((await response.json()).code, "BROWSER_SESSION_REQUIRED");
});

test("AI file project preflight requires the authenticated Google browser session", async () => {
  const response = await fetch(`${baseUrl}/api/projects/import/ai-file/preview`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://dogrudizaynpro.github.io",
    },
    body: JSON.stringify({
      sourceFingerprint: "a".repeat(64),
      headers: ["Project"],
      rows: [["Project A"]],
    }),
  });
  assert.equal(response.status, 401);
  assert.equal((await response.json()).code, "BROWSER_SESSION_REQUIRED");
});

test("AI usage count requires the authenticated Google browser session", async () => {
  const response = await fetch(`${baseUrl}/api/ai/usage`);
  assert.equal(response.status, 401);
});

test("AI write confirmation requires the authenticated Google browser session", async () => {
  const response = await fetch(`${baseUrl}/api/ai/tools/confirm`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://dogrudizaynpro.github.io",
    },
    body: JSON.stringify({ confirmationId: "4bc6f5a6-0b6c-4ddb-b29b-208c84c344d0" }),
  });
  assert.equal(response.status, 401);
  assert.equal((await response.json()).code, "BROWSER_SESSION_REQUIRED");
});

test("catalog CRUD and material calculation endpoints require the Google session", async () => {
  for (const path of [
    "/api/products",
    "/api/systems",
    "/api/price-analysis",
    "/api/material-analysis",
  ]) {
    const response = await fetch(`${baseUrl}${path}`);
    assert.equal(response.status, 401, `${path} must require authentication`);
  }

  const calculation = await fetch(`${baseUrl}/api/material-analysis/calculate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://dogrudizaynpro.github.io",
    },
    body: JSON.stringify({ name: "Material", quantity: 1, unit: "m2" }),
  });

  assert.equal(calculation.status, 401);
});

test("procurement CRUD endpoints require the Google session", async () => {
  const list = await fetch(`${baseUrl}/api/research`);
  assert.equal(list.status, 401);
  const update = await fetch(`${baseUrl}/api/research/4bc6f5a6-0b6c-4ddb-b29b-208c84c344d0`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://dogrudizaynpro.github.io",
    },
    body: JSON.stringify({ title: "Updated" }),
  });
  assert.equal(update.status, 401);
});

test("CRM CRUD endpoints require the Google session", async () => {
  const list = await fetch(`${baseUrl}/api/crm`);
  assert.equal(list.status, 401);
  const update = await fetch(`${baseUrl}/api/crm/4bc6f5a6-0b6c-4ddb-b29b-208c84c344d0`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://dogrudizaynpro.github.io",
    },
    body: JSON.stringify({ name: "Updated" }),
  });
  assert.equal(update.status, 401);
});

test("report CRUD endpoints require the Google session", async () => {
  const list = await fetch(`${baseUrl}/api/reports`);
  assert.equal(list.status, 401);
  const create = await fetch(`${baseUrl}/api/reports`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://dogrudizaynpro.github.io",
    },
    body: JSON.stringify({ type: "PROJECT" }),
  });
  assert.equal(create.status, 401);
});

test("finance cost CRUD endpoints require the Google session", async () => {
  const list = await fetch(`${baseUrl}/api/finance/costs`);
  assert.equal(list.status, 401);
  const create = await fetch(`${baseUrl}/api/finance/costs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://dogrudizaynpro.github.io",
    },
    body: JSON.stringify({ name: "Unauthorized cost" }),
  });
  assert.equal(create.status, 401);
});

test("message conversation and message endpoints require the Google session", async () => {
  const list = await fetch(`${baseUrl}/api/messages/conversations`);
  assert.equal(list.status, 401);
  const create = await fetch(`${baseUrl}/api/messages/conversations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://dogrudizaynpro.github.io",
    },
    body: JSON.stringify({ title: "Unauthorized conversation" }),
  });
  assert.equal(create.status, 401);
  const messages = await fetch(`${baseUrl}/api/messages/conversations/4bc6f5a6-0b6c-4ddb-b29b-208c84c344d0/messages`);
  assert.equal(messages.status, 401);
});

test("document list, download and upload endpoints require the Google session", async () => {
  const list = await fetch(`${baseUrl}/api/documents`);
  assert.equal(list.status, 401);
  const download = await fetch(`${baseUrl}/api/documents/4bc6f5a6-0b6c-4ddb-b29b-208c84c344d0/download`);
  assert.equal(download.status, 401);
  const upload = await fetch(`${baseUrl}/api/documents?name=file.pdf`, {
    method: "POST",
    headers: {
      "Content-Type": "application/pdf",
      Origin: "https://dogrudizaynpro.github.io",
    },
    body: "%PDF-test",
  });
  assert.equal(upload.status, 401);
});
