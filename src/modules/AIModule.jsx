import { useEffect, useRef, useState } from "react";
import aiTradeDesignReference from "../assets/DDPro-AI-Trade-Referans.png";
import aiCharacterFront from "../assets/ddpro-ai-character-front.png";
import aiCharacterBack from "../assets/ddpro-ai-character-back.png";
import { getAiProviderStatus } from "../services/ai.service.js";

const MODULE_TITLES = {
  projects: "Projeler",
  offers: "Teklifler",
  procurement: "Tedarik & Araştırma",
  calendar: "Takvim",
  crm: "Müşteriler / CRM",
  reports: "Raporlar",
  "price-analysis": "Fiyat Analizi",
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

function AIModule({
  aiMessages,
  sendAiMessage,
  aiInput,
  setAiInput,
  aiAttachment,
  setAiAttachment,
  onNavigate,
  messagesOnly = false,
  aiSending = false,
  onConfirmAction,
  onConfirmProjectImport,
}) {
  const promptFieldRef = useRef(null);
  const fileInputRef = useRef(null);
  const [fileError, setFileError] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const [providerStatus, setProviderStatus] = useState("checking");
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
        if (active) setProviderStatus(status.configured ? "ready" : "unconfigured");
      })
      .catch(() => {
        if (active) setProviderStatus("unavailable");
      });
    return () => {
      active = false;
    };
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
              <strong><i aria-hidden="true" /> {providerStatus === "ready" ? "AI sağlayıcısı yapılandırıldı" : providerStatus === "checking" ? "AI sağlayıcısı kontrol ediliyor" : "AI sağlayıcısı bağlı değil"}</strong>
              <p>{providerStatus === "ready" ? "Yanıtlar sunucu tarafındaki AI sağlayıcısından istenir." : "Gerçek yanıt için backend AI_API_URL, AI_API_KEY ve AI_MODEL değişkenleri gerekir. İstek başarısız olursa yanıt uydurulmaz."}</p>
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
                    ? "DDPro AI"
                    : "Sen"}
                </strong>
                <p>{message.text}</p>
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
                                  {record.error
                                    ? record.error
                                    : record.missing.length
                                      ? `Eksik: ${record.missing.join(", ")}`
                                      : "Hazır"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </details>
                    {(!message.projectImport.result || message.projectImport.result.errors.length > 0) ? (
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
                            : "Önizlemeyi onayla ve projeleri kaydet"}
                      </button>
                    ) : null}
                    {message.projectImport.result ? (
                      <div className="ai-project-import-results" role="status">
                        <p>Kaydedildi: {message.projectImport.result.added.length}</p>
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
                      </div>
                    ) : null}
                    {message.projectImport.importError ? (
                      <p className="ai-file-error" role="alert">
                        Aktarım yapılamadı, kayıtların değiştiği varsayılmadı: {message.projectImport.importError}
                      </p>
                    ) : null}
                    {message.projectImport.result?.incomplete?.length ? (
                      <p>Eksik tarih ve alanlar tahmin edilmeden boş bırakıldı ({message.projectImport.result.incomplete.length} satır).</p>
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
              disabled={aiSending}
            />
            <button
              className="ai-attach-button"
              type="button"
              aria-label="Dosya veya görsel ekle"
              title="Dosya veya görsel ekle"
              disabled={aiSending}
              onClick={() => fileInputRef.current?.click()}
            >
              <span aria-hidden="true">＋</span>
            </button>
            <button type="submit" disabled={aiSending || (!aiInput.trim() && !aiAttachment)}>
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
          </form>
        </section>
      </div>
    </div>
  );
}

export default AIModule;
