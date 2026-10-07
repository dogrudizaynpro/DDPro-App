import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, test } from "node:test";

const TEST_API_KEY = "test-ai-key-not-a-secret";
const savedEnv = {};
const envKeys = ["AI_API_URL", "AI_API_KEY", "AI_MODEL", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
const realFetch = globalThis.fetch;
let requests = [];
let responses = [];
let requestAiCompletion;
let testIntegrationConnection;

before(async () => {
  for (const key of envKeys) savedEnv[key] = process.env[key];
  process.env.AI_API_URL = "https://api.openai.com/v1/chat/completions";
  process.env.AI_API_KEY = TEST_API_KEY;
  process.env.AI_MODEL = "gpt-5.6-luna";
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(init.body);
    requests.push({ url: String(url), headers: init.headers, body });
    const next = rejectSamplingParameters(body) || responses.shift();
    assert.ok(next, "Unexpected AI provider request");
    return new Response(JSON.stringify(next.body), {
      status: next.status,
      headers: { "Content-Type": "application/json" },
    });
  };
  ({ requestAiCompletion } = await import("../src/services/ai.service.js"));
  ({ testIntegrationConnection } = await import("../src/services/integration-health.service.js"));
});

after(() => {
  globalThis.fetch = realFetch;
  for (const key of envKeys) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

beforeEach(() => {
  requests = [];
  responses = [];
});

afterEach(() => {
  assert.equal(responses.length, 0, "Every queued AI provider response must be consumed");
});

const completion = (message) => ({ status: 200, body: { choices: [{ message }] } });

const rejectSamplingParameters = (body) => {
  const unsupported = ["temperature", "top_p"].find((key) => key in body);
  if (!unsupported) return null;
  return {
    status: 400,
    body: { error: { message: `Unsupported parameter: '${unsupported}'.`, type: "invalid_request_error" } },
  };
};

test("Chat Completions request omits sampling parameters unsupported by gpt-5.6-luna", async () => {
  responses.push(completion({ role: "assistant", content: "OK" }));
  const result = await requestAiCompletion({ message: "Connection check.", context: {} });

  assert.deepEqual(result, { answer: "OK" });
  assert.equal(requests.length, 1);
  const [{ url, headers, body }] = requests;
  assert.equal(url, "https://api.openai.com/v1/chat/completions");
  assert.equal(headers.Authorization, ["Bearer", TEST_API_KEY].join(" "));
  assert.equal(body.model, "gpt-5.6-luna");
  assert.equal("temperature" in body, false);
  assert.equal("top_p" in body, false);
  assert.equal(body.tool_choice, "auto");
  assert.deepEqual(body.tools.map((tool) => tool.function.name), ["read_records", "prepare_write"]);
});

test("AI provider connection test succeeds with the production request shape", async () => {
  responses.push(completion({ role: "assistant", content: "OK" }));
  const result = await testIntegrationConnection("ai");

  assert.equal(result.connected, true);
  assert.equal(result.testSucceeded, true);
  assert.equal("temperature" in requests[0].body, false);
  assert.ok(Array.isArray(requests[0].body.tools));
});

test("tool calls are executed through the Chat Completions tool message loop", async () => {
  responses.push(
    completion({
      role: "assistant",
      content: null,
      tool_calls: [{
        id: "call_1",
        type: "function",
        function: { name: "unknown_tool", arguments: "{}" },
      }],
    }),
    completion({ role: "assistant", content: "Done." })
  );
  const result = await requestAiCompletion({ message: "List projects.", context: {} });

  assert.deepEqual(result, { answer: "Done." });
  assert.equal(requests.length, 2);
  const followUp = requests[1].body.messages;
  assert.equal(followUp.at(-2).tool_calls[0].id, "call_1");
  assert.deepEqual(followUp.at(-1), {
    role: "tool",
    tool_call_id: "call_1",
    content: JSON.stringify({ error: "Tool is not available." }),
  });
  assert.equal("temperature" in requests[1].body, false);
});

test("prepare_write never executes a write and still requires explicit confirmation storage", async () => {
  responses.push(completion({
    role: "assistant",
    content: null,
    tool_calls: [{
      id: "call_write",
      type: "function",
      function: {
        name: "prepare_write",
        arguments: JSON.stringify({ resource: "projects", operation: "create", record: { name: "X" } }),
      },
    }],
  }));

  await assert.rejects(
    requestAiCompletion({ message: "Create project X.", context: {}, integrationAccount: "owner@example.com" }),
    (error) => error.statusCode === 503
  );
  assert.equal(requests.length, 1);
});

test("HTTP 400 from the provider surfaces a safe error without exposing the API key", async () => {
  const badRequest = { status: 400, body: { error: { message: "Bad request" } } };
  responses.push(badRequest, badRequest);

  await assert.rejects(
    requestAiCompletion({ message: "Connection check.", context: {} }),
    (error) => {
      assert.equal(error.statusCode, 502);
      assert.equal(error.code, "AI_PROVIDER_REQUEST_FAILED");
      assert.equal(error.message, "AI provider request failed (HTTP 400).");
      assert.equal(error.message.includes(TEST_API_KEY), false);
      return true;
    }
  );
  assert.equal(requests.length, 2);
  assert.ok(requests[0].body.tools);
  assert.equal("tools" in requests[1].body, false);
  for (const { body } of requests) assert.equal("temperature" in body, false);
});
