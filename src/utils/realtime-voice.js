const INPUT_SAMPLE_RATE = 16_000;
const DEFAULT_OUTPUT_SAMPLE_RATE = 24_000;
const VOICE_RESOURCE_NAMES = {
  projects: "Proje kayıtları",
  customers: "CRM kayıtları",
  products: "Ürün kataloğu",
  systems: "Sistem kataloğu",
  "price-analysis": "Doğrulanmış fiyat kayıtları",
  "material-analysis": "Doğrulanmış malzeme kayıtları",
  procurement: "Tedarik kayıtları",
  offers: "Teklif kayıtları",
  reports: "Rapor kayıtları",
  calendar: "Takvim kayıtları",
  integrations: "Entegrasyon durumu",
  research: "Web araştırması",
};

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
    onOperation = () => {},
    onInterrupted = () => {},
    onError = () => {},
    executeTool = async () => { throw new Error("Sesli işlem araçları kullanılamıyor."); },
    browser = globalThis.window,
  }) {
    this.createSession = createSession;
    this.context = context;
    this.history = history;
    this.onState = onState;
    this.onTranscript = onTranscript;
    this.onOperation = onOperation;
    this.onInterrupted = onInterrupted;
    this.onError = onError;
    this.executeTool = executeTool;
    this.browser = browser;
    this.socket = null;
    this.stream = null;
    this.audioContext = null;
    this.outputAnalyser = null;
    this.outputAnalysisBuffer = null;
    this.processor = null;
    this.sources = new Set();
    this.nextPlaybackTime = 0;
    this.inputTranscript = "";
    this.outputTranscript = "";
    this.toolCalls = new Map();
    this.scheduledToolCallIds = new Set();
    this.pendingOperations = new Map();
    this.reconnectAttempts = 0;
    this.reconnecting = false;
    this.connectionGeneration = 0;
    this.pendingClientMessages = [];
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
      if (typeof this.audioContext.createAnalyser === "function") {
        this.outputAnalyser = this.audioContext.createAnalyser();
        this.outputAnalyser.fftSize = 256;
        this.outputAnalysisBuffer = new Float32Array(this.outputAnalyser.fftSize);
        this.outputAnalyser.connect(this.audioContext.destination);
      }
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
      this.connectionGeneration += 1;
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
      this.socket.binaryType = "arraybuffer";
      this.socket.onopen = () => {
        this.socket.send(JSON.stringify({ setup: session.setup }));
      };
      let messageQueue = Promise.resolve();
      const handleMessage = async (event) => {
        if (this.intentionalClose) return;
        let data;
        try {
          const frame = event.data;
          const text = typeof frame === "string" ? frame
            : typeof frame?.text === "function" ? await frame.text()
              : new TextDecoder().decode(frame);
          data = JSON.parse(text);
          if (!data || typeof data !== "object" || Array.isArray(data)) {
            throw new Error("Invalid Live message envelope.");
          }
        } catch {
          console.error("Gemini Live message decoding failed:", {
            stage: "websocket_decode",
            frameType: typeof event.data === "string" ? "text" : "binary",
          });
          const error = new Error("Ses sağlayıcısından geçersiz yanıt alındı.");
          finish(error);
          this.fail(error);
          return;
        }
        if (this.intentionalClose) return;
        if (data.setupComplete) {
          try {
            if (!this.processor) this.startAudioInput();
            this.active = true;
            this.reconnecting = false;
            this.onState(this.reconnectAttempts ? "reconnected" : "listening");
            for (const text of this.pendingClientMessages.splice(0)) {
              this.sendText(text);
            }
            finish();
          } catch (error) {
            finish(error);
            this.fail(error);
          }
          return;
        }
        if (data.error) {
          console.error("Gemini Live provider rejected session:", {
            stage: "websocket_provider",
            providerCode: Number.isInteger(data.error.code) ? data.error.code : null,
          });
          const error = new Error("Sesli sohbet sağlayıcısı isteği tamamlayamadı.");
          finish(error);
          this.fail(error);
          return;
        }
        if (data.toolCall) this.handleToolCalls(data.toolCall);
        this.handleServerContent(data.serverContent);
      };
      // Blob decoding is asynchronous; preserve setup/audio/transcript frame order.
      this.socket.onmessage = (event) => {
        messageQueue = messageQueue.then(() => handleMessage(event)).catch(() => {
          const error = new Error("Sesli sohbet yanıtı işlenemedi.");
          finish(error);
          this.fail(error);
        });
        return messageQueue;
      };
      this.socket.onerror = () => {
        console.error("Gemini Live transport failed:", { stage: "websocket_transport" });
        const error = new Error("Sesli sohbet bağlantısı kurulamadı.");
        if (this.active) this.reconnect(error);
        else {
          finish(error);
          this.fail(error);
        }
      };
      this.socket.onclose = (event) => {
        if (this.intentionalClose) return;
        console.error("Gemini Live connection closed:", {
          stage: "websocket_close",
          closeCode: Number.isInteger(event?.code) ? event.code : null,
          wasClean: event?.wasClean === true,
        });
        const error = new Error("Sesli sohbet bağlantısı koptu. Yeniden bağlanmayı deneyin.");
        if (this.reconnecting) return;
        if (this.active) this.reconnect(error);
        else {
          finish(error);
          this.fail(error);
        }
      };
    });
  }

  reconnect(error) {
    if (this.intentionalClose || this.reconnecting) return;
    if (this.reconnectAttempts >= 1) {
      this.fail(error);
      return;
    }
    this.reconnecting = true;
    this.active = false;
    this.reconnectAttempts += 1;
    this.onState("reconnecting");
    const previousSocket = this.socket;
    this.socket = null;
    if (previousSocket && previousSocket.readyState < this.browser.WebSocket.CLOSING) {
      previousSocket.close();
    }
    Promise.resolve()
      .then(() => this.createSession({ context: this.context, history: this.history }))
      .then((session) => this.connect(session))
      .catch((reconnectError) => this.fail(reconnectError || error));
  }

  handleToolCalls(toolCall) {
    const receivedCalls = Array.isArray(toolCall?.functionCalls) ? toolCall.functionCalls : [];
    if (receivedCalls.some((call) =>
      typeof call?.id !== "string" || !call.id || typeof call?.name !== "string" || !call.name
    )) {
      this.fail(new Error("Sesli araç çağrısı geçersiz."));
      return;
    }
    const calls = receivedCalls
      .filter((call) => {
        if (typeof call?.id !== "string" || !call.id || this.scheduledToolCallIds.has(call.id)) {
          return false;
        }
        this.scheduledToolCallIds.add(call.id);
        return true;
      });
    if (!calls.length) return;
    const generation = this.connectionGeneration;
    Promise.all(calls.map((call) => this.executeFunctionCall(call)))
      .then((functionResponses) => {
        if (this.intentionalClose) return;
        if (this.reconnecting || generation !== this.connectionGeneration) {
          this.sendText(
            `Önceki ses bağlantısındaki DDPro araç sonucu: ${JSON.stringify(functionResponses)}. ` +
            "Bu, backend'den alınmış gerçek işlem sonucudur; doğal Türkçe ile kullanıcıya özetle."
          );
          return;
        }
        if (this.socket?.readyState !== this.browser.WebSocket.OPEN) return;
        this.socket.send(JSON.stringify({
          toolResponse: { functionResponses },
        }));
      })
      .catch(() => {
        const error = new Error("Sesli işlem yanıtı sağlayıcıya iletilemedi.");
        this.fail(error);
      });
  }

  executeFunctionCall(call) {
    const id = typeof call?.id === "string" ? call.id : "";
    const name = typeof call?.name === "string" ? call.name : "";
    if (!id || !name) {
      const error = new Error("Sesli araç çağrısı geçersiz.");
      this.fail(error);
      return Promise.resolve(null);
    }
    if (this.toolCalls.has(id)) return this.toolCalls.get(id);
    const args = call.args && typeof call.args === "object" && !Array.isArray(call.args)
      ? call.args
      : {};
    const promise = Promise.resolve()
      .then(async () => {
        const resource = typeof args.resource === "string"
          ? args.resource
          : name === "read_integration_status"
            ? "integrations"
            : name === "web_search"
              ? "research"
            : "";
        const resourceName = VOICE_RESOURCE_NAMES[resource] || "DDPro kayıtları";
        const request = name === "prepare_write"
          ? `${resourceName} ${({
            create: "oluşturma",
            update: "güncelleme",
            delete: "silme",
          })[args.operation] || "değişiklik"} talebi`
          : `${resourceName} sorgusu`;
        const operation = {
          id,
          request,
          tool: name,
          resource,
          status: "running",
          summary: "İstek backend aracı tarafından yürütülüyor.",
        };
        this.pendingOperations.set(id, operation);
        this.onOperation(operation);
        this.onState("tool_running");
        try {
          const result = await this.executeTool({ name, args });
          if (this.intentionalClose) {
            this.pendingOperations.delete(id);
            return { id, name, response: { status: "cancelled" } };
          }
          if (result?.type === "confirmation_required" && result.pendingAction) {
            this.pendingOperations.delete(id);
            const pendingAction = result.pendingAction;
            this.onOperation({
              ...operation,
              status: "awaiting_confirmation",
              summary: "İşlem hazırlanıp kullanıcı onayına sunuldu; henüz uygulanmadı.",
              pendingAction,
            });
            this.onState("tool_confirmation");
            return {
              id,
              name,
              response: {
                status: "awaiting_confirmation",
                summary: pendingAction.summary,
              },
            };
          }
          const records = result?.data;
          if (result?.type !== "records" || !Object.hasOwn(result, "data") ||
              (records !== null && typeof records !== "object") ||
              (Array.isArray(records) && records.some((record) =>
                !record || typeof record !== "object" || Array.isArray(record)
              ))) {
            throw new Error("Backend araç sonucu doğrulanamadı.");
          }
          const count = Array.isArray(records) ? records.length : records ? 1 : 0;
          this.pendingOperations.delete(id);
          this.onOperation({
            ...operation,
            status: "completed",
            summary: `${count} kayıt backend'den alındı.`,
            records,
            filters: args.filters || {},
          });
          this.onState("tool_completed");
          return { id, name, response: { data: records } };
        } catch (error) {
          this.pendingOperations.delete(id);
          if (this.intentionalClose) {
            return { id, name, response: { status: "cancelled" } };
          }
          const message = typeof error?.message === "string"
            ? error.message.slice(0, 300)
            : "İşlem tamamlanamadı.";
          this.onOperation({
            ...operation,
            status: "failed",
            summary: message,
          });
          this.onState("tool_failed");
          return { id, name, response: { error: message } };
        }
      });
    if (this.toolCalls.size >= 100) {
      this.toolCalls.delete(this.toolCalls.keys().next().value);
    }
    this.toolCalls.set(id, promise);
    return promise;
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
      this.onInterrupted();
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

  sendText(text) {
    if (typeof text !== "string" || !text.trim() || this.intentionalClose) return false;
    if (this.reconnecting) {
      this.pendingClientMessages.push(text.trim());
      return true;
    }
    if (this.socket?.readyState !== this.browser.WebSocket.OPEN) return false;
    this.socket.send(JSON.stringify({
      clientContent: {
        turns: [{ role: "user", parts: [{ text: text.trim() }] }],
        turnComplete: true,
      },
    }));
    return true;
  }

  playAudio(data, sampleRate) {
    const samples = pcm16ToFloat32(data);
    if (!samples.length || !this.audioContext) return;
    const buffer = this.audioContext.createBuffer(1, samples.length, sampleRate);
    buffer.copyToChannel(samples, 0);
    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.outputAnalyser || this.audioContext.destination);
    const now = this.audioContext.currentTime;
    this.nextPlaybackTime = Math.max(now, this.nextPlaybackTime);
    source.start(this.nextPlaybackTime);
    this.nextPlaybackTime += buffer.duration;
    this.sources.add(source);
    source.onended = () => this.sources.delete(source);
  }

  getOutputLevel() {
    if (!this.sources.size || !this.outputAnalyser || !this.outputAnalysisBuffer) return 0;
    this.outputAnalyser.getFloatTimeDomainData(this.outputAnalysisBuffer);
    let sum = 0;
    for (const sample of this.outputAnalysisBuffer) sum += sample * sample;
    return Math.sqrt(sum / this.outputAnalysisBuffer.length);
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
    this.pendingClientMessages = [];
    this.reportUnverifiedOperations();
    this.releaseResources();
    this.onState("error");
    if (error) this.onError(error);
  }

  stop() {
    this.intentionalClose = true;
    this.active = false;
    this.pendingClientMessages = [];
    this.reportUnverifiedOperations();
    this.releaseResources();
    this.onState("idle");
  }

  reportUnverifiedOperations() {
    for (const operation of this.pendingOperations.values()) {
      this.onOperation({
        ...operation,
        status: "unverified",
        summary: "Sesli oturum kapandı; backend işlem sonucu doğrulanamadı.",
      });
    }
    this.pendingOperations.clear();
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
    this.outputAnalyser?.disconnect();
    this.outputAnalyser = null;
    this.outputAnalysisBuffer = null;
    this.stream = null;
    this.socket = null;
    this.audioContext = null;
    this.toolCalls.clear();
    this.scheduledToolCallIds.clear();
  }
}
