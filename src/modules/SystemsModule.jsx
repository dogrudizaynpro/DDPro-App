import { CatalogWorkspace } from "./OperationsModule.jsx";
import DDProActionButton from "../components/DDProActionButton.jsx";

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
          <DDProActionButton
            icon={showMemoryForm ? "settings" : "add"}
            label={showMemoryForm ? "Hafıza formunu kapat" : "Yeni kayıt"}
            ariaExpanded={showMemoryForm}
            onClick={() => setShowMemoryForm((value) => !value)}
          />
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

            <DDProActionButton icon="save" label="Hafızaya kaydet" type="submit" />
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

                <DDProActionButton
                  icon="delete"
                  label={`${item.title} kaydını sil`}
                  onClick={() => deleteMemory(item.id)}
                />
              </div>
            ))
          )}
        </div>
      </div>

      <div className="panel panel-content">
        <h2>Gerçek entegrasyon durumu</h2>
        <p>Bağlı olmayan servisler etkinmiş gibi gösterilmez.</p>
        <DDProActionButton
          icon="settings"
          label="Entegrasyon ayarlarını görüntüle"
          onClick={() => onNavigate("settings")}
        />
      </div>
    </div>
  );
}

export default SystemsModule;
