const INPUT_SAMPLE_RATE = 16_000;
const DEFAULT_OUTPUT_SAMPLE_RATE = 24_000;

export const resampleToPcm16 = (samples, inputSampleRate) => {
  const ratio = inputSampleRate / INPUT_SAMPLE_RATE;
  const outputLength = Math.floor(samples.length / ratio);
  const pcm = new Int16Array(outputLength);
  for (let index = 0; index < outputLength; index += 1) {
    const start = Math.floor(index * ratio);
    const end = Math.min(samples.length, Math.floor((index + 1) * ratio));
    let sum = 0;
    for (let sampleIndex = start; sampleIndex < end; sampleIndex += 1) {
      sum += samples[sampleIndex];
    }
    const sample = end > start ? sum / (end - start) : 0;
    pcm[index] = Math.round(Math.max(-1, Math.min(1, sample)) * (sample < 0 ? 0x8000 : 0x7fff));
  }
  return pcm;
};

export const pcm16ToFloat32 = (data) => {
  const bytes = Uint8Array.from(atob(data), (character) => character.charCodeAt(0));
  if (bytes.byteLength % 2 !== 0) throw new Error("Invalid realtime audio data.");
  const pcm = new Int16Array(bytes.buffer);
  return Float32Array.from(pcm, (sample) => sample / (sample < 0 ? 0x8000 : 0x7fff));
};

const encodePcm16 = (pcm) => {
  const bytes = new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
};

export class RealtimeVoiceSession {
  constructor({
    createSession,
    context,
    history,
    onState = () => {},
    onTranscript = () => {},
    onError = () => {},
    browser = globalThis.window,
  }) {
    this.createSession = createSession;
    this.context = context;
    this.history = history;
    this.onState = onState;
    this.onTranscript = onTranscript;
    this.onError = onError;
    this.browser = browser;
    this.socket = null;
    this.stream = null;
    this.audioContext = null;
    this.processor = null;
    this.sources = new Set();
    this.nextPlaybackTime = 0;
    this.inputTranscript = "";
    this.outputTranscript = "";
    this.intentionalClose = false;
    this.active = false;
  }

  async start() {
    if (!this.browser?.isSecureContext) {
      throw new Error("Mikrofon erişimi için güvenli HTTPS bağlantısı gerekir.");
    }
    if (!this.browser?.navigator?.mediaDevices?.getUserMedia ||
        !this.browser?.WebSocket ||
        !this.browser?.AudioContext) {
      throw new Error("Bu tarayıcı gerçek zamanlı sesli sohbeti desteklemiyor.");
    }
    this.onState("starting");
    try {
      this.stream = await this.browser.navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      this.audioContext = new this.browser.AudioContext();
      await this.audioContext.resume();
      const session = await this.createSession({
        context: this.context,
        history: this.history,
      });
      if (!session?.token || !session?.websocketUrl || !session?.setup) {
        throw new Error("Sesli oturum yapılandırması alınamadı.");
      }
      await this.connect(session);
    } catch (error) {
      this.stop();
      this.onState("error");
      throw error;
    }
  }

  connect(session) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const timeout = this.browser.setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(new Error("Ses sağlayıcısına zamanında bağlanılamadı."));
        this.fail();
      }, 15_000);
      const finish = (error) => {
        if (settled) return;
        settled = true;
        this.browser.clearTimeout(timeout);
        if (error) reject(error);
        else resolve();
      };
      const url = `${session.websocketUrl}?access_token=${encodeURIComponent(session.token)}`;
      this.socket = new this.browser.WebSocket(url);
      this.socket.onopen = () => {
        this.socket.send(JSON.stringify({ setup: session.setup }));
      };
      this.socket.onmessage = (event) => {
        let data;
        try {
          data = JSON.parse(event.data);
        } catch {
          this.fail(new Error("Ses sağlayıcısından geçersiz yanıt alındı."));
          finish(new Error("Ses sağlayıcısından geçersiz yanıt alındı."));
          return;
        }
        if (data.setupComplete) {
          try {
            this.startAudioInput();
            this.active = true;
            this.onState("listening");
            finish();
          } catch (error) {
            finish(error);
            this.fail(error);
          }
          return;
        }
        if (data.error) {
          const error = new Error("Sesli sohbet sağlayıcısı isteği tamamlayamadı.");
          finish(error);
          this.fail(error);
          return;
        }
        this.handleServerContent(data.serverContent);
      };
      this.socket.onerror = () => {
        const error = new Error("Sesli sohbet bağlantısı kurulamadı.");
        finish(error);
        this.fail(error);
      };
      this.socket.onclose = () => {
        if (this.intentionalClose) return;
        const error = new Error("Sesli sohbet bağlantısı koptu. Yeniden bağlanmayı deneyin.");
        finish(error);
        this.fail(error);
      };
    });
  }

  startAudioInput() {
    const source = this.audioContext.createMediaStreamSource(this.stream);
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
    const silentOutput = this.audioContext.createGain();
    silentOutput.gain.value = 0;
    this.processor.onaudioprocess = (event) => {
      if (!this.active || this.socket?.readyState !== this.browser.WebSocket.OPEN) return;
      const pcm = resampleToPcm16(event.inputBuffer.getChannelData(0), this.audioContext.sampleRate);
      if (!pcm.length) return;
      this.socket.send(JSON.stringify({
        realtimeInput: {
          audio: {
            mimeType: `audio/pcm;rate=${INPUT_SAMPLE_RATE}`,
            data: encodePcm16(pcm),
          },
        },
      }));
    };
    source.connect(this.processor);
    this.processor.connect(silentOutput);
    silentOutput.connect(this.audioContext.destination);
    this.inputSource = source;
    this.silentOutput = silentOutput;
  }

  handleServerContent(content) {
    if (!content) return;
    if (content.interrupted) {
      this.stopPlayback();
      this.nextPlaybackTime = 0;
      this.onState("listening");
    }
    if (content.inputTranscription?.text) {
      this.inputTranscript += content.inputTranscription.text;
      this.onState("transcribing");
    }
    if (content.outputTranscription?.text) {
      this.outputTranscript += content.outputTranscription.text;
      this.onState("speaking");
    }
    for (const part of content.modelTurn?.parts || []) {
      const audio = part.inlineData;
      if (!audio?.data || !audio.mimeType?.startsWith("audio/pcm")) continue;
      try {
        this.playAudio(audio.data, Number(audio.mimeType.match(/rate=(\d+)/)?.[1]) ||
          DEFAULT_OUTPUT_SAMPLE_RATE);
      } catch {
        this.fail(new Error("Asistanın ses yanıtı oynatılamadı."));
        return;
      }
    }
    if (content.turnComplete) {
      if (this.inputTranscript.trim()) {
        this.onTranscript("user", this.inputTranscript.trim());
      }
      if (this.outputTranscript.trim()) {
        this.onTranscript("assistant", this.outputTranscript.trim());
      }
      this.inputTranscript = "";
      this.outputTranscript = "";
      if (this.active) this.onState("listening");
    }
  }

  playAudio(data, sampleRate) {
    const samples = pcm16ToFloat32(data);
    if (!samples.length || !this.audioContext) return;
    const buffer = this.audioContext.createBuffer(1, samples.length, sampleRate);
    buffer.copyToChannel(samples, 0);
    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.audioContext.destination);
    const now = this.audioContext.currentTime;
    this.nextPlaybackTime = Math.max(now, this.nextPlaybackTime);
    source.start(this.nextPlaybackTime);
    this.nextPlaybackTime += buffer.duration;
    this.sources.add(source);
    source.onended = () => this.sources.delete(source);
  }

  stopPlayback() {
    for (const source of this.sources) {
      try {
        source.stop();
      } catch {
        // The source may have already ended.
      }
    }
    this.sources.clear();
  }

  fail(error = null) {
    if (this.intentionalClose) return;
    this.intentionalClose = true;
    this.active = false;
    this.releaseResources();
    this.onState("error");
    if (error) this.onError(error);
  }

  stop() {
    this.intentionalClose = true;
    this.active = false;
    this.releaseResources();
    this.onState("idle");
  }

  releaseResources() {
    this.stopPlayback();
    this.processor?.disconnect();
    this.inputSource?.disconnect();
    this.silentOutput?.disconnect();
    this.stream?.getTracks().forEach((track) => track.stop());
    if (this.socket && this.socket.readyState < this.browser.WebSocket.CLOSING) {
      this.socket.close();
    }
    if (this.audioContext && this.audioContext.state !== "closed") {
      this.audioContext.close().catch(() => {});
    }
    this.processor = null;
    this.inputSource = null;
    this.silentOutput = null;
    this.stream = null;
    this.socket = null;
    this.audioContext = null;
  }
}
