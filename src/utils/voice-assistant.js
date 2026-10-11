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

const isTurkishVoice = (voice) => /^tr(?:-|$)/i.test(voice?.lang || "");

export const selectTurkishSpeechVoice = (voices = []) => {
  const turkishVoices = voices.filter(isTurkishVoice);
  const istanbulTurkishVoices = turkishVoices.filter((voice) =>
    /^tr-TR$/i.test(voice.lang || "")
  );
  const explicitlyFeminine = (voice) =>
    voice.gender?.toLowerCase?.() === "female";
  return istanbulTurkishVoices.find(explicitlyFeminine) ||
    istanbulTurkishVoices[0] ||
    turkishVoices.find(explicitlyFeminine) ||
    turkishVoices[0] ||
    null;
};

export const waitForTurkishSpeechVoices = async (speechSynthesis, timeoutMs = 1500) => {
  const getTurkishVoices = () =>
    (speechSynthesis.getVoices?.() || []).filter(isTurkishVoice);
  const initialVoices = getTurkishVoices();
  if (initialVoices.length) return initialVoices;

  await new Promise((resolve) => {
    let timeout;
    const previousHandler = speechSynthesis.onvoiceschanged;
    const finish = () => {
      clearTimeout(timeout);
      speechSynthesis.removeEventListener?.("voiceschanged", checkVoices);
      if (!speechSynthesis.removeEventListener && speechSynthesis.onvoiceschanged === handleVoicesChanged) {
        speechSynthesis.onvoiceschanged = previousHandler || null;
      }
      resolve();
    };
    const checkVoices = () => {
      if (getTurkishVoices().length) finish();
    };
    const handleVoicesChanged = (event) => {
      previousHandler?.call(speechSynthesis, event);
      checkVoices();
    };
    timeout = setTimeout(finish, timeoutMs);
    if (speechSynthesis.addEventListener) {
      speechSynthesis.addEventListener("voiceschanged", checkVoices);
    } else {
      speechSynthesis.onvoiceschanged = handleVoicesChanged;
    }
    checkVoices();
  });
  return getTurkishVoices();
};

export const speakTurkishText = async (text, browser = globalThis.window, handlers = {}) => {
  if (!browser?.speechSynthesis || !browser?.SpeechSynthesisUtterance) {
    throw new Error("Bu tarayıcı sesli yanıtları desteklemiyor.");
  }
  if (typeof text !== "string" || !text.trim()) {
    throw new Error("Seslendirilecek bir AI yanıtı bulunmuyor.");
  }
  const voices = await waitForTurkishSpeechVoices(browser.speechSynthesis);
  const voice = selectTurkishSpeechVoice(voices);
  if (!voice) {
    throw new Error("Tarayıcıda Türkçe ses bulunamadı. Ses ayarlarını kontrol edin veya yanıtı okuyun.");
  }
  if (handlers.shouldSpeak && !handlers.shouldSpeak()) return null;
  const utterance = new browser.SpeechSynthesisUtterance(text.trim());
  utterance.lang = "tr-TR";
  utterance.rate = 0.95;
  utterance.pitch = 1;
  utterance.volume = 1;
  utterance.voice = voice;
  utterance.onstart = handlers.onstart || null;
  utterance.onend = handlers.onend || null;
  utterance.onerror = handlers.onerror || null;
  browser.speechSynthesis.speak(utterance);
  return utterance;
};
