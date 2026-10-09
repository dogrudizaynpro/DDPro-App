import { useEffect, useState } from "react";
import { formatDateTime } from "../utils/date-time.js";
import { getProjects } from "../services/projects.service.js";
import { getCrmContacts } from "../services/operations-integrations.service.js";
import DDProIcon from "../components/DDProIcon.jsx";
import DDProActionButton from "../components/DDProActionButton.jsx";
import {
  deleteDocument,
  getDocumentDownload,
  getDocuments,
  uploadDocument,
} from "../services/documents.service.js";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ACCEPTED_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

export default function DocumentsModule() {
  const [documents, setDocuments] = useState([]);
  const [projects, setProjects] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = async () => {
    setLoading(true);
    setError("");
    try {
      setDocuments(await getDocuments());
    } catch (loadError) {
      setDocuments([]);
      setError(loadError.message || "Belgeler backend'den alınamadı.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    Promise.allSettled([getProjects(), getCrmContacts()]).then(([projectResult, contactResult]) => {
      if (!active) return;
      if (projectResult.status === "fulfilled") setProjects(projectResult.value);
      if (contactResult.status === "fulfilled") setContacts(contactResult.value.data || []);
    });
    refresh();
    return () => { active = false; };
  }, []);

  const saveDocument = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    const file = form.elements.file.files?.[0];
    if (!file) return setError("Yüklenecek dosya seçin.");
    if (file.size < 1 || file.size > MAX_FILE_SIZE) return setError("Dosya boyutu 1 byte ile 10 MB arasında olmalıdır.");
    if (!ACCEPTED_TYPES.has(file.type)) return setError("Desteklenmeyen dosya türü. PDF, PNG, JPEG, CSV, DOCX veya XLSX seçin.");
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await uploadDocument(file, { projectId: values.project_id, crmContactId: values.crm_contact_id });
      form.reset();
      setNotice("Dosya özel Supabase Storage alanına yüklendi.");
      await refresh();
    } catch (uploadError) {
      setError(uploadError.message || "Belge yüklenemedi.");
    } finally {
      setBusy(false);
    }
  };

  const download = async (document) => {
    try {
      const record = await getDocumentDownload(document.id);
      window.location.assign(record.download_url);
    } catch (downloadError) {
      setError(downloadError.message || "Güvenli indirme bağlantısı oluşturulamadı.");
    }
  };

  const remove = async (document) => {
    setBusy(true);
    setError("");
    try {
      await deleteDocument(document.id);
      setDocuments((items) => items.filter((item) => item.id !== document.id));
      setNotice("Dosya ve metadata silindi.");
    } catch (deleteError) {
      setError(deleteError.message || "Belge silinemedi.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="module-page">
      <p className="status-banner info">Dosyalar özel Supabase Storage alanında tutulur. İndirme bağlantıları oturumla oluşturulan 60 saniyelik imzalı URL'lerdir.</p>
      {error ? <p className="status-banner warning" role="alert">{error}</p> : null}
      {notice ? <p className="status-banner success" role="status">{notice}</p> : null}
      <section className="panel">
        <h2>Güvenli belge yükle</h2>
        <form className="data-form" onSubmit={saveDocument}>
          <label>Dosya<input name="file" type="file" accept=".pdf,.png,.jpg,.jpeg,.csv,.docx,.xlsx" required /></label>
          <label>Proje
            <select name="project_id" defaultValue=""><option value="">Proje ilişkilendirme</option>
              {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
            </select>
          </label>
          <label>Müşteri
            <select name="crm_contact_id" defaultValue=""><option value="">Müşteri ilişkilendirme</option>
              {contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.name}</option>)}
            </select>
          </label>
          <button type="submit" disabled={busy}><DDProIcon name="save" />{busy ? "Yükleniyor…" : "Güvenli alana yükle"}</button>
        </form>
      </section>
      <section className="panel">
        <div className="panel-header"><h2>Belgeler</h2><button type="button" onClick={refresh} disabled={loading}>{loading ? "Yükleniyor…" : "Yenile"}</button></div>
        {loading ? <p className="empty-state">Belgeler yükleniyor…</p> : documents.length ? (
          <div className="data-list">{documents.map((document) => (
            <article className="data-card" key={document.id}>
              <div>
                <h3>{document.original_name}</h3>
                <p>{(document.file_size / 1024).toFixed(1)} KB · {document.content_type}</p>
                {document.project_id ? <p>Proje: {projects.find((project) => project.id === document.project_id)?.name || document.project_id}</p> : null}
                {document.crm_contact_id ? <p>Müşteri: {contacts.find((contact) => contact.id === document.crm_contact_id)?.name || document.crm_contact_id}</p> : null}
                <small>{formatDateTime(document.created_at)}</small>
              </div>
              <div className="module-toolbar">
                <button type="button" onClick={() => download(document)}>Güvenli indir</button>
                <DDProActionButton
                  icon="delete"
                  label={`${document.original_name} belgesini sil`}
                  disabled={busy}
                  onClick={() => remove(document)}
                />
              </div>
            </article>
          ))}</div>
        ) : <p className="empty-state">{error ? "Belgeler backend'den alınamadı." : "Henüz belge yüklenmedi."}</p>}
      </section>
    </div>
  );
}
