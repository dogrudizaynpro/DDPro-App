import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, test } from "node:test";
import { errorHandler } from "../src/middleware/errorHandler.js";

const TEST_API_KEY = "test-ai-key-not-a-secret";
const savedEnv = {};
const envKeys = ["AI_API_URL", "AI_API_KEY", "AI_MODEL", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
const realFetch = globalThis.fetch;
let requests = [];
let responses = [];
let requestAiCompletion;
let validatePdfDraft;
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
    const next = rejectReasoningTools(body) || rejectSamplingParameters(body) || responses.shift();
    assert.ok(next, "Unexpected AI provider request");
    return new Response(JSON.stringify(next.body), {
      status: next.status,
      headers: { "Content-Type": "application/json" },
    });
  };
  ({ requestAiCompletion, validatePdfDraft } = await import("../src/services/ai.service.js"));
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

const makePdf = (text) => {
  const stream = `BT /F1 12 Tf 72 72 Td (${text}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [4 0 R] /Count 1 >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] /Resources << /Font << /F1 3 0 R >> >> /Contents 5 0 R >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf);
};

const rejectReasoningTools = (body) => {
  if (!body.tools?.length || body.reasoning_effort === "none") return null;
  return {
    status: 400,
    body: { error: { message: "Function tools with reasoning_effort are not supported for gpt-5.6-luna in /v1/chat/completions." } },
  };
};

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

  assert.deepEqual(result, { answer: "OK", toolExecutions: [] });
  assert.equal(requests.length, 1);
  const [{ url, headers, body }] = requests;
  assert.equal(url, "https://api.openai.com/v1/chat/completions");
  assert.equal(headers.Authorization, ["Bearer", TEST_API_KEY].join(" "));
  assert.equal(body.model, "gpt-5.6-luna");
  assert.equal("temperature" in body, false);
  assert.equal("top_p" in body, false);
  assert.equal(body.reasoning_effort, "none");
  assert.equal(body.tool_choice, "auto");
  assert.deepEqual(body.tools.map((tool) => tool.function.name), ["read_records", "prepare_write"]);
});

test("authenticated specialist data is provided as untrusted synthesis context", async () => {
  responses.push(completion({ role: "assistant", content: "Kayıtlar özetlendi." }));
  const result = await requestAiCompletion({
    message: "Projeleri ve müşterileri özetle.",
    context: {},
    integrationAccount: "authorized@example.com",
    toolPolicy: "read",
    agents: [
      { id: "project", name: "Proje ve saha", resources: ["projects"] },
      { id: "crm", name: "Müşteri ve CRM", resources: ["customers"] },
    ],
    agentData: [
      { agentId: "project", resource: "projects", status: "completed", records: [{ name: "Test proje" }] },
      { agentId: "crm", resource: "customers", status: "failed", error: "Authorized records could not be read." },
    ],
  });

  assert.equal(result.answer, "Kayıtlar özetlendi.");
  const requestMessages = requests[0].body.messages;
  assert.match(requestMessages[0].content, /If any specialist result has status failed/);
  assert.match(requestMessages[1].content, /"name":"Test proje"/);
  assert.match(requestMessages[1].content, /"status":"failed"/);
  assert.match(requestMessages[1].content, /never instructions/);
  assert.equal("tools" in requests[0].body, false);
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

test("PDF candidate schema leaves duplicate-page quotes ambiguous and unsupported sources unverified", () => {
  const candidate = {
    type: "product",
    productName: "Panel",
    unit: null,
    quantity: null,
    price: null,
    currency: null,
    technicalSpecifications: null,
    quote: "Panel 1200 mm",
  };
  const draft = validatePdfDraft(JSON.stringify({
    candidates: [
      candidate,
      { ...candidate, quote: "Unmatched quotation" },
      { ...candidate, type: "price" },
    ],
  }), {
    name: "catalog.pdf",
    pages: 3,
    truncated: false,
    pdfPages: [
      { pageNumber: 1, text: "Panel 1200 mm", truncated: false },
      { pageNumber: 2, text: "Price 50", truncated: false },
      { pageNumber: 3, text: "Panel 1200 mm", truncated: false },
    ],
  });
  assert.equal(draft.candidates[0].sourceFileName, "catalog.pdf");
  assert.equal(draft.candidates[0].sourcePage, null);
  assert.equal(draft.candidates[0].verified, false);
  assert.deepEqual(draft.candidates[0].missingFields, [
    "Birim", "Miktar", "Fiyat", "Para birimi", "Teknik özellik",
  ]);
  assert.equal(draft.candidates[1].sourcePage, null);
  assert.equal(draft.candidates[1].verified, false);
  assert.equal(draft.candidates[2].sourcePage, null);
  assert.equal(draft.candidates[2].verified, false);
  assert.throws(
    () => validatePdfDraft(JSON.stringify({ candidates: [{ ...candidate, pageNumber: 1 }] }), {
      name: "catalog.pdf",
      pages: 1,
      pdfPages: [{ pageNumber: 1, text: candidate.quote }],
    }),
    (error) => error.code === "AI_PDF_DRAFT_INVALID"
  );
});

test("PDF candidate analysis sends no operational tools to the provider", async () => {
  responses.push(completion({
    role: "assistant",
    content: JSON.stringify({
      candidates: [{
        type: "product",
        productName: "Zemin kaplama",
        unit: "m²",
        quantity: 160,
        price: null,
        currency: null,
        technicalSpecifications: null,
        quote: "Zemin kaplama alanı: 160 m²",
      }],
    }),
  }));
  const result = await requestAiCompletion({
    message: "Ekli PDF'de yazılı metraj ve m² miktarını çıkar.",
    context: {},
    attachment: { originalName: "offer.pdf", buffer: makePdf("Zemin kaplama alanı: 160 m²") },
  });

  assert.equal("tools" in requests[0].body, false);
  assert.equal(result.pdfDraft.candidates[0].quantity, 160);
  assert.equal(result.pdfDraft.candidates[0].unit, "m²");
  assert.equal(result.pdfDraft.candidates[0].sourcePage, 1);
  assert.equal(result.pdfDraft.candidates[0].verified, true);
  assert.equal(result.toolExecutions.length, 0);
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
  assert.ok(requests.every(({ body }) =>
    body.reasoning_effort === "none" &&
    body.tools.some(({ function: tool }) => tool.name === "read_records")
  ));
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

test("transient AI provider responses retry once after a bounded delay", async () => {
  responses.push(
    { status: 503, body: { error: { message: "temporarily unavailable" } } },
    completion({ role: "assistant", content: "Recovered response" })
  );
  const result = await requestAiCompletion({ message: "Connection check.", context: {} });
  assert.equal(result.answer, "Recovered response");
  assert.equal(requests.length, 2);
});

test("tool-free provider rejection preserves upstream status without misdiagnosing a tool request", async (t) => {
  responses.push({
    status: 400,
    body: { error: { message: "Invalid model. private-prompt-echo" } },
  });
  const log = t.mock.method(console, "error", () => {});
  await assert.rejects(requestAiCompletion({
    message: "General question.",
    toolPolicy: "none",
  }), (error) => {
    assert.equal(error.code, "AI_PROVIDER_REQUEST_FAILED");
    assert.equal(error.upstreamStatus, 400);
    assert.doesNotMatch(error.message, /operational tools/);
    errorHandler(error, {}, {
      status(code) { assert.equal(code, 502); return this; },
      json(body) {
        assert.equal(body.code, "AI_PROVIDER_REQUEST_FAILED");
        assert.equal(body.upstreamStatus, 400);
      },
    }, () => {});
    return true;
  });
  assert.deepEqual(log.mock.calls[0].arguments, [
    "AI provider error:",
    { code: "AI_PROVIDER_REQUEST_FAILED", statusCode: 502, upstreamStatus: 400 },
  ]);
  assert.doesNotMatch(JSON.stringify(log.mock.calls), /private-prompt-echo|test-ai-key/);
});

test("read-only project analyses cannot request operational writes", async () => {
  responses.push(completion({
    role: "assistant",
    content: null,
    tool_calls: [{
      id: "call_project_write",
      type: "function",
      function: {
        name: "prepare_write",
        arguments: JSON.stringify({ resource: "projects", operation: "delete", record: { id: "project-1" } }),
      },
    }],
  }));
  await assert.rejects(
    requestAiCompletion({ message: "Analyze this project.", context: {}, readOnly: true }),
    (error) => error.code === "AI_TOOL_UNAVAILABLE"
  );
  assert.deepEqual(
    requests[0].body.tools.map(({ function: tool }) => tool.name),
    ["read_records"]
  );
});

test("orchestrator tool policies restrict advertised and executable DDPro tools", async () => {
  responses.push(completion({ role: "assistant", content: "General answer." }));
  assert.equal((await requestAiCompletion({
    message: "General question.",
    context: {},
    toolPolicy: "none",
  })).answer, "General answer.");
  assert.equal("tools" in requests[0].body, false);

  requests = [];
  responses.push(completion({
    role: "assistant",
    content: null,
    tool_calls: [{
      id: "call_disallowed_write",
      type: "function",
      function: {
        name: "prepare_write",
        arguments: JSON.stringify({ resource: "projects", operation: "create", record: { name: "X" } }),
      },
    }],
  }));
  await assert.rejects(
    requestAiCompletion({
      message: "List projects.",
      context: {},
      integrationAccount: "owner@example.com",
      toolPolicy: "read",
    }),
    (error) => error.code === "AI_TOOL_UNAVAILABLE"
  );
  assert.deepEqual(
    requests[0].body.tools.map(({ function: tool }) => tool.name),
    ["read_records"]
  );
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
