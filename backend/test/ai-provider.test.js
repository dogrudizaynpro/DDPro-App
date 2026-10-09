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

test("image attachments are sent to the configured provider as vision content", async () => {
  responses.push(completion({ role: "assistant", content: "Görsel analiz edildi." }));
  const image = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/pXcAAAAASUVORK5CYII=", "base64");
  const result = await requestAiCompletion({
    message: "Bu görseli analiz et.",
    context: {},
    attachment: { originalName: "room.png", buffer: image },
  });

  assert.equal(result.answer, "Görsel analiz edildi.");
  const userMessage = requests[0].body.messages.find((item) => item.role === "user");
  assert.ok(Array.isArray(userMessage.content));
  assert.match(userMessage.content[0].text, /room\.png/);
  assert.equal(userMessage.content[1].type, "image_url");
  assert.match(userMessage.content[1].image_url.url, /^data:image\/png;base64,/);
});

test("project spreadsheet data remains available in the AI transfer preview", async () => {
  const headers = [
    "Project", "Customer", "Company", "Location", "Project type", "Product",
    "Area m2", "System", "Status", "Start date", "End date", "Notes",
  ];
  const rows = Array.from({ length: 18 }, (_, index) => [
    `Project ${index + 1}`, `Customer ${index + 1}`, `Company ${index + 1}`,
    `City ${index + 1}`, "Office", "Facade", `${index + 1}`, "Wall",
    "Active", "2026-01-01", "2026-12-31", `Keep this ${index + 1}`,
  ]);
  responses.push(completion({ role: "assistant", content: "18 project rows were analyzed." }));

  const result = await requestAiCompletion({
    message: "Analyze this project spreadsheet.",
    context: {},
    attachment: {
      originalName: "projects.csv",
      buffer: Buffer.from([headers, ...rows].map((row) => row.join(",")).join("\n")),
    },
  });

  assert.equal(result.projectImport.records.length, 18);
  assert.equal(result.projectImport.table.headers.length, 12);
  assert.equal(result.projectImport.records[17].project.name, "Project 18");
  assert.equal(result.projectImport.records[17].project.source_data.values[11], "Keep this 18");
  assert.equal(result.projectImport.records[17].project.area_m2, 18);
  assert.equal(result.projectImport.records[17].project.start_date, "2026-01-01");
  assert.equal(result.pendingAction, undefined);
});

test("file project analysis cannot prepare writes before separate import confirmation", async () => {
  const csv = "Project,Status\nProject A,Active";
  responses.push(
    completion({
      role: "assistant",
      content: null,
      tool_calls: [{
        id: "call_file_write",
        type: "function",
        function: {
          name: "prepare_write",
          arguments: JSON.stringify({ resource: "projects", operation: "create", record: { name: "Project A" } }),
        },
      }],
    }),
    completion({ role: "assistant", content: "Project spreadsheet ready for review." })
  );

  const result = await requestAiCompletion({
    message: "Analyze this project spreadsheet.",
    context: {},
    integrationAccount: "owner@example.com",
    attachment: { originalName: "projects.csv", buffer: Buffer.from(csv) },
  });

  assert.equal(result.projectImport.records.length, 1);
  assert.equal(result.pendingAction, undefined);
  assert.deepEqual(JSON.parse(requests[1].body.messages.at(-1).content), {
    error: "Project spreadsheet rows are shown in a separate review and import flow.",
  });
});

test("AI provider connection test succeeds with the production request shape", async () => {
  responses.push(completion({ role: "assistant", content: "OK" }));
  const result = await testIntegrationConnection("ai");

  assert.equal(result.connected, true);
  assert.equal(result.testSucceeded, true);
  assert.equal("temperature" in requests[0].body, false);
  assert.ok(Array.isArray(requests[0].body.tools));
});

test("unavailable provider tools return an explicit error instead of a fabricated answer", async () => {
  responses.push(
    completion({
      role: "assistant",
      content: null,
      tool_calls: [{
        id: "call_1",
        type: "function",
        function: { name: "unknown_tool", arguments: "{}" },
      }],
    })
  );
  await assert.rejects(
    requestAiCompletion({ message: "List projects.", context: {} }),
    (error) => {
      assert.equal(error.statusCode, 502);
      assert.equal(error.code, "AI_TOOL_UNAVAILABLE");
      assert.match(error.message, /unavailable/);
      return true;
    }
  );

  assert.equal(requests.length, 1);
  assert.equal(requests[0].body.tools.some(({ function: tool }) =>
    tool.name === "read_records"
  ), true);
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
  const badRequest = {
    status: 400,
    body: { error: { message: `Unsupported model tool calls: ${TEST_API_KEY}` } },
  };
  responses.push(badRequest);

  await assert.rejects(
    requestAiCompletion({ message: "Connection check.", context: {} }),
    (error) => {
      assert.equal(error.statusCode, 502);
      assert.equal(error.code, "AI_PROVIDER_TOOL_REQUEST_REJECTED");
      assert.equal(error.message, "AI provider rejected the request containing DDPro operational tools (HTTP 400). Unsupported model tool calls: [REDACTED]");
      assert.equal(error.message.includes(TEST_API_KEY), false);
      return true;
    }
  );
  assert.equal(requests.length, 1);
  assert.ok(requests[0].body.tools);
  for (const { body } of requests) assert.equal("temperature" in body, false);
});

test("AI provider network failures remain understandable and never expose credentials", async () => {
  globalThis.fetch = async () => {
    throw new Error(`Request failed with ${TEST_API_KEY}`);
  };

  await assert.rejects(
    testIntegrationConnection("ai"),
    (error) => {
      assert.equal(error.statusCode, 502);
      assert.equal(error.code, "AI_PROVIDER_UNAVAILABLE");
      assert.equal(error.message, "AI provider could not be reached.");
      assert.doesNotMatch(error.message, /test-ai-key-not-a-secret/);
      return true;
    }
  );
});
