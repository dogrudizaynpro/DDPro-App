import EmptyState from "../common/EmptyState.jsx";

const NEXT_STEPS = [
  "API bağlantısı tanımlanmalı",
  "Veri modeli bu modüle bağlanmalı",
  "Yetkili aksiyonlar aktive edilmeli",
];

export default function PlaceholderModule({ module, onOpenDashboard }) {
  return (
    <div className="module-page">
      <div className="placeholder-layout">
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow-label">KONTROLLÜ PLACEHOLDER</p>
              <h2>{module.title}</h2>
            </div>
            <span className={`availability-badge ${module.statusTone}`}>
              {module.availabilityLabel}
            </span>
          </div>

          <EmptyState
            title="Bu modül henüz bağlı değil"
            description={`${module.description} Gerçek veri veya tamamlanmış işlev izlenimi verilmeden mimari kabuk hazırlandı.`}
            badge="Bağlantı yok"
            actionLabel="Dashboarda Dön"
            onAction={onOpenDashboard}
          />
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow-label">SONRAKİ AŞAMA</p>
              <h2>API'ye hazır yapı</h2>
            </div>
          </div>

          <div className="next-steps-list">
            {NEXT_STEPS.map((step) => (
              <div className="next-step-item" key={step}>
                <span></span>
                <strong>{step}</strong>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
