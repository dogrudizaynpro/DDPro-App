import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getTurkishSpeechRecognition,
  isSuccessfulAiResponse,
  selectTurkishSpeechVoice,
  sendVoiceCommand,
  speakTurkishText,
  waitForTurkishSpeechVoices,
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

test("Turkish speech output waits for browser voices and installs handlers before speaking", async () => {
  const spoken = [];
  const events = [];
  class Utterance {
    constructor(text) {
      this.text = text;
    }
  }
  const browser = {
    SpeechSynthesisUtterance: Utterance,
    speechSynthesis: {
      getVoices: () => [
        { lang: "en-US", name: "English Female" },
        { lang: "tr-TR", name: "Turkish Default" },
        { lang: "tr-TR", name: "Turkish Default" },
      ],
      speak: (utterance) => {
        assert.equal(typeof utterance.onstart, "function");
        assert.equal(typeof utterance.onend, "function");
        assert.equal(typeof utterance.onerror, "function");
        spoken.push(utterance);
        utterance.onstart();
        utterance.onend();
      },
    },
  });
  const utterance = await speakTurkishText("  Merhaba  ", browser, {
    onstart: () => events.push("start"),
    onend: () => events.push("end"),
    onerror: () => events.push("error"),
  });
  assert.equal(utterance.text, "Merhaba");
  assert.equal(utterance.lang, "tr-TR");
  assert.equal(utterance.voice.name, "Turkish Default");
  assert.equal(utterance.rate, 0.95);
  assert.equal(utterance.pitch, 1);
  assert.deepEqual(spoken, [utterance]);
  assert.deepEqual(events, ["start", "end"]);
});

test("Turkish voice preference ranks Turkish locale and uses gender metadata, not voice names", () => {
  const voices = [
    { lang: "en-US", name: "English Female" },
    { lang: "tr", name: "Turkish Default" },
    { lang: "tr-TR", name: "Zeynep" },
    { lang: "tr-TR", name: "Voice 3", gender: "female" },
  ];
  assert.equal(selectTurkishSpeechVoice(voices), voices[3]);
  assert.equal(selectTurkishSpeechVoice([voices[0], voices[1]]), voices[1]);
  assert.equal(selectTurkishSpeechVoice([{ lang: "en-US", name: "Female" }]), null);
});

test("browser voice loading waits for voiceschanged and returns Turkish voices", async () => {
  let voices = [];
  let changed;
  const synthesis = {
    getVoices: () => voices,
    addEventListener: (name, listener) => { changed = listener; },
    removeEventListener: (name, listener) => {
      if (changed === listener) changed = null;
    },
  };
  const loading = waitForTurkishSpeechVoices(synthesis, 100);
  voices = [{ lang: "tr-TR", name: "Türkçe" }];
  changed();
  assert.deepEqual(await loading, voices);
  assert.equal(changed, null);
});

test("speech synthesis preserves Turkish names, technical terms, measurements and amounts verbatim", async () => {
  const text = "İstanbul'daki DDPro Yapı A.Ş. projesinde 120 m² cephe, 12 mm derz ve 3.250.000 TL bütçe.";
  let spoken;
  class Utterance {
    constructor(value) { this.text = value; }
  }
  await speakTurkishText(text, {
    SpeechSynthesisUtterance: Utterance,
    speechSynthesis: {
      getVoices: () => [{ lang: "tr-TR", name: "Turkish Female" }],
      speak: (utterance) => { spoken = utterance; },
    },
  });
  assert.equal(spoken.text, text);
});

test("Turkish speech output reports unsupported browsers, unavailable Turkish voices, and empty responses", async () => {
  await assert.rejects(speakTurkishText("Yanıt", {}), /desteklemiyor/);
  await assert.rejects(speakTurkishText("  ", {
    SpeechSynthesisUtterance: class {},
    speechSynthesis: { speak() {} },
  }), /yanıtı bulunmuyor/);
  await assert.rejects(speakTurkishText("Yanıt", {
    SpeechSynthesisUtterance: class {},
    speechSynthesis: { getVoices: () => [{ lang: "en-US", name: "English" }], speak() {} },
  }), /Türkçe ses bulunamadı/);
});
