function SystemsModule({
  systemInventory,
  showMemoryForm,
  setShowMemoryForm,
  createMemory,
  memoryTitle,
  setMemoryTitle,
  memoryContent,
  setMemoryContent,
  memoryItems,
  deleteMemory,
  integrations,
  toggleIntegration,
  statusNote,
}) {
  return (
    <div className="module-page">
      <div className="panel">
        <div className="panel-header">
          <h2>Sistem Envanteri</h2>
        </div>

        <div className="panel-content">
          {statusNote ? (
            <p className={`status-banner ${statusNote.tone || "info"}`}>
              {statusNote.message}
            </p>
          ) : null}
          {systemInventory.length === 0 ? (
            <p className="empty-state">Henüz veri bulunmuyor.</p>
          ) : (
            <div className="systems-grid">
              {systemInventory.map((item) => (
                <div
                  className="system-card"
                  key={
                    item.id ||
                    `${item.name || "system"}::${item.description || "description-missing"}`
                  }
                >
                  <h3>{item.name || "Sistem Kaydı"}</h3>
                  <p>{item.description || "Sistem detay açıklaması bulunmuyor."}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="panel memory-panel">
        <div className="panel-header">
          <h2>Merkezi Hafıza</h2>

          <button
            type="button"
            onClick={() => setShowMemoryForm((value) => !value)}
          >
            {showMemoryForm ? "Kapat" : "+ Yeni Kayıt"}
          </button>
        </div>

        {showMemoryForm && (
          <form className="data-form" onSubmit={createMemory}>
            <input
              type="text"
              placeholder="Hafıza başlığı"
              value={memoryTitle}
              onChange={(event) => setMemoryTitle(event.target.value)}
            />

            <textarea
              placeholder="Hafıza içeriği"
              value={memoryContent}
              onChange={(event) => setMemoryContent(event.target.value)}
            />

            <button type="submit">Hafızaya Kaydet</button>
          </form>
        )}

        <div className="data-list">
          {memoryItems.length === 0 ? (
            <p className="empty-state">
              Merkezi hafızada henüz kayıt bulunmuyor.
            </p>
          ) : (
            memoryItems.map((item) => (
              <div className="data-card" key={item.id}>
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.content}</p>
                  <small>{item.date}</small>
                </div>

                <button
                  type="button"
                  onClick={() => deleteMemory(item.id)}
                >
                  Sil
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h2>Entegrasyonlar</h2>
        </div>

        <div className="data-list">
          {integrations.map((item) => (
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
          ))}
        </div>
      </div>
    </div>
  );
}

export default SystemsModule;
