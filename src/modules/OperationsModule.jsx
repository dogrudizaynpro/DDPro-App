import { useEffect, useMemo, useState } from "react";
import { getIntegrationStatus } from "../services/integrations.service.js";
import {
  beginGoogleConnection,
  createGoogleCalendarEvent,
  createCrmContact,
  deleteCrmContact,
  disconnectGoogle,
  getCrmContacts,
  getGoogleCalendarEvents,
  importGoogleCalendarToLocal,
  importGmailToCrm,
  sendWhatsAppText,
  updateCrmContact,
} from "../services/operations-integrations.service.js";

const WEBSITE_URL = "https://www.ddizaynpro.com/";

const field = (name, label, type = "text", required = false) => ({
  name,
  label,
  type,
  required,
});

const moduleDefinitions = {
  products: {
    title: "Ürünler",
    storageKey: "ddpro_products_v1",
    notice: "Kayıtlar bu tarayıcıda saklanır; merkezi ürün API bağlantısı yoktur.",
    fields: [field("name", "Ürün / sistem adı", "text", true), field("detail", "Teknik bilgi", "textarea"), field("sourceUrl", "Kaynak bağlantısı", "url")],
  },
  "price-analysis": {
    title: "Fiyat Analizi",
    storageKey: "ddpro_price_analysis_v1",
    notice: "Yalnızca kullanıcı tarafından girilen fiyatlar kaydedilir; fiyat önerilmez veya doğrulanmış gibi gösterilmez.",
    fields: [field("name", "Kalem", "text", true), field("amount", "Kaynakta görünen fiyat", "text"), field("sourceUrl", "Kaynak bağlantısı", "url", true), field("verification", "Doğrulama notu", "textarea")],
  },
  "material-analysis": {
    title: "Malzeme Analizi",
    storageKey: "ddpro_material_analysis_v1",
    notice: "Malzeme notları yerel kayıttır; doğrulanmamış maliyet hesaplanmaz.",
    fields: [field("name", "Malzeme", "text", true), field("project", "İlgili proje"), field("detail", "Teknik bilgi / analiz notu", "textarea"), field("sourceUrl", "Kaynak bağlantısı", "url")],
  },
  crm: {
    title: "Müşteriler / CRM",
    storageKey: "ddpro_crm_contacts_v1",
    notice: "CRM kayıtları şu an yalnızca bu tarayıcıda saklanır. Gmail ve merkezi CRM API entegrasyonu bağlı değildir.",
    fields: [
      field("date", "Tarih", "date", true),
      field("name", "Ad Soyad", "text", true),
      field("company", "Firma"),
      field("phone", "Telefon", "tel"),
      field("email", "E-posta", "email"),
      field("request", "Talep", "textarea"),
      field("project", "Proje"),
      field("system", "Sistem"),
      field("area", "m²", "number"),
      field("status", "Durum"),
      field("notes", "Notlar", "textarea"),
    ],
  },
  documents: {
    title: "Belgeler",
    storageKey: "ddpro_documents_v1",
    notice: "Belge referansları yerel tarayıcı kaydıdır; dosya depolama servisi bağlı değildir.",
    fields: [field("name", "Belge adı", "text", true), field("project", "İlgili proje"), field("sourceUrl", "Belge bağlantısı", "url"), field("notes", "Notlar", "textarea")],
  },
  finance: {
    title: "Finans / Maliyet",
    storageKey: "ddpro_finance_v1",
    notice: "Yalnızca manuel girilen kayıtlar saklanır. Kur dönüşümü veya maliyet tahmini yapılmaz.",
    fields: [field("name", "Kayıt adı", "text", true), field("amount", "Girilen tutar"), field("currency", "Para birimi"), field("project", "İlgili proje"), field("sourceUrl", "Kaynak / belge bağlantısı", "url"), field("notes", "Notlar", "textarea")],
  },
  calendar: {
    title: "Takvim",
    storageKey: "ddpro_calendar_events_v1",
    notice: "Etkinlikler bu tarayıcıda saklanır; paylaşımlı takvim / Google Calendar entegrasyonu bağlı değildir.",
    fields: [
      field("title", "Etkinlik", "text", true),
      field("type", "Tür (toplantı, saha, görev, teklif)"),
      field("date", "Tarih", "date", true),
      field("time", "Saat", "time"),
      field("project", "İlgili proje"),
      field("notes", "Notlar", "textarea"),
    ],
  },
};

const readRecords = (key) => {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
};

const timestamp = () => new Date().toISOString();

function IntegrationSettings({ onNavigate }) {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    getIntegrationStatus()
      .then((value) => {
        if (active) setStatus(value);
      })
      .catch(() => {
        if (active) setError("Entegrasyon durumu backend'den alınamadı. Backend adresini ve erişimini kontrol edin.");
      });
    return () => {
      active = false;
    };
  }, []);

  const statusLabel = ({ connected = false, configured = false } = {}) => {
    if (connected) return "BAĞLI";
    if (!configured) return "YAPILANDIRMA GEREKLİ";
    return "BAĞLI DEĞİL · bağlantı testi/oturum bekleniyor";
  };

  const startGoogleOAuth = () => {
    try {
      beginGoogleConnection();
    } catch (connectionError) {
      setError(connectionError.message);
    }
  };

  const disconnectGoogleAccount = async () => {
    try {
      await disconnectGoogle();
      const value = await getIntegrationStatus();
      setStatus(value);
    } catch (disconnectError) {
      setError(disconnectError.message || "Google bağlantısı kapatılamadı.");
    }
  };

  return (
    <div className="operations-module">
      <p className="status-banner info">
        API anahtarları uygulama koduna veya tarayıcıya girilmez. Gerekli bilgileri yalnızca güvenli backend ortam değişkenlerinde yapılandırın.
      </p>
      {error ? <p className="status-banner warning">{error}</p> : null}
      <div className="operations-grid">
        <article className="data-card">
          <div><h3>AI Provider</h3><p>Sunucu tarafında OpenAI uyumlu Chat Completions API.</p><small><strong>{status ? statusLabel({ connected: status.ai?.connected, configured: status.ai?.configured }) : "DURUM KONTROL EDİLİYOR"}</strong><br />{status?.ai?.configured ? "Kimlik bilgileri tanımlı; provider yanıtı ayrıca sınanmalı." : "AI_API_URL, AI_API_KEY ve AI_MODEL bekleniyor."}<br /><button type="button" onClick={() => onNavigate("ai-assistant")}>AI Asistanı aç</button></small></div>
        </article>
        <article className="data-card">
          <div><h3>Gmail</h3><p>OAuth sonrası gelen iletiler yetkili oturumla CRM'e aktarılır.</p><small><strong>{status ? statusLabel({ connected: status.gmail?.connected, configured: status.gmail?.oauthFlowAvailable }) : "DURUM KONTROL EDİLİYOR"}</strong><br />Gmail salt okunur kapsamıyla çalışır; kurulum Google OAuth, allowlist, şifreli token deposu ve Supabase service role gerektirir.<br /><button type="button" disabled={!status?.gmail?.oauthFlowAvailable} onClick={startGoogleOAuth}>Google hesabını bağla</button> {status?.gmail?.connected ? <button type="button" onClick={disconnectGoogleAccount}>Google bağlantısını kes</button> : null} <button type="button" onClick={() => onNavigate("crm")}>CRM'e git</button></small></div>
        </article>
        <article className="data-card">
          <div><h3>Google Calendar</h3><p>Backend API üzerinden etkinlik okuma ve oluşturma.</p><small><strong>{status ? statusLabel({ connected: status.googleCalendar?.connected, configured: status.googleCalendar?.oauthFlowAvailable }) : "DURUM KONTROL EDİLİYOR"}</strong><br />Google hesabı aynı OAuth bağlantısını kullanır. <button type="button" onClick={() => onNavigate("calendar")}>Takvimi aç</button></small></div>
        </article>
        <article className="data-card">
          <div><h3>WhatsApp Business</h3><p>İmzalı inbound webhook, CRM aktarımı ve Cloud API gönderim adapter'ı.</p><small><strong>{status ? statusLabel({ connected: false, configured: status.whatsapp?.configured }) : "DURUM KONTROL EDİLİYOR"}</strong><br />Meta App Secret, Verify Token, access token ve phone number ID beklenir.<br /><button type="button" onClick={() => onNavigate("crm")}>CRM mesaj kayıtlarını aç</button></small></div>
        </article>
        <article className="data-card">
          <div><h3>Web research provider</h3><p>Sunucu tarafında araştırma adapter'ı.</p><small><strong>{status ? statusLabel({ connected: false, configured: status.research?.configured }) : "DURUM KONTROL EDİLİYOR"}</strong><br />RESEARCH_API_URL ve RESEARCH_API_KEY bekleniyor.<br /><button type="button" onClick={() => onNavigate("procurement")}>Araştırma modülünü aç</button></small></div>
        </article>
        <article className="data-card">
          <div><h3>CRM</h3><p>Supabase'e kalıcı CRM CRUD, kaynak takibi ve project ilişkilendirme.</p><small><strong>{status ? statusLabel({ connected: status.crm?.connected, configured: status.crm?.configured }) : "DURUM KONTROL EDİLİYOR"}</strong><br />Şifreli OAuth depolaması için Supabase service-role key gerekir.<br /><button type="button" onClick={() => onNavigate("crm")}>CRM kayıtlarını aç</button></small></div>
        </article>
        <article className="data-card">
          <div><h3>Web sitesi / CMS</h3><p>İmzalı web lead intake ve backend CMS adapter.</p><small><strong>{status ? statusLabel({ connected: false, configured: status.web?.managementConfigured }) : "DURUM KONTROL EDİLİYOR"}</strong><br />WEBSITE_WEBHOOK_SECRET ve CMS provider URL/token ayrı yapılandırılır.<br /><button type="button" onClick={() => onNavigate("website")}>Web Sitesi modülünü aç</button></small></div>
        </article>
        <article className="data-card"><div><h3>Supabase / API</h3><p>Projeler, teklifler, araştırma ve CRM persistence.</p><small><strong>{status ? statusLabel({ connected: status.supabase?.connected, configured: status.supabase?.configured }) : "DURUM KONTROL EDİLİYOR"}</strong><br />SUPABASE_URL, SUPABASE_ANON_KEY ve entegrasyon yazmaları için SUPABASE_SERVICE_ROLE_KEY gerekir.</small></div></article>
      </div>
    </div>
  );
}

function WebsiteWorkspace({ onNavigate, setAiInput }) {
  const prepareWebsitePrompt = () => {
    setAiInput("https://www.ddizaynpro.com/ web sitesinin içeriğini analiz etmek istiyorum. Web erişimi olan AI entegrasyonu bağlı değilse bunu açıkça belirt; site içeriğine eriştiğini varsayma.");
    onNavigate("ai-assistant");
  };

  return (
    <div className="operations-module">
      <div className="panel panel-content website-access">
        <h2>Resmi DOĞRU DİZAYN PRO web sitesi</h2>
        <p>Site yeni sekmede açılır. Bu uygulama web sitesinde içerik değiştirmez.</p>
        <a className="module-action-link" href={WEBSITE_URL} target="_blank" rel="noopener noreferrer">www.ddizaynpro.com ↗</a>
        <p className="status-banner info">Site yönetim paneli/CMS bağlantısı yapılandırılmadı; yönetim işlemi yapılmaz.</p>
        <button type="button" onClick={prepareWebsitePrompt}>Web içeriği için AI çalışma alanına geç</button>
      </div>
    </div>
  );
}

function CalendarWorkspace() {
  const [events, setEvents] = useState(() => readRecords("ddpro_calendar_events_v1"));
  const [remote, setRemote] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const loadEvents = async () => {
    const response = await getGoogleCalendarEvents();
    setEvents(response.data || []);
    setRemote(true);
  };

  useEffect(() => {
    let active = true;
    getGoogleCalendarEvents()
      .then((response) => {
        if (active) {
          setEvents(response.data || []);
          setRemote(true);
        }
      })
      .catch((loadError) => {
        if (active) {
          setRemote(false);
          setError(loadError.message || "Google Calendar oturumu bağlı değil.");
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const createEvent = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    setBusy(true);
    setError("");
    try {
      const start = new Date(values.start);
      const end = new Date(values.end);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
        throw new Error("Etkinlik başlangıç/bitiş zamanı geçersiz.");
      }
      if (remote) {
        await createGoogleCalendarEvent({
          summary: values.summary,
          description: values.description,
          start: start.toISOString(),
          end: end.toISOString(),
        });
        await loadEvents();
        setNotice("Google Calendar etkinliği kaydedildi.");
      } else {
        const next = [
          {
            id: globalThis.crypto?.randomUUID?.() || `${Date.now()}`,
            title: values.summary,
            type: "Yerel görev",
            date: start.toISOString(),
            end: end.toISOString(),
            notes: values.description,
            source: "local",
          },
          ...readRecords("ddpro_calendar_events_v1"),
        ];
        localStorage.setItem("ddpro_calendar_events_v1", JSON.stringify(next));
        setEvents(next);
        setNotice("Etkinlik yalnızca bu tarayıcıda saklandı; Google Calendar'a gönderilmedi.");
      }
      form.reset();
    } catch (createError) {
      setError(createError.message);
    } finally {
      setBusy(false);
    }
  };

  const importLocalEvents = async () => {
    try {
      const imported = await importGoogleCalendarToLocal();
      const next = [...imported, ...readRecords("ddpro_calendar_events_v1")];
      localStorage.setItem("ddpro_calendar_events_v1", JSON.stringify(next));
      setNotice(`${imported.length} etkinlik yerel takvim görünümüne aktarıldı; Google kayıtları değişmedi.`);
    } catch (importError) {
      setError(importError.message);
    }
  };

  return (
    <div className="operations-module">
      <p className={`status-banner ${remote ? "success" : "info"}`}>
        {remote ? "Google Calendar API oturumu bağlı; etkinlik listesi canlı provider'dan." : "Google Calendar bağlı değil; burada sahte etkinlik gösterilmez. Yerel takvim kayıtları CRM/rapor ekranlarında kalır."}
      </p>
      {error ? <p className="status-banner warning">{error}</p> : null}
      {notice ? <p className="status-banner info">{notice}</p> : null}
      {!remote ? <button type="button" onClick={() => { try { beginGoogleConnection(); } catch (e) { setError(e.message); } }}>Google hesabını bağla</button> : (
        <div className="module-toolbar">
          <button type="button" onClick={loadEvents}>Google Calendar'ı yenile</button>
          <button type="button" onClick={importLocalEvents}>Yerel görünüme kopyala</button>
        </div>
      )}
      <form className="data-form" onSubmit={createEvent}>
        <h2>{remote ? "Google Calendar etkinliği oluştur" : "Yerel etkinlik taslağı"}</h2>
        <label>Başlık<input name="summary" required maxLength={500} /></label>
        <label>Başlangıç<input name="start" type="datetime-local" required /></label>
        <label>Bitiş<input name="end" type="datetime-local" required /></label>
        <label>Açıklama<textarea name="description" rows={3} maxLength={5000} /></label>
        <button type="submit" disabled={busy}>{busy ? "Kaydediliyor…" : remote ? "Google Calendar'a kaydet" : "Yerel taslak kaydet"}</button>
      </form>
      <div className="data-list">
        {events.length ? events.map((event) => (
          <article className="data-card" key={event.id || `${event.title}-${event.date}`}>
            <div><h3>{event.summary || event.title || "Takvim etkinliği"}</h3><p>{event.start?.dateTime || event.start?.date || event.date}</p><small>{event.status || event.type || "Google Calendar"}</small></div>
          </article>
        )) : <p className="empty-state">Google Calendar bağlantısı kurulduğunda gerçek etkinlikler burada görünür.</p>}
      </div>
    </div>
  );
}

function CrmWorkspace({ onNavigate, setAiInput }) {
  const [contacts, setContacts] = useState(() => readRecords("ddpro_crm_contacts_v1"));
  const [remoteMode, setRemoteMode] = useState(false);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const reloadRemoteContacts = async () => {
    const response = await getCrmContacts();
    setContacts(response.data || []);
    setRemoteMode(true);
  };

  useEffect(() => {
    let active = true;
    getCrmContacts()
      .then((response) => {
        if (active) {
          setContacts(response.data || []);
          setRemoteMode(true);
          setError("");
        }
      })
      .catch((loadError) => {
        if (active) {
          setRemoteMode(false);
          setError(loadError.message || "CRM backend bağlantısı kullanılamıyor.");
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const saveContact = async (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    const contact = {
      ...values,
      area_m2: values.area_m2 ? Number(values.area_m2) : null,
      source: values.source || "manual",
      project_id: values.project_id || null,
    };
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (remoteMode) {
        const response = editing
          ? await updateCrmContact(editing.id, contact)
          : await createCrmContact(contact);
        await reloadRemoteContacts();
        setNotice(response.duplicate ? "Kaynak kaydı zaten CRM'e aktarılmış." : "CRM kaydı sunucuya kaydedildi.");
      } else if (editing) {
        const next = contacts.map((item) =>
          item.id === editing.id ? { ...item, ...contact } : item
        );
        localStorage.setItem("ddpro_crm_contacts_v1", JSON.stringify(next));
        setContacts(next);
        setNotice("Kayıt bu tarayıcıya yerel olarak kaydedildi; CRM backend bağlı değil.");
      } else {
        const next = [
          { ...contact, id: globalThis.crypto?.randomUUID?.() || `${Date.now()}`, createdAt: timestamp() },
          ...contacts,
        ];
        localStorage.setItem("ddpro_crm_contacts_v1", JSON.stringify(next));
        setContacts(next);
        setNotice("Kayıt bu tarayıcıya yerel olarak kaydedildi; CRM backend bağlı değil.");
      }
      setEditing(null);
      event.currentTarget.reset();
    } catch (saveError) {
      setError(saveError.message || "CRM kaydı kaydedilemedi.");
    } finally {
      setBusy(false);
    }
  };

  const removeContact = async (contact) => {
    setError("");
    try {
      if (remoteMode) {
        await deleteCrmContact(contact.id);
        await reloadRemoteContacts();
      } else {
        const next = contacts.filter((item) => item.id !== contact.id);
        localStorage.setItem("ddpro_crm_contacts_v1", JSON.stringify(next));
        setContacts(next);
      }
    } catch (removeError) {
      setError(removeError.message || "CRM kaydı silinemedi.");
    }
  };

  const connectGoogle = () => {
    try {
      beginGoogleConnection();
    } catch (connectionError) {
      setError(connectionError.message);
    }
  };

  const importGmail = async () => {
    setBusy(true);
    setError("");
    try {
      const response = await importGmailToCrm();
      await reloadRemoteContacts();
      setNotice(`${response.data.imported} Gmail iletisi CRM'e aktarıldı.`);
    } catch (importError) {
      setError(importError.message || "Gmail aktarımı başarısız.");
    } finally {
      setBusy(false);
    }
  };

  const sendWhatsApp = async (contact) => {
    const message = window.prompt(`${contact.phone} numarasına gönderilecek mesajı yazın:`);
    if (!message?.trim()) return;
    try {
      const result = await sendWhatsAppText(contact.phone, message.trim());
      setNotice(`WhatsApp provider mesajı kabul etti (${result.data.id || "message id yok"}).`);
    } catch (sendError) {
      setError(sendError.message || "WhatsApp mesajı gönderilemedi.");
    }
  };

  const field = (name, label, type = "text") => (
    <label key={name}>
      {label}
      <input
        name={name}
        type={type}
        required={name === "name"}
        min={type === "number" ? "0" : undefined}
        step={type === "number" ? "any" : undefined}
        defaultValue={editing?.[name] ?? (name === "contact_date" ? editing?.date : "") ?? ""}
      />
    </label>
  );

  return (
    <div className="operations-module">
      <p className={`status-banner ${remoteMode ? "success" : "info"}`}>
        {remoteMode
          ? "CRM bağlı: kayıtlar Supabase backend üzerinden okunup yazılıyor."
          : "CRM backend oturumu bağlı değil. Yerel kayıtlar yalnızca bu tarayıcıda saklanır."}
      </p>
      {!remoteMode ? (
        <button type="button" onClick={connectGoogle}>Google hesabıyla güvenli CRM oturumu aç</button>
      ) : (
        <div className="module-toolbar">
          <button type="button" disabled={busy} onClick={importGmail}>Gmail taleplerini CRM'e aktar</button>
          <button type="button" onClick={() => getCrmContacts().then(reloadRemoteContacts).catch((e) => setError(e.message))}>CRM'i yenile</button>
        </div>
      )}
      {error ? <p className="status-banner warning">{error}</p> : null}
      {notice ? <p className="status-banner info">{notice}</p> : null}
      <form key={editing?.id || "new-crm-contact"} className="data-form operations-crm-form" onSubmit={saveContact}>
        <h2>{editing ? "CRM kaydını düzenle" : "CRM kaydı oluştur"}</h2>
        {field("contact_date", "Tarih", "date")}
        {field("name", "Ad Soyad")}
        {field("company", "Firma")}
        {field("phone", "Telefon", "tel")}
        {field("email", "E-posta", "email")}
        <label>Talep<textarea name="request" rows={3} defaultValue={editing?.request || ""} /></label>
        {field("project_id", "Proje UUID")}
        {field("system", "Sistem")}
        {field("area_m2", "m²", "number")}
        <label>Durum<input name="status" defaultValue={editing?.status || "Yeni"} /></label>
        <p>Kaynak: {editing?.source || "manual"} (yalnızca doğrulanmış entegrasyonlar kaynak atayabilir)</p>
        <label>Notlar<textarea name="notes" rows={3} defaultValue={editing?.notes || ""} /></label>
        <div className="module-toolbar">
          <button type="submit" disabled={busy}>{busy ? "Kaydediliyor…" : remoteMode ? "CRM'e kaydet" : "Yerel taslak kaydet"}</button>
          {editing ? <button type="button" onClick={() => setEditing(null)}>Düzenlemeyi iptal et</button> : null}
        </div>
      </form>
      <div className="data-list">
        {contacts.length ? contacts.map((contact) => (
          <article className="data-card" key={contact.id}>
            <div>
              <h3>{contact.name}</h3>
              <p>{contact.company} · {contact.email} · {contact.phone}</p>
              <p>{contact.request}</p>
              <small>Kaynak: {contact.source || "manual"} · {contact.status} · {contact.contact_date || contact.date || contact.created_at}</small>
              <div className="module-toolbar">
                <button type="button" onClick={() => setEditing(contact)}>Düzenle</button>
                <button type="button" onClick={() => {
                  setAiInput(`CRM kaydındaki gelen talebi değerlendir ve müşterinin ihtiyacını, belirsiz noktaları ve önerilen sonraki adımları çıkar. Otomatik CRM değişikliği yapma; önerilen alanları kullanıcı onayına sun.\n\nKaynak: ${contact.source || "manual"}\nFirma: ${contact.company || "Belirtilmedi"}\nTalep: ${contact.request || "Talep metni yok"}\nProje: ${contact.project_id || "Belirtilmedi"}\nSistem: ${contact.system || "Belirtilmedi"}`);
                  onNavigate("ai-assistant");
                }}>Talebi AI ile analiz et</button>
                {contact.phone ? <button type="button" onClick={() => sendWhatsApp(contact)}>WhatsApp yanıtı gönder</button> : null}
                <button type="button" onClick={() => removeContact(contact)}>Sil</button>
              </div>
            </div>
          </article>
        )) : <p className="empty-state">CRM kayıtları henüz yok.</p>}
      </div>
    </div>
  );
}

function ReportsWorkspace({ records, projects, offers, research, aiMessages }) {
  const [reportType, setReportType] = useState("Proje raporu");
  const [reports, setReports] = useState(() => readRecords("ddpro_generated_reports_v1"));
  const [error, setError] = useState("");
  const [crmRecords, setCrmRecords] = useState(records.crm);
  const [googleEvents, setGoogleEvents] = useState([]);
  useEffect(() => {
    let active = true;
    getCrmContacts()
      .then((response) => {
        if (active) setCrmRecords(response.data || []);
      })
      .catch(() => {});
    getGoogleCalendarEvents()
      .then((response) => {
        if (active) setGoogleEvents(response.data || []);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  const reportSnapshot = useMemo(
    () => ({
      generatedAt: timestamp(),
      type: reportType,
      sources: {
        projects: projects.map(({ id, name, type, status }) => ({ id, name, type, status })),
        offers: offers.map(({ id, title, amountDisplay, status, source }) => ({ id, title, amountDisplay, status, source })),
        research: research.map(({ id, name, note, status }) => ({ id, name, note, status })),
        crm: crmRecords.map(({ id, name, company, status, source, project_id }) => ({
          id,
          name,
          company,
          status,
          source,
          projectId: project_id,
        })),
        calendarEvents: records.calendar.length,
        googleCalendarEvents: googleEvents.map(({ id, summary, start, status }) => ({
          id,
          summary,
          start: start?.dateTime || start?.date || "",
          status,
        })),
      },
      aiResponses: aiMessages
        .filter((message) => message.role === "assistant" && !message.status)
        .slice(-10)
        .map(({ text, date }) => ({ text, date })),
    }),
    [reportType, projects, offers, research, crmRecords, records.calendar.length, googleEvents]
  );

  const saveReport = (event) => {
    event.preventDefault();
    const report = {
      id: globalThis.crypto?.randomUUID?.() || `${Date.now()}`,
      type: reportType,
      createdAt: timestamp(),
      snapshot: reportSnapshot,
    };
    const next = [report, ...reports];
    try {
      localStorage.setItem("ddpro_generated_reports_v1", JSON.stringify(next));
      setReports(next);
      setError("");
    } catch {
      setError("Rapor tarayıcıda saklanamadı. Depolama alanını kontrol edin.");
    }
  };

  return (
    <div className="operations-module">
      <p className="status-banner info">Rapor, mevcut uygulama verilerinin zaman damgalı yerel anlık görüntüsüdür; eksik veriler tamamlanmış gibi gösterilmez.</p>
      <form className="data-form" onSubmit={saveReport}>
        <label>Rapor türü<select value={reportType} onChange={(event) => setReportType(event.target.value)}>{["Proje raporu", "AI analiz raporu", "Tedarik raporu", "Maliyet raporu", "Teklif raporu"].map((type) => <option key={type}>{type}</option>)}</select></label>
        <button type="submit">Mevcut verilerden rapor anlık görüntüsü oluştur</button>
      </form>
      {error ? <p className="status-banner warning">{error}</p> : null}
      <div className="data-list">
        {reports.length ? reports.map((report) => (
          <article className="data-card" key={report.id}>
            <div><h3>{report.type}</h3><p>{new Date(report.createdAt).toLocaleString("tr-TR")}</p><small>{report.snapshot.sources.projects.length} proje · {report.snapshot.sources.offers.length} teklif · {report.snapshot.sources.research.length} araştırma · {(report.snapshot.sources.crm || []).length} CRM kişi</small><pre>{JSON.stringify(report.snapshot, null, 2)}</pre></div>
          </article>
        )) : <p className="empty-state">Henüz rapor kaydı yok.</p>}
      </div>
    </div>
  );
}

export default function OperationsModule({
  moduleId,
  onNavigate,
  setAiInput,
  projects = [],
  offers = [],
  research = [],
  aiMessages = [],
}) {
  const definition = moduleDefinitions[moduleId];
  const [records, setRecords] = useState(() =>
    definition ? readRecords(definition.storageKey) : []
  );
  const [formOpen, setFormOpen] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (definition) setRecords(readRecords(definition.storageKey));
  }, [definition]);

  useEffect(() => {
    if (!definition || moduleId === "reports") return;
    try {
      localStorage.setItem(definition.storageKey, JSON.stringify(records));
    } catch {
      setError("Kayıt tarayıcıda saklanamadı. Yerel depolama alanını kontrol edin.");
    }
  }, [definition, moduleId, records]);

  if (moduleId === "settings") return <IntegrationSettings onNavigate={onNavigate} />;
  if (moduleId === "website") return <WebsiteWorkspace onNavigate={onNavigate} setAiInput={setAiInput} />;
  if (moduleId === "crm") return <CrmWorkspace onNavigate={onNavigate} setAiInput={setAiInput} />;
  if (moduleId === "calendar") return <CalendarWorkspace />;
  if (moduleId === "reports") {
    return (
      <ReportsWorkspace
        records={{ crm: readRecords("ddpro_crm_contacts_v1"), calendar: readRecords("ddpro_calendar_events_v1") }}
        projects={projects}
        offers={offers}
        research={research}
        aiMessages={aiMessages}
      />
    );
  }
  if (!definition) return null;

  const addRecord = (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    const record = {
      id: globalThis.crypto?.randomUUID?.() || `${Date.now()}`,
      createdAt: timestamp(),
      ...values,
    };
    setRecords((current) => [record, ...current]);
    setFormOpen(false);
    event.currentTarget.reset();
  };

  const removeRecord = (id) =>
    setRecords((current) => current.filter((record) => record.id !== id));

  return (
    <div className="operations-module">
      <p className="status-banner info">{definition.notice}</p>
      <div className="module-toolbar">
        <button type="button" onClick={() => setFormOpen((open) => !open)}>
          {formOpen ? "Formu kapat" : `+ ${definition.title} kaydı ekle`}
        </button>
      </div>
      {formOpen ? (
        <form className="data-form" onSubmit={addRecord}>
          {definition.fields.map((item) => (
            <label key={item.name}>
              {item.label}
              {item.type === "textarea" ? (
                <textarea name={item.name} required={item.required} rows={3} />
              ) : (
                <input name={item.name} type={item.type} required={item.required} min={item.type === "number" ? "0" : undefined} step={item.type === "number" ? "any" : undefined} />
              )}
            </label>
          ))}
          <button type="submit">Kaydı sakla</button>
        </form>
      ) : null}
      {error ? <p className="status-banner warning">{error}</p> : null}
      <div className="data-list">
        {records.length ? records.map((record) => (
          <article className="data-card" key={record.id}>
            <div>
              <h3>{record.name || record.title || record.type || definition.title}</h3>
              {definition.fields.filter((item) => item.name !== "name" && item.name !== "title").map((item) => record[item.name] ? <p key={item.name}><strong>{item.label}:</strong> {record[item.name]}</p> : null)}
              <small>{record.createdAt ? new Date(record.createdAt).toLocaleString("tr-TR") : ""}</small>
            </div>
            <button type="button" onClick={() => removeRecord(record.id)}>Sil</button>
          </article>
        )) : <p className="empty-state">Bu modülde henüz kayıt yok.</p>}
      </div>
    </div>
  );
}
