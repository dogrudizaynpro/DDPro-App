const capabilities = [
  { icon: "⌁", title: "Analiz & Raporlama", route: "reports" },
  { icon: "◇", title: "Tedarik & Pazarlık", route: "procurement" },
  { icon: "▧", title: "Proje & Süreç Yönetimi", route: "projects" },
  { icon: "▤", title: "Veri & Bilgi İşleme", route: "systems" },
  { icon: "⌘", title: "İletişim & Koordinasyon", route: "messages" },
  { icon: "◎", title: "Karar Destek Mekanizması", route: "price-analysis" },
];

const principles = [
  { icon: "✧", title: "Yapay Zekâ Gücü", route: "ai-assistant" },
  { icon: "⌁", title: "Stratejik Akıl", route: "reports" },
  { icon: "◎", title: "Küresel Bağlantı", route: "procurement" },
  { icon: "⬡", title: "Güvenli Sistem", route: "systems" },
  { icon: "◷", title: "7/24 Kesintisiz", route: "systems" },
  { icon: "↗", title: "Sonuç Odaklı", route: "reports" },
];

function AIModule({
  aiMessages,
  sendAiMessage,
  aiInput,
  setAiInput,
  onNavigate,
}) {
  return (
    <div className="module-page ai-module">
      <section className="ai-command-layout">
        <aside className="ai-principles" aria-label="DDPro AI işlevleri">
          {principles.map((principle) => (
            <button
              className="ai-principle"
              key={principle.title}
              type="button"
              onClick={() => onNavigate(principle.route)}
            >
              <span aria-hidden="true">{principle.icon}</span>
              <strong>{principle.title}</strong>
            </button>
          ))}
        </aside>

        <div className="ai-profile-panel">
          <div className="ai-title-lockup">
            <span className="eyebrow">OPERASYONEL ZEKÂ / DDPRO</span>
            <h2>DDPRO <span>AI TRADE</span></h2>
            <p>AI Asistanın / Partnerin / Yöneticin</p>
            <div className="ai-tags">
              <span>STRATEJİ</span><i>•</i><span>ANALİZ</span><i>•</i>
              <span>SİSTEM</span><i>•</i><span>ÇÖZÜM</span>
            </div>
          </div>

          <div className="ai-who">
            <span className="ai-section-label">01 / BEN KİMİM?</span>
            {[
              "AI Asistan",
              "Stratejik Partner",
              "Sistem Yöneticisi",
              "Problem Çözücü",
              "7/24 Görevde",
            ].map((role) => (
              <p key={role}><span aria-hidden="true">◆</span>{role}</p>
            ))}
          </div>

          <div className="ai-capabilities">
            <span className="ai-section-label">02 / YETENEKLERİM</span>
            <div className="ai-capability-grid">
              {capabilities.map((capability) => (
                <button
                  className="ai-capability"
                  key={capability.title}
                  type="button"
                  onClick={() => onNavigate(capability.route)}
                >
                  <span aria-hidden="true">{capability.icon}</span>
                  <strong>{capability.title}</strong>
                  <span className="ai-capability-arrow" aria-hidden="true">↗</span>
                </button>
              ))}
            </div>
          </div>

          <blockquote className="ai-quote">
            <span aria-hidden="true">“</span>
            DOĞRU DİZAYN<br />DOĞRU SİSTEM<br />DOĞRU ÇÖZÜM
            <span aria-hidden="true">”</span>
          </blockquote>
          <div className="ai-signature">DDPro <span>AI</span></div>
        </div>

        <aside className="ai-spec-panel">
          <span className="ai-section-label">03 / TEKNİK ÖZELLİKLER</span>
          {[
            { title: "Hızlı Öğrenme", route: "ai-assistant" },
            { title: "Yüksek Adaptasyon", route: "systems" },
            { title: "Çoklu Dil Desteği", route: "settings" },
            { title: "Sürekli Güncelleme", route: "systems" },
            { title: "Entegre Sistemler", route: "systems" },
            { title: "Verimlilik Odaklı", route: "reports" },
          ].map((feature) => (
            <button
              className="ai-spec-link"
              key={feature.title}
              type="button"
              onClick={() => onNavigate(feature.route)}
            >
              <span aria-hidden="true">›</span>{feature.title}
            </button>
          ))}
          <div className="ai-system-stamp">
            <span aria-hidden="true">◉</span>
            <strong>%100 UYUMLU<br />SENİNLE BİRLİKTE<br />DAHA GÜÇLÜ.</strong>
          </div>
        </aside>
      </section>

      <section className="panel ai-chat-panel">
        <div className="panel-header">
          <div>
            <span className="panel-kicker">ÇALIŞMA ALANI</span>
            <h2>DDPro AI Asistan</h2>
          </div>
          <span className="ai-chat-status"><i className="status-dot" /> 7/24 HAZIR</span>
        </div>
        <div className="ai-chat">
          {aiMessages.map((message) => (
            <div
              key={message.id}
              className={`ai-message ${message.role}`}
            >
              <strong>
                {message.role === "assistant" ? "DDPro AI" : "Sen"}
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
          <button type="submit">Gönder <span aria-hidden="true">↗</span></button>
        </form>
      </section>
    </div>
  );
}

export default AIModule;
