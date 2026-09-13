import EmptyState from "../common/EmptyState.jsx";
import ProjectCard from "../common/ProjectCard.jsx";

export default function ResearchModule({
  items,
  loading,
  error,
  showForm,
  onToggleForm,
  onSubmit,
  onDelete,
  researchName,
  onResearchNameChange,
  researchNote,
  onResearchNoteChange,
}) {
  return (
    <div className="module-page">
      <div className="module-toolbar">
        <button type="button" onClick={onToggleForm}>
          {showForm ? "Formu Kapat" : "+ Yeni Araştırma"}
        </button>
      </div>

      {error ? <p className="status-banner warning">⚠ {error}</p> : null}

      {showForm ? (
        <form className="data-form" onSubmit={onSubmit}>
          <input
            type="text"
            placeholder="Araştırma başlığı"
            value={researchName}
            onChange={(event) => onResearchNameChange(event.target.value)}
          />

          <textarea
            placeholder="Araştırma notu"
            value={researchNote}
            onChange={(event) => onResearchNoteChange(event.target.value)}
          />

          <button type="submit">Araştırmayı Kaydet</button>
        </form>
      ) : null}

      {loading ? (
        <EmptyState
          title="Araştırmalar yükleniyor"
          description="Tedarik ve araştırma kayıtları yeni MASTER paneline taşınıyor."
          badge="Canlı modül"
        />
      ) : items.length === 0 ? (
        <EmptyState
          title="Araştırma kaydı bulunmuyor"
          description="Canlı kayıtlar veya yerel eklemeler geldiğinde bu alan otomatik dolacaktır."
          badge="Hazır"
        />
      ) : (
        <div className="entity-list">
          {items.map((item) => (
            <ProjectCard
              key={item.id}
              title={item.name}
              subtitle={item.note}
              meta={item.date}
              badge={item.source === "api" ? "Canlı API" : "Yerel kayıt"}
              onDelete={() => onDelete(item.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
