export const getTurkishSpeechRecognition = (browser = globalThis.window) =>
  browser?.SpeechRecognition || browser?.webkitSpeechRecognition || null;

export const isSuccessfulAiResponse = (message) =>
  message?.role === "assistant" &&
  message.status === "success" &&
  typeof message.text === "string" &&
  Boolean(message.text.trim());

export const sendVoiceCommand = async (sendAiMessage, transcript) => {
  const response = await sendAiMessage({ preventDefault() {} }, transcript);
  if (!isSuccessfulAiResponse(response)) {
    throw new Error("Sesli komut için yeni bir AI yanıtı alınamadı. Mesaj akışındaki hata bilgisini kontrol edin.");
  }
  return response;
};

export const selectTurkishSpeechVoice = (voices = []) => {
  const turkishVoices = voices.filter((voice) =>
    /^tr(?:-|$)/i.test(voice?.lang || "")
  );
  const feminineName = /\b(female|woman|kadın|zira|filiz|emel|seda|yelda|gül|gul)\b/i;
  return turkishVoices.find((voice) =>
    voice.gender?.toLowerCase?.() === "female" || feminineName.test(voice.name || "")
  ) || turkishVoices[0] || null;
};

export const speakTurkishText = (text, browser = globalThis.window) => {
  if (!browser?.speechSynthesis || !browser?.SpeechSynthesisUtterance) {
    throw new Error("Bu tarayıcı sesli yanıtları desteklemiyor.");
  }
  if (typeof text !== "string" || !text.trim()) {
    throw new Error("Seslendirilecek bir AI yanıtı bulunmuyor.");
  }
  const utterance = new browser.SpeechSynthesisUtterance(text.trim());
  utterance.lang = "tr-TR";
  utterance.rate = 0.95;
  utterance.pitch = 1;
  utterance.volume = 1;
  const voices = browser.speechSynthesis.getVoices?.() || [];
  const voice = selectTurkishSpeechVoice(voices);
  if (voice) utterance.voice = voice;
  browser.speechSynthesis.speak(utterance);
  return utterance;
};
