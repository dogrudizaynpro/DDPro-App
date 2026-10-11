import { useEffect, useState } from "react";
import { getCrmContacts } from "../services/operations-integrations.service.js";
import { formatDateTime } from "../utils/date-time.js";
import {
  importAiFileProjects,
  previewProjectSpreadsheetUpload,
} from "../services/projects.service.js";
import {
  deleteDocument,
  getDocumentDownload,
  getDocuments,
  uploadDocument,
} from "../services/documents.service.js";
import DDProActionButton from "../components/DDProActionButton.jsx";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const SPREADSHEET_TYPES = new Set([
  ".xlsx",
  ".csv",
]);
const DOCUMENT_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);
const ASSET_LABELS = {
  before: "Uygulama öncesi",
  progress: "Uygulama süreci",
  completed: "Tamamlanan iş",
};

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
  refreshProjects,
  setAiInput,
}) {
  const selectedProject = projects.find((project) => project.id === selectedProjectId);
  const [projectTitle, setProjectTitle] = useState("");
  const [projectTypeValue, setProjectTypeValue] = useState("");
  const [areaM2, setAreaM2] = useState("");
  const [systems, setSystems] = useState("");
  const [notes, setNotes] = useState("");
  const [customer, setCustomer] = useState("");
  const [company, setCompany] = useState("");
  const [location, setLocation] = useState("");
  const [product, setProduct] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [projectCommand, setProjectCommand] = useState("");
  const [status, setStatus] = useState("");
  const [detailsStatus, setDetailsStatus] = useState("");
  const [crmContacts, setCrmContacts] = useState([]);
  const [crmContactsError, setCrmContactsError] = useState("");
  const [crmContactId, setCrmContactId] = useState("");
  const [documents, setDocuments] = useState([]);
  const [documentError, setDocumentError] = useState("");
  const [documentNotice, setDocumentNotice] = useState("");
  const [documentBusy, setDocumentBusy] = useState(false);
  const [previewUrls, setPreviewUrls] = useState({});
  const [spreadsheetPreview, setSpreadsheetPreview] = useState(null);
  const [spreadsheetBusy, setSpreadsheetBusy] = useState(false);
  const [spreadsheetError, setSpreadsheetError] = useState("");
  const [spreadsheetResult, setSpreadsheetResult] = useState(null);
  const projectDocuments = documents.filter((document) => document.project_id === selectedProject?.id);

  useEffect(() => {
    setProjectTitle(selectedProject?.name || "");
    setProjectTypeValue(selectedProject?.type || "");
    setAreaM2(selectedProject?.areaM2 ?? "");
    setSystems((selectedProject?.systems || []).join(", "));
    setNotes(selectedProject?.notes || "");
    setCustomer(selectedProject?.customer || "");
    setCompany(selectedProject?.company || "");
    setLocation(selectedProject?.location || "");
    setProduct(selectedProject?.product || "");
    setStartDate(selectedProject?.startDate || "");
    setEndDate(selectedProject?.endDate || "");
    setStatus(selectedProject?.status || "Aktif");
    setCrmContactId(selectedProject?.crmContactId || "");
    setDetailsStatus("");
    setProjectCommand("");
    setSpreadsheetPreview(null);
    setSpreadsheetError("");
    setSpreadsheetResult(null);
  }, [selectedProject?.id]);

  useEffect(() => {
    let active = true;
    setDocumentError("");
    getDocuments()
      .then((items) => { if (active) setDocuments(items); })
      .catch((error) => {
        if (active) setDocumentError(error.message || "Proje dosyaları yüklenemedi.");
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    const coverIds = new Set(projects.map((project) => project.coverDocumentId).filter(Boolean));
    const imageDocuments = documents.filter((document) =>
      document.content_type.startsWith("image/") &&
      (document.project_id === selectedProject?.id || coverIds.has(document.id))
    );
    Promise.all(imageDocuments.map(async (document) => {
      try {
        const result = await getDocumentDownload(document.id, { preview: true });
        return [document.id, result.download_url];
      } catch {
        return [document.id, ""];
      }
    })).then((entries) => {
      if (active) setPreviewUrls(Object.fromEntries(entries.filter(([, url]) => url)));
    });
    return () => { active = false; };
  }, [documents, projects, selectedProject?.id]);

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
      name: projectTitle,
      type: projectTypeValue,
      areaM2,
      systems: systems.split(",").map((item) => item.trim()).filter(Boolean),
      notes,
      customer,
      company,
      location,
      product,
      startDate,
      endDate,
      status,
      crmContactId,
    });
    setDetailsStatus(
      saved
        ? "Proje ayrıntıları kaydedildi."
        : "Ayrıntılar kaydedilemedi; bağlantı ve backend migration durumunu kontrol edin."
    );
  };

  const uploadProjectFile = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const file = form.elements.file.files?.[0];
    const assetType = form.elements.project_asset_type.value;
    if (!file) return setDocumentError("Yüklenecek dosyayı seçin.");
    if (file.size < 1 || file.size > MAX_FILE_SIZE) {
      return setDocumentError("Dosya boyutu 1 bayt ile 10 MB arasında olmalıdır.");
    }
    if (!DOCUMENT_TYPES.has(file.type)) {
      return setDocumentError("Desteklenmeyen dosya. PDF, JPEG, PNG, WebP, CSV, DOCX veya XLSX seçin.");
    }
    if (assetType !== "document" && !file.type.startsWith("image/")) {
      return setDocumentError("Uygulama aşaması için bir fotoğraf seçin.");
    }
    setDocumentBusy(true);
    setDocumentError("");
    setDocumentNotice("");
    try {
      await uploadDocument(file, { projectId: selectedProject.id, projectAssetType: assetType });
      setDocuments(await getDocuments());
      form.reset();
      setDocumentNotice("Dosya özel proje depolama alanına yüklendi.");
    } catch (error) {
      setDocumentError(error.message || "Dosya yüklenemedi.");
    } finally {
      setDocumentBusy(false);
    }
  };

  const setProjectCover = async (documentId) => {
    setDocumentBusy(true);
    setDocumentError("");
    try {
      const saved = await updateProject(selectedProject.id, { coverDocumentId: documentId });
      if (!saved) throw new Error("Kapak fotoğrafı kaydedilemedi.");
      setDocumentNotice("Kapak fotoğrafı güncellendi.");
    } catch (error) {
      setDocumentError(error.message || "Kapak fotoğrafı güncellenemedi.");
    } finally {
      setDocumentBusy(false);
    }
  };

  const removeProjectDocument = async (document) => {
    setDocumentBusy(true);
    setDocumentError("");
    try {
      await deleteDocument(document.id);
      setDocuments((items) => items.filter((item) => item.id !== document.id));
      if (selectedProject.coverDocumentId === document.id) {
        const saved = await updateProject(selectedProject.id, { coverDocumentId: null });
        if (!saved) setDocumentError("Dosya silindi ancak kapak bağlantısı yenilenemedi.");
      }
      setDocumentNotice("Proje dosyası silindi.");
    } catch (error) {
      setDocumentError(error.message || "Proje dosyası silinemedi.");
    } finally {
      setDocumentBusy(false);
    }
  };

  const previewSpreadsheet = async (event) => {
    event.preventDefault();
    const file = event.currentTarget.elements.file.files?.[0];
    if (!file) return setSpreadsheetError("İçe aktarılacak XLSX veya CSV dosyasını seçin.");
    if (file.size < 1 || file.size > MAX_FILE_SIZE) {
      return setSpreadsheetError("Dosya boyutu 1 bayt ile 10 MB arasında olmalıdır.");
    }
    const extension = `.${file.name.split(".").pop()?.toLowerCase()}`;
    if (!SPREADSHEET_TYPES.has(extension)) {
      return setSpreadsheetError("Bu aktarım XLSX ve CSV dosyalarını destekler; eski XLS biçimi desteklenmiyor.");
    }
    setSpreadsheetBusy(true);
    setSpreadsheetError("");
    setSpreadsheetResult(null);
    try {
      setSpreadsheetPreview(await previewProjectSpreadsheetUpload(file));
    } catch (error) {
      setSpreadsheetError(error.message || "Excel önizlemesi oluşturulamadı.");
      setSpreadsheetPreview(null);
    } finally {
      setSpreadsheetBusy(false);
    }
  };

  const confirmSpreadsheetImport = async () => {
    if (!spreadsheetPreview) return;
    setSpreadsheetBusy(true);
    setSpreadsheetError("");
    try {
      const { sourceFingerprint, table } = spreadsheetPreview;
      const result = await importAiFileProjects({
        sourceFingerprint,
        headers: table.headers,
        rows: table.rows,
      });
      setSpreadsheetResult(result);
      setSpreadsheetPreview(null);
      await refreshProjects?.();
    } catch (error) {
      setSpreadsheetError(error.message || "Projeler içe aktarılamadı.");
    } finally {
      setSpreadsheetBusy(false);
    }
  };

  const sendProjectCommand = () => {
    if (!selectedProject || !projectCommand.trim()) return;
    setAiInput(
      `Proje: ${selectedProject.name}\nİstek: ${projectCommand.trim()}\nÖnce analiz et ve öneri sun. Dosya yükleme veya kayıt değişikliği yapma; onay gerektiren işlemleri açıkça belirt.`
    );
    onNavigate("ai-assistant");
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
            <div className="project-detail-hero">
              {previewUrls[selectedProject.coverDocumentId] ? (
                <img src={previewUrls[selectedProject.coverDocumentId]} alt={`${selectedProject.name} proje kapağı`} />
              ) : (
                <div className="project-image-placeholder" role="img" aria-label="Proje fotoğrafı henüz eklenmedi">
                  <span aria-hidden="true">◇</span>
                  <span>Henüz proje fotoğrafı yok</span>
                </div>
              )}
              <div className="project-detail-overview">
                <p>{selectedProject.type} · {selectedProject.date}</p>
                <dl>
                  <div><dt>Müşteri / işveren</dt><dd>{selectedProject.customer || "Belirtilmedi"}</dd></div>
                  <div><dt>Firma</dt><dd>{selectedProject.company || "Belirtilmedi"}</dd></div>
                  <div><dt>Konum</dt><dd>{selectedProject.location || "Belirtilmedi"}</dd></div>
                  <div><dt>Uygulanan ürün</dt><dd>{selectedProject.product || "Belirtilmedi"}</dd></div>
                  <div><dt>Alan</dt><dd>{selectedProject.areaM2 ? `${selectedProject.areaM2} m²` : "Belirtilmedi"}</dd></div>
                  <div><dt>Tarihler</dt><dd>{selectedProject.startDate || "—"} – {selectedProject.endDate || "—"}</dd></div>
                </dl>
              </div>
            </div>
            <p className="status-banner info">
              Proje bilgileri ve dosyalar yetkili backend üzerinden yönetilir. Fotoğraf bulunmadığında temsili proje görseli gösterilmez.
            </p>
            <form className="data-form project-detail-form" onSubmit={saveProjectDetails}>
              <label>Proje adı<input value={projectTitle} onChange={(event) => setProjectTitle(event.target.value)} maxLength={250} required /></label>
              <label>Proje türü<input value={projectTypeValue} onChange={(event) => setProjectTypeValue(event.target.value)} maxLength={500} /></label>
              <label>Durum<select value={status} onChange={(event) => setStatus(event.target.value)}>
                <option>Aktif</option>
                <option>Beklemede</option>
                <option>Tamamlandı</option>
              </select></label>
              <label>m²<input type="number" min="0" step="any" value={areaM2} onChange={(event) => setAreaM2(event.target.value)} /></label>
              <label>Sistemler (virgülle ayırın)<input value={systems} onChange={(event) => setSystems(event.target.value)} /></label>
              <label>Proje notları<textarea rows={4} value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
              <label>Müşteri / işveren<input value={customer} onChange={(event) => setCustomer(event.target.value)} maxLength={500} /></label>
              <label>Firma<input value={company} onChange={(event) => setCompany(event.target.value)} maxLength={500} /></label>
              <label>Konum<input value={location} onChange={(event) => setLocation(event.target.value)} maxLength={1000} /></label>
              <label>Uygulanan ürün<input value={product} onChange={(event) => setProduct(event.target.value)} maxLength={1000} /></label>
              <label>Başlangıç tarihi<input value={startDate} onChange={(event) => setStartDate(event.target.value)} maxLength={100} /></label>
              <label>Bitiş tarihi<input value={endDate} onChange={(event) => setEndDate(event.target.value)} maxLength={100} /></label>
              <label>Bağlı CRM müşterisi
                <select value={crmContactId} onChange={(event) => setCrmContactId(event.target.value)}>
                  <option value="">Müşteri bağlama</option>
                  {crmContacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.name}</option>)}
                </select>
              </label>
              {crmContactsError ? <small>CRM bağlantısı için Google yetkili oturumu gerekir.</small> : null}
              <DDProActionButton icon="save" label="Proje ayrıntılarını kaydet" type="submit" />
            </form>
            {detailsStatus ? <p role="status">{detailsStatus}</p> : null}
            <section className="project-command-section">
              <h3>Proje komutu ve açıklaması</h3>
              <p>İsteğiniz mevcut AI Asistanına analiz için iletilir; dosya yükleme ve kayıt değişikliği bu alandan yapılmaz.</p>
              <textarea
                rows={3}
                aria-label="Proje hakkında doğal dilde istek"
                placeholder="Örn. Uygulama fotoğraflarını ve teknik belgeleri düzenlemek için bir kontrol listesi hazırla."
                value={projectCommand}
                onChange={(event) => setProjectCommand(event.target.value)}
              />
              <button type="button" disabled={!projectCommand.trim()} onClick={sendProjectCommand}>AI ile analiz et</button>
            </section>
            <section className="project-assets-section">
              <div className="panel-header"><h3>Fotoğraflar ve proje belgeleri</h3></div>
              {documentError ? <p className="status-banner warning" role="alert">{documentError}</p> : null}
              {documentNotice ? <p className="status-banner success" role="status">{documentNotice}</p> : null}
              <form className="data-form project-upload-form" onSubmit={uploadProjectFile}>
                <label>Fotoğraf veya belge
                  <input name="file" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.csv,.docx,.xlsx,application/pdf,image/png,image/jpeg,image/webp" required />
                </label>
                <label>Dosya türü
                  <select name="project_asset_type" defaultValue="document">
                    <option value="document">Teknik belge / dosya</option>
                    <option value="before">Uygulama öncesi fotoğraf</option>
                    <option value="progress">Uygulama süreci fotoğrafı</option>
                    <option value="completed">Tamamlanan iş fotoğrafı</option>
                  </select>
                </label>
                <button type="submit" disabled={documentBusy}>{documentBusy ? "Yükleniyor…" : "Proje dosyasını yükle"}</button>
              </form>
              {projectDocuments.length ? (
                <div className="project-assets-grid">
                  {projectDocuments.map((document) => (
                    <article className="project-asset-card" key={document.id}>
                      {previewUrls[document.id] ? (
                        <img src={previewUrls[document.id]} alt={document.original_name} loading="lazy" />
                      ) : <div className="project-asset-file" aria-hidden="true">▤</div>}
                      <div className="project-asset-copy">
                        <strong>{document.original_name}</strong>
                        <small>{ASSET_LABELS[document.project_asset_type] || "Proje belgesi"} · {(document.file_size / 1024).toFixed(1)} KB</small>
                        <small>{formatDateTime(document.created_at)}</small>
                      </div>
                      <div className="module-toolbar">
                        <button type="button" onClick={async () => {
                          try {
                            const result = await getDocumentDownload(document.id);
                            window.location.assign(result.download_url);
                          } catch (error) {
                            setDocumentError(error.message || "Dosya indirilemedi.");
                          }
                        }}>İndir</button>
                        {document.content_type.startsWith("image/") ? (
                          <button type="button" disabled={documentBusy || selectedProject.coverDocumentId === document.id} onClick={() => setProjectCover(document.id)}>
                            {selectedProject.coverDocumentId === document.id ? "Kapak fotoğrafı" : "Kapak yap"}
                          </button>
                        ) : null}
                        <DDProActionButton
                          icon="delete"
                          label={`${document.original_name} dosyasını sil`}
                          disabled={documentBusy}
                          onClick={() => removeProjectDocument(document)}
                        />
                      </div>
                    </article>
                  ))}
                </div>
              ) : <p className="empty-state">{documentError ? "Proje dosyaları alınamadı." : "Bu projeye henüz fotoğraf veya belge eklenmedi."}</p>}
            </section>
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
        <DDProActionButton
          icon={showProjectForm ? "settings" : "add"}
          label={showProjectForm ? "Proje formunu kapat" : "Yeni Proje"}
          ariaExpanded={showProjectForm}
          onClick={() => setShowProjectForm((value) => !value)}
        />
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
          <label>Müşteri / işveren<input name="customer" maxLength={500} /></label>
          <label>Firma<input name="company" maxLength={500} /></label>
          <label>Konum<input name="location" maxLength={1000} /></label>
          <label>Uygulanan ürün<input name="product" maxLength={1000} /></label>
          <label>Başlangıç tarihi<input name="start_date" maxLength={100} /></label>
          <label>Bitiş tarihi<input name="end_date" maxLength={100} /></label>

          <select
            value={projectStatus}
            onChange={(event) => setProjectStatus(event.target.value)}
          >
            <option>Aktif</option>
            <option>Beklemede</option>
            <option>Tamamlandı</option>
          </select>

          <DDProActionButton icon="save" label="Projeyi kaydet" type="submit" />
        </form>
      )}

      <section className="panel project-import-panel">
        <div className="panel-header"><h2>Excel ile proje aktarımı</h2></div>
        <p className="module-intro">XLSX/CSV dosyasını önizlemede eşleştirir, mükerrer ve eksik kayıtları kontrol eder; onayınızdan sonra mevcut proje aktarım hizmetiyle kaydeder.</p>
        <form className="data-form project-import-form" onSubmit={previewSpreadsheet}>
          <label>Proje tablosu<input name="file" type="file" accept=".xlsx,.csv" required /></label>
          <button type="submit" disabled={spreadsheetBusy}>{spreadsheetBusy ? "Kontrol ediliyor…" : "Önizleme oluştur"}</button>
        </form>
        {spreadsheetError ? <p className="status-banner warning" role="alert">{spreadsheetError}</p> : null}
        {spreadsheetPreview ? (
          <div className="project-import-preview">
            <p>{spreadsheetPreview.table.name} · {spreadsheetPreview.records.length} satır · Aktarılacak {spreadsheetPreview.counts.transfer} · Kontrol {spreadsheetPreview.counts.review} · Mükerrer {spreadsheetPreview.counts.duplicate}</p>
            <div className="project-import-table-wrap"><table>
              <thead><tr>{spreadsheetPreview.table.headers.map((header, index) => <th key={`${header}-${index}`}>{header}</th>)}<th>Durum</th></tr></thead>
              <tbody>{spreadsheetPreview.records.map((record) => (
                <tr key={record.row}>
                  {spreadsheetPreview.table.headers.map((_, index) => <td key={index}>{String(spreadsheetPreview.table.rows[record.row - 2]?.[index] ?? "")}</td>)}
                  <td>
                    {record.classification === "duplicate" ? "Mükerrer · atlanacak" : record.classification === "review" ? "Kontrol gerekli" : record.error || "Aktarılacak"}
                    {record.missing?.length ? <small>Eksik alanlar: {record.missing.join(", ")}</small> : null}
                    {record.validationErrors?.length ? <small>Doğrulama hataları: {record.validationErrors.join("; ")}</small> : null}
                    {record.reasons?.length ? <small>{record.reasons.join("; ")}</small> : null}
                    {record.warnings?.length ? <small>Uyarılar: {record.warnings.join("; ")}</small> : null}
                  </td>
                </tr>
              ))}</tbody>
            </table></div>
            <button type="button" disabled={spreadsheetBusy || !spreadsheetPreview.counts.transfer} onClick={confirmSpreadsheetImport}>
              {spreadsheetBusy ? "Aktarılıyor…" : "Aktarımı onayla"}
            </button>
          </div>
        ) : null}
        {spreadsheetResult ? (
          <div className="status-banner success" role="status">
            Eklendi: {spreadsheetResult.added.length} · Mükerrer/atlanan: {spreadsheetResult.existing.length} · Hatalı: {spreadsheetResult.errors.length}
            {spreadsheetResult.errors.length ? <ul>{spreadsheetResult.errors.map((item) => <li key={`${item.row}-${item.name}`}>Satır {item.row}: {item.message}</li>)}</ul> : null}
          </div>
        ) : null}
      </section>

      <div className="project-card-grid">
        {projectsLoading ? (
          <p className="empty-state">Projeler yükleniyor...</p>
        ) : projects.length === 0 ? (
          <p className="empty-state">Henüz veri bulunmuyor.</p>
        ) : (
          projects.map((project) => (
            <div className="data-card project-card" key={project.id}>
              <button className="project-detail-link" type="button" onClick={() => onNavigate("projects", { id: project.id })}>
                {previewUrls[project.coverDocumentId] ? (
                  <img className="project-card-cover" src={previewUrls[project.coverDocumentId]} alt="" loading="lazy" />
                ) : <span className="project-card-cover-placeholder" aria-hidden="true">◇</span>}
                <span className="project-card-copy">
                  <h3>{project.name}</h3>
                  <p>{project.customer || project.type}</p>
                  <small>{project.company || project.location || "Firma / konum belirtilmedi"}</small>
                  <small>{project.areaM2 ? `${project.areaM2} m² · ` : ""}{project.status} · {project.date}</small>
                </span>
              </button>

              <DDProActionButton
                icon="delete"
                label={`${project.name} projesini sil`}
                onClick={() => deleteProject(project.id)}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default ProjectsModule;
