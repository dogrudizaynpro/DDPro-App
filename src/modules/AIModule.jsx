import { useEffect, useRef, useState } from "react";
import { RealtimeVoiceSession } from "../utils/realtime-voice.js";
import aiTradeDesignReference from "../assets/DDPro-AI-Trade-Referans.png";
import aiCharacterFront from "../assets/ddpro-ai-character-front.png";
import aiCharacterBack from "../assets/ddpro-ai-character-back.png";
import {
  createAiVoiceSession,
  executeAiVoiceTool,
  getAiProviderStatus,
} from "../services/ai.service.js";

const MODULE_TITLES = {
  projects: "Projeler",
  offers: "Teklifler",
  procurement: "Tedarik & Araştırma",
  calendar: "Takvim",
  crm: "Müşteriler / CRM",
  reports: "Raporlar",
  "price-analysis": "Fiyat Analizi",
};

const ORCHESTRATION_LABELS = {
  awaiting_confirmation: "Kullanıcı onayı bekleniyor",
  completed: "Tamamlandı",
  completed_with_errors: "Bazı veri adımları tamamlanamadı",
  incomplete: "Bazı uzman adımları çalıştırılmadı",
  failed: "Tamamlanamadı",
  not_invoked: "Çalıştırılmadı",
  unverified: "Sonuç doğrulanamadı",
};

const ORCHESTRATION_RESOURCES = {
  projects: "Projeler",
  customers: "Müşteri kayıtları",
  products: "Ürünler",
  systems: "Sistemler",
  "price-analysis": "Fiyat kayıtları",
  "material-analysis": "Malzeme kayıtları",
  offers: "Teklifler",
  procurement: "Tedarik kayıtları",
  reports: "Raporlar",
  calendar: "Takvim",
};

const ORCHESTRATION_OPERATIONS = {
  read_records: "kayıtlar sorgulandı",
  create: "oluşturma taslağı hazırlandı",
  update: "güncelleme taslağı hazırlandı",
  delete: "silme taslağı hazırlandı",
  web_search: "web araştırması yapıldı",
  ddpro_site_search: "DDPro sitesi araştırıldı",
};

const getOrchestrationStepLabel = (step) => {
  const resource = ORCHESTRATION_RESOURCES[step.resource] || "Araştırma";
  const operation = ORCHESTRATION_OPERATIONS[step.operation] || "işlem";
  const status = ORCHESTRATION_LABELS[step.status] || "durum bilinmiyor";
  const count = Number.isInteger(step.resultCount) ? ` · ${step.resultCount} sonuç` : "";
  return `${resource}: ${operation} · ${status}${count}`;
};

const capabilities = [
  {
    icon: "▣",
    title: "Proje & süreç",
    prompt: "Aktif projelerimi ve süreçlerimi gözden geçir, öncelikli adımları öner.",
    moduleId: "projects",
  },
  {
    icon: "◈",
    title: "Analiz & raporlama",
    prompt: "Operasyonel durumumu analiz et ve yönetim raporu taslağı hazırla.",
    moduleId: "reports",
  },
  {
    icon: "⌕",
    title: "Tedarik araştırması",
    prompt: "Bir tedarik araştırması için değerlendirme kriterleri öner.",
    moduleId: "procurement",
  },
  {
    icon: "▤",
    title: "Teklif yönetimi",
    prompt: "Tekliflerimi karşılaştırmak için bir değerlendirme ve kontrol listesi hazırla.",
    moduleId: "offers",
  },
  {
    icon: "✦",
    title: "Karar desteği",
    prompt: "Mevcut seçenekleri risk, etki ve öncelik açısından değerlendirmek için bir karar çerçevesi oluştur.",
    moduleId: "ai-assistant",
  },
];

const aiTradeRoles = [
  {
    className: "ai-role-hotspot-assistant",
    label: "AI Asistan çalışma alanını aç",
    prompt: "Bir DDPro AI Asistan olarak bana proje ve operasyonlarımda yardımcı ol.",
  },
  {
    className: "ai-role-hotspot-partner",
    label: "AI Partner çalışma alanını aç",
    prompt: "Bir DDPro AI Partner olarak aktif proje ve süreçlerimde benimle birlikte çalış.",
  },
  {
    className: "ai-role-hotspot-manager",
    label: "AI Yönetici karar desteğini aç",
    prompt: "Bir DDPro AI Yönetici olarak mevcut işlerimi önceliklendir ve karar desteği sun.",
  },
];

export const renderVoiceProjectRecords = (operation) => {
  if (operation.tool !== "read_records" || operation.resource !== "projects" ||
      operation.status !== "completed") return null;
  const records = Array.isArray(operation.records)
    ? operation.records
    : operation.records ? [operation.records] : [];
  const saveRecords = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(records, null, 2)], {
      type: "application/json",
    }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "ddpro-proje-kayitlari.json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
  };
  return (
    <div className="ai-action-confirmation">
      <small>Kaynak: yetkili backend · read_records · projects · Çağrı: {operation.id}</small>
      {records.length ? (
        <ul aria-label="Backend proje kayıtları">
          {records.map((record, index) => (
            <li key={record.id || index}>
              <strong>{record.name || "Proje adı belirtilmemiş"}</strong>
              <span>Durum: {record.status || "Belirtilmemiş"}</span>
              <small>Kayıt kimliği: {record.id || "Belirtilmemiş"}</small>
            </li>
          ))}
        </ul>
      ) : <p>Bu sorguda proje kaydı bulunamadı.</p>}
      <small>Bu sorgunun sonucu gösteriliyor; araç en fazla 50 kayıt döndürür.</small>
      <details className="ai-action-preview">
        <summary>Gerçek araç sonucunu incele</summary>
        <pre>{JSON.stringify({ filters: operation.filters, data: operation.records }, null, 2)}</pre>
      </details>
      <button className="ai-module-suggestion" type="button" onClick={saveRecords}>
        Proje listesini kaydet (JSON)
      </button>
    </div>
  );
};

function AudioWaveform({ sessionRef, active, microphoneActive }) {
  const barsRef = useRef([]);
  const barWeights = [0.42, 0.62, 0.82, 1, 0.7, 0.92, 0.58, 0.76, 0.48, 0.88, 0.56, 0.72, 0.4];

  useEffect(() => {
    if (!active) {
      barsRef.current.forEach((bar) => {
        if (bar) bar.style.transform = "scaleY(0.08)";
      });
      return undefined;
    }

    let frameId;
    const updateWaveform = () => {
      const level = Math.min(1, (sessionRef.current?.getOutputLevel() || 0) * 5);
      barsRef.current.forEach((bar, index) => {
        if (bar) bar.style.transform = `scaleY(${0.08 + level * barWeights[index]})`;
      });
      frameId = window.requestAnimationFrame(updateWaveform);
    };

    frameId = window.requestAnimationFrame(updateWaveform);
    return () => {
      window.cancelAnimationFrame(frameId);
      barsRef.current.forEach((bar) => {
        if (bar) bar.style.transform = "scaleY(0.08)";
      });
    };
  }, [active, sessionRef]);

  return (
    <div
      className={`ai-audio-visualizer${active ? " is-active" : ""}`}
      role="group"
      aria-label="Asistan ses seviyesi"
    >
      <span className="ai-audio-visualizer-label">DDPRO AI TRADE <span>·</span> SES AKIŞI</span>
      <div className="ai-audio-waveform" aria-hidden="true">
        {barWeights.map((_, index) => (
          <span
            className="ai-audio-waveform-bar"
            key={index}
            ref={(element) => { barsRef.current[index] = element; }}
          />
        ))}
      </div>
      <span className={`ai-audio-input-indicator${microphoneActive ? " is-active" : ""}`}>
        {microphoneActive ? "Mikrofon algılıyor" : active ? "Dinleme açık" : "Beklemede"}
      </span>
    </div>
  );
}

function AIModule({
  aiMessages,
  sendAiMessage,
  onVoiceMessage,
  voiceContext = {},
  aiInput,
  setAiInput,
  aiAttachment,
  setAiAttachment,
  onNavigate,
  messagesOnly = false,
  aiSending = false,
  onConfirmAction,
  onConfirmVoiceAction,
  onConfirmProjectImport,
  onRetryProjectImportPreview,
}) {
  const promptFieldRef = useRef(null);
  const fileInputRef = useRef(null);
  const [fileError, setFileError] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const [providerStatus, setProviderStatus] = useState("checking");
  const [voiceListening, setVoiceListening] = useState(false);
  const [voiceSpeaking, setVoiceSpeaking] = useState(false);
  const [voicePhase, setVoicePhase] = useState("idle");
  const [voiceProviderConfigured, setVoiceProviderConfigured] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState("Gerçek zamanlı Türkçe sesli sohbet için sunucu sağlayıcı yapılandırması gerekir.");
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [voiceError, setVoiceError] = useState("");
  const [voiceOperations, setVoiceOperations] = useState([]);
  const voiceSessionRef = useRef(null);
  const voiceConfirmationsRef = useRef(new Set());
  const allowedFileExtensions = new Set(["png", "jpg", "jpeg", "webp", "xlsx", "csv", "pdf", "docx", "txt"]);
  const maxFileSize = 10 * 1024 * 1024;
  const isImageAttachment = (file) =>
    file && ["png", "jpg", "jpeg", "webp"].includes(file.name.split(".").pop()?.toLowerCase());

  useEffect(() => {
    if (!isImageAttachment(aiAttachment)) {
      setPreviewUrl("");
      return undefined;
    }
    const url = URL.createObjectURL(aiAttachment);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [aiAttachment]);

  useEffect(() => {
    let active = true;
    getAiProviderStatus()
      .then((status) => {
        if (active) setProviderStatus(status.configured ? "configured" : "unconfigured");
        if (active) {
          setVoiceProviderConfigured(Boolean(status.realtimeVoiceConfigured));
          setVoiceStatus(status.realtimeVoiceConfigured
            ? "Gerçek zamanlı Türkçe sesli sohbet hazır."
            : "Sesli sohbet için backend ortamında GEMINI_API_KEY ve GEMINI_LIVE_MODEL gerekir.");
        }
      })
      .catch(() => {
        if (active) setProviderStatus("unavailable");
      });
    return () => {
      active = false;
    };
  }, []);

  const stopRealtimeVoice = () => {
    voiceSessionRef.current?.stop();
    voiceSessionRef.current = null;
    setVoiceListening(false);
    setVoiceSpeaking(false);
    setVoicePhase("idle");
    setVoiceStatus("Sesli sohbet durduruldu; mikrofon kapatıldı.");
  };

  const updateVoiceOperation = (operation) => {
    setVoiceOperations((current) => {
      const existing = current.findIndex((item) => item.id === operation.id);
      if (existing < 0) return [...current, operation].slice(-10);
      return current.map((item, index) => index === existing ? operation : item);
    });
  };

  const confirmVoiceOperation = async (operation) => {
    const confirmationId = operation.pendingAction?.id;
    if (!confirmationId || voiceConfirmationsRef.current.has(confirmationId)) return;
    voiceConfirmationsRef.current.add(confirmationId);
    updateVoiceOperation({
      ...operation,
      status: "executing",
      summary: "Onaylanan işlem backend'de yürütülüyor.",
    });
    try {
      if (typeof onConfirmVoiceAction !== "function") {
        throw new Error("İşlem onayı şu anda kullanılamıyor.");
      }
      const result = await onConfirmVoiceAction(confirmationId);
      updateVoiceOperation({
        ...operation,
        status: "completed",
        summary: "İşlem backend tarafından tamamlandı ve sonucu doğrulandı.",
        pendingAction: null,
      });
      voiceSessionRef.current?.sendText(
        `Kullanıcı onayını verdi. Backend işlem sonucu: ${JSON.stringify(result)}. ` +
        "Yalnızca bu gerçek sonucu kısa ve doğal Türkçe ile sesli olarak bildir."
      );
    } catch (error) {
      const summary = error?.code === "AI_OPERATION_AUDIT_UNAVAILABLE"
        ? "İşlem sonucu doğrulanamadı. Hedef kayıt tekrar denenmeden önce kontrol edilmeli."
        : `İşlem tamamlanamadı; değişiklik yapıldığı doğrulanmadı. ${error?.message || ""}`.trim();
      updateVoiceOperation({
        ...operation,
        status: "failed",
        summary,
        pendingAction: null,
      });
      voiceSessionRef.current?.sendText(
        `Onaylanan işlem başarısız oldu veya sonucu doğrulanamadı: ${summary}. ` +
        "Başarılı olduğunu söyleme; bunu kullanıcıya kısa Türkçe ile bildir."
      );
    } finally {
      voiceConfirmationsRef.current.delete(confirmationId);
    }
  };

  const toggleRealtimeVoice = async () => {
    if (voiceSessionRef.current) {
      stopRealtimeVoice();
      return;
    }
    if (aiSending) return;
    if (!voiceProviderConfigured) {
      setVoicePhase("error");
      setVoiceStatus("Gerçek zamanlı ses sağlayıcısı yapılandırılmadı.");
      setVoiceError("Backend ortamında GEMINI_API_KEY ve GEMINI_LIVE_MODEL ayarlanmalıdır.");
      return;
    }

    setVoiceError("");
    setVoiceTranscript("");
    const history = aiMessages
      .filter((message) =>
        ["user", "assistant"].includes(message.role) &&
        typeof message.text === "string" &&
        message.status !== "unavailable"
      )
      .slice(-12)
      .map(({ role, text }) => ({ role, text: text.slice(0, 2_000) }));
    const session = new RealtimeVoiceSession({
      createSession: createAiVoiceSession,
      context: voiceContext,
      history,
      onState: (phase) => {
        setVoicePhase(phase);
        setVoiceListening([
          "starting", "listening", "transcribing", "speaking", "tool_running",
          "reconnecting", "reconnected",
          "tool_completed", "tool_failed", "tool_confirmation",
        ].includes(phase));
        setVoiceSpeaking(phase === "speaking");
        if (phase === "starting") setVoiceStatus("Mikrofon izni ve güvenli ses bağlantısı bekleniyor…");
        if (phase === "listening") setVoiceStatus("Canlı bağlantı açık. Konuşabilirsiniz; asistan sözünüzü kesebilir.");
        if (phase === "transcribing") setVoiceStatus("Konuşmanız gerçek zamanlı işleniyor…");
        if (phase === "speaking") setVoiceStatus("DDPro AI sesli yanıt veriyor. Araya girmek için konuşun.");
        if (phase === "tool_running") setVoiceStatus("İstek analiz edildi. Yetkili DDPro aracı backend'de çalışıyor…");
        if (phase === "tool_completed") setVoiceStatus("Gerçek backend sonucu alındı ve ekranda gösteriliyor.");
        if (phase === "tool_failed") setVoiceStatus("Backend sorgusu başarısız; kayıtlar doğrulanamadı.");
        if (phase === "tool_confirmation") setVoiceStatus("Değişiklik önerisi hazır; açık onayınız bekleniyor.");
        if (phase === "reconnecting") setVoiceStatus("Ses bağlantısı koptu; sınırlı sayıda yeniden bağlanma deneniyor…");
        if (phase === "reconnected") setVoiceStatus("Ses bağlantısı yeniden kuruldu. Devam edebilirsiniz.");
        if (phase === "error") setVoiceListening(false);
      },
      onTranscript: (role, text) => {
        setVoiceTranscript(role === "user" ? text : "");
        onVoiceMessage?.(role, text);
      },
      executeTool: executeAiVoiceTool,
      onOperation: updateVoiceOperation,
      onInterrupted: () => {
        setVoiceSpeaking(false);
      },
      onError: (error) => {
        if (voiceSessionRef.current === session) voiceSessionRef.current = null;
        setVoiceError(error.message);
      },
    });
    voiceSessionRef.current = session;
    try {
      await session.start();
    } catch (error) {
      if (voiceSessionRef.current === session) voiceSessionRef.current = null;
      setVoiceListening(false);
      setVoiceSpeaking(false);
      setVoicePhase("error");
      setVoiceStatus("Gerçek zamanlı sesli sohbet başlatılamadı.");
      const microphoneErrors = {
        NotAllowedError: "Mikrofon izni verilmedi. Tarayıcı izinlerinden mikrofon erişimine izin verin.",
        NotFoundError: "Kullanılabilir mikrofon bulunamadı.",
        NotReadableError: "Mikrofon başka bir uygulama tarafından kullanılıyor veya açılamıyor.",
        SecurityError: "Mikrofon erişimi güvenli bir HTTPS bağlantısı gerektirir.",
        TimeoutError: "Ses sağlayıcısına bağlanma zaman aşımına uğradı.",
      };
      setVoiceError(microphoneErrors[error.name] || error.message || "Ses oturumu başlatılamadı.");
    }
  };

  useEffect(() => () => {
    voiceSessionRef.current?.stop();
    voiceSessionRef.current = null;
  }, []);

  const activateRole = (prompt) => {
    setAiInput(prompt);
    window.requestAnimationFrame(() => {
      const promptField = promptFieldRef.current;
      promptField?.scrollIntoView({ behavior: "smooth", block: "center" });
      promptField?.focus({ preventScroll: true });
    });
  };

  const selectCapability = (capability) => {
    if (capability.moduleId === "ai-assistant") {
      activateRole(capability.prompt);
      return;
    }
    onNavigate(capability.moduleId);
  };

  const addAttachment = (file) => {
    setFileError("");
    if (!file) return;
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (!allowedFileExtensions.has(extension)) {
      setFileError("Desteklenmeyen dosya türü. PNG, JPG, WebP, XLSX, CSV, PDF, DOCX veya TXT seçin.");
      return;
    }
    if (file.size < 1 || file.size > maxFileSize) {
      setFileError("Dosya 1 bayt ile 10 MB arasında olmalıdır.");
      return;
    }
    setAiAttachment(file);
  };

  return (
    <div className={`module-page ai-module${messagesOnly ? " ai-messages-module" : ""}`}>
      {!messagesOnly ? (
        <section className="ai-trade-master-reference" aria-label="DDPro AI TRADE ana tasarım referansı">
          <img
            className="ai-trade-master-image"
            src={aiTradeDesignReference}
            alt="DDPro AI TRADE'in kadın karakteri, marka dili ve merkezi teknik kompozisyonunu içeren ana referans"
          />
          <img className="ai-character-crop ai-character-front" src={aiCharacterFront} alt="" aria-hidden="true" />
          <img className="ai-character-crop ai-character-back" src={aiCharacterBack} alt="" aria-hidden="true" />
          <div className="ai-trade-role-hotspots" role="group" aria-label="AI TRADE rollerini başlat">
            {aiTradeRoles.map((role) => (
              <button
                className={`ai-trade-role-hotspot ${role.className}`}
                key={role.className}
                type="button"
                aria-label={role.label}
                onClick={() => activateRole(role.prompt)}
              />
            ))}
          </div>
        </section>
      ) : null}
      <AudioWaveform
        sessionRef={voiceSessionRef}
        active={voiceListening}
        microphoneActive={voicePhase === "transcribing"}
      />

      <div className={`ai-workspace${messagesOnly ? " ai-messages-workspace" : ""}`}>
        {!messagesOnly ? (
          <aside className="ai-capabilities">
            <div className="ai-section-heading">
              <span>DDPRO AI TRADE</span>
              <h3>Yetenekler</h3>
            </div>
            <div className="ai-capability-list">
              {capabilities.map((capability) => (
                <button
                  className="ai-capability"
                  key={capability.title}
                  type="button"
                  onClick={() => selectCapability(capability)}
                >
                  <span className="ai-capability-icon" aria-hidden="true">{capability.icon}</span>
                  <span>
                    <strong>{capability.title}</strong>
                    <small>Çalışma başlat <span aria-hidden="true">↗</span></small>
                  </span>
                </button>
              ))}
            </div>
            <div className="ai-specification">
              <span>ÇALIŞMA DURUMU</span>
              <strong><i aria-hidden="true" /> {providerStatus === "configured" ? "AI sağlayıcısı yapılandırıldı" : providerStatus === "checking" ? "AI sağlayıcısı kontrol ediliyor" : "AI sağlayıcısı bağlı değil"}</strong>
              <p>{providerStatus === "configured" ? "Yapılandırma, başarılı yanıt garantisi değildir. Yanıtlar sunucu tarafındaki AI sağlayıcısından istenir." : "Gerçek yanıt için backend AI_API_URL, AI_API_KEY ve AI_MODEL değişkenleri gerekir. İstek başarısız olursa yanıt uydurulmaz."}</p>
            </div>
          </aside>
        ) : null}

        <section className="ai-conversation-panel">
          <div className="ai-conversation-header">
            <div>
              <span className="ai-eyebrow">{messagesOnly ? "YEREL MESAJ AKIŞI" : "AKILLI ÇALIŞMA ALANI"}</span>
              <h3>{messagesOnly ? "Mesajlar" : "AI Asistan / Partner"}</h3>
            </div>
            <span className="ai-session-badge"><i aria-hidden="true" /> YEREL OTURUM</span>
          </div>
          <div className="ai-chat" aria-live="polite">
            {aiMessages.map((message) => (
              <div
                key={message.id}
                className={`ai-message ${message.role}`}
              >
                <strong>
                  {message.role === "assistant"
                    ? (message.status === "unavailable" ? "DDPro AI · Yanıt alınamadı" : "DDPro AI")
                    : "Sen"}
                </strong>
                <p>{message.text}</p>
                {message.orchestration ? (
                  <section className="ai-orchestration-summary" aria-label="İşlem özeti">
                    <strong>
                      İşlem durumu: {ORCHESTRATION_LABELS[message.orchestration.status] || "Durum bilinmiyor"}
                    </strong>
                    {message.orchestration.agents?.length ? (
                      <ul>
                        {message.orchestration.agents.map((agent) => (
                          <li key={agent.id}>
                            {agent.name}: {ORCHESTRATION_LABELS[agent.status] || "Durum bilinmiyor"}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {message.orchestration.steps?.length ? (
                      <ul aria-label="Gerçekleştirilen adımlar">
                        {message.orchestration.steps.map((step, index) => (
                          <li key={`${step.agentId || "operation"}-${step.operation}-${step.resource || "research"}-${index}`}>
                            {getOrchestrationStepLabel(step)}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </section>
                ) : null}
                {message.attachments?.map((attachment) => (
                  <div className="ai-message-attachment" key={attachment.name}>
                    <span aria-hidden="true">▧</span>
                    <span>{attachment.name}</span>
                    <small>{attachment.status}</small>
                  </div>
                ))}
                <small>{message.date}</small>
                {message.pendingAction ? (
                  <div className="ai-action-confirmation">
                    {message.pendingAction.preview ? (
                      <details className="ai-action-preview">
                        <summary>Önerilen kayıt değişikliğini incele</summary>
                        <pre>{JSON.stringify(message.pendingAction.preview, null, 2)}</pre>
                      </details>
                    ) : null}
                    <button
                      className="ai-module-suggestion"
                      type="button"
                      disabled={aiSending}
                      onClick={() => onConfirmAction?.(message.id, message.pendingAction.id)}
                    >
                      {aiSending ? "İşlem doğrulanıyor…" : message.pendingAction.summary}
                    </button>
                    <small>Onay bağlantısı 5 dakika geçerlidir ve yalnızca bir kez kullanılabilir.</small>
                  </div>
                ) : null}
                {message.projectImport ? (
                  <section className="ai-project-import">
                    <h4>Proje aktarım önizlemesi</h4>
                    <p>
                      {message.projectImport.records.length} satır · {message.projectImport.table.headers.length} alan.
                      Eksik alanlar boş bırakılır; hiçbir kayıt siz onaylamadan oluşturulmaz.
                    </p>
                    {message.projectImport.counts ? (
                      <div className="ai-project-import-results" aria-label="Aktarım önizleme grupları">
                        {[
                          ["transfer", "Aktarılacak", "Eşleşen ve yeni kayıtlar"],
                          ["duplicate", "Mükerrer olduğu için atlanacak", "Mevcut projeyle eşleşen kayıtlar"],
                          ["review", "Kontrol gerektiren", "Eksik alan veya eşleşmeyen ürün/sistem içeren kayıtlar"],
                        ].map(([classification, title, description]) => {
                          const records = message.projectImport.records.filter(
                            (record) => record.classification === classification
                          );
                          return (
                            <section key={classification}>
                              <strong>{title}: {message.projectImport.counts[classification]}</strong>
                              <p>{description}</p>
                              {records.length ? (
                                <ul>
                                  {records.map((record) => (
                                    <li key={record.row}>
                                      Satır {record.row}: {record.project?.name || "Proje adı yok"}
                                      {record.reasons?.length ? ` · ${record.reasons.join("; ")}` : ""}
                                    </li>
                                  ))}
                                </ul>
                              ) : null}
                            </section>
                          );
                        })}
                      </div>
                    ) : null}
                    {message.projectImport.previewError ? (
                      <div className="ai-project-import-results" role="alert">
                        <p>Mükerrer ve ürün/sistem eşleşmeleri doğrulanamadı: {message.projectImport.previewError}</p>
                        <button
                          className="ai-module-suggestion"
                          type="button"
                          disabled={aiSending}
                          onClick={() => onRetryProjectImportPreview?.(message.id, message.projectImport)}
                        >
                          {aiSending ? "Önizleme kontrol ediliyor…" : "Eşleşmeleri yeniden kontrol et"}
                        </button>
                      </div>
                    ) : null}
                    <details open>
                      <summary>{message.projectImport.table.name} dosya içeriğini ve eşlenen kayıtları incele</summary>
                      <div className="ai-project-import-table-wrap">
                        <table>
                          <thead>
                            <tr>
                              {message.projectImport.table.headers.map((header, index) => (
                                <th key={`${header}-${index}`}>{header || `Alan ${index + 1}`}</th>
                              ))}
                              <th>Aktarım</th>
                            </tr>
                          </thead>
                          <tbody>
                            {message.projectImport.records.map((record) => (
                              <tr key={record.row}>
                                {message.projectImport.table.headers.map((_, index) => (
                                  <td key={index}>{String(message.projectImport.table.rows[record.row - 2]?.[index] ?? "")}</td>
                                ))}
                                <td>
                                  {record.classification === "duplicate"
                                    ? "Mükerrer · aktarılmayacak"
                                    : record.classification === "review"
                                      ? `Kontrol gerekli${record.reasons?.length ? `: ${record.reasons.join("; ")}` : ""}`
                                      : record.classification === "transfer"
                                        ? "Aktarılacak"
                                        : record.error || (record.missing.length ? `Eksik: ${record.missing.join(", ")}` : "Kontrol ediliyor")}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </details>
                    {!message.projectImport.previewError &&
                    (!message.projectImport.result || message.projectImport.result.errors.length > 0) ? (
                      <button
                        className="ai-module-suggestion"
                        type="button"
                        disabled={aiSending}
                        onClick={() => onConfirmProjectImport?.(message.id, message.projectImport)}
                      >
                        {aiSending
                          ? "Projeler aktarılıyor…"
                          : message.projectImport.result
                            ? "Başarısız satırları yeniden dene"
                            : "Projeleri Kaydet"}
                      </button>
                    ) : null}
                    {message.projectImport.result ? (
                      <div className="ai-project-import-results" role="status">
                        <p>Kaydedildi: {message.projectImport.result.added.length}</p>
                        {message.projectImport.verification ? (
                          <p>
                            Projeler API yenilemesinde doğrulandı: {message.projectImport.verification.saved ?? "—"}
                            {" / "}{message.projectImport.verification.expected}
                            {message.projectImport.verification.error
                              ? ` · Yenileme hatası: ${message.projectImport.verification.error}`
                              : message.projectImport.verification.complete
                                ? " · Tamamı doğrulandı"
                                : " · Eksik kayıtlar için Projeler listesini kontrol edin"}
                          </p>
                        ) : null}
                        {message.projectImport.result.added.length ? (
                          <ul>{message.projectImport.result.added.map((record) => <li key={record.row}>{record.name}</li>)}</ul>
                        ) : null}
                        <p>Mükerrer olarak atlandı: {message.projectImport.result.existing.length}</p>
                        {message.projectImport.result.existing.length ? (
                          <ul>{message.projectImport.result.existing.map((record) => <li key={`${record.row}-${record.name}`}>{record.name}</li>)}</ul>
                        ) : null}
                        <p>Başarısız: {message.projectImport.result.errors.length}</p>
                        {message.projectImport.result.errors.length ? (
                          <ul>{message.projectImport.result.errors.map((record) => <li key={record.row}>Satır {record.row}: {record.message}</li>)}</ul>
                        ) : null}
                        {message.projectImport.result.incomplete?.length ? (
                          <p>Eksik değerler tahmin edilmeden boş bırakıldı: {message.projectImport.result.incomplete.length} satır.</p>
                        ) : null}
                      </div>
                    ) : null}
                    {message.projectImport.importError ? (
                      <p className="ai-file-error" role="alert">
                        Aktarım yapılamadı, kayıtların değiştiği varsayılmadı: {message.projectImport.importError}
                      </p>
                    ) : null}
                  </section>
                ) : null}
                {message.moduleSuggestion && MODULE_TITLES[message.moduleSuggestion] ? (
                  <button
                    className="ai-module-suggestion"
                    type="button"
                    onClick={() => onNavigate(message.moduleSuggestion)}
                  >
                    {MODULE_TITLES[message.moduleSuggestion]} modülüne geç
                  </button>
                ) : null}
              </div>
            ))}
          </div>
          <form
            className={`ai-form${dragActive ? " ai-form-drag-active" : ""}`}
            onSubmit={sendAiMessage}
            onDragOver={(event) => {
              event.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) setDragActive(false);
            }}
            onDrop={(event) => {
              event.preventDefault();
              setDragActive(false);
              addAttachment(event.dataTransfer.files?.[0]);
            }}
          >
            <input
              ref={fileInputRef}
              className="ai-file-input"
              type="file"
              accept=".png,.jpg,.jpeg,.webp,.xlsx,.csv,.pdf,.docx,.txt,image/png,image/jpeg,image/webp,text/csv,application/pdf"
              aria-label="Eklenecek dosyayı seç"
              onChange={(event) => {
                addAttachment(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
            <textarea
              ref={promptFieldRef}
              aria-label="DDPro AI mesajı"
              placeholder="DDPro AI için mesajını yaz..."
              value={aiInput}
              onChange={(event) => setAiInput(event.target.value)}
              disabled={aiSending || voiceListening}
            />
            <button
              className="ai-attach-button"
              type="button"
              aria-label="Dosya veya görsel ekle"
              title="Dosya veya görsel ekle"
              disabled={aiSending || voiceListening}
              onClick={() => fileInputRef.current?.click()}
            >
              <span aria-hidden="true">＋</span>
            </button>
            <button
              className={`ai-voice-button${voiceListening ? " is-listening" : ""}${voiceSpeaking ? " is-speaking" : ""}`}
              type="button"
              aria-label={voiceListening ? "Gerçek zamanlı sesli sohbeti durdur" : "Gerçek zamanlı sesli sohbeti başlat"}
              aria-pressed={voiceListening}
              disabled={aiSending || (!voiceListening && !voiceProviderConfigured)}
              onClick={toggleRealtimeVoice}
            >
              <span aria-hidden="true">🎙</span>
              {voiceListening
                ? "Sohbeti durdur"
                : "Canlı sesli sohbet"}
            </button>
            <button
              type="submit"
              disabled={aiSending || voiceListening || (!aiInput.trim() && !aiAttachment)}
            >
              <span>{aiSending ? (aiAttachment ? "Yükleniyor ve analiz ediliyor…" : "Yanıt bekleniyor…") : "Analizi başlat"}</span>
              <span aria-hidden="true">→</span>
            </button>
            {aiAttachment ? (
              <div className="ai-attachment-preview">
                {previewUrl ? <img src={previewUrl} alt={`${aiAttachment.name} önizlemesi`} /> : <span aria-hidden="true">▧</span>}
                <span>
                  <strong>{aiAttachment.name}</strong>
                  <small>{(aiAttachment.size / (1024 * 1024)).toFixed(2)} MB · Gönderilmeye hazır</small>
                </span>
                <button
                  type="button"
                  aria-label="Eklenen dosyayı kaldır"
                  disabled={aiSending}
                  onClick={() => setAiAttachment(null)}
                >
                  Kaldır
                </button>
              </div>
            ) : null}
            {fileError ? <p className="ai-file-error" role="alert">{fileError}</p> : null}
            {voiceError ? <p className="ai-voice-status" role="alert">{voiceError}</p> : null}
            <p className="ai-voice-status" role="status" aria-live="polite">{voiceStatus}</p>
            {voiceTranscript ? (
              <p className="ai-voice-status ai-voice-transcript" aria-live="polite">
                <strong>Algılanan konuşma:</strong> {voiceTranscript}
              </p>
            ) : null}
            {voiceOperations.length ? (
              <ol className="ai-voice-operations" aria-label="Sesli asistan işlem akışı" aria-live="polite">
                {voiceOperations.map((operation) => {
                  const resource = MODULE_TITLES[operation.resource] || ({
                    customers: "CRM",
                    products: "Ürün kataloğu",
                    systems: "Sistem kataloğu",
                    "material-analysis": "Malzeme analizi",
                    integrations: "Entegrasyonlar",
                  })[operation.resource] || operation.resource;
                  const tool = operation.tool === "prepare_write"
                    ? "Kayıt değişikliği"
                    : operation.resource
                      ? `${resource} sorgusu`
                      : "DDPro işlemi";
                  const status = {
                    running: "İşlem yürütülüyor",
                    awaiting_confirmation: "Onay bekleniyor",
                    executing: "Onaylı işlem yürütülüyor",
                    completed: "İşlem tamamlandı",
                    failed: "İşlem başarısız",
                    cancelled: "İşlem iptal edildi",
                    unverified: "Sonuç doğrulanamadı",
                  }[operation.status] || operation.status;
                  return (
                    <li key={operation.id} data-status={operation.status}>
                      <strong>{tool}</strong>
                      <small>Talep: {operation.request}</small>
                      <span>{status}</span>
                      <p>{operation.summary}</p>
                      {renderVoiceProjectRecords(operation)}
                      {operation.pendingAction ? (
                        <div className="ai-action-confirmation">
                          <details className="ai-action-preview">
                            <summary>Önerilen değişikliği incele</summary>
                            <pre>{JSON.stringify(operation.pendingAction.preview, null, 2)}</pre>
                          </details>
                          <button
                            className="ai-module-suggestion"
                            type="button"
                            disabled={operation.status === "executing"}
                            onClick={() => confirmVoiceOperation(operation)}
                          >
                            {operation.pendingAction.summary}
                          </button>
                          <small>İşlem, yalnızca bu açık onayla ve 5 dakika içinde bir kez yürütülür.</small>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
            ) : null}
          </form>
        </section>
      </div>
    </div>
  );
}

export default AIModule;
