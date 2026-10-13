import assert from "node:assert/strict";
import { after, before, test } from "node:test";

const saved = {
  apiKey: process.env.GEMINI_API_KEY,
  model: process.env.GEMINI_LIVE_MODEL,
};
const realFetch = globalThis.fetch;
let request;
let createGeminiLiveSessionConfig;
let createGeminiLiveToken;
let getGeminiLiveWebSocketUrl;

before(async () => {
  process.env.GEMINI_API_KEY = "test-gemini-api-key";
  process.env.GEMINI_LIVE_MODEL = "models/test-live-audio";
  globalThis.fetch = async (url, init) => {
    request = { url: String(url), headers: init.headers, body: JSON.parse(init.body) };
    return new Response(JSON.stringify({ name: "auth_tokens/one-use-session" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  ({
    createGeminiLiveSessionConfig,
    createGeminiLiveToken,
    getGeminiLiveWebSocketUrl,
  } = await import("../src/services/ai-voice.service.js"));
});

after(() => {
  globalThis.fetch = realFetch;
  if (saved.apiKey === undefined) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = saved.apiKey;
  if (saved.model === undefined) delete process.env.GEMINI_LIVE_MODEL;
  else process.env.GEMINI_LIVE_MODEL = saved.model;
});

test("Gemini Live config requests Turkish audio, operational tools, VAD, and safe behavior", () => {
  const config = createGeminiLiveSessionConfig({
    context: { projects: [{ name: "Test project" }] },
    history: [{ role: "user", text: "Önceki soru" }],
  });
  assert.equal(config.model, "models/test-live-audio");
  assert.deepEqual(config.generationConfig.responseModalities, ["AUDIO"]);
  assert.equal(config.generationConfig.speechConfig.languageCode, "tr-TR");
  assert.equal(config.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName, "Kore");
  assert.equal(config.realtimeInputConfig.automaticActivityDetection.disabled, false);
  assert.match(config.systemInstruction.parts[0].text, /sunucunun sağladığı operasyon araçlarıyla oku/);
  assert.match(config.systemInstruction.parts[0].text, /mutlaka read_records aracını resource: projects ile çağır ve sonucunu bekle/);
  assert.match(config.systemInstruction.parts[0].text, /Boş data sonucu için kayıt bulunamadığını/);
  assert.match(config.systemInstruction.parts[0].text, /error varsa sorgunun başarısız olduğunu/);
  assert.match(config.systemInstruction.parts[0].text, /Eksik proje adı\/durumu alanlarını tamamlama/);
  const liveTools = config.tools.flatMap(({ functionDeclarations }) => functionDeclarations);
  assert.deepEqual(liveTools.map(({ name }) => name), [
    "read_records", "prepare_write", "read_integration_status",
  ]);
  assert.match(config.systemInstruction.parts[0].text, /kullanıcı onayı gelmeden hiçbir değişiklik gerçekleşmiş sayılmaz/);
  assert.match(config.systemInstruction.parts[0].text, /Test project/);
  assert.deepEqual(config.inputAudioTranscription, {});
  assert.deepEqual(config.outputAudioTranscription, {});
  assert.equal(config.config, undefined);
  assert.throws(() => createGeminiLiveSessionConfig({ context: { data: "x".repeat(24_001) } }), {
    statusCode: 413,
  });
});

test("single-use Live token is created server-side and the permanent key is not returned", async (t) => {
  const log = t.mock.method(console, "error", () => {});
  const config = createGeminiLiveSessionConfig({ context: {}, history: [] });
  const token = await createGeminiLiveToken(config);
  assert.equal(token, "auth_tokens/one-use-session");
  assert.equal(request.url, "https://generativelanguage.googleapis.com/v1alpha/auth_tokens");
  assert.equal(request.headers["x-goog-api-key"], "test-gemini-api-key");
  assert.equal(request.body.uses, 1);
  assert.deepEqual(request.body.bidiGenerateContentSetup, config);
  assert.equal(request.body.liveConnectConstraints, undefined);
  assert.equal(request.body.config, undefined);
  assert.ok(Date.parse(request.body.expireTime) > Date.now());
  assert.ok(Date.parse(request.body.newSessionExpireTime) > Date.now());
  assert.match(getGeminiLiveWebSocketUrl(), /BidiGenerateContentConstrained$/);
  assert.doesNotMatch(JSON.stringify({ token }), /test-gemini-api-key/);
  assert.equal(log.mock.calls.length, 0);
});

test("Live model identity is preserved with exactly one models/ resource prefix", () => {
  const previousModel = process.env.GEMINI_LIVE_MODEL;
  try {
    for (const model of ["gemini-3.8-live", "models/gemini-3.8-live"]) {
      process.env.GEMINI_LIVE_MODEL = model;
      assert.equal(createGeminiLiveSessionConfig().model, "models/gemini-3.8-live");
      assert.equal(process.env.GEMINI_LIVE_MODEL, model);
    }
  } finally {
    process.env.GEMINI_LIVE_MODEL = previousModel;
  }
});

test("documented token name takes precedence while token-only responses remain compatible", async (t) => {
  for (const [body, expected] of [
    [{ name: "auth_tokens/documented", token: "legacy-token" }, "auth_tokens/documented"],
    [{ token: "legacy-token" }, "legacy-token"],
    [{ name: "", token: "legacy-token" }, "legacy-token"],
  ]) {
    t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify(body)));
    assert.equal(await createGeminiLiveToken(createGeminiLiveSessionConfig()), expected);
  }
});

test("provider failures are sanitized and unconfigured sessions fail closed", async (t) => {
  const log = t.mock.method(console, "error", () => {});
  const oldKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  await assert.rejects(createGeminiLiveToken({}), (error) => {
    assert.equal(error.statusCode, 503);
    assert.equal(error.code, "AI_VOICE_NOT_CONFIGURED");
    return true;
  });
  process.env.GEMINI_API_KEY = oldKey;

  globalThis.fetch = async () =>
    new Response(JSON.stringify({ error: { message: "test-gemini-api-key leaked detail" } }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  await assert.rejects(
    createGeminiLiveToken(createGeminiLiveSessionConfig({ context: {}, history: [] })),
    (error) => {
      assert.equal(error.code, "AI_VOICE_SESSION_FAILED");
      assert.equal(error.statusCode, 502);
      assert.equal(error.expose, true);
      assert.equal(
        error.message,
        "Realtime voice session could not be created: GEMINI_API_KEY was rejected by Google " +
          "(invalid, expired or restricted key) (Gemini HTTP 401)."
      );
      assert.doesNotMatch(error.message, /leaked detail|test-gemini-api-key/);
      return true;
    }
  );
  assert.equal(log.mock.calls.length, 1);
  assert.equal(log.mock.calls[0].arguments[1].upstreamStatus, 401);
  assert.doesNotMatch(JSON.stringify(log.mock.calls), /test-gemini-api-key/);
});

test("Google HTTP status and safe error fields are logged without other response data", async (t) => {
  const log = t.mock.method(console, "error", () => {});
  t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({
    error: {
      status: "INVALID_ARGUMENT",
      message: "Invalid liveConnectConstraints configuration.",
      details: [{ secret: "private-google-detail" }],
    },
    token: "private-access-token",
    headers: { Authorization: "private-header" },
  }), { status: 400 }));
  await assert.rejects(createGeminiLiveToken({}), {
    message: "Realtime voice session could not be created: Gemini rejected the Live session setup " +
      "(Gemini HTTP 400 INVALID_ARGUMENT).",
    statusCode: 502,
    code: "AI_VOICE_SESSION_FAILED",
    expose: true,
  });
  assert.deepEqual(log.mock.calls[0].arguments, [
    "Gemini Live token request failed:",
    {
      upstreamStatus: 400,
      providerStatus: "INVALID_ARGUMENT",
      message: "Invalid liveConnectConstraints configuration.",
    },
  ]);
  assert.equal(log.mock.calls.length, 1);
});

test("Google diagnostics redact credentials, headers, session data and log control characters", async (t) => {
  const log = t.mock.method(console, "error", () => {});
  const sessionConfig = { config: { systemInstruction: { parts: [{ text: "private-session-data" }] } } };
  t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({
    token: "private-response-token",
    name: "auth_tokens/private-response-name",
    error: {
      status: "PERMISSION_DENIED",
      message: [
        process.env.GEMINI_API_KEY,
        encodeURIComponent(process.env.GEMINI_API_KEY),
        "access_token=opaque-access-token",
        ["Bearer", "opaque-bearer-token"].join(" "),
        "ya29.google-access-token",
        "auth_tokens/unreturned-token",
        "private-response-token",
        "auth_tokens/private-response-name",
        "private-session-data",
        "\nContent-Type: private-request-header",
      ].join(" "),
    },
  }), { status: 403 }));
  await assert.rejects(createGeminiLiveToken(sessionConfig), { statusCode: 502 });
  const diagnostic = log.mock.calls[0].arguments[1];
  assert.equal(diagnostic.upstreamStatus, 403);
  assert.equal(diagnostic.providerStatus, "PERMISSION_DENIED");
  assert.doesNotMatch(diagnostic.message,
    /test-gemini-api-key|opaque-access-token|opaque-bearer-token|ya29\.|auth_tokens\/|private-|[\u0000-\u001f\u007f]/);
});

test("non-JSON and malformed Google responses log only a safe fallback", async (t) => {
  const log = t.mock.method(console, "error", () => {});
  for (const [body, status] of [
    ["<html>private-session-data test-gemini-api-key</html>", 404],
    ["{malformed", 502],
  ]) {
    t.mock.method(globalThis, "fetch", async () => new Response(body, { status }));
    await assert.rejects(createGeminiLiveToken({}), { statusCode: 502 });
    assert.deepEqual(log.mock.calls.at(-1).arguments[1], {
      upstreamStatus: status,
      providerStatus: "",
      message: "Google token response was not valid JSON.",
    });
  }
});

test("rate limits and missing tokens preserve the existing client-facing failure", async (t) => {
  const log = t.mock.method(console, "error", () => {});
  for (const status of [429, 200]) {
    t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({
      error: { status: { secret: "private-status" }, message: ["private-message"] },
    }), { status }));
    await assert.rejects(createGeminiLiveToken({}), {
      message: status === 429
        ? "Realtime voice session could not be created: Gemini Live quota or rate limit was exceeded (Gemini HTTP 429)."
        : "Realtime voice session could not be created: Gemini did not return a session token (Gemini HTTP 200).",
      statusCode: status === 429 ? 429 : 502,
      code: "AI_VOICE_SESSION_FAILED",
      expose: true,
    });
    const diagnostic = log.mock.calls.at(-1).arguments[1];
    assert.equal(diagnostic.upstreamStatus, status);
    assert.equal(diagnostic.providerStatus, "");
    assert.equal(diagnostic.message, `Google API request failed (HTTP ${status}).`);
  }
});

test("network errors and timeouts do not log sensitive transport errors", async (t) => {
  const log = t.mock.method(console, "error", () => {});
  for (const name of ["Error", "TimeoutError"]) {
    t.mock.method(globalThis, "fetch", async () => {
      const cause = new Error("private-request-header test-gemini-api-key");
      cause.name = name;
      throw cause;
    });
    await assert.rejects(createGeminiLiveToken({}), {
      message: "Realtime voice provider could not be reached.",
      statusCode: 502,
      code: name === "TimeoutError" ? "AI_VOICE_PROVIDER_TIMEOUT" : "AI_VOICE_PROVIDER_UNAVAILABLE",
      expose: true,
    });
  }
  assert.equal(log.mock.calls.length, 0);
});

test("production instructions redact partial context and history echoes", async (t) => {
  const log = t.mock.method(console, "error", () => {});
  const config = createGeminiLiveSessionConfig({
    context: { customer: "PrivateCustomer PrivateSurname" },
    history: [{ role: "user", text: "ConfidentialConversation privatebudget" }],
  });
  t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({
    error: {
      status: "INVALID_ARGUMENT",
      message: "Invalid instruction: PrivateCustomer ConfidentialConversation privatebudget",
    },
  }), { status: 400 }));
  await assert.rejects(createGeminiLiveToken(config), { code: "AI_VOICE_SESSION_FAILED" });
  assert.doesNotMatch(JSON.stringify(log.mock.calls), /PrivateCustomer|ConfidentialConversation|privatebudget/);
});

test("malformed Unicode in session data cannot replace the generic client error", async (t) => {
  const log = t.mock.method(console, "error", () => {});
  t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({
    error: { status: "INVALID_ARGUMENT", message: "Invalid instruction" },
  }), { status: 400 }));
  await assert.rejects(createGeminiLiveToken({ config: { text: "\ud800" } }), {
    message: "Realtime voice session could not be created: Gemini rejected the Live session setup (Gemini HTTP 400).",
    statusCode: 502,
    code: "AI_VOICE_SESSION_FAILED",
    expose: true,
  });
  assert.deepEqual(log.mock.calls[0].arguments[1], {
    upstreamStatus: 400,
    providerStatus: "",
    message: "Google token error details could not be safely logged.",
  });
});

test("Live function declarations only use Gemini Schema fields accepted by auth_tokens", () => {
  const declarations = createGeminiLiveSessionConfig().tools[0].functionDeclarations;
  const allowed = new Set([
    "type", "format", "description", "nullable", "enum", "properties", "required",
    "items", "minItems", "maxItems", "minimum", "maximum",
  ]);
  const visit = (schema, path) => {
    for (const key of Object.keys(schema)) assert.ok(allowed.has(key), `${path}.${key} is not a Gemini Schema field`);
    if (schema.type === "object") {
      assert.ok(Object.keys(schema.properties || {}).length, `${path} OBJECT must declare properties`);
    }
    for (const [name, property] of Object.entries(schema.properties || {})) visit(property, `${path}.${name}`);
    if (schema.items) visit(schema.items, `${path}.items`);
  };
  for (const declaration of declarations) {
    assert.deepEqual(Object.keys(declaration).filter((key) => !["name", "description", "parameters"].includes(key)), []);
    if (declaration.parameters) visit(declaration.parameters, declaration.name);
  }
  assert.doesNotMatch(JSON.stringify(declarations), /additionalProperties/);
  const byName = Object.fromEntries(declarations.map((declaration) => [declaration.name, declaration]));
  assert.equal(byName.read_integration_status.parameters, undefined);
  assert.deepEqual(byName.read_records.parameters.required, ["resource"]);
  assert.equal(byName.read_records.parameters.properties.filters.type, "object");
  assert.equal(byName.prepare_write.parameters.properties.record.type, "string");
  assert.match(byName.prepare_write.parameters.properties.record.description, /JSON object/);
});

test("Live token failures explain auth, model and setup causes while logging static field paths", async (t) => {
  const log = t.mock.method(console, "error", () => {});
  const config = createGeminiLiveSessionConfig({
    context: { customer: "PrivateCustomer" },
    history: [{ role: "user", text: "ConfidentialConversation" }],
  });
  const cases = [
    [400, {
      status: "INVALID_ARGUMENT",
      message: "API key not valid. Please pass a valid API key.",
      details: [{ "@type": "type.googleapis.com/google.rpc.ErrorInfo", reason: "API_KEY_INVALID" }],
    }, /GEMINI_API_KEY was rejected by Google .*\(Gemini HTTP 400 INVALID_ARGUMENT\)/],
    [403, { status: "PERMISSION_DENIED", message: "Method doesn't allow unregistered callers." },
      /GEMINI_API_KEY is not permitted to create Gemini Live sessions/],
    [404, { status: "NOT_FOUND", message: "models/test-live-audio is not found for API version v1alpha" },
      /GEMINI_LIVE_MODEL is unknown or not available/],
    [400, {
      status: "INVALID_ARGUMENT",
      message: "Invalid JSON payload received. Unknown name \"additionalProperties\" at " +
        "'bidi_generate_content_setup.tools[0].function_declarations[0].parameters': Cannot find field. " +
        "PrivateCustomer ConfidentialConversation",
    }, /Gemini rejected the Live session setup \(Gemini HTTP 400 INVALID_ARGUMENT\)/],
    [503, { status: "UNAVAILABLE", message: "The service is currently unavailable." },
      /Gemini Live service is temporarily unavailable/],
  ];
  for (const [status, providerError, expected] of cases) {
    t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({ error: providerError }), { status }));
    await assert.rejects(createGeminiLiveToken(config), (error) => {
      assert.equal(error.code, "AI_VOICE_SESSION_FAILED");
      assert.equal(error.statusCode, 502);
      assert.match(error.message, expected);
      assert.doesNotMatch(error.message, /test-gemini-api-key|PrivateCustomer|ConfidentialConversation/);
      return true;
    });
  }
  const logged = log.mock.calls.map((call) => call.arguments[1]);
  assert.deepEqual(logged[0].reasons, ["API_KEY_INVALID"]);
  assert.equal(logged[2].message, "models/test-live-audio is not found for API version v1alpha");
  assert.match(logged[3].message, /Unknown name "additionalProperties" at 'bidi_generate_content_setup\.tools\[0\]/);
  assert.doesNotMatch(JSON.stringify(logged), /test-gemini-api-key|PrivateCustomer|ConfidentialConversation/);
});

test("voice prepare_write rejects JSON-string records that are not objects", async () => {
  const { executeAiVoiceTool } = await import("../src/controllers/ai.controller.js");
  for (const record of ["{not json", "[]", "null", "\"text\""]) {
    let statusCode;
    let body;
    const res = {
      status(code) { statusCode = code; return this; },
      json(payload) { body = payload; return this; },
    };
    await executeAiVoiceTool({
      integrationAccount: "owner@example.com",
      body: { name: "prepare_write", args: { resource: "projects", operation: "create", record } },
    }, res, (error) => assert.fail(error));
    assert.equal(statusCode, 400);
    assert.equal(body.message, "Voice tool record must be a JSON object.");
  }
});
