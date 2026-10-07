import { useEffect, useState } from "react";
import { getCrmContacts } from "../services/operations-integrations.service.js";
import DDProIcon from "../components/DDProIcon.jsx";

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
  updateProject,
  selectedProjectId,
  onNavigate,
}) {
  const selectedProject = projects.find((project) => project.id === selectedProjectId);
  const [areaM2, setAreaM2] = useState("");
  const [systems, setSystems] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("");
  const [detailsStatus, setDetailsStatus] = useState("");
  const [crmContacts, setCrmContacts] = useState([]);
  const [crmContactsError, setCrmContactsError] = useState("");
  const [crmContactId, setCrmContactId] = useState("");

  useEffect(() => {
    setAreaM2(selectedProject?.areaM2 ?? "");
    setSystems((selectedProject?.systems || []).join(", "));
    setNotes(selectedProject?.notes || "");
    setStatus(selectedProject?.status || "Aktif");
    setCrmContactId(selectedProject?.crmContactId || "");
    setDetailsStatus("");
  }, [selectedProject?.id]);

  useEffect(() => {
    let active = true;
    getCrmContacts()
      .then((response) => {
        if (active) {
          setCrmContacts(response.data || []);
          setCrmContactsError("");
        }
      })
      .catch((error) => {
        if (active) setCrmContactsError(error.message);
      });
    return () => {
      active = false;
    };
  }, []);

  const saveProjectDetails = async (event) => {
    event.preventDefault();
    const saved = await updateProject(selectedProject.id, {
      areaM2,
      systems: systems.split(",").map((item) => item.trim()).filter(Boolean),
      notes,
      status,
      crmContactId,
    });
    setDetailsStatus(
      saved
        ? "Proje ayrıntıları kaydedildi."
        : "Ayrıntılar kaydedilemedi; bağlantı ve backend migration durumunu kontrol edin."
    );
  };

  return (
    <div className="module-page">
      {selectedProject ? (
        <section className="panel project-detail-panel">
          <div className="panel-header">
            <h2>{selectedProject.name}</h2>
            <span>{selectedProject.status}</span>
          </div>
          <div className="panel-content">
            <p>{selectedProject.type}</p>
            <p>{selectedProject.date}</p>
            <p className="status-banner info">
              m², sistem ve not alanları API destekli projelerde backend'e kaydedilir. Yerel projeler bu tarayıcıda saklanır.
            </p>
            <form className="data-form project-detail-form" onSubmit={saveProjectDetails}>
              <label>Durum<select value={status} onChange={(event) => setStatus(event.target.value)}>
                <option>Aktif</option>
                <option>Beklemede</option>
                <option>Tamamlandı</option>
              </select></label>
              <label>m²<input type="number" min="0" step="any" value={areaM2} onChange={(event) => setAreaM2(event.target.value)} /></label>
              <label>Sistemler (virgülle ayırın)<input value={systems} onChange={(event) => setSystems(event.target.value)} /></label>
              <label>Proje notları<textarea rows={4} value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
              <label>Bağlı CRM müşterisi
                <select value={crmContactId} onChange={(event) => setCrmContactId(event.target.value)}>
                  <option value="">Müşteri bağlama</option>
                  {crmContacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.name}</option>)}
                </select>
              </label>
              {crmContactsError ? <small>CRM bağlantısı için Google yetkili oturumu gerekir.</small> : null}
              <button type="submit"><DDProIcon name="save" />Proje ayrıntılarını kaydet</button>
            </form>
            {detailsStatus ? <p role="status">{detailsStatus}</p> : null}
            <div className="module-toolbar">
              <button type="button" onClick={() => onNavigate("offers")}>Teklifler</button>
              <button type="button" onClick={() => onNavigate("material-analysis")}>Malzeme analizi</button>
              <button type="button" onClick={() => onNavigate("procurement")}>Tedarik</button>
              <button type="button" onClick={() => onNavigate("calendar")}>Takvim</button>
            </div>
          </div>
        </section>
      ) : null}

      <div className="module-toolbar">
        <button
          type="button"
          onClick={() => setShowProjectForm((value) => !value)}
        >
          {showProjectForm ? "Formu Kapat" : <><DDProIcon name="add" />Yeni Proje</>}
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

          <button type="submit"><DDProIcon name="save" />Projeyi Kaydet</button>
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
              <button className="project-detail-link" type="button" onClick={() => onNavigate("projects", { id: project.id })}>
                <h3>{project.name}</h3>
                <p>{project.type}</p>
                <small>{project.status} · {project.date}</small>
              </button>

              <button
                type="button"
                onClick={() => deleteProject(project.id)}
              >
                <DDProIcon name="delete" />Sil
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default ProjectsModule;
