import assert from "node:assert/strict";
import { test } from "node:test";
import {
  pcm16ToFloat32,
  RealtimeVoiceSession,
  resampleToPcm16,
} from "../src/utils/realtime-voice.js";

class FakeWebSocket {
  static OPEN = 1;
  static CLOSING = 2;
  static latest;

  constructor(url) {
    this.url = url;
    this.readyState = 0;
    this.sent = [];
    FakeWebSocket.latest = this;
    queueMicrotask(() => {
      this.readyState = FakeWebSocket.OPEN;
      this.onopen?.();
    });
  }

  send(value) {
    const message = JSON.parse(value);
    this.sent.push(message);
    if (message.setup) {
      queueMicrotask(() => this.emit({ setupComplete: {} }));
    }
  }

  emit(value) {
    return this.onmessage?.({ data: JSON.stringify(value) });
  }

  close() {
    this.readyState = 3;
    this.onclose?.();
  }
}

class FakeAudioContext {
  static latest;

  constructor() {
    this.sampleRate = 48_000;
    this.currentTime = 1;
    this.destination = {};
    this.state = "running";
    this.createdSources = [];
    FakeAudioContext.latest = this;
  }

  async resume() {}
  async close() { this.state = "closed"; }
  createMediaStreamSource() { return { connect() {}, disconnect() {} }; }
  createScriptProcessor() {
    const processor = { connect() {}, disconnect() {}, onaudioprocess: null };
    this.processor = processor;
    return processor;
  }
  createGain() { return { gain: {}, connect() {}, disconnect() {} }; }
  createBuffer(_channels, length, sampleRate) {
    return {
      duration: length / sampleRate,
      copyToChannel() {},
    };
  }
  createBufferSource() {
    const source = {
      connect() {},
      start: () => { source.started = true; },
      stop: () => { source.stopped = true; source.onended?.(); },
    };
    this.createdSources.push(source);
    return source;
  }
}

const createBrowser = (getUserMedia = async () => {
  const track = { stopped: false, stop() { this.stopped = true; } };
  return { getTracks: () => [track] };
}) => ({
  isSecureContext: true,
  navigator: { mediaDevices: { getUserMedia } },
  WebSocket: FakeWebSocket,
  AudioContext: FakeAudioContext,
  setTimeout,
  clearTimeout,
});

const createSession = (options = {}) => {
  const events = { states: [], transcripts: [], operations: [], errors: [] };
  const session = new RealtimeVoiceSession({
    createSession: async () => ({
      token: "single-use-token",
      websocketUrl: "wss://voice.example/live",
      setup: { model: "models/live", generationConfig: { responseModalities: ["AUDIO"] } },
    }),
    context: { projects: [] },
    history: [],
    onState: (state) => events.states.push(state),
    onTranscript: (...turn) => events.transcripts.push(turn),
    onOperation: (operation) => events.operations.push(operation),
    onError: (error) => events.errors.push(error),
    browser: createBrowser(),
    ...options,
  });
  return { session, events };
};

test("audio input is resampled to mono 16 kHz PCM and provider audio decodes to float samples", () => {
  const pcm = resampleToPcm16(Float32Array.from([0.2, 0.4, -0.2, -0.4]), 32_000);
  assert.deepEqual([...pcm], [9830, -9830]);
  const encoded = btoa(String.fromCharCode(...new Uint8Array(pcm.buffer)));
  assert.deepEqual([...pcm16ToFloat32(encoded)].map((sample) => Number(sample.toFixed(2))), [0.3, -0.3]);
});

test("realtime session streams microphone audio, transcripts, and stops playback on interruption", async () => {
  const { session, events } = createSession();
  await session.start();
  const socket = FakeWebSocket.latest;
  assert.match(socket.url, /access_token=single-use-token/);
  assert.equal(socket.sent[0].setup.model, "models/live");

  FakeAudioContext.latest.processor.onaudioprocess({
    inputBuffer: { getChannelData: () => Float32Array.from({ length: 12 }, () => 0.1) },
  });
  const inputFrame = socket.sent.find((message) => message.realtimeInput);
  assert.equal(inputFrame.realtimeInput.audio.mimeType, "audio/pcm;rate=16000");

  const audio = btoa(String.fromCharCode(0, 0, 1, 0));
  await socket.emit({
    serverContent: {
      modelTurn: { parts: [{ inlineData: { mimeType: "audio/pcm;rate=24000", data: audio } }] },
    },
  });
  assert.equal(FakeAudioContext.latest.createdSources[0].started, true);
  await socket.emit({ serverContent: { interrupted: true } });
  assert.equal(FakeAudioContext.latest.createdSources[0].stopped, true);

  await socket.emit({
    serverContent: {
      inputTranscription: { text: "Merhaba" },
      outputTranscription: { text: "Merhaba, nasıl yardımcı olayım?" },
      turnComplete: true,
    },
  });
  assert.deepEqual(events.transcripts, [
    ["user", "Merhaba"],
    ["assistant", "Merhaba, nasıl yardımcı olayım?"],
  ]);
  assert.ok(events.states.includes("listening"));
  session.stop();
  assert.equal(FakeAudioContext.latest.state, "closed");
});

test("Gemini Live tool calls use backend results and deduplicate repeated call IDs", async () => {
  let executions = 0;
  const { session, events } = createSession({
    executeTool: async ({ name, args }) => {
      executions += 1;
      assert.equal(name, "read_records");
      assert.equal(args.resource, "projects");
      await new Promise((resolve) => setTimeout(resolve, 0));
      return { type: "records", data: [{ id: "project-1" }] };
    },
  });
  await session.start();
  const socket = FakeWebSocket.latest;
  const call = { id: "call-1", name: "read_records", args: { resource: "projects" } };
  await socket.emit({ toolCall: { functionCalls: [call] } });
  await socket.emit({ toolCall: { functionCalls: [call] } });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(executions, 1);
  assert.equal(socket.sent.filter((message) => message.toolResponse).length, 1);
  assert.deepEqual(
    socket.sent.find((message) => message.toolResponse).toolResponse.functionResponses,
    [{
      id: "call-1",
      name: "read_records",
      response: { data: [{ id: "project-1" }] },
    }]
  );
  assert.equal(events.operations.at(-1).status, "completed");
  assert.match(events.operations.at(-1).summary, /1 kayıt backend'den alındı/);
  assert.deepEqual(events.operations.at(-1).records, [{ id: "project-1" }]);
  assert.equal(events.states.at(-1), "tool_completed");
  session.stop();
});

test("Live empty and malformed tool results are distinguished from successful records", async () => {
  for (const [result, status] of [
    [{ type: "records", data: [] }, "completed"],
    [{ type: "records", data: null }, "completed"],
    [undefined, "failed"],
    [{ type: "records" }, "failed"],
    [{ type: "records", data: undefined }, "failed"],
    [{ type: "records", data: "not records" }, "failed"],
    [{ type: "records", data: [null] }, "failed"],
  ]) {
    const { session, events } = createSession({ executeTool: async () => result });
    await session.start();
    const socket = FakeWebSocket.latest;
    await socket.emit({ toolCall: { functionCalls: [{
      id: "empty-call", name: "read_records", args: { resource: "projects" },
    }] } });
    await new Promise((resolve) => setTimeout(resolve, 0));
    const response = socket.sent.find((message) => message.toolResponse)
      .toolResponse.functionResponses[0].response;
    assert.equal(events.operations.at(-1).status, status);
    if (status === "completed") {
      assert.deepEqual(response, { data: result.data });
      assert.equal(events.operations.at(-1).records, result.data);
      assert.match(events.operations.at(-1).summary, /0 kayıt/);
    } else {
      assert.deepEqual(response, { error: "Backend araç sonucu doğrulanamadı." });
      assert.equal(events.operations.at(-1).records, undefined);
      assert.equal(events.states.at(-1), "tool_failed");
    }
    session.stop();
  }
});

test("stopping during a backend call reports an unverified result without a false completion", async () => {
  let resolveTool;
  const { session, events } = createSession({
    executeTool: () => new Promise((resolve) => { resolveTool = resolve; }),
  });
  await session.start();
  await FakeWebSocket.latest.emit({ toolCall: { functionCalls: [
    { id: "pending-call", name: "read_records", args: { resource: "projects" } },
  ] } });
  await Promise.resolve();
  session.stop();
  assert.equal(events.operations.at(-1).status, "unverified");
  resolveTool({ type: "records", data: [{ id: "project-1" }] });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(events.operations.at(-1).status, "unverified");
});

test("Live operations require confirmation and return tool failures as failures", async () => {
  const { session, events } = createSession({
    executeTool: async ({ name }) => {
      if (name === "prepare_write") {
        return {
          type: "confirmation_required",
          pendingAction: { id: "confirmation-1", summary: "Proje oluşturulsun mu?", preview: {} },
        };
      }
      throw Object.assign(new Error("Yetki yetersiz."), { status: 403 });
    },
  });
  await session.start();
  const socket = FakeWebSocket.latest;
  await socket.emit({ toolCall: { functionCalls: [
    { id: "write-1", name: "prepare_write", args: { resource: "projects" } },
    { id: "read-1", name: "read_records", args: { resource: "projects" } },
  ] } });
  await new Promise((resolve) => setTimeout(resolve, 0));
  const finalOperations = new Map(events.operations.map((operation) => [operation.id, operation]));
  assert.deepEqual([...finalOperations.values()].map(({ status }) => status), [
    "awaiting_confirmation",
    "failed",
  ]);
  const responses = socket.sent.find((message) => message.toolResponse).toolResponse.functionResponses;
  assert.equal(responses[0].response.status, "awaiting_confirmation");
  assert.match(responses[1].response.error, /Yetki yetersiz/);
  session.stop();
});

test("realtime session reports microphone denial and releases resources on connection loss", async () => {
  const denied = createSession({
    browser: createBrowser(async () => { throw new Error("Permission denied"); }),
  });
  await assert.rejects(denied.session.start(), /Permission denied/);
  assert.ok(denied.events.states.includes("error"));

  const disconnected = createSession();
  await disconnected.session.start();
  const socket = FakeWebSocket.latest;
  const track = disconnected.session.stream.getTracks()[0];
  socket.onclose();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
  FakeWebSocket.latest.onclose({ code: 1006, wasClean: false });
  assert.equal(track.stopped, true);
  assert.match(disconnected.events.errors.at(-1).message, /bağlantısı koptu/);
  assert.ok(disconnected.events.states.includes("error"));
});

test("a transient Live disconnect reconnects once with a fresh session and retains the microphone", async () => {
  let sessionsCreated = 0;
  const { session, events } = createSession({
    createSession: async () => {
      sessionsCreated += 1;
      return {
        token: `single-use-token-${sessionsCreated}`,
        websocketUrl: "wss://voice.example/live",
        setup: { model: "models/live", generationConfig: { responseModalities: ["AUDIO"] } },
      };
    },
  });
  await session.start();
  const originalSocket = FakeWebSocket.latest;
  const track = session.stream.getTracks()[0];
  originalSocket.onclose({ code: 1006, wasClean: false });
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(sessionsCreated, 2);
  assert.notEqual(FakeWebSocket.latest, originalSocket);
  assert.equal(track.stopped, false);
  assert.ok(events.states.includes("reconnecting"));
  assert.ok(events.states.includes("reconnected"));
  assert.equal(session.active, true);
  session.stop();
  assert.equal(track.stopped, true);
});

test("Live binary JSON setup and audio frames decode as Blob or ArrayBuffer in arrival order", async () => {
  for (const frameType of ["blob", "arraybuffer"]) {
    class BinaryWebSocket extends FakeWebSocket {
      send(value) {
        const message = JSON.parse(value);
        this.sent.push(message);
        if (message.setup) {
          const blob = new Blob([JSON.stringify({ setupComplete: {} })]);
          queueMicrotask(async () => this.onmessage({
            data: frameType === "blob" ? blob : await blob.arrayBuffer(),
          }));
        }
      }
    }
    const { session, events } = createSession({
      browser: { ...createBrowser(), WebSocket: BinaryWebSocket },
    });
    try {
      await session.start();
      const socket = FakeWebSocket.latest;
      assert.equal(socket.binaryType, "arraybuffer");
      const audio = btoa(String.fromCharCode(0, 0, 1, 0));
      const audioFrame = new Blob([JSON.stringify({
        serverContent: {
          modelTurn: { parts: [{ inlineData: { mimeType: "audio/pcm;rate=24000", data: audio } }] },
          outputTranscription: { text: "Merhaba" },
        },
      })]);
      const first = socket.onmessage({
        data: frameType === "blob" ? audioFrame : await audioFrame.arrayBuffer(),
      });
      const second = socket.emit({ serverContent: { turnComplete: true } });
      await Promise.all([first, second]);
      assert.equal(FakeAudioContext.latest.createdSources[0].started, true);
      assert.deepEqual(events.transcripts, [["assistant", "Merhaba"]]);
      assert.deepEqual(events.errors, []);
    } finally {
      session.stop();
    }
  }
});

test("invalid binary JSON logs metadata only and releases the microphone", async (t) => {
  const log = t.mock.method(console, "error", () => {});
  const { session, events } = createSession();
  await session.start();
  const track = session.stream.getTracks()[0];
  await FakeWebSocket.latest.onmessage({
    data: new Blob(["private-token private-conversation invalid JSON"]),
  });
  assert.equal(track.stopped, true);
  assert.match(events.errors[0].message, /geçersiz yanıt/);
  assert.deepEqual(log.mock.calls[0].arguments[1], {
    stage: "websocket_decode", frameType: "binary",
  });
  assert.doesNotMatch(JSON.stringify(log.mock.calls), /private-/);
});

test("backend ephemeral token and constrained wire setup are passed unchanged to Live WebSocket", async (t) => {
  const {
    createGeminiLiveSessionConfig,
    createGeminiLiveToken,
    getGeminiLiveWebSocketUrl,
  } = await import("../backend/src/services/ai-voice.service.js");
  const previousKey = process.env.GEMINI_API_KEY;
  const previousModel = process.env.GEMINI_LIVE_MODEL;
  const token = "auth_tokens/session+opaque?value=&";
  let tokenRequest;
  let setup;
  process.env.GEMINI_API_KEY = "test-live-backend-key";
  process.env.GEMINI_LIVE_MODEL = "gemini-3.8-live";
  t.mock.method(globalThis, "fetch", async (url, init) => {
    tokenRequest = { url, body: JSON.parse(init.body) };
    return new Response(JSON.stringify({ name: token }));
  });
  const { session } = createSession({
    createSession: async (input) => {
      setup = createGeminiLiveSessionConfig(input);
      return {
        token: await createGeminiLiveToken(setup),
        websocketUrl: getGeminiLiveWebSocketUrl(),
        setup,
      };
    },
  });
  try {
    await session.start();
    const socket = FakeWebSocket.latest;
    const url = new URL(socket.url);
    assert.equal(tokenRequest.url, "https://generativelanguage.googleapis.com/v1alpha/auth_tokens");
    assert.equal(url.pathname,
      "/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained");
    assert.equal(url.searchParams.get("access_token"), token);
    assert.deepEqual([...url.searchParams.keys()], ["access_token"]);
    assert.deepEqual(socket.sent[0], { setup: tokenRequest.body.bidiGenerateContentSetup });
    assert.deepEqual(socket.sent[0].setup, setup);
    assert.equal(setup.model, "models/gemini-3.8-live");
    assert.deepEqual(setup.generationConfig.responseModalities, ["AUDIO"]);
    assert.equal(setup.config, undefined);
    assert.doesNotMatch(socket.url + JSON.stringify(socket.sent), /test-live-backend-key/);
  } finally {
    session.stop();
    if (previousKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previousKey;
    if (previousModel === undefined) delete process.env.GEMINI_LIVE_MODEL;
    else process.env.GEMINI_LIVE_MODEL = previousModel;
  }
});
