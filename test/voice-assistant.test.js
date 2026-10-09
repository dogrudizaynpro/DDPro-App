import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getTurkishSpeechRecognition,
  isSuccessfulAiResponse,
  sendVoiceCommand,
  speakTurkishText,
} from "../src/utils/voice-assistant.js";

test("Turkish speech recognition resolves standard and prefixed browser APIs", () => {
  const standard = class StandardRecognition {};
  const prefixed = class PrefixedRecognition {};
  assert.equal(getTurkishSpeechRecognition({ SpeechRecognition: standard }), standard);
  assert.equal(getTurkishSpeechRecognition({ webkitSpeechRecognition: prefixed }), prefixed);
  assert.equal(getTurkishSpeechRecognition({}), null);
});

test("voice responses require an explicitly successful, nonempty assistant answer", () => {
  assert.equal(isSuccessfulAiResponse({ role: "assistant", status: "success", text: "Yeni yanıt" }), true);
  for (const response of [
    null,
    { role: "assistant", text: "Eski karşılama" },
    { role: "assistant", status: "unavailable", text: "Bağlantı hatası" },
    { role: "user", status: "success", text: "Komut" },
    { role: "assistant", status: "success", text: " " },
    { role: "assistant", status: "success", text: {} },
  ]) assert.equal(isSuccessfulAiResponse(response), false);
});

test("voice commands await and return only the answer from their own send", async () => {
  let resolve;
  const answer = { role: "assistant", status: "success", text: "Bu komutun yeni yanıtı" };
  const sending = sendVoiceCommand((event, transcript) => {
    event.preventDefault();
    assert.equal(transcript, "Yeni komut");
    return new Promise((finish) => { resolve = finish; });
  }, "Yeni komut");
  resolve(answer);
  assert.equal(await sending, answer);
});

test("failed, skipped and rejected sends never become spoken answers", async () => {
  for (const response of [
    undefined,
    null,
    { role: "assistant", status: "unavailable", text: "İstek başarısız" },
    { role: "assistant", status: "success", text: "" },
  ]) {
    await assert.rejects(sendVoiceCommand(async () => response, "Komut"), /yeni bir AI yanıtı alınamadı/);
  }
  await assert.rejects(sendVoiceCommand(async () => { throw new Error("Ağ hatası"); }, "Komut"), /Ağ hatası/);
});

test("Turkish speech output is sent to browser synthesis in Turkish", () => {
  const spoken = [];
  class Utterance {
    constructor(text) {
      this.text = text;
    }
  }
  const browser = {
    SpeechSynthesisUtterance: Utterance,
    speechSynthesis: { speak: (utterance) => spoken.push(utterance) },
  };
  const utterance = speakTurkishText("  Merhaba  ", browser);
  assert.equal(utterance.text, "Merhaba");
  assert.equal(utterance.lang, "tr-TR");
  assert.deepEqual(spoken, [utterance]);
});

test("Turkish speech output reports unsupported browsers and empty responses", () => {
  assert.throws(() => speakTurkishText("Yanıt", {}), /desteklemiyor/);
  assert.throws(() => speakTurkishText("  ", {
    SpeechSynthesisUtterance: class {},
    speechSynthesis: { speak() {} },
  }), /yanıtı bulunmuyor/);
});
