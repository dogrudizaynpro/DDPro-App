import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { sendVoiceCommand } from "../src/utils/voice-assistant.js";

const appSource = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");
const moduleSource = await readFile(new URL("../src/modules/AIModule.jsx", import.meta.url), "utf8");
const sendStart = appSource.indexOf("  const sendAiMessage = async");
const sendEnd = appSource.indexOf("  const confirmAiOperationalAction =", sendStart);
const statusStart = appSource.indexOf("const integrationStatusQuestion =");
const statusEnd = appSource.indexOf("\nconst describeIntegrationStatus =", statusStart);
const integrationStatusQuestion = runInNewContext(
  `${appSource.slice(statusStart, statusEnd)}; integrationStatusQuestion;`,
);
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
    integrationStatusQuestion,
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

test("AI send accepts direct project requests and includes the selected project context", async () => {
  let request;
  const { send } = createSender({
    requestAiCompletion: async (value) => {
      request = value;
      return { answer: "Proje analizi" };
    },
  });
  const selectedProject = {
    id: "project-7",
    name: "İstanbul Ofis",
    areaM2: 120,
  };
  const response = await send("Riskleri analiz et", "", { selectedProject });
  assert.equal(response.text, "Proje analizi");
  assert.equal(request.message, "Riskleri analiz et");
  assert.deepEqual(request.context.selectedProject, selectedProject);
});

test("research prompts use AI completion and display direct source URLs", async () => {
  let completionRequest;
  const { send } = createSender({
    requestAiCompletion: async (request) => {
      completionRequest = request;
      return {
        answer: "Kaynak özeti\nDoğrudan kaynak URL'si: https://manufacturer.example/linear-ceiling",
      };
    },
  });
  const message =
    "Türkiye’deki alüminyum lineer asma tavan üreticilerini araştır. En az 3 sonuç ve her biri için doğrudan kaynak bağlantısı göster.";

  const response = await send(message);

  assert.equal(completionRequest.message, message);
  assert.match(response.text, /https:\/\/manufacturer\.example\/linear-ceiling/);
  assert.equal(response.moduleSuggestion, "procurement");
});

test("source-link requests do not route to integration status", async () => {
  let completionCalled = false;
  let statusCalled = false;
  const { send } = createSender({
    requestAiCompletion: async () => {
      completionCalled = true;
      return { answer: "Araştırma kaynakları." };
    },
    getIntegrationStatus: async () => {
      statusCalled = true;
      return { available: true };
    },
  });

  const response = await send("Kaynak bağlantılarını göster.");

  assert.equal(completionCalled, true);
  assert.equal(statusCalled, true);
  assert.match(response.text, /Araştırma kaynakları/);
  assert.notEqual(response.moduleSuggestion, "integrations");
});

test("only explicit connection-state questions route to integration status", async () => {
  for (const [message, expected] of [
    ["Kaynak bağlantılarını göster.", null],
    ["Üreticileri araştır.", null],
    ["İnternette ara.", null],
    ["Web araştırma servisi bağlı mı?", ["Web araştırma servisi", "research"]],
  ]) {
    assert.deepEqual(integrationStatusQuestion(message), expected);
  }

  let completionCalled = false;
  const { send, state } = createSender({
    requestAiCompletion: async () => {
      completionCalled = true;
      return { answer: "Araştırma sağlayıcısı bağlı." };
    },
    describeIntegrationStatus: () => "Canlı araştırma servisi durumu",
  });
  await send("Web araştırma servisi bağlı mı?");
  assert.equal(completionCalled, false);
  assert.equal(state.messages.at(-1).text, "Canlı araştırma servisi durumu");
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

test("AI voice module uses the realtime session and mirrors its turns into the existing conversation", () => {
  assert.match(moduleSource, /RealtimeVoiceSession/);
  assert.match(moduleSource, /createAiVoiceSession/);
  assert.match(moduleSource, /onVoiceMessage\?\.\(role, text\)/);
  assert.doesNotMatch(moduleSource, /SpeechRecognition|speechSynthesis/);
});
