import { CatalogWorkspace } from "./OperationsModule.jsx";

function SystemsModule({
  showMemoryForm,
  setShowMemoryForm,
  createMemory,
  memoryTitle,
  setMemoryTitle,
  memoryContent,
  setMemoryContent,
  memoryItems,
  deleteMemory,
  onNavigate,
  statusNote,
}) {
  return (
    <div className="module-page">
      {statusNote ? (
        <p className={`status-banner ${statusNote.tone || "info"}`}>
          {statusNote.message}
        </p>
      ) : null}
      <CatalogWorkspace moduleId="systems" />

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

      <div className="panel panel-content">
        <h2>Gerçek entegrasyon durumu</h2>
        <p>Bağlı olmayan servisler etkinmiş gibi gösterilmez.</p>
        <button type="button" onClick={() => onNavigate("settings")}>
          Entegrasyon ayarlarını görüntüle
        </button>
      </div>
    </div>
  );
}

export default SystemsModule;
