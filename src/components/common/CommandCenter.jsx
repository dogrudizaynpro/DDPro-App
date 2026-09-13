import SystemStatus from "./SystemStatus.jsx";

export default function CommandCenter({
  activeModule,
  systemStatusItems,
  quickActions,
}) {
  return (
    <section className="command-center">
      <div className="command-center-copy">
        <p className="eyebrow-label">KOMUT MERKEZİ</p>
        <h2>{activeModule.short}</h2>
        <p>{activeModule.description}</p>
      </div>

      <div className="command-center-actions">
        <SystemStatus items={systemStatusItems} />
        <div className="quick-actions">
          {quickActions.map((item) => (
            <button key={item.id} type="button" onClick={item.action}>
              <strong>{item.label}</strong>
              <span>{item.description}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
