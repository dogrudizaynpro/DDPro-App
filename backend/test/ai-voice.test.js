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
  assert.deepEqual(config.config.responseModalities, ["AUDIO"]);
  assert.equal(config.config.speechConfig.languageCode, "tr-TR");
  assert.equal(config.config.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName, "Kore");
  assert.equal(config.config.realtimeInputConfig.automaticActivityDetection.disabled, false);
  assert.match(config.config.systemInstruction.parts[0].text, /değişiklik yapma yetkin yok/);
  assert.match(config.config.systemInstruction.parts[0].text, /Test project/);
  assert.throws(() => createGeminiLiveSessionConfig({ context: { data: "x".repeat(24_001) } }), {
    statusCode: 413,
  });
});

test("single-use Live token is created server-side and the permanent key is not returned", async () => {
  const config = createGeminiLiveSessionConfig({ context: {}, history: [] });
  const token = await createGeminiLiveToken(config);
  assert.equal(token, "auth_tokens/one-use-session");
  assert.equal(request.url, "https://generativelanguage.googleapis.com/v1alpha/authTokens");
  assert.equal(request.headers["x-goog-api-key"], "test-gemini-api-key");
  assert.equal(request.body.uses, 1);
  assert.equal(request.body.liveConnectConstraints.model, "models/test-live-audio");
  assert.ok(Date.parse(request.body.expireTime) > Date.now());
  assert.ok(Date.parse(request.body.newSessionExpireTime) > Date.now());
  assert.match(getGeminiLiveWebSocketUrl(), /BidiGenerateContentConstrained$/);
  assert.doesNotMatch(JSON.stringify({ token }), /test-gemini-api-key/);
});

test("provider failures are sanitized and unconfigured sessions fail closed", async () => {
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
      assert.doesNotMatch(error.message, /leaked detail|test-gemini-api-key/);
      return true;
    }
  );
});
