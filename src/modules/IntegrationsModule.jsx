function IntegrationsModule({ integrations, toggleIntegration, statusNote }) {
  return (
    <div className="module-page">
      <div className="panel">
        <div className="panel-header">
          <h2>Entegrasyonlar</h2>
        </div>

        <div className="panel-content">
          {statusNote ? (
            <p className={`status-banner ${statusNote.tone || "info"}`}>
              {statusNote.message}
            </p>
          ) : null}
        </div>

        <div className="data-list">
          {integrations.length === 0 ? (
            <p className="empty-state">Henüz entegrasyon bulunmuyor.</p>
          ) : (
            integrations.map((item) => (
              <div className="data-card" key={item.id}>
                <div>
                  <h3>{item.name}</h3>
                  <p>{item.description}</p>
                  <small>Durum: {item.status}</small>
                </div>

                <button
                  type="button"
                  onClick={() => toggleIntegration(item.id)}
                >
                  {item.status === "Aktif" ? "Pasifleştir" : "Aktifleştir"}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default IntegrationsModule;
