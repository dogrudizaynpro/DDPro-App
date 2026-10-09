import assert from "node:assert/strict";
import express from "express";
import { after, before, test } from "node:test";
import { parseAiChatUpload } from "../src/middleware/ai-file-upload.js";

let server;
let baseUrl;

before(async () => {
  const app = express();
  app.post("/upload", parseAiChatUpload, (req, res) => res.json({
    body: req.body,
    file: req.aiFile && {
      name: req.aiFile.originalName,
      mimeType: req.aiFile.mimeType,
      size: req.aiFile.buffer.length,
    },
  }));
  app.use((error, _req, res, _next) => res.status(error.statusCode || 500).json({
    message: error.message,
  }));
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (!server) return;
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
});

test("AI chat multipart uploads are parsed in memory with message and filename", async () => {
  const body = new FormData();
  body.set("message", "Analyze this invoice.");
  body.set("context", JSON.stringify({ activeModule: "finance" }));
  body.set("file", new Blob(["invoice text"], { type: "text/plain" }), "invoice.txt");
  const response = await fetch(`${baseUrl}/upload`, { method: "POST", body });
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(result.body, {
    message: "Analyze this invoice.",
    context: '{"activeModule":"finance"}',
  });
  assert.deepEqual(result.file, {
    name: "invoice.txt",
    mimeType: "text/plain",
    size: 12,
  });
});

test("unexpected upload fields are rejected", async () => {
  const body = new FormData();
  body.set("message", "Analyze this.");
  body.set("unexpected", "data");
  const response = await fetch(`${baseUrl}/upload`, { method: "POST", body });
  assert.equal(response.status, 400);
  assert.match((await response.json()).message, /unexpected or duplicate field/);
});
