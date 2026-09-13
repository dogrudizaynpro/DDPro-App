function ProjectsModule({
  showProjectForm,
  setShowProjectForm,
  createProject,
  projectName,
  setProjectName,
  projectType,
  setProjectType,
  projectStatus,
  setProjectStatus,
  projectsLoading,
  projectsError,
  projects,
  deleteProject,
}) {
  return (
    <div className="module-page">
      <div className="module-toolbar">
        <button
          type="button"
          onClick={() => setShowProjectForm((value) => !value)}
        >
          {showProjectForm ? "Formu Kapat" : "+ Yeni Proje"}
        </button>
      </div>

      {projectsError && (
        <p className="status-banner warning">⚠ {projectsError}</p>
      )}

      {showProjectForm && (
        <form className="data-form" onSubmit={createProject}>
          <input
            type="text"
            placeholder="Proje adı"
            value={projectName}
            onChange={(event) => setProjectName(event.target.value)}
          />

          <input
            type="text"
            placeholder="Proje türü"
            value={projectType}
            onChange={(event) => setProjectType(event.target.value)}
          />

          <select
            value={projectStatus}
            onChange={(event) => setProjectStatus(event.target.value)}
          >
            <option>Aktif</option>
            <option>Beklemede</option>
            <option>Tamamlandı</option>
          </select>

          <button type="submit">Projeyi Kaydet</button>
        </form>
      )}

      <div className="data-list">
        {projectsLoading ? (
          <p className="empty-state">Projeler yükleniyor...</p>
        ) : projects.length === 0 ? (
          <p className="empty-state">Henüz veri bulunmuyor.</p>
        ) : (
          projects.map((project) => (
            <div className="data-card" key={project.id}>
              <div>
                <h3>{project.name}</h3>
                <p>{project.type}</p>
                <small>
                  {project.status} · {project.date}
                </small>
              </div>

              <button
                type="button"
                onClick={() => deleteProject(project.id)}
              >
                Sil
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default ProjectsModule;
