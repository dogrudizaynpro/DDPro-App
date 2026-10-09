import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { sendVoiceCommand } from "../src/utils/voice-assistant.js";

const appSource = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");
const moduleSource = await readFile(new URL("../src/modules/AIModule.jsx", import.meta.url), "utf8");
const sendStart = appSource.indexOf("  const sendAiMessage = async");
const sendEnd = appSource.indexOf("  const confirmAiOperationalAction =", sendStart);
const summaryStart = appSource.indexOf("const describeIntegrationStatus =");
const summaryEnd = appSource.indexOf("\nfunction App()", summaryStart);
const describeIntegrationStatus = runInNewContext(
  `${appSource.slice(summaryStart, summaryEnd)}; describeIntegrationStatus;`,
);

test("AI integration summaries preserve actual Google failure categories and safe errors", () => {
  for (const category of [
    "api_disabled", "scope_required", "permission_denied", "failed_precondition",
    "service_unavailable", "request_rejected", "test_failed",
  ]) {
    const summary = describeIntegrationStatus("Gmail", "gmail", {
      gmail: {
        configured: true, connected: false, authenticated: true, status: category,
        lastTest: { error: "Safe provider diagnostic", googleApiError: { category } },
      },
    });
    assert.match(summary, new RegExp(category));
    assert.match(summary, /Safe provider diagnostic/);
    assert.doesNotMatch(summary, /OAuth oturumu|testi bekliyor|yetkilendirmesi gerekli/);
  }
  const summary = describeIntegrationStatus("Gmail", "gmail", {
    gmail: {
      configured: true, connected: false, status: "test_failed",
      lastTest: { error: "Mailbox unavailable", googleApiError: { category: "failed_precondition" } },
    },
  });
  assert.match(summary, /failed_precondition.*Mailbox unavailable/);
});

test("AI integration summaries distinguish pending tests from required authorization", () => {
  const pending = describeIntegrationStatus("Gmail", "gmail", {
    gmail: { configured: true, connected: false, status: "configured_not_tested" },
  });
  assert.match(pending, /başarılı bağlantı testi bekliyor/);
  assert.doesNotMatch(pending, /kontrol başarısız|OAuth/);
  for (const status of ["auth_required", "authorization_required"]) {
    const summary = describeIntegrationStatus("Gmail", "gmail", {
      gmail: { configured: true, connected: false, status },
    });
    assert.match(summary, /OAuth yetkilendirmesi gerekli/);
    assert.doesNotMatch(summary, /testi bekliyor/);
  }
});

test("AI integration summaries report known failures even without test error details", () => {
  const summary = describeIntegrationStatus("Entegrasyonlar", null, {
    gmail: { configured: true, connected: false, status: "failed_precondition" },
    googleCalendar: { configured: true, connected: true, status: "connected" },
  });
  assert.match(summary, /Gmail: BAĞLI DEĞİL.*failed_precondition.*ayrıntı yok/);
  assert.match(summary, /Google Calendar: BAĞLI;/);
});

const createSender = (overrides = {}) => {
  const state = { messages: [{ id: "welcome", role: "assistant", text: "Eski mesaj" }] };
  let id = 0;
  const context = {
    aiAttachment: null, aiInput: "", aiSending: false,
    createId: () => `message-${++id}`, formatDate: () => "2026-10-09",
    setAiMessages: (update) => { state.messages = update(state.messages); },
    setAiInput: (input) => { state.input = input; },
    setAiSending: (sending) => { state.sending = sending; },
    setAiAttachment: () => {},
    integrationStatusQuestion: () => null,
    getStoredData: () => [],
    getCrmContacts: async () => ({ data: [] }),
    getIntegrationStatus: async () => ({ available: true }),
    setIntegrationState: () => {},
    projects: [], offers: [], products: [], systemInventory: [], procurementItems: [], reportItems: [],
    requestAiCompletion: async () => ({ answer: "Yeni AI yanıtı" }),
    getAiUsageCount: async () => 1,
    setAiAnalysisCount: () => {},
    addLog: () => {},
    getApiFailureReason: (error) => error.message,
    ...overrides,
  };
  const send = runInNewContext(`${appSource.slice(sendStart, sendEnd)}; sendAiMessage;`, context);
  return { send, state };
};

test("AI send displays and returns the identical new successful answer for voice output", async () => {
  const { send, state } = createSender();
  const response = await sendVoiceCommand(send, "Yeni komut");
  assert.equal(response, state.messages.at(-1));
  assert.equal(response.text, "Yeni AI yanıtı");
  assert.equal(response.status, "success");
  assert.equal(state.messages.at(-2).text, "Yeni komut");
  assert.equal(state.sending, false);
});

for (const [name, completion] of [
  ["provider rejection", () => Promise.reject(new Error("Provider offline"))],
  ["empty answer", async () => ({ answer: " " })],
  ["non-text answer", async () => ({ answer: {} })],
  ["missing completion", async () => null],
]) {
  test(`AI ${name} displays failure, never a successful or spoken answer`, async () => {
    const { send, state } = createSender({ requestAiCompletion: completion });
    await assert.rejects(sendVoiceCommand(send, "Yeni komut"), /yeni bir AI yanıtı alınamadı/);
    assert.equal(state.messages.at(-1).status, "unavailable");
    assert.equal(state.sending, false);
    assert.ok(state.messages.at(-1).text);
  });
}

test("busy AI send does not reuse the previous answer", async () => {
  const { send, state } = createSender({ aiSending: true });
  await assert.rejects(sendVoiceCommand(send, "Yeni komut"), /yeni bir AI yanıtı alınamadı/);
  assert.equal(state.messages.length, 1);
});

for (const fail of [false, true]) {
  test(`integration status voice send returns only its own ${fail ? "failure" : "success"}`, async () => {
    const { send, state } = createSender({
      integrationStatusQuestion: () => ["google", "Google"],
      getIntegrationStatus: async () => {
        if (fail) throw new Error("Backend offline");
        return { available: true };
      },
      describeIntegrationStatus: () => "Canlı entegrasyon durumu",
    });
    if (fail) {
      await assert.rejects(sendVoiceCommand(send, "Google bağlı mı?"), /yeni bir AI yanıtı alınamadı/);
      assert.equal(state.messages.at(-1).status, "unavailable");
    } else {
      assert.equal(await sendVoiceCommand(send, "Google bağlı mı?"), state.messages.at(-1));
    }
    assert.equal(state.sending, false);
  });
}

const createVoiceInput = (send) => {
  const state = { spoken: [], errors: [], inputs: [] };
  const context = {
    voiceListening: false, aiSending: false,
    SpeechRecognition: class {
      start() {}
    },
    window: { isSecureContext: true },
    recognitionRef: { current: null },
    voiceRequestRef: { current: 0 },
    sendAiMessageRef: { current: send },
    sendVoiceCommand,
    setAiInput: (input) => state.inputs.push(input),
    setVoiceError: (error) => state.errors.push(error),
    setVoiceListening: () => {},
    stopSpeech: () => { context.voiceRequestRef.current += 1; },
    speakResponse: (text) => state.spoken.push(text),
  };
  const start = moduleSource.indexOf("  const toggleVoiceInput =");
  const end = moduleSource.indexOf("  const activateRole =", start);
  runInNewContext(`${moduleSource.slice(start, end)}; toggleVoiceInput();`, context);
  return { context, state, recognition: context.recognitionRef.current };
};
const transcriptEvent = { results: [[{ transcript: "Sesli komut" }]] };

test("recognition uses the current send callback rather than the closure from microphone start", async () => {
  const voice = createVoiceInput(() => { throw new Error("Stale callback used"); });
  const { send, state } = createSender();
  voice.context.sendAiMessageRef.current = send;
  await voice.recognition.onresult(transcriptEvent);
  assert.deepEqual(voice.state.spoken, ["Yeni AI yanıtı"]);
  assert.equal(state.messages.at(-1).text, voice.state.spoken[0]);
});

test("recognition reports failure without speaking a failure or an older answer", async () => {
  const { send } = createSender({ requestAiCompletion: async () => { throw new Error("Offline"); } });
  const voice = createVoiceInput(send);
  await voice.recognition.onresult(transcriptEvent);
  assert.deepEqual(voice.state.spoken, []);
  assert.match(voice.state.errors.at(-1), /yeni bir AI yanıtı alınamadı/);
});

test("cancelled or unmounted voice requests cannot speak their late responses", async () => {
  let resolve;
  const voice = createVoiceInput(() => new Promise((finish) => { resolve = finish; }));
  const pending = voice.recognition.onresult(transcriptEvent);
  voice.context.voiceRequestRef.current += 1;
  resolve({ role: "assistant", status: "success", text: "Geç yanıt" });
  await pending;
  assert.deepEqual(voice.state.spoken, []);
});
