export default function Sidebar({
  modules,
  activeModule,
  onSelectModule,
  totalModuleCount,
}) {
  return (
    <aside className="sidebar">
      <div className="sidebar-intro">
        <p className="sidebar-label">MASTER NAVİGASYON</p>
        <strong>{totalModuleCount} modül</strong>
      </div>

      <nav className="module-nav" aria-label="MASTER modülleri">
        {modules.map((module) => (
          <button
            key={module.id}
            type="button"
            className={`module-button ${activeModule === module.id ? "active" : ""}`}
            onClick={() => onSelectModule(module.id)}
          >
            <span className="module-icon">{module.icon}</span>
            <span className="module-text">
              <strong>{module.title}</strong>
              <small>{module.short}</small>
            </span>
          </button>
        ))}
      </nav>

      {modules.length === 0 && (
        <div className="sidebar-empty">
          <strong>Eşleşen modül yok</strong>
          <p>Arama alanını temizleyerek tüm MASTER modüllerini tekrar görüntüleyebilirsin.</p>
        </div>
      )}

      <div className="sidebar-footer">
        <div className="sidebar-system">
          <span className="status-dot"></span>
          DDPro Core / MASTER Shell aktif
        </div>
      </div>
    </aside>
  );
}
