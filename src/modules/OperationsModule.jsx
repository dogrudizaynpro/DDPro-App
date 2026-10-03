import { useEffect, useMemo, useState } from "react";
import { getIntegrationStatus } from "../services/integrations.service.js";

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

  const readiness = (ready, configuredText, missingText) =>
    ready ? configuredText : missingText;

  return (
    <div className="operations-module">
      <p className="status-banner info">
        API anahtarları uygulama koduna veya tarayıcıya girilmez. Gerekli bilgileri yalnızca güvenli backend ortam değişkenlerinde yapılandırın.
      </p>
      {error ? <p className="status-banner warning">{error}</p> : null}
      <div className="operations-grid">
        <article className="data-card">
          <div><h3>AI Provider</h3><p>Sunucu tarafında OpenAI uyumlu Chat Completions API.</p><small>{status ? readiness(status.ai?.configured, "Kimlik bilgileri var; provider yanıtı ayrıca doğrulanmalı.", "AI_API_URL, AI_API_KEY ve AI_MODEL bekleniyor.") : "Backend durumu kontrol ediliyor."}<br /><button type="button" onClick={() => onNavigate("ai-assistant")}>AI Asistanı aç</button></small></div>
        </article>
        <article className="data-card">
          <div><h3>Gmail / Google</h3><p>OAuth akışı henüz uygulanmadı; e-posta okunmaz veya gönderilmez.</p><small>{status ? readiness(status.gmail?.configured, "OAuth bilgileri tanımlı; OAuth akışı uygulanmalı.", "GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET ve GOOGLE_REDIRECT_URI bekleniyor.") : "Backend durumu kontrol ediliyor."}<br /><button type="button" onClick={() => onNavigate("messages")}>Mesaj merkezini aç</button></small></div>
        </article>
        <article className="data-card">
          <div><h3>CRM</h3><p>İletişim kayıtları bu tarayıcıda saklanıyor; backend CRM servisi bağlı değil.</p><small>Merkezi CRM endpoint ve erişim kontrolü gerekli.<br /><button type="button" onClick={() => onNavigate("crm")}>CRM kayıtlarını aç</button></small></div>
        </article>
        <article className="data-card">
          <div><h3>Web sitesi</h3><p>Resmi DDPro sitesi ayrı sekmede açılır. İçerik yönetimi bağlantısı yoktur.</p><small>Yönetim için yetkili CMS erişimi/API bilgisi gerekir.<br /><button type="button" onClick={() => onNavigate("website")}>Web modülünü aç</button></small></div>
        </article>
        <article className="data-card">
          <div><h3>Supabase / API</h3><p>Mevcut proje, araştırma ve teklif API bağlantısı.</p><small>{status ? readiness(status.supabase?.configured, "Supabase ortam bilgileri tanımlı.", "SUPABASE_URL ve SUPABASE_ANON_KEY bekleniyor.") : "Backend durumu kontrol ediliyor."}</small></div>
        </article>
        <article className="data-card">
          <div><h3>Bildirimler / erişim</h3><p>Bildirim gönderimi ve kullanıcı rolleri henüz yapılandırılmadı.</p><small>Kimlik doğrulama ve bildirim sağlayıcısı entegrasyonu gerekli.</small></div>
        </article>
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

function ReportsWorkspace({ records, projects, offers, research, aiMessages }) {
  const [reportType, setReportType] = useState("Proje raporu");
  const [reports, setReports] = useState(() => readRecords("ddpro_generated_reports_v1"));
  const [error, setError] = useState("");
  const reportSnapshot = useMemo(
    () => ({
      generatedAt: timestamp(),
      type: reportType,
      sources: {
        projects: projects.map(({ id, name, type, status }) => ({ id, name, type, status })),
        offers: offers.map(({ id, title, amountDisplay, status, source }) => ({ id, title, amountDisplay, status, source })),
        research: research.map(({ id, name, note, status }) => ({ id, name, note, status })),
        crm: records.crm.length,
        calendarEvents: records.calendar.length,
      },
      aiResponses: aiMessages
        .filter((message) => message.role === "assistant" && !message.status)
        .slice(-10)
        .map(({ text, date }) => ({ text, date })),
    }),
    [reportType, projects, offers, research, records.crm.length, records.calendar.length]
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
            <div><h3>{report.type}</h3><p>{new Date(report.createdAt).toLocaleString("tr-TR")}</p><small>{report.snapshot.sources.projects.length} proje · {report.snapshot.sources.offers.length} teklif · {report.snapshot.sources.research.length} araştırma</small><pre>{JSON.stringify(report.snapshot, null, 2)}</pre></div>
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
