import assert from "node:assert/strict";
import { after, before, test } from "node:test";

const envKeys = ["AI_API_URL", "AI_API_KEY", "AI_MODEL", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
const savedEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
const realFetch = globalThis.fetch;
const projectRecords = [{
  id: "f3be8128-34ba-4d6f-87de-6869cb9d4df5",
  name: "Live API project",
  status: "Aktif",
}];
let databaseStatus = 200;
let databaseRequests;
let providerRequests;
let requestAiCompletion;
let toolDefinitions;
let toolNames;

before(async () => {
  process.env.AI_API_URL = "https://ai-provider.test/v1/chat/completions";
  process.env.AI_API_KEY = "test-ai-key";
  process.env.AI_MODEL = "test-model";
  process.env.SUPABASE_URL = "https://supabase.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
  databaseRequests = [];
  providerRequests = [];
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(input);
    if (url.hostname === "supabase.test") {
      databaseRequests.push({ url, headers: new Headers(init.headers) });
      return new Response(
        JSON.stringify(databaseStatus === 200
          ? projectRecords
          : { code: "XX000", message: "database unavailable" }),
        {
          status: databaseStatus,
          headers: { "Content-Type": "application/json", "Content-Range": "0-0/1" },
        }
      );
    }

    const body = JSON.parse(init.body);
    providerRequests.push(body);
    const toolMessage = body.messages.find((message) => message.role === "tool");
    const responseMessage = toolMessage
      ? { role: "assistant", content: "Found Live API project in the Projects API." }
      : {
        role: "assistant",
        content: null,
        tool_calls: [{
          id: "call_projects_read",
          type: "function",
          function: {
            name: "read_records",
            arguments: JSON.stringify({ resource: "projects" }),
          },
        }],
      };
    return new Response(JSON.stringify({ choices: [{ message: responseMessage }] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  ({ requestAiCompletion } = await import("../src/services/ai.service.js"));
  ({ AI_TOOL_DEFINITIONS: toolDefinitions, AI_TOOL_NAMES: toolNames } =
    await import("../src/services/ai-tools.service.js"));
});

after(() => {
  globalThis.fetch = realFetch;
  for (const key of envKeys) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

test("the canonical AI tool registry exposes executable read_records resources", () => {
  assert.deepEqual(
    toolDefinitions.map(({ function: tool }) => tool.name),
    [toolNames.readRecords, toolNames.prepareWrite]
  );
  const readTool = toolDefinitions.find(
    ({ function: tool }) => tool.name === toolNames.readRecords
  );
  assert.ok(readTool.function.parameters.properties.resource.enum.includes("projects"));
});

test("read_records reaches the Projects API controller and returns its actual data to AI", async () => {
  databaseStatus = 200;
  databaseRequests.length = 0;
  providerRequests.length = 0;

  const result = await requestAiCompletion({
    message: "List my projects.",
    context: {},
    integrationAccount: "authorized@example.com",
  });

  assert.deepEqual(result, { answer: "Found Live API project in the Projects API." });
  assert.equal(databaseRequests.length, 1);
  assert.equal(databaseRequests[0].url.pathname, "/rest/v1/projects");
  assert.equal(
    databaseRequests[0].headers.get("authorization"),
    ["Bearer", process.env.SUPABASE_SERVICE_ROLE_KEY].join(" ")
  );
  const toolResult = providerRequests[1].messages.find((message) => message.role === "tool");
  assert.deepEqual(JSON.parse(toolResult.content), { data: projectRecords });
  assert.equal(providerRequests[0].tools.some(
    ({ function: tool }) => tool.name === "read_records"
  ), true);
});

test("Projects API errors fail the AI request instead of being hidden by a generated answer", async () => {
  databaseStatus = 503;
  databaseRequests.length = 0;
  providerRequests.length = 0;

  await assert.rejects(
    requestAiCompletion({
      message: "List my projects.",
      context: {},
      integrationAccount: "authorized@example.com",
    }),
    (error) => {
      assert.equal(error.statusCode, 502);
      assert.equal(error.code, "AI_TOOL_EXECUTION_FAILED");
      assert.equal(error.message, "The requested records are unavailable.");
      return true;
    }
  );

  assert.equal(databaseRequests.length, 1);
  assert.equal(providerRequests.length, 1);
});
