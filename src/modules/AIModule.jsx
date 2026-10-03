import aiCharacterFront from "../assets/ddpro-ai-character-front.png";
import aiCharacterBack from "../assets/ddpro-ai-character-back.png";

const capabilities = [
  {
    icon: "▣",
    title: "Proje & süreç",
    prompt: "Aktif projelerimi ve süreçlerimi gözden geçir, öncelikli adımları öner.",
  },
  {
    icon: "◈",
    title: "Analiz & raporlama",
    prompt: "Operasyonel durumumu analiz et ve yönetim raporu taslağı hazırla.",
  },
  {
    icon: "⌕",
    title: "Tedarik araştırması",
    prompt: "Bir tedarik araştırması için değerlendirme kriterleri öner.",
  },
  {
    icon: "▤",
    title: "Teklif yönetimi",
    prompt: "Tekliflerimi karşılaştırmak için bir değerlendirme ve kontrol listesi hazırla.",
  },
  {
    icon: "✦",
    title: "Karar desteği",
    prompt: "Mevcut seçenekleri risk, etki ve öncelik açısından değerlendirmek için bir karar çerçevesi oluştur.",
  },
];

function AIModule({ aiMessages, sendAiMessage, aiInput, setAiInput }) {
  return (
    <div className="module-page ai-module">
      <section className="ai-trade-hero">
        <figure className="ai-character-pair">
          <div className="ai-character-views">
            <img src={aiCharacterFront} alt="DDPro AI TRADE karakterinin referanstaki ön görünümü" />
            <img src={aiCharacterBack} alt="DDPro AI TRADE karakterinin referanstaki arka görünümü" />
          </div>
          <figcaption>DDPRO AI PARTNER · ÖN / ARKA</figcaption>
        </figure>
        <div className="ai-trade-copy">
          <span className="ai-eyebrow">DDPRO INTELLIGENCE SYSTEM</span>
          <h2>DDPRO <strong>AI TRADE</strong></h2>
          <p>
            Tasarım ve proje süreçlerinde analiz eden, yön gösteren çalışma
            partneriniz.
          </p>
          <div className="ai-role-tags">
            <span><i aria-hidden="true">01</i> AI ASİSTAN</span>
            <span><i aria-hidden="true">02</i> AI PARTNER</span>
            <span><i aria-hidden="true">03</i> AI YÖNETİCİ</span>
          </div>
        </div>
        <div className="ai-online-indicator"><span className="status-dot" aria-hidden="true" /> YEREL ALAN HAZIR</div>
      </section>

      <div className="ai-workspace">
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
                onClick={() => setAiInput(capability.prompt)}
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
            <strong><i aria-hidden="true" /> Yerel oturum aktif</strong>
            <p>Mesajlar bu çalışma alanında saklanır. Gelişmiş AI bağlantısı yapılandırıldığında etkinleşir.</p>
          </div>
        </aside>

        <section className="ai-conversation-panel">
          <div className="ai-conversation-header">
            <div>
              <span className="ai-eyebrow">AKILLI ÇALIŞMA ALANI</span>
              <h3>AI Asistan / Partner</h3>
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
              </div>
            ))}
          </div>
          <form className="ai-form" onSubmit={sendAiMessage}>
            <textarea
              aria-label="DDPro AI mesajı"
              placeholder="DDPro AI için mesajını yaz..."
              value={aiInput}
              onChange={(event) => setAiInput(event.target.value)}
            />
            <button type="submit">
              <span>Analizi başlat</span>
              <span aria-hidden="true">→</span>
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}

export default AIModule;
