import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getTurkishSpeechRecognition,
  speakTurkishText,
} from "../src/utils/voice-assistant.js";

test("Turkish speech recognition resolves standard and prefixed browser APIs", () => {
  const standard = class StandardRecognition {};
  const prefixed = class PrefixedRecognition {};
  assert.equal(getTurkishSpeechRecognition({ SpeechRecognition: standard }), standard);
  assert.equal(getTurkishSpeechRecognition({ webkitSpeechRecognition: prefixed }), prefixed);
  assert.equal(getTurkishSpeechRecognition({}), null);
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
