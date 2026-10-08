import { useCallback, useEffect, useMemo, useState } from "react";
import DDProIcon from "../components/DDProIcon.jsx";
import {
  beginGoogleConnection,
  createCrmContact,
  deleteCrmContact,
  getCrmContacts,
  importGmailToCrm,
  sendWhatsAppText,
  updateCrmContact,
} from "../services/operations-integrations.service.js";

const emptyContact = {
  name: "",
  company: "",
  email: "",
  phone: "",
  request: "",
  project_id: "",
  system: "",
  area_m2: "",
  status: "Yeni",
  notes: "",
};

function CRMModule({ projects = [], onNavigate, setAiInput }) {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [editingId, setEditingId] = useState("");
  const [importing, setImporting] = useState(false);

  const loadContacts = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await getCrmContacts();
      setContacts(Array.isArray(response.data) ? response.data : []);
    } catch (loadError) {
      setError(loadError.message || "CRM kayıtları yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  const visibleContacts = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("tr-TR");
    return contacts.filter((contact) => {
      const matchesQuery = !normalizedQuery || [
        contact.name,
        contact.company,
        contact.email,
        contact.phone,
        contact.request,
      ].some((value) => String(value || "").toLocaleLowerCase("tr-TR").includes(normalizedQuery));
      return matchesQuery && (!statusFilter || contact.status === statusFilter);
    });
  }, [contacts, query, statusFilter]);

  const saveContact = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    const form = event.currentTarget;
    values.area_m2 = values.area_m2.trim() ? Number(values.area_m2) : null;
    values.project_id = values.project_id || null;
    try {
      const response = editingId
        ? await updateCrmContact(editingId, values)
        : await createCrmContact(values);
      if (response.duplicate) {
        setNotice("Bu e-posta veya telefonla eşleşen CRM kaydı zaten mevcut; kayıt yinelenmedi.");
      } else {
        setNotice(editingId ? "CRM kaydı güncellendi." : "CRM kaydı oluşturuldu.");
      }
      setEditingId("");
      form.reset();
      await loadContacts();
    } catch (saveError) {
      setError(saveError.message || "CRM kaydı kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  };

  const beginEdit = (contact) => {
    setEditingId(contact.id);
    const form = document.getElementById("crm-contact-form");
    if (!form) return;
    for (const [key, value] of Object.entries({
      ...emptyContact,
      ...contact,
      project_id: contact.project_id || "",
    })) {
      const field = form.elements.namedItem(key);
      if (field) field.value = value ?? "";
    }
  };

  const removeContact = async (id) => {
    setError("");
    setNotice("");
    try {
      await deleteCrmContact(id);
      setNotice("CRM kaydı silindi.");
      if (editingId === id) setEditingId("");
      await loadContacts();
    } catch (deleteError) {
      setError(deleteError.message || "CRM kaydı silinemedi.");
    }
  };

  const connectGoogle = async () => {
    try {
      await beginGoogleConnection();
    } catch (connectionError) {
      setError(connectionError.message || "Google bağlantısı başlatılamadı.");
    }
  };

  const importGmail = async () => {
    setImporting(true);
    setError("");
    setNotice("");
    try {
      const response = await importGmailToCrm();
      await loadContacts();
      setNotice(`${response.data?.imported || 0} Gmail iletisi CRM'e aktarıldı.`);
    } catch (importError) {
      setError(importError.message || "Gmail aktarımı başarısız.");
    } finally {
      setImporting(false);
    }
  };

  const sendWhatsApp = async (contact) => {
    const message = window.prompt(`${contact.phone} numarasına gönderilecek mesajı yazın:`);
    if (!message?.trim()) return;
    try {
      const response = await sendWhatsAppText(contact.phone, message.trim());
      setNotice(`WhatsApp sağlayıcısı mesajı kabul etti (${response.data?.id || "message id yok"}).`);
    } catch (sendError) {
      setError(sendError.message || "WhatsApp mesajı gönderilemedi.");
    }
  };

  return (
    <div className="module-page">
      <form id="crm-contact-form" className="data-form" onSubmit={saveContact}>
        <h2>{editingId ? "Müşteri kaydını düzenle" : "Yeni müşteri kaydı"}</h2>
        <input name="name" placeholder="Ad soyad" maxLength={250} required />
        <input name="company" placeholder="Şirket" maxLength={500} />
        <input name="email" type="email" placeholder="E-posta" maxLength={320} />
        <input name="phone" type="tel" placeholder="Telefon" maxLength={80} />
        <textarea name="request" placeholder="Talep / ihtiyaç" maxLength={20000} />
        <label>Bağlı proje
          <select name="project_id" defaultValue="">
            <option value="">Proje seçin (isteğe bağlı)</option>
            {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
          </select>
        </label>
        <input name="system" placeholder="İlgili sistem" maxLength={500} />
        <input name="area_m2" type="number" min="0" step="0.01" placeholder="Alan (m²)" />
        <select name="status" defaultValue="Yeni">
          <option>Yeni</option><option>İletişimde</option><option>Teklif</option><option>Müşteri</option><option>Pasif</option>
        </select>
        <textarea name="notes" placeholder="CRM notları" maxLength={20000} />
        <div className="module-toolbar">
          <button type="submit" disabled={saving}><DDProIcon name="save" />{saving ? "Kaydediliyor…" : editingId ? "Güncelle" : "Müşteri ekle"}</button>
          {editingId ? <button type="button" disabled={saving} onClick={() => {
            setEditingId("");
            document.getElementById("crm-contact-form")?.reset();
          }}>Düzenlemeyi iptal et</button> : null}
        </div>
      </form>

      {error ? <p className="status-banner warning" role="alert">{error}</p> : null}
      {notice ? <p className="status-banner info" role="status">{notice}</p> : null}
      {error && !contacts.length ? <button type="button" onClick={connectGoogle}>Google hesabıyla güvenli CRM oturumu aç</button> : null}

      <div className="module-toolbar">
        <button type="button" onClick={importGmail} disabled={importing || loading}>
          {importing ? "Gmail aktarılıyor…" : "Gmail taleplerini CRM'e aktar"}
        </button>
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Müşteri ara" aria-label="Müşteri ara" />
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Duruma göre filtrele">
          <option value="">Tüm durumlar</option>
          {[...new Set(contacts.map((contact) => contact.status).filter(Boolean))].map((status) => <option key={status}>{status}</option>)}
        </select>
        <button type="button" onClick={loadContacts} disabled={loading}>{loading ? "Yükleniyor…" : "Yenile"}</button>
      </div>

      <div className="data-list">
        {loading ? <p className="empty-state">CRM kayıtları yükleniyor…</p> : null}
        {!loading && !error && visibleContacts.length === 0
          ? <p className="empty-state">{contacts.length ? "Arama ölçütlerine uygun müşteri bulunamadı." : "Henüz CRM müşterisi bulunmuyor."}</p>
          : null}
        {!loading && visibleContacts.map((contact) => (
          <article className="data-card" key={contact.id}>
            <div>
              <h3>{contact.name}</h3>
              <p>{[contact.company, contact.email, contact.phone].filter(Boolean).join(" · ") || "İletişim bilgisi eklenmedi."}</p>
              {contact.request ? <p>{contact.request}</p> : null}
              {contact.project_id ? <p>Proje: {projects.find((project) => project.id === contact.project_id)?.name || "Bağlı proje"}</p> : null}
              <small>{contact.status || "Durum belirtilmedi"}{contact.area_m2 ? ` · ${contact.area_m2} m²` : ""}</small>
            </div>
            <div className="module-toolbar">
              <button className="ddpro-icon-action" type="button" aria-label={`${contact.name} kaydını düzenle`} title="Düzenle" onClick={() => beginEdit(contact)}><DDProIcon name="edit" /></button>
              <button type="button" onClick={() => {
                setAiInput?.(`CRM kaydındaki müşteri talebini değerlendir; ihtiyaçları, belirsizlikleri ve önerilen sonraki adımları çıkar. CRM kaydında değişiklik yapma; önerileri onaya sun.\n\nMüşteri: ${contact.name}\nFirma: ${contact.company || "Belirtilmedi"}\nTalep: ${contact.request || "Talep metni yok"}\nProje: ${contact.project_id || "Belirtilmedi"}\nSistem: ${contact.system || "Belirtilmedi"}`);
                onNavigate?.("ai-assistant");
              }}>Talebi AI ile analiz et</button>
              {contact.phone ? <button type="button" onClick={() => sendWhatsApp(contact)}>WhatsApp yanıtı gönder</button> : null}
              <button className="ddpro-icon-action" type="button" aria-label={`${contact.name} kaydını sil`} title="Sil" onClick={() => removeContact(contact.id)}><DDProIcon name="delete" /></button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

export default CRMModule;
