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

test("Gemini Live config requests Turkish audio, VAD, and safe context-only behavior", () => {
  const config = createGeminiLiveSessionConfig({
    context: { projects: [{ name: "Test project" }] },
    history: [{ role: "user", text: "Önceki soru" }],
  });
  assert.equal(config.model, "models/test-live-audio");
  assert.deepEqual(config.generationConfig.responseModalities, ["AUDIO"]);
  assert.equal(config.generationConfig.speechConfig.languageCode, "tr-TR");
  assert.equal(config.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName, "Kore");
  assert.equal(config.realtimeInputConfig.automaticActivityDetection.disabled, false);
  assert.match(config.systemInstruction.parts[0].text, /değişiklik yapma yetkin yok/);
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
  assert.equal(request.url, "https://generativelanguage.googleapis.com/v1beta/auth_tokens");
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
      assert.equal(error.message, "Realtime voice session could not be created.");
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
    message: "Realtime voice session could not be created.",
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
      message: "Realtime voice session could not be created.",
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
    message: "Realtime voice session could not be created.",
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
