export const getTurkishSpeechRecognition = (browser = globalThis.window) =>
  browser?.SpeechRecognition || browser?.webkitSpeechRecognition || null;

export const speakTurkishText = (text, browser = globalThis.window) => {
  if (!browser?.speechSynthesis || !browser?.SpeechSynthesisUtterance) {
    throw new Error("Bu tarayıcı sesli yanıtları desteklemiyor.");
  }
  if (typeof text !== "string" || !text.trim()) {
    throw new Error("Seslendirilecek bir AI yanıtı bulunmuyor.");
  }
  const utterance = new browser.SpeechSynthesisUtterance(text.trim());
  utterance.lang = "tr-TR";
  browser.speechSynthesis.speak(utterance);
  return utterance;
};
