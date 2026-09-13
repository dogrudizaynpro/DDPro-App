import EmptyState from "../common/EmptyState.jsx";
import ProjectCard from "../common/ProjectCard.jsx";

export default function SystemsModule({
  systems,
  memoryItems,
  integrations,
  showMemoryForm,
  onToggleMemoryForm,
  onCreateMemory,
  onDeleteMemory,
  onToggleIntegration,
  memoryTitle,
  onMemoryTitleChange,
  memoryContent,
  onMemoryContentChange,
}) {
  return (
    <div className="module-page">
      <div className="systems-grid">
        {systems.map((system) => (
          <article className="system-card" key={system.id}>
            <h3>{system.title}</h3>
            <p>{system.description}</p>
          </article>
        ))}
      </div>

      <div className="systems-layout">
        <section className="panel memory-panel">
          <div className="panel-header">
            <h2>Merkezi Hafıza</h2>

            <button type="button" onClick={onToggleMemoryForm}>
              {showMemoryForm ? "Kapat" : "+ Yeni Kayıt"}
            </button>
          </div>

          {showMemoryForm ? (
            <form className="data-form" onSubmit={onCreateMemory}>
              <input
                type="text"
                placeholder="Hafıza başlığı"
                value={memoryTitle}
                onChange={(event) => onMemoryTitleChange(event.target.value)}
              />

              <textarea
                placeholder="Hafıza içeriği"
                value={memoryContent}
                onChange={(event) => onMemoryContentChange(event.target.value)}
              />

              <button type="submit">Hafızaya Kaydet</button>
            </form>
          ) : null}

          {memoryItems.length === 0 ? (
            <EmptyState
              title="Merkezi hafıza boş"
              description="Yerel hafıza kayıtları eklendikçe bu alanda korunur."
              badge="Yerel modül"
            />
          ) : (
            <div className="entity-list">
              {memoryItems.map((item) => (
                <ProjectCard
                  key={item.id}
                  title={item.title}
                  subtitle={item.content}
                  meta={item.date}
                  badge="Yerel kayıt"
                  onDelete={() => onDeleteMemory(item.id)}
                />
              ))}
            </div>
          )}
        </section>

        <section className="panel">
          <div className="panel-header">
            <h2>Entegrasyonlar</h2>
          </div>

          <div className="entity-list">
            {integrations.map((item) => (
              <ProjectCard
                key={item.id}
                title={item.name}
                subtitle={item.description}
                meta={`Durum: ${item.status}`}
                badge={item.status}
                actionLabel={item.status === "Aktif" ? "Pasifleştir" : "Aktifleştir"}
                onDelete={() => onToggleIntegration(item.id)}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
