import { useEffect, useMemo, useState } from "react";
import {
  getIntegrationStatus,
  testIntegrationConnection,
} from "../services/integrations.service.js";
import { CAN_USE_LOCAL_FALLBACK } from "../services/api.js";
import {
  beginGoogleConnection,
  completeGoogleConnection,
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

const integrationCatalog = [
  {
    id: "gmail",
    title: "Gmail",
    description: "OAuth ile gelen e-postaları yetkili oturumdan CRM'e aktarır.",
    variables: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REDIRECT_URI", "GOOGLE_ALLOWED_EMAILS", "INTEGRATION_SESSION_SECRET", "INTEGRATION_TOKEN_ENCRYPTION_KEY", "SUPABASE_SERVICE_ROLE_KEY"],
    moduleId: "crm",
    action: "Google hesabını bağla",
    requiresOAuth: true,
  },
  {
    id: "googleCalendar",
    title: "Google Calendar",
    description: "OAuth üzerinden gerçek takvim etkinliklerini okur ve oluşturur.",
    variables: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REDIRECT_URI", "GOOGLE_ALLOWED_EMAILS", "INTEGRATION_SESSION_SECRET", "INTEGRATION_TOKEN_ENCRYPTION_KEY", "SUPABASE_SERVICE_ROLE_KEY"],
    moduleId: "calendar",
    requiresOAuth: true,
  },
  {
    id: "whatsapp",
    title: "WhatsApp Business / Cloud API",
    description: "İmzalı webhook, CRM lead aktarımı ve Cloud API mesaj gönderimi.",
    variables: ["WHATSAPP_ACCESS_TOKEN", "WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_API_VERSION", "WHATSAPP_APP_SECRET", "WHATSAPP_VERIFY_TOKEN"],
    moduleId: "crm",
  },
  {
    id: "crm",
    title: "CRM",
    description: "Supabase üzerinde kalıcı müşteri kayıtları ve kaynak ilişkileri.",
    variables: ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "INTEGRATION_TOKEN_ENCRYPTION_KEY", "Google OAuth oturumu", "004_operations_integrations.sql migration"],
    moduleId: "crm",
    requiresOAuth: true,
  },
  {
    id: "website",
    title: "DDPro Web Sitesi / CMS",
    description: "ddizaynpro.com web lead ve CMS provider bağlantısı.",
    variables: ["WEBSITE_WEBHOOK_SECRET", "WEBSITE_CMS_API_URL", "WEBSITE_CMS_API_TOKEN"],
    moduleId: "website",
  },
  {
    id: "appStore",
    title: "App Store Connect / Apple",
    description: "Sunucu tarafında App Store Connect API erişimi; mobil dağıtım başlatmaz.",
    variables: ["APPLE_ISSUER_ID", "APPLE_KEY_ID", "APPLE_PRIVATE_KEY"],
    moduleId: "settings",
  },
  {
    id: "supabase",
    title: "Supabase",
    description: "Proje veritabanı ve güvenli entegrasyon deposu bağlantısı.",
    variables: ["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "004_operations_integrations.sql migration"],
    moduleId: "projects",
  },
  {
    id: "ai",
    title: "AI Provider",
    description: "Backend üzerinden OpenAI uyumlu Chat Completions provider'ı; test kısa bir istek gönderir ve provider kullanımına sayılabilir.",
    variables: ["AI_API_URL", "AI_API_KEY", "AI_MODEL"],
    moduleId: "ai-assistant",
  },
  {
    id: "research",
    title: "Web araştırma servisi",
    description: "Gerçek harici araştırma sağlayıcısı; kaynak/fiyat doğrulaması ayrıca gerekir.",
    variables: ["RESEARCH_API_URL", "RESEARCH_API_KEY"],
    moduleId: "procurement",
  },
];

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

function IntegrationSettings({ onNavigate, hubMode = false }) {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState("");
  const [testing, setTesting] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = async () => {
    setError("");
    try {
      setStatus(await getIntegrationStatus());
    } catch (statusError) {
      setError(statusError.message || "Entegrasyon durumu backend'den alınamadı.");
    }
  };

  useEffect(() => {
    let active = true;
    const queryString = window.location.hash.split("?")[1] || "";
    const oauthResult = new URLSearchParams(queryString);
    const exchangeCode = oauthResult.get("exchange_code");
    if (exchangeCode) {
      oauthResult.delete("exchange_code");
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#${window.location.hash.split("?")[0].slice(1)}?${oauthResult}`);
    }
    if (oauthResult.get("integration") === "google_connected") {
      setNotice("Google hesabı güvenli OAuth akışıyla bağlandı. Gmail ve Google Calendar durumları backend'den doğrulanıyor.");
    } else if (oauthResult.get("integration") === "google_error") {
      const reasons = {
        configuration_required: "Google OAuth backend yapılandırması eksik.",
        state_invalid: "Google OAuth güvenlik kontrolü başarısız; tekrar deneyin.",
        access_denied: "Google hesap erişimi verilmedi veya iptal edildi.",
        token_exchange_failed: "Google OAuth token değişimi başarısız.",
        account_not_allowed: "Bu Google hesabı DDPro izin listesinde değil.",
        provider_unavailable: "Google bağlantısı tamamlanamadı. Backend yapılandırmasını ve bağlantı durumunu kontrol edin.",
      };
      setError(reasons[oauthResult.get("reason")] || "Google OAuth bağlantısı tamamlanamadı.");
    }
    const loadStatus = async () => {
      await completeGoogleConnection(exchangeCode);
      return getIntegrationStatus();
    };
    loadStatus()
      .then((value) => {
        if (active) setStatus(value);
      })
      .catch((loadError) => {
        if (active) setError(loadError.message || "Entegrasyon durumu backend'den alınamadı.");
      });
    return () => {
      active = false;
    };
  }, []);

  const statusLabel = ({ connected = false, configured = false, status: state = "" } = {}) => {
    if (connected) return "BAĞLI";
    if (!configured) return "YAPILANDIRMA GEREKLİ";
    if (state === "test_failed") return "BAĞLANTI TESTİ BAŞARISIZ";
    return "BAĞLI DEĞİL · bağlantı testi/oturum bekleniyor";
  };

  const startGoogleOAuth = async () => {
    try {
      await beginGoogleConnection();
    } catch (connectionError) {
      setError(connectionError.message);
    }
  };

  const disconnectGoogleAccount = async () => {
    try {
      const response = await disconnectGoogle();
      setNotice(response.data?.providerRevoked
        ? "Google erişimi sağlayıcıda iptal edildi; Gmail ve Calendar oturumu kapatıldı."
        : "DDPro token'ı kaldırıldı ve oturum kapatıldı. Google sağlayıcısı token iptalini doğrulamadı; Google hesap izinlerini kontrol edin.");
      await refresh();
    } catch (disconnectError) {
      setError(disconnectError.message || "Google bağlantısı kapatılamadı.");
    }
  };

  const runConnectionTest = async (provider) => {
    setTesting(provider);
    setError("");
    setNotice("");
    try {
      await testIntegrationConnection(provider);
      setNotice(`${integrationCatalog.find((item) => item.id === provider)?.title || provider} bağlantı testi başarılı.`);
      await refresh();
    } catch (testError) {
      setError(testError.message || "Bağlantı testi başarısız.");
      await refresh();
    } finally {
      setTesting("");
    }
  };

  const providerStatus = (integration) => {
    if (integration.id === "website") return status?.web;
    return status?.[integration.id];
  };

  return (
    <div className="operations-module">
      {hubMode ? (
        <div className="panel-header integration-hub-heading">
          <div><h2>ENTEGRASYON MERKEZİ</h2><p>Sunucu bağlantılarını sınayın ve gerçek durumlarını görüntüleyin.</p></div>
          <button type="button" onClick={refresh}>Durumları yenile</button>
        </div>
      ) : (
        <div className="panel-header integration-settings-link">
          <div><h2>Entegrasyon ayarları</h2><p>Bağlantı ve provider durumlarını merkezi alanda yönetin.</p></div>
          <button type="button" onClick={() => onNavigate("integrations")}>Entegrasyon Merkezi ↗</button>
        </div>
      )}
      <p className="status-banner info">API anahtarı, OAuth secret veya token bu arayüze girilmez. Credential değerlerini yalnızca backend environment variables üzerinden yönetin. Environment ile yönetilen servislerin bağlantısını kesmek için ilgili değişkenleri kaldırıp backend'i yeniden başlatın.</p>
      {error ? <p className="status-banner warning">{error}</p> : null}
      {notice ? <p className="status-banner success">{notice}</p> : null}
      <div className="operations-grid">
        {integrationCatalog.map((integration) => {
          const connection = providerStatus(integration);
          const configured = integration.id === "gmail" || integration.id === "googleCalendar"
            ? connection?.oauthFlowAvailable
            : integration.id === "website"
              ? connection?.managementConfigured && connection?.inboundLeadConfigured
              : integration.id === "whatsapp"
                ? connection?.configured
                : connection?.configured;
          const isGoogleConnected = status?.google?.connected;
          return (
            <article className="data-card integration-card" key={integration.id}>
              <div>
                <div className="integration-card-heading"><h3>{integration.title}</h3><span className={`integration-state${connection?.connected ? " is-connected" : connection?.status === "test_failed" ? " has-error" : ""}`}>{status ? statusLabel({ connected: connection?.connected, configured, status: connection?.status }) : "DURUM KONTROL EDİLİYOR"}</span></div>
                <p>{integration.description}</p>
                <small><strong>Gerekli backend yapılandırması</strong><br />{integration.variables.join(" · ")}<br />
                  {connection?.lastTest?.testedAt ? `Son test: ${new Date(connection.lastTest.testedAt).toLocaleString("tr-TR")}` : "Henüz bağlantı testi çalıştırılmadı."}
                  {connection?.checkedAt ? <span className="integration-check-time">Son kontrol: {new Date(connection.checkedAt).toLocaleString("tr-TR")}</span> : null}
                  {connection?.lastTest?.error ? <span className="integration-error">{connection.lastTest.error}</span> : null}
                  <div className="module-toolbar integration-actions">
                    {integration.requiresOAuth && !isGoogleConnected ? <button type="button" onClick={startGoogleOAuth}>Google hesabını bağla</button> : null}
                    <button type="button" disabled={!configured || testing === integration.id || (integration.requiresOAuth && !isGoogleConnected)} onClick={() => runConnectionTest(integration.id)}>{testing === integration.id ? "Test ediliyor…" : "Bağlantıyı test et"}</button>
                    {integration.requiresOAuth && isGoogleConnected ? <button type="button" onClick={disconnectGoogleAccount}>Google bağlantısını kes (Gmail + Calendar)</button> : null}
                    <button type="button" onClick={() => onNavigate(integration.moduleId)}>{integration.moduleId === "ai-assistant" ? "AI TRADE'i aç" : "Modülü aç"}</button>
                  </div>
                  <span className="integration-secret-note">Credential alanları yalnızca sunucu environment variables üzerinden tanımlanır; secret değeri uygulamada gösterilmez.</span>
                </small>
              </div>
            </article>
          );
        })}
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
  const [contacts, setContacts] = useState(() =>
    CAN_USE_LOCAL_FALLBACK ? readRecords("ddpro_crm_contacts_v1") : []
  );
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
          if (!CAN_USE_LOCAL_FALLBACK) setContacts([]);
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
      if (remoteMode || !CAN_USE_LOCAL_FALLBACK) {
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
      setError(`CRM kaydı kaydedilmedi: ${saveError.message || "CRM backend bağlantısı kullanılamıyor."}`);
    } finally {
      setBusy(false);
    }
  };

  const removeContact = async (contact) => {
    setError("");
    try {
      if (remoteMode || !CAN_USE_LOCAL_FALLBACK) {
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
          : CAN_USE_LOCAL_FALLBACK
            ? "CRM backend oturumu bağlı değil. Yerel kayıtlar yalnızca bu tarayıcıda saklanır."
            : "CRM backend oturumu bağlı değil. Kayıtlar gösterilmiyor veya tarayıcıya kaydedilmiyor."}
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
          <button type="submit" disabled={busy}>{busy ? "Kaydediliyor…" : remoteMode || !CAN_USE_LOCAL_FALLBACK ? "CRM'e kaydet" : "Yerel taslak kaydet"}</button>
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
    definition && moduleId !== "crm" ? readRecords(definition.storageKey) : []
  );
  const [formOpen, setFormOpen] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (definition && moduleId !== "crm") {
      setRecords(readRecords(definition.storageKey));
    }
  }, [definition]);

  useEffect(() => {
    if (!definition || moduleId === "reports" || moduleId === "crm") return;
    try {
      localStorage.setItem(definition.storageKey, JSON.stringify(records));
    } catch {
      setError("Kayıt tarayıcıda saklanamadı. Yerel depolama alanını kontrol edin.");
    }
  }, [definition, moduleId, records]);

  if (moduleId === "settings") return <IntegrationSettings onNavigate={onNavigate} />;
  if (moduleId === "integrations") return <IntegrationSettings onNavigate={onNavigate} hubMode />;
  if (moduleId === "website") return <WebsiteWorkspace onNavigate={onNavigate} setAiInput={setAiInput} />;
  if (moduleId === "crm") return <CrmWorkspace onNavigate={onNavigate} setAiInput={setAiInput} />;
  if (moduleId === "calendar") return <CalendarWorkspace />;
  if (moduleId === "reports") {
    return (
      <ReportsWorkspace
        records={{
          crm: CAN_USE_LOCAL_FALLBACK ? readRecords("ddpro_crm_contacts_v1") : [],
          calendar: readRecords("ddpro_calendar_events_v1"),
        }}
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
