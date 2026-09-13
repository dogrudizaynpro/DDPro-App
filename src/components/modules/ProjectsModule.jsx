import EmptyState from "../common/EmptyState.jsx";
import ProjectCard from "../common/ProjectCard.jsx";

export default function ProjectsModule({
  projects,
  loading,
  error,
  showForm,
  onToggleForm,
  onSubmit,
  onDelete,
  projectName,
  onProjectNameChange,
  projectType,
  onProjectTypeChange,
  projectStatus,
  onProjectStatusChange,
}) {
  return (
    <div className="module-page">
      <div className="module-toolbar">
        <button type="button" onClick={onToggleForm}>
          {showForm ? "Formu Kapat" : "+ Yeni Proje"}
        </button>
      </div>

      {error ? <p className="status-banner warning">⚠ {error}</p> : null}

      {showForm ? (
        <form className="data-form" onSubmit={onSubmit}>
          <input
            type="text"
            placeholder="Proje adı"
            value={projectName}
            onChange={(event) => onProjectNameChange(event.target.value)}
          />

          <input
            type="text"
            placeholder="Proje türü"
            value={projectType}
            onChange={(event) => onProjectTypeChange(event.target.value)}
          />

          <select
            value={projectStatus}
            onChange={(event) => onProjectStatusChange(event.target.value)}
          >
            <option>Aktif</option>
            <option>Beklemede</option>
            <option>Tamamlandı</option>
          </select>

          <button type="submit">Projeyi Kaydet</button>
        </form>
      ) : null}

      {loading ? (
        <EmptyState
          title="Projeler yükleniyor"
          description="Mevcut proje kayıtları MASTER görünümüne aktarılıyor."
          badge="Canlı modül"
        />
      ) : projects.length === 0 ? (
        <EmptyState
          title="Henüz proje kaydı bulunmuyor"
          description="Canlı endpoint veya yerel kayıtlar geldiğinde proje kartları bu alanda listelenir."
          badge="Hazır"
        />
      ) : (
        <div className="entity-list">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              title={project.name}
              subtitle={project.type}
              meta={`${project.status} · ${project.date}`}
              badge={project.source === "api" ? "Canlı API" : "Yerel kayıt"}
              onDelete={() => onDelete(project.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
