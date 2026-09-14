function MemoryModule({
  showMemoryForm,
  setShowMemoryForm,
  createMemory,
  memoryTitle,
  setMemoryTitle,
  memoryContent,
  setMemoryContent,
  memoryItems,
  deleteMemory,
  statusNote,
}) {
  return (
    <div className="module-page">
      <div className="panel memory-panel">
        <div className="panel-header">
          <h2>Veri & Hafıza Merkezi</h2>

          <button
            type="button"
            onClick={() => setShowMemoryForm((value) => !value)}
          >
            {showMemoryForm ? "Kapat" : "+ Yeni Kayıt"}
          </button>
        </div>

        <div className="panel-content">
          {statusNote ? (
            <p className={`status-banner ${statusNote.tone || "info"}`}>
              {statusNote.message}
            </p>
          ) : null}
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
    </div>
  );
}

export default MemoryModule;
