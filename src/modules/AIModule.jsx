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
  onNavigate,
  messagesOnly = false,
  aiSending = false,
  onConfirmAction,
}) {
  const promptFieldRef = useRef(null);
  const [providerStatus, setProviderStatus] = useState("checking");

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
          <form className="ai-form" onSubmit={sendAiMessage}>
            <textarea
              ref={promptFieldRef}
              aria-label="DDPro AI mesajı"
              placeholder="DDPro AI için mesajını yaz..."
              value={aiInput}
              onChange={(event) => setAiInput(event.target.value)}
              disabled={aiSending}
            />
            <button type="submit" disabled={aiSending || !aiInput.trim()}>
              <span>{aiSending ? "Yanıt bekleniyor…" : "Analizi başlat"}</span>
              <span aria-hidden="true">→</span>
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}

export default AIModule;
