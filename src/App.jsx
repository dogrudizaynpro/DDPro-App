import { lazy, Suspense, useEffect, useId, useMemo, useRef, useState } from "react";
import ddproMasterLogo from "./assets/DDPRO_LOGO_MASTER_V1_EXACT.png";
import dashboardDesignReference from "./assets/DDPro-Dashboard-Referans.png";
import DDProIcon from "./components/DDProIcon.jsx";
import {
  createProject as createProjectRequest,
  deleteProject as deleteProjectRequest,
  getProjects,
  importAiFileProjects,
  previewAiFileProjectImport,
  updateProject as updateProjectRequest,
} from "./services/projects.service.js";
import "./styles.css";
import {
  createOffer as createOfferRequest,
  deleteOffer as deleteOfferRequest,
  getOfferById,
  getOffers,
  mapOfferToViewModel,
  mapOffersToViewModel,
  updateOffer as updateOfferRequest,
} from "./services/offers.service.js";
import {
  CAN_USE_LOCAL_FALLBACK,
  getApiHealth,
} from "./services/api.js";
import {
  confirmAiAction as confirmAiActionRequest,
  getAiUsageCount,
  requestAiCompletion,
} from "./services/ai.service.js";
import { getCatalogRecords } from "./services/catalog.service.js";
import { getReports } from "./services/reports.service.js";
import { getDocuments } from "./services/documents.service.js";
import { getFinanceCosts } from "./services/finance.service.js";
import {
  getCrmContacts,
  getGoogleCalendarEvents,
} from "./services/operations-integrations.service.js";
import { getIntegrationStatus } from "./services/integrations.service.js";
import {
  createResearchItem as createProcurementRequest,
  deleteResearchItem as deleteProcurementRequest,
  getResearchItems as getProcurementItems,
  updateResearchItem as updateProcurementRequest,
} from "./services/research.service.js";

const ProjectsModule = lazy(() => import("./modules/ProjectsModule.jsx"));
const ProcurementModule = lazy(() => import("./modules/ProcurementModule.jsx"));
const OffersModule = lazy(() => import("./modules/OffersModule.jsx"));
const CRMModule = lazy(() => import("./modules/CRMModule.jsx"));
const SystemsModule = lazy(() => import("./modules/SystemsModule.jsx"));
const AIModule = lazy(() => import("./modules/AIModule.jsx"));
const MessagesModule = lazy(() => import("./modules/MessagesModule.jsx"));
const DocumentsModule = lazy(() => import("./modules/DocumentsModule.jsx"));
const SkeletonModule = lazy(() => import("./modules/SkeletonModule.jsx"));
const OperationsModule = lazy(() => import("./modules/OperationsModule.jsx"));

const STORAGE_KEYS = {
  projects: "ddpro_projects_v1",
  procurement: "ddpro_research_v1",
  offers: "ddpro_offers_v1",
  memory: "ddpro_memory_v1",
  logs: "ddpro_system_logs_v1",
  products: "ddpro_products_v1",
  systems: "ddpro_system_inventory_v1",
  priceAnalysis: "ddpro_price_analysis_v1",
  materialAnalysis: "ddpro_material_analysis_v1",
  customers: "ddpro_customers_v1",
  reports: "ddpro_reports_v1",
};

const useCatalogDataState = (resource) => {
  const [value, setValue] = useState(EMPTY_ITEMS);
  useEffect(() => {
    let active = true;
    getCatalogRecords(resource)
      .then((records) => { if (active) setValue(records); })
      .catch(() => { if (active) setValue(EMPTY_ITEMS); });
    return () => { active = false; };
  }, [resource]);
  return value;
};

const modules = [
  {
    id: "dashboard",
    path: "/dashboard",
    icon: "⌂",
    title: "Genel Bakış",
    short: "Ana Ekran",
    description:
      "DDPro operasyonlarının merkezi görünümü.",
  },
  {
    id: "projects",
    path: "/projeler",
    icon: "▣",
    title: "Projeler",
    short: "Proje Yönetimi",
    description:
      "Aktif projelerini oluştur, yönet, düzenle ve tüm süreçlerini merkezi olarak takip et.",
  },
  {
    id: "products",
    path: "/urunler",
    icon: "◈",
    title: "Ürünler",
    short: "Ürün Yönetimi",
    description:
      "Ürün veri yapısı ve ürün kartlarının yönetim alanı.",
  },
  {
    id: "systems",
    path: "/sistemler",
    icon: "⚙",
    title: "Sistemler",
    short: "Sistem Yönetimi",
    description:
      "Sistem bileşenleri, entegrasyonlar ve sistem kayıtları.",
  },
  {
    id: "price-analysis",
    path: "/fiyat-analizi",
    icon: "₺",
    title: "Fiyat Analizi",
    short: "Fiyat Merkezi",
    description:
      "Fiyat analiz kayıtları ve karşılaştırma ekranları.",
  },
  {
    id: "material-analysis",
    path: "/malzeme-analizi",
    icon: "⛁",
    title: "Malzeme Analizi",
    short: "Maliyet Merkezi",
    description:
      "Malzeme maliyet analizlerini bağımsız olarak yönet.",
  },
  {
    id: "offers",
    path: "/teklifler",
    icon: "€",
    title: "Teklifler",
    short: "Teklif Sistemi",
    description:
      "Tekliflerini oluştur, kayıt altına al, takip et ve proje süreçleriyle ilişkilendir.",
  },
  {
    id: "crm",
    path: "/musteriler-crm",
    icon: "☰",
    title: "Müşteriler / CRM",
    short: "CRM Yönetimi",
    description:
      "Müşteri ilişkileri ve CRM kayıtları için merkezi çalışma alanı.",
  },
  {
    id: "procurement",
    path: "/tedarik",
    icon: "⌕",
    title: "Tedarik",
    short: "Tedarik Yönetimi",
    description:
      "Tedarik araştırmaları ve kayıtları için operasyon ekranı.",
  },
  {
    id: "documents",
    path: "/belgeler",
    icon: "☷",
    title: "Belgeler",
    short: "Belge Yönetimi",
    description:
      "Belge arşivi ve doküman takibi için temel iskelet ekranı.",
  },
  {
    id: "ai-assistant",
    path: "/ai-asistan",
    icon: "✦",
    title: "AI Asistan",
    short: "Yapay Zeka",
    description:
      "DDPro AI çalışma alanı ve asistan konuşma akışı.",
  },
  {
    id: "calendar",
    path: "/takvim",
    icon: "▦",
    title: "Takvim",
    short: "Proje Takvimi",
    description:
      "Aylık takvim görünümü. Etkinlik verileri backend bağlantısı bekliyor.",
  },
  {
    id: "messages",
    path: "/mesajlar",
    icon: "✉",
    title: "Mesajlar",
    short: "Mesaj Merkezi",
    description:
      "Proje ve müşteri ilişkili kalıcı konuşma kayıtları.",
  },
  {
    id: "finance",
    path: "/finans-maliyet",
    icon: "⟐",
    title: "Finans / Maliyet",
    short: "Finans Yönetimi",
    description:
      "Finansal özetler, maliyet kırılımları ve bütçe takibi.",
  },
  {
    id: "reports",
    path: "/raporlar",
    icon: "☲",
    title: "Raporlar",
    short: "Rapor Merkezi",
    description:
      "Operasyonel ve yönetsel rapor ekranları için temel yapı.",
  },
  {
    id: "settings",
    path: "/ayarlar",
    icon: "⚚",
    title: "Ayarlar",
    short: "Yapılandırma",
    description:
      "Uygulama tercihleri ve sistem ayarları yönetimi.",
  },
  {
    id: "integrations",
    path: "/entegrasyon-merkezi",
    icon: "⌘",
    title: "Entegrasyon Merkezi",
    short: "Bağlantı Yönetimi",
    description:
      "Harici servis bağlantıları, yapılandırma gereksinimleri ve canlı bağlantı testleri.",
  },
  {
    id: "website",
    path: "/web-sitesi",
    icon: "↗",
    title: "Web Sitesi",
    short: "Resmi Site",
    description:
      "Resmi DOĞRU DİZAYN PRO web sitesi ve açıkça belirtilen entegrasyon durumu.",
  },
];

const dashboardReferenceNavigation = [
  { label: "Genel Bakış", moduleId: "dashboard" },
  { label: "Projeler", moduleId: "projects" },
  { label: "Tedarik ve araştırma", moduleId: "procurement" },
  { label: "AI Asistan", moduleId: "ai-assistant" },
  { label: "Takvim ve proje planı", moduleId: "calendar" },
  { label: "Mesajlar ve AI çalışma alanı", moduleId: "messages" },
  { label: "Raporlar", moduleId: "reports" },
  { label: "Ayarlar", moduleId: "settings" },
  { label: "Web sitesi", moduleId: "website" },
];

const moduleRouteMap = Object.fromEntries(
  modules.map((module) => [module.id, module.path])
);

const routeModuleMap = Object.fromEntries(
  modules.flatMap((module) => [[`/${module.id}`, module.id], [module.path, module.id]])
);
const moduleIds = new Set(modules.map((module) => module.id));
const dashboardQuickAccessModuleIds = new Set([
  "offers",
  "procurement",
  "ai-assistant",
  "reports",
]);
const calendarMonthFormatter = new Intl.DateTimeFormat("tr-TR", {
  month: "short",
  year: "numeric",
});
const footerDateFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "2-digit",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "Europe/Istanbul",
});

const normalizeModulePath = (pathValue) => {
  const sanitizedPath = (pathValue || "").trim();
  const normalizedBasePath = sanitizedPath.replace(/\/+$/, "");

  if (!normalizedBasePath) {
    return "/dashboard";
  }

  return normalizedBasePath.startsWith("/")
    ? normalizedBasePath
    : `/${normalizedBasePath}`;
};

const resolveModuleFromHash = (hashValue) => {
  const rawPath = (hashValue || "").replace(/^#/, "").trim();
  const pathOnly = rawPath.match(/^[^?#]*/)?.[0] || "";
  const normalizedPath = normalizeModulePath(pathOnly);
  return routeModuleMap[normalizedPath] || "dashboard";
};

const OFFER_STATUS_TONES = {
  Hazırlanıyor: "pending",
  Gönderildi: "info",
  Onaylandı: "success",
  Reddedildi: "danger",
};

const getOfferStatusTone = (status) =>
  OFFER_STATUS_TONES[status] || "neutral";

const getOfferCacheSignature = (offer) =>
  [
    offer?.id,
    offer?.title,
    offer?.amountDisplay,
    offer?.status,
    offer?.date,
    offer?.source,
    offer?.currency,
    offer?.projectId,
  ].join("::");

const mergeOffers = (apiOffers, storedOffers) => {
  const storedViewModels = mapOffersToViewModel(storedOffers);
  const apiIds = new Set(apiOffers.map((offer) => offer.id));
  const localOnlyOffers = storedViewModels.filter(
    (offer) => offer.source === "local" && !apiIds.has(offer.id)
  );

  return [...apiOffers, ...localOnlyOffers];
};

const EMPTY_ITEMS = Object.freeze([]);
const LOCAL_ONLY_MODULE_MESSAGE =
  "Bu modül production API'ye bağlı değil. Bu sürümde yalnızca arayüz ve tarayıcı içi kayıt alanı hazır.";

const getStoredData = (key, fallback = EMPTY_ITEMS) => {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

const useStoredDataState = (key, fallback = EMPTY_ITEMS) => {
  const [value, setValue] = useState(() => getStoredData(key, fallback));

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  useEffect(() => {
    const syncStoredValue = (event) => {
      if (event.key === null || event.key === key) {
        setValue(getStoredData(key, fallback));
      }
    };

    window.addEventListener("storage", syncStoredValue);

    return () => {
      window.removeEventListener("storage", syncStoredValue);
    };
  }, [key, fallback]);

  return [value, setValue];
};

const createId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const isUuid = (value) =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );

const formatDate = () =>
  new Date().toLocaleString("tr-TR", {
    dateStyle: "short",
    timeStyle: "short",
  });

function DashboardCalendar({
  now,
  title = "YAKLAŞAN TAKVİM",
  onOpenCalendar,
  events = [],
  fetchState = "loading",
}) {
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const leadingDays = (monthStart.getDay() + 6) % 7;

  return (
    <section className="panel calendar-panel">
      <div className="panel-header">
        <h2>{title}</h2>
        {onOpenCalendar ? (
          <button type="button" className="calendar-open-button" onClick={onOpenCalendar}>
            {calendarMonthFormatter.format(now)}
          </button>
        ) : (
          <span className="calendar-month">{calendarMonthFormatter.format(now)}</span>
        )}
      </div>
      <div className="calendar-widget">
        <div className="calendar-weekdays" aria-hidden="true">
          {["Pt", "Sa", "Ça", "Pe", "Cu", "Ct", "Pa"].map((day) => (
            <span key={day}>{day}</span>
          ))}
        </div>
        <div className="calendar-days">
          {Array.from({ length: leadingDays }, (_, index) => (
            <span className="calendar-day muted" key={`blank-${index}`} aria-hidden="true" />
          ))}
          {Array.from({ length: daysInMonth }, (_, index) => {
            const day = index + 1;
            return (
              <span
                className={`calendar-day${day === now.getDate() ? " today" : ""}`}
                key={day}
                aria-current={day === now.getDate() ? "date" : undefined}
              >
                {day}
              </span>
            );
          })}
        </div>
        {fetchState === "loading" ? (
          <div className="calendar-empty"><span className="status-dot" aria-hidden="true" /><p>Google Calendar verisi yükleniyor…</p></div>
        ) : fetchState === "error" ? (
          <div className="calendar-empty"><span className="status-dot warning" aria-hidden="true" /><p>Google Calendar verisi alınamadı.</p></div>
        ) : fetchState === "unavailable" ? (
          <div className="calendar-empty"><span className="status-dot" aria-hidden="true" /><p>Yaklaşan etkinlikler için Google Calendar bağlantısı gerekli.</p></div>
        ) : events.length === 0 ? (
          <div className="calendar-empty"><span className="status-dot" aria-hidden="true" /><p>Yaklaşan etkinlik bulunmuyor.</p></div>
        ) : (
          <div className="calendar-upcoming-list">
            {events.slice(0, 3).map((event) => {
              const start = event.start?.dateTime || event.start?.date;
              const dateLabel = start
                ? new Date(start).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: event.start?.dateTime ? "short" : undefined })
                : "Tarih belirtilmedi";
              return (
                <div className="calendar-upcoming-item" key={event.id}>
                  <strong>{event.summary || "Başlıksız etkinlik"}</strong>
                  <small>{dateLabel}</small>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

const getInitialItems = (key, fallback = EMPTY_ITEMS) =>
  CAN_USE_LOCAL_FALLBACK ? getStoredData(key, fallback) : fallback;

const getApiFailureReason = (error) => {
  if (!error) {
    return "Bilinmeyen hata";
  }

  if (error.code === "API_CONFIGURATION_ERROR") {
    return error.message;
  }

  if (error.status === 503) {
    return "Backend veritabanı yapılandırması eksik veya servis hazır değil (HTTP 503)";
  }

  if (error.status === 404) {
    return "İstenen API rotası bulunamadı (HTTP 404)";
  }

  if (error.message) {
    return error.message;
  }

  return "Bilinmeyen hata";
};

const getApiStatusCode = (error) =>
  error?.status || error?.statusCode || error?.data?.statusCode || null;

const integrationStatusQuestion = (message) => {
  const text = message.toLocaleLowerCase("tr-TR");
  if (!/bağlı|bagli|bağlant|baglanti|hazır|hazir|durum|entegrasyon|çalışıyor mu|çalışır mı|connected|connection|status|ready/i.test(text)) {
    return null;
  }
  if (/gmail|e-posta|email/.test(text)) return ["Gmail", "gmail"];
  if (/google calendar|google takvim/.test(text)) return ["Google Calendar", "googleCalendar"];
  if (/whatsapp/.test(text)) return ["WhatsApp Business", "whatsapp"];
  if (/app store|apple|ios|ipad/.test(text)) return ["App Store Connect / Apple", "appStore"];
  if (/crm|müşteri yönetimi/.test(text)) return ["CRM", "crm"];
  if (/web sitesi|cms|ddpro web/.test(text)) return ["DDPro Web Sitesi / CMS", "web"];
  if (/supabase|veritabanı|database/.test(text)) return ["Supabase", "supabase"];
  if (/web araştırma|araştırma servisi|research provider/.test(text)) return ["Web araştırma servisi", "research"];
  if (/ai provider|ai sağlayıcı|yapay zeka bağlant|ai bağlant|ai connection/.test(text)) return ["AI Provider", "ai"];
  if (/google|takvim|calendar/.test(text)) return ["Google Calendar", "googleCalendar"];
  if (/entegrasyon|bağlantı|bağlı/.test(text)) return ["Entegrasyonlar", null];
  return null;
};

const describeIntegrationStatus = (label, key, status) => {
  const stateLabel = (entry) => {
    if (!entry) return "durumu bu yanıtta alınamadı";
    if (entry.connected) return "BAĞLI";
    if (!entry.configured) return "YAPILANDIRMA GEREKLİ";
    if (entry.status === "test_failed") return `BAĞLI DEĞİL · son test başarısız: ${entry.lastTest?.error || "ayrıntı yok"}`;
    return "BAĞLI DEĞİL · OAuth oturumu veya başarılı bağlantı testi bekliyor";
  };
  if (key) return `${label}: ${stateLabel(status[key])}. Durum uygulamanın entegrasyon API'sinden alındı.`;
  return `Gerçek backend durumuna göre entegrasyonlar: ${[
    ["Gmail", status.gmail],
    ["Google Calendar", status.googleCalendar],
    ["WhatsApp", status.whatsapp],
    ["CRM", status.crm],
    ["Web sitesi/CMS", status.web],
    ["Apple App Store Connect", status.appStore],
    ["Supabase", status.supabase],
    ["AI Provider", status.ai],
    ["Web araştırma", status.research],
  ].map(([name, entry]) => `${name}: ${stateLabel(entry)}`).join("; ")}.`;
};

function App() {
  const dashboardMapId = useId().replace(/:/g, "");
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [activeModule, setActiveModule] = useState(() =>
    resolveModuleFromHash(window.location.hash)
  );
  const [selectedProjectId, setSelectedProjectId] = useState(() => {
    const hashPath = window.location.hash.replace(/^#/, "");
    return new URLSearchParams(hashPath.slice(hashPath.indexOf("?") + 1)).get("id") || "";
  });
  const [showDashboardReference, setShowDashboardReference] = useState(true);
  const dashboardReferenceDialogRef = useRef(null);
  const dashboardReferenceLiveRef = useRef(null);
  const dashboardReferenceReturnRef = useRef(null);

  const [apiHealthState, setApiHealthState] = useState({
    status: "loading",
    message: "",
  });
  const [integrationState, setIntegrationState] = useState(null);

  const [projects, setProjects] = useState(() => getInitialItems(STORAGE_KEYS.projects));

  const [projectsLoading, setProjectsLoading] = useState(true);
  const [projectsError, setProjectsError] = useState(null);
  const [projectsFetchState, setProjectsFetchState] = useState("loading");

  const [procurementItems, setProcurementItems] = useState(() =>
    getInitialItems(STORAGE_KEYS.procurement)
  );
  const [procurementLoading, setProcurementLoading] = useState(true);
  const [procurementError, setProcurementError] = useState(null);
  const [procurementFetchState, setProcurementFetchState] = useState("loading");

  const [offers, setOffers] = useState(() =>
    mapOffersToViewModel(getInitialItems(STORAGE_KEYS.offers))
  );

  const [offersLoading, setOffersLoading] = useState(true);
  const [offersError, setOffersError] = useState(null);
  const [offersFetchState, setOffersFetchState] = useState("loading");
  const [offersReloadKey, setOffersReloadKey] = useState(0);
  const [selectedOfferId, setSelectedOfferId] = useState(null);
  const [selectedOfferDetail, setSelectedOfferDetail] = useState(null);
  const [offerDetailLoading, setOfferDetailLoading] = useState(false);
  const [offerDetailError, setOfferDetailError] = useState(null);
  const projectsTouchedRef = useRef(0);
  const procurementTouchedRef = useRef(0);
  const offersTouchedRef = useRef(0);
  const projectsActiveMutationsRef = useRef(0);
  const procurementActiveMutationsRef = useRef(0);
  const offersActiveMutationsRef = useRef(0);
  const offerDetailsCacheRef = useRef(new Map());

  const [memoryItems, setMemoryItems] = useState(() =>
    getStoredData(STORAGE_KEYS.memory)
  );

  const [systemLogs, setSystemLogs] = useState(() =>
    getStoredData(STORAGE_KEYS.logs)
  );

  const products = useCatalogDataState("products");
  const systemInventory = useCatalogDataState("systems");
  const priceAnalysisItems = useCatalogDataState("price-analysis");
  const materialAnalysisItems = useCatalogDataState("material-analysis");
  const [customerItems] = useStoredDataState(STORAGE_KEYS.customers);
  const [documentItems, setDocumentItems] = useState([]);
  const [financeItems, setFinanceItems] = useState([]);
  const [reportItems, setReportItems] = useState([]);
  const [aiAnalysisCount, setAiAnalysisCount] = useState(0);
  const [aiUsageFetchState, setAiUsageFetchState] = useState("loading");
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [calendarFetchState, setCalendarFetchState] = useState("loading");

  const [showProjectForm, setShowProjectForm] = useState(false);
  const [showProcurementForm, setShowProcurementForm] = useState(false);
  const [showOfferForm, setShowOfferForm] = useState(false);
  const [showMemoryForm, setShowMemoryForm] = useState(false);

  const [projectName, setProjectName] = useState("");
  const [projectType, setProjectType] = useState("");
  const [projectStatus, setProjectStatus] = useState("Aktif");

  const [procurementName, setProcurementName] = useState("");
  const [procurementNote, setProcurementNote] = useState("");

  const [offerName, setOfferName] = useState("");
  const [offerAmount, setOfferAmount] = useState("");
  const [offerStatus, setOfferStatus] = useState("Hazırlanıyor");

  const [memoryTitle, setMemoryTitle] = useState("");
  const [memoryContent, setMemoryContent] = useState("");

  const [aiInput, setAiInput] = useState("");
  const [aiSending, setAiSending] = useState(false);
  const [aiAttachment, setAiAttachment] = useState(null);

  const [aiMessages, setAiMessages] = useState([
    {
      id: "welcome",
      role: "assistant",
      text:
        "DDPro AI çalışma alanı hazır. Proje, teklif, araştırma veya sistem analiziyle ilgili bir çalışma başlatabilirsin.",
      date: formatDate(),
    },
  ]);

  useEffect(() => {
    const intervalId = window.setInterval(() => setCurrentDate(new Date()), 60_000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    let active = true;
    if (!integrationState?.google?.connected) {
      setReportItems([]);
      setFinanceItems([]);
      setDocumentItems([]);
      setAiAnalysisCount(0);
      setAiUsageFetchState("unavailable");
      setCalendarEvents([]);
      setCalendarFetchState("unavailable");
      return () => { active = false; };
    }
    getReports()
      .then((reports) => { if (active) setReportItems(reports); })
      .catch(() => { if (active) setReportItems([]); });
    getFinanceCosts()
      .then((costs) => { if (active) setFinanceItems(costs); })
      .catch(() => { if (active) setFinanceItems([]); });
    getDocuments()
      .then((documents) => { if (active) setDocumentItems(documents); })
      .catch(() => { if (active) setDocumentItems([]); });
    getAiUsageCount()
      .then((count) => {
        if (active) {
          setAiAnalysisCount(count);
          setAiUsageFetchState("success");
        }
      })
      .catch(() => {
        if (active) {
          setAiAnalysisCount(0);
          setAiUsageFetchState("error");
        }
      });
    getGoogleCalendarEvents()
      .then((response) => {
        if (active) {
          setCalendarEvents(Array.isArray(response?.data) ? response.data : []);
          setCalendarFetchState("success");
        }
      })
      .catch(() => {
        if (active) {
          setCalendarEvents([]);
          setCalendarFetchState("error");
        }
      });
    return () => { active = false; };
  }, [integrationState?.google?.connected]);

  useEffect(() => {
    let active = true;
    const refreshIntegrationState = () =>
      getIntegrationStatus()
        .then((status) => {
          if (active) setIntegrationState(status);
        })
        .catch(() => {
          if (active) setIntegrationState(null);
        });
    refreshIntegrationState();
    const intervalId = window.setInterval(refreshIntegrationState, 60_000);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    const syncModuleFromHash = () => {
      const nextModule = resolveModuleFromHash(window.location.hash);
      const hashPath = window.location.hash.replace(/^#/, "");
      setSelectedProjectId(
        new URLSearchParams(hashPath.slice(hashPath.indexOf("?") + 1)).get("id") || ""
      );
      setActiveModule((currentModule) =>
        currentModule === nextModule ? currentModule : nextModule
      );
    };

    syncModuleFromHash();
    window.addEventListener("hashchange", syncModuleFromHash);

    return () => {
      window.removeEventListener("hashchange", syncModuleFromHash);
    };
  }, []);

  useEffect(() => {
    if (activeModule !== "dashboard") return;
    const focusTarget = showDashboardReference
      ? dashboardReferenceLiveRef.current
      : dashboardReferenceReturnRef.current;
    focusTarget?.focus({ preventScroll: true });
  }, [activeModule, showDashboardReference]);

  useEffect(() => {
    if (activeModule !== "dashboard" || !showDashboardReference) return;

    const handleReferenceDialogKeydown = (event) => {
      if (event.key === "Escape") {
        setShowDashboardReference(false);
        return;
      }

      if (event.key !== "Tab") return;

      const focusableElements = [
        ...(dashboardReferenceDialogRef.current?.querySelectorAll(
          'a[href], button:not([disabled]), summary, [tabindex]:not([tabindex="-1"])'
        ) ?? []),
      ].filter((element) => {
        const isVisible =
          typeof element.checkVisibility === "function"
            ? element.checkVisibility()
            : element.getClientRects().length > 0;
        const isInsideClosedDetails = element.closest("details:not([open])");
        return isVisible && (!isInsideClosedDetails || element.matches("summary"));
      });
      if (focusableElements.length === 0) {
        event.preventDefault();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const focusIsOutsideDialog =
        !dashboardReferenceDialogRef.current?.contains(document.activeElement);

      if (event.shiftKey && (document.activeElement === firstElement || focusIsOutsideDialog)) {
        event.preventDefault();
        lastElement.focus({ preventScroll: true });
      } else if (
        !event.shiftKey &&
        (document.activeElement === lastElement || focusIsOutsideDialog)
      ) {
        event.preventDefault();
        firstElement.focus({ preventScroll: true });
      }
    };

    window.addEventListener("keydown", handleReferenceDialogKeydown);
    return () => window.removeEventListener("keydown", handleReferenceDialogKeydown);
  }, [activeModule, showDashboardReference]);

  useEffect(() => {
    if (!moduleIds.has(activeModule)) {
      setActiveModule("dashboard");
      return;
    }

    const rawHash = window.location.hash.replace(/^#/, "");
    const hashPath = rawHash.match(/^[^?#]*/)?.[0] || "";
    const hashPathSuffix = rawHash.slice(hashPath.length);
    const normalizedHashPath = normalizeModulePath(hashPath);
    const expectedPath = moduleRouteMap[activeModule] || "/dashboard";

    if (normalizedHashPath !== expectedPath) {
      window.location.hash = `${expectedPath}${hashPathSuffix}`;
    }
  }, [activeModule]);

  useEffect(() => {
    let cancelled = false;

    getApiHealth()
      .then((data) => {
        if (cancelled) return;
        const databaseReady =
          data?.status === "ok" && data?.database?.ready === true;
        setApiHealthState({
          status: databaseReady ? "success" : "warning",
          message: databaseReady
            ? ""
            : "Production backend yanıt veriyor ancak veritabanı hazır değil.",
        });
      })
      .catch((error) => {
        if (cancelled) return;
        const reason = getApiFailureReason(error);
        setApiHealthState({
          status: "error",
          message: `Production API health kontrolü başarısız: ${reason}`,
        });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!CAN_USE_LOCAL_FALLBACK) {
      return;
    }

    localStorage.setItem(STORAGE_KEYS.projects, JSON.stringify(projects));
  }, [projects]);

  useEffect(() => {
    if (!CAN_USE_LOCAL_FALLBACK) {
      return;
    }

    localStorage.setItem(
      STORAGE_KEYS.procurement,
      JSON.stringify(procurementItems)
    );
  }, [procurementItems]);

  useEffect(() => {
    if (!CAN_USE_LOCAL_FALLBACK) {
      return;
    }

    localStorage.setItem(STORAGE_KEYS.offers, JSON.stringify(offers));
  }, [offers]);

  useEffect(() => {
    let cancelled = false;

    const fetchOffersFromApi = async () => {
      const mutationRevision = offersTouchedRef.current;
      const mutationWasActive = offersActiveMutationsRef.current > 0;
      const localOffers = getStoredData(STORAGE_KEYS.offers);
      const localOfferViewModels = mapOffersToViewModel(localOffers);
      setOffersLoading(true);
      setOffersError(null);
      setOffersFetchState("loading");

      try {
        const apiOffers = await getOffers();

        if (cancelled) return;

        offerDetailsCacheRef.current.clear();

        if (mutationWasActive || offersTouchedRef.current !== mutationRevision) {
          addLog(
            "Tekliflerde yerel değişiklik algılandı, API yanıtı üzerine yazmadı."
          );
          return;
        }

        if (apiOffers && apiOffers.length > 0) {
          setOffers(
            CAN_USE_LOCAL_FALLBACK
              ? mergeOffers(apiOffers, localOffers)
              : apiOffers
          );
          setOffersFetchState("success");
          addLog("Teklifler API üzerinden yüklendi.");
        } else {
          const localDrafts = localOfferViewModels.filter(
            (offer) => offer.source === "local"
          );

          setOffers(CAN_USE_LOCAL_FALLBACK ? localDrafts : EMPTY_ITEMS);
          setOffersFetchState("empty");
          addLog(
            CAN_USE_LOCAL_FALLBACK && localDrafts.length > 0
              ? "Teklif API boş döndü, yerel taslaklar korundu."
              : "Teklif API boş döndü."
          );
        }
      } catch (error) {
        const reason = getApiFailureReason(error);
        if (!cancelled && !mutationWasActive && offersTouchedRef.current === mutationRevision) {
          console.warn("Teklif API erişimi başarısız:", error.message);
          setOffers(CAN_USE_LOCAL_FALLBACK ? localOfferViewModels : EMPTY_ITEMS);
          setSelectedOfferId((currentId) =>
            CAN_USE_LOCAL_FALLBACK &&
            localOfferViewModels.some((offer) => offer.id === currentId)
              ? currentId
              : CAN_USE_LOCAL_FALLBACK
                ? localOfferViewModels[0]?.id || null
                : null
          );
          setOffersFetchState("error");
          setOffersError(
            CAN_USE_LOCAL_FALLBACK && localOfferViewModels.length > 0
              ? `Teklif API’sine ulaşılamadı (${reason}). Son kaydedilen veriler gösteriliyor.`
              : `Teklif API’sine ulaşılamadı (${reason}). Production ortamında yerel fallback kapalı olduğu için canlı veri gösterilemiyor.`
          );
          addLog(
            CAN_USE_LOCAL_FALLBACK
              ? `Tekliflerde API bağlantı hatası: ${reason}. Yerel veriler kullanıldı.`
              : `Tekliflerde production API bağlantı hatası: ${reason}.`
          );
        }
      } finally {
        if (!cancelled) {
          if (mutationWasActive || offersTouchedRef.current !== mutationRevision) {
            setOffersFetchState((current) => current === "loading" ? "success" : current);
          }
          setOffersLoading(false);
        }
      }
    };

    fetchOffersFromApi();

    return () => {
      cancelled = true;
    };
  }, [offersReloadKey, integrationState?.google?.connected]);

  useEffect(() => {
    if (offers.length === 0) {
      setSelectedOfferId(null);
      setSelectedOfferDetail(null);
      setOfferDetailError(null);
      return;
    }

    if (!offers.some((offer) => offer.id === selectedOfferId)) {
      setSelectedOfferId(offers[0].id);
    }
  }, [offers, selectedOfferId]);

  useEffect(() => {
    const selectedOffer = offers.find((offer) => offer.id === selectedOfferId);

    if (!selectedOffer) {
      setSelectedOfferDetail(null);
      setOfferDetailError(null);
      setOfferDetailLoading(false);
      return;
    }

    if (selectedOffer.source !== "api") {
      setSelectedOfferDetail(selectedOffer);
      setOfferDetailError(null);
      setOfferDetailLoading(false);
      return;
    }

    const cachedOfferEntry = offerDetailsCacheRef.current.get(selectedOfferId);
    const selectedOfferSignature = getOfferCacheSignature(selectedOffer);
    const cacheMatchesSelectedOffer =
      cachedOfferEntry &&
      cachedOfferEntry.signature === selectedOfferSignature;

    if (cacheMatchesSelectedOffer) {
      setSelectedOfferDetail(cachedOfferEntry.detail);
      setOfferDetailError(null);
      setOfferDetailLoading(false);
      return;
    }

    let cancelled = false;
    setOfferDetailLoading(true);
    setOfferDetailError(null);

    getOfferById(selectedOfferId)
      .then((offer) => {
        if (!cancelled) {
          const nextDetail = offer || selectedOffer;
          offerDetailsCacheRef.current.set(selectedOfferId, {
            detail: nextDetail,
            signature: selectedOfferSignature,
          });
          setSelectedOfferDetail(nextDetail);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSelectedOfferDetail(selectedOffer);
          setOfferDetailError("Teklif detayları şu anda alınamadı.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setOfferDetailLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [offers, selectedOfferId]);

  useEffect(() => {
    let cancelled = false;

    const fetchProcurementFromApi = async () => {
      const mutationRevision = procurementTouchedRef.current;
      const mutationWasActive = procurementActiveMutationsRef.current > 0;
      const localProcurementItems = getInitialItems(STORAGE_KEYS.procurement);
      setProcurementLoading(true);
      setProcurementError(null);
      setProcurementFetchState("loading");

      try {
        const apiProcurementItems = await getProcurementItems();

        if (cancelled) return;

        if (mutationWasActive || procurementTouchedRef.current !== mutationRevision) {
          addLog(
            "Tedarik kayıtlarında yerel değişiklik algılandı, API yanıtı üzerine yazmadı."
          );
        } else if (apiProcurementItems && apiProcurementItems.length > 0) {
          setProcurementItems(apiProcurementItems);
          setProcurementFetchState("success");
          addLog("Tedarik kayıtları API üzerinden yüklendi.");
        } else {
          setProcurementItems(
            CAN_USE_LOCAL_FALLBACK ? localProcurementItems : EMPTY_ITEMS
          );
          setProcurementFetchState("empty");
          addLog(
            CAN_USE_LOCAL_FALLBACK
              ? "Tedarik API boş döndü, yerel veriler kullanıldı."
              : "Tedarik API boş döndü."
          );
        }
      } catch (error) {
        const reason = getApiFailureReason(error);
        if (!cancelled && !mutationWasActive && procurementTouchedRef.current === mutationRevision) {
          setProcurementItems(
            CAN_USE_LOCAL_FALLBACK ? localProcurementItems : EMPTY_ITEMS
          );
          setProcurementFetchState("error");
          setProcurementError(
            CAN_USE_LOCAL_FALLBACK
              ? `Tedarik API erişimi başarısız (${reason}). Yerel tedarik verileri gösteriliyor.`
              : `Tedarik API erişimi başarısız (${reason}). Production ortamında yerel fallback kapalı olduğu için canlı veri gösterilemiyor.`
          );
          addLog(
            CAN_USE_LOCAL_FALLBACK
              ? `Tedarik API bağlantı hatası: ${reason}. Yerel veriler kullanıldı.`
              : `Tedarik production API bağlantı hatası: ${reason}.`
          );
        }
      } finally {
        if (!cancelled) {
          if (mutationWasActive || procurementTouchedRef.current !== mutationRevision) {
            setProcurementFetchState((current) => current === "loading" ? "success" : current);
          }
          setProcurementLoading(false);
        }
      }
    };

    fetchProcurementFromApi();

    return () => {
      cancelled = true;
    };
  }, [integrationState?.google?.connected]);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEYS.memory,
      JSON.stringify(memoryItems)
    );
  }, [memoryItems]);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEYS.logs,
      JSON.stringify(systemLogs)
    );
  }, [systemLogs]);

  useEffect(() => {
    let cancelled = false;

    const fetchProjectsFromApi = async () => {
      const mutationRevision = projectsTouchedRef.current;
      const mutationWasActive = projectsActiveMutationsRef.current > 0;
      const localProjects = getInitialItems(STORAGE_KEYS.projects);
      setProjectsLoading(true);
      setProjectsError(null);
      setProjectsFetchState("loading");

      try {
        const apiProjects = await getProjects();

        if (cancelled) return;

        if (mutationWasActive || projectsTouchedRef.current !== mutationRevision) {
          addLog(
            "Projelerde yerel değişiklik algılandı, API yanıtı üzerine yazmadı."
          );
          return;
        }

        if (apiProjects && apiProjects.length > 0) {
          setProjects(apiProjects);
          setProjectsFetchState("success");
          addLog("Projeler API üzerinden yüklendi.");
        } else {
          setProjects(CAN_USE_LOCAL_FALLBACK ? localProjects : EMPTY_ITEMS);
          setProjectsFetchState("empty");
          addLog(
            CAN_USE_LOCAL_FALLBACK
              ? "Projeler API boş döndü, yerel veriler kullanıldı."
              : "Projeler API boş döndü."
          );
        }
      } catch (error) {
        const reason = getApiFailureReason(error);
        if (!cancelled && !mutationWasActive && projectsTouchedRef.current === mutationRevision) {
          setProjects(CAN_USE_LOCAL_FALLBACK ? localProjects : EMPTY_ITEMS);
          setProjectsFetchState("error");
          setProjectsError(
            CAN_USE_LOCAL_FALLBACK
              ? `Projeler API erişimi başarısız (${reason}). Yerel proje verileri gösteriliyor.`
              : `Projeler API erişimi başarısız (${reason}). Production ortamında yerel fallback kapalı olduğu için canlı veri gösterilemiyor.`
          );
          addLog(
            CAN_USE_LOCAL_FALLBACK
              ? `Projelerde API bağlantı hatası: ${reason}. Yerel veriler kullanıldı.`
              : `Projelerde production API bağlantı hatası: ${reason}.`
          );
        }
      } finally {
        if (!cancelled) {
          if (mutationWasActive || projectsTouchedRef.current !== mutationRevision) {
            setProjectsFetchState((current) => current === "loading" ? "success" : current);
          }
          setProjectsLoading(false);
        }
      }
    };

    fetchProjectsFromApi();

    return () => {
      cancelled = true;
    };
  }, [integrationState?.google?.connected]);

  const addLog = (message) => {
    const newLog = {
      id: createId(),
      message,
      date: formatDate(),
    };

    setSystemLogs((currentLogs) =>
      [newLog, ...currentLogs].slice(0, 50)
    );
  };

  const activeProjects = useMemo(
    () => projects.filter((project) => project.status === "Aktif"),
    [projects]
  );

  const pendingOffers = useMemo(
    () => offers.filter((offer) => offer.status === "Hazırlanıyor"),
    [offers]
  );

  const dashboardActivity = useMemo(() => {
    const entries = [
      ...(projectsFetchState === "success" || projectsFetchState === "empty"
        ? projects.map((project) => ({
            id: `project:${project.id}`,
            message: `Proje kaydı: ${project.name}`,
            createdAt: project.created_at || project.createdAt,
          }))
        : []),
      ...(offersFetchState === "success" || offersFetchState === "empty"
        ? offers.map((offer) => ({
            id: `offer:${offer.id}`,
            message: `Teklif kaydı: ${offer.title || offer.name}`,
            createdAt: offer.created_at || offer.createdAt,
          }))
        : []),
      ...(procurementFetchState === "success" || procurementFetchState === "empty"
        ? procurementItems.map((item) => ({
            id: `procurement:${item.id}`,
            message: `Tedarik kaydı: ${item.name}`,
            createdAt: item.created_at || item.createdAt,
          }))
        : []),
    ];
    return entries
      .filter((entry) => entry.id && entry.message && Number.isFinite(Date.parse(entry.createdAt)))
      .sort((first, second) => Date.parse(second.createdAt) - Date.parse(first.createdAt))
      .slice(0, 4)
      .map((entry) => ({
        ...entry,
        date: new Date(entry.createdAt).toLocaleString("tr-TR", {
          dateStyle: "short",
          timeStyle: "short",
        }),
      }));
  }, [
    offers,
    offersFetchState,
    procurementFetchState,
    procurementItems,
    projects,
    projectsFetchState,
  ]);
  const dashboardActivityLoading = [
    projectsFetchState,
    offersFetchState,
    procurementFetchState,
  ].some((state) => state === "loading");
  const dashboardActivityUnavailable = [
    projectsFetchState,
    offersFetchState,
    procurementFetchState,
  ].some((state) => state === "error");

  const metricValue = (value, state) =>
    ["success", "empty"].includes(state) ? value : "—";
  const metricDetail = (detail, state) =>
    state === "loading"
      ? "Backend verisi yükleniyor"
      : state === "error"
        ? "Backend verisi alınamadı"
        : state === "unavailable"
          ? "Oturum veya servis kullanılamıyor"
        : state === "empty"
          ? "Kayıt bulunmuyor"
          : detail;

  const dashboardStats = useMemo(
    () => [
      {
        label: "AKTİF PROJELER",
        value: metricValue(activeProjects.length, projectsFetchState),
        detail: metricDetail("Devam eden projeler", projectsFetchState),
        icon: "▣",
        moduleId: "projects",
      },
      {
        label: "TEKLİFLER",
        value: metricValue(offers.length, offersFetchState),
        detail: metricDetail(`${pendingOffers.length} bekleyen teklif`, offersFetchState),
        icon: "◈",
        moduleId: "offers",
      },
      {
        label: "ARAŞTIRMALAR",
        value: metricValue(procurementItems.length, procurementFetchState),
        detail: metricDetail("Tedarik ve ürün araştırması", procurementFetchState),
        icon: "⌕",
        moduleId: "procurement",
      },
      {
        label: "AI ETKİLEŞİMİ",
        value: metricValue(aiAnalysisCount, aiUsageFetchState),
        detail: metricDetail("Kalıcı backend kullanım kaydı", aiUsageFetchState),
        icon: "AI",
        moduleId: "ai-assistant",
      },
    ],
    [
      activeProjects.length,
      aiAnalysisCount,
      aiUsageFetchState,
      offers.length,
      offersFetchState,
      pendingOffers.length,
      procurementItems.length,
      procurementFetchState,
      projectsFetchState,
    ]
  );

  const handleModuleNavigation = (moduleId, params = {}) => {
    if (moduleId === "dashboard") {
      setShowDashboardReference(true);
    }

    const nextRoute = moduleRouteMap[moduleId] || "/dashboard";
    const query = moduleId === "projects" && params.id
      ? `?id=${encodeURIComponent(params.id)}`
      : "";
    const nextHash = `#${nextRoute}${query}`;
    if (window.location.hash !== nextHash) {
      window.location.hash = `${nextRoute}${query}`;
      return;
    }

    setSelectedProjectId(params.id || "");
    setActiveModule(moduleId);
  };

  const getConnectionTone = (state) => {
    switch (state) {
      case "success":
        return "success";
      case "error":
        return "warning";
      case "warning":
        return "warning";
      case "empty":
      case "planned":
        return "info";
      case "loading":
      default:
        return "loading";
    }
  };

  const getConnectionLabel = (state) => {
    switch (state) {
      case "success":
        return "Bağlı";
      case "empty":
        return "Bağlı / veri yok";
      case "error":
        return "Bağlantı hatası";
      case "warning":
        return "Yerel fallback";
      case "planned":
        return "API entegrasyonu bekliyor";
      case "loading":
      default:
        return "Kontrol ediliyor";
    }
  };

  const headerStatusTone = getConnectionTone(apiHealthState.status);
  const headerStatusLabel =
    apiHealthState.status === "success"
      ? "Production API Hazır"
      : apiHealthState.status === "loading"
        ? "API Kontrol Ediliyor"
        : "Production API Kontrol Gerekli";
  const handleOffersReload = () => {
    offerDetailsCacheRef.current.clear();
    setOffersReloadKey((value) => value + 1);
  };

  const createProject = async (event) => {
    event.preventDefault();

    if (!projectName.trim()) return;
    projectsTouchedRef.current += 1;
    let shouldResetForm = false;

    const newProject = {
      id: createId(),
      name: projectName.trim(),
      type: projectType.trim() || "Genel Proje",
      status: projectStatus,
      date: formatDate(),
    };

    setProjectsError(null);

    projectsActiveMutationsRef.current += 1;
    try {
      const createdProject = await createProjectRequest(newProject);
      if (!createdProject) {
        throw new Error("Project API did not return the saved project.");
      }
      const nextProject = createdProject;

      setProjects((currentProjects) => [nextProject, ...currentProjects]);
      setProjectsFetchState("success");
      addLog(`Yeni proje API üzerinden oluşturuldu: ${nextProject.name}`);
      shouldResetForm = true;
    } catch (error) {
      if (CAN_USE_LOCAL_FALLBACK) {
        setProjects((currentProjects) => [newProject, ...currentProjects]);
        setProjectsFetchState("warning");
        setProjectsError("Proje API'ye kaydedilemedi. Yerel kayıt oluşturuldu.");
        addLog(`Yeni proje yerel olarak oluşturuldu: ${newProject.name}`);
        shouldResetForm = true;
      } else {
        setProjectsError(
          `Proje API'ye kaydedilemedi (${getApiFailureReason(error)}). Yerel fallback production ortamında kapalı.`
        );
        addLog(
          `Proje oluşturma production API hatası: ${getApiFailureReason(error)}.`
        );
      }
    } finally {
      projectsActiveMutationsRef.current -= 1;
      projectsTouchedRef.current += 1;
    }

    if (shouldResetForm) {
      setProjectName("");
      setProjectType("");
      setProjectStatus("Aktif");
      setShowProjectForm(false);
    }
  };

  const deleteProject = async (id) => {
    const project = projects.find((item) => item.id === id);
    projectsTouchedRef.current += 1;

    if (!isUuid(id)) {
      setProjects((currentProjects) =>
        currentProjects.filter((item) => item.id !== id)
      );

      if (project) {
        addLog(`Yerel proje silindi: ${project.name}`);
      }

      return;
    }

    projectsActiveMutationsRef.current += 1;
    try {
      await deleteProjectRequest(id);
      setProjectsError(null);
      setProjects((currentProjects) =>
        currentProjects.filter((item) => item.id !== id)
      );

      if (project) {
        addLog(`Proje API üzerinden silindi: ${project.name}`);
      }
    } catch (error) {
      if (getApiStatusCode(error) === 404) {
        setProjects((currentProjects) =>
          currentProjects.filter((item) => item.id !== id)
        );
        if (project) {
          addLog(`Proje listeden temizlendi: ${project.name}`);
        }
        return;
      }

      setProjectsError(
        `Proje silme işlemi API üzerinde tamamlanamadı (${getApiFailureReason(error)}).`
      );
      if (project) {
        addLog(`Proje silme hatası: ${project.name}`);
      }
    } finally {
      projectsActiveMutationsRef.current -= 1;
      projectsTouchedRef.current += 1;
    }
  };

  const updateProject = async (id, updates) => {
    projectsTouchedRef.current += 1;
    const project = projects.find((item) => item.id === id);

    if (!project) return false;
    if (!isUuid(id)) {
      setProjects((current) =>
        current.map((item) => item.id === id ? { ...item, ...updates } : item)
      );
      addLog(`Yerel proje ayrıntıları güncellendi: ${project.name}`);
      return true;
    }

    projectsActiveMutationsRef.current += 1;
    try {
      const updatedProject = await updateProjectRequest(id, updates);
      if (!updatedProject) return false;
      setProjects((current) =>
        current.map((item) => item.id === id ? updatedProject : item)
      );
      setProjectsError(null);
      addLog(`Proje API üzerinden güncellendi: ${project.name}`);
      return true;
    } catch (error) {
      setProjectsError(
        `Proje ayrıntıları kaydedilemedi (${getApiFailureReason(error)}).`
      );
      return false;
    } finally {
      projectsActiveMutationsRef.current -= 1;
      projectsTouchedRef.current += 1;
    }
  };

  const persistProcurementRecord = async (newProcurement) => {
    procurementTouchedRef.current += 1;
    let shouldResetForm = false;
    setProcurementError(null);
    procurementActiveMutationsRef.current += 1;

    try {
      const createdProcurement = await createProcurementRequest(newProcurement);
      if (!createdProcurement) {
        throw new Error("Research API did not return the saved record.");
      }
      const nextProcurement = createdProcurement;

      setProcurementItems((currentItems) => [nextProcurement, ...currentItems]);
      setProcurementFetchState("success");
      addLog(`Yeni tedarik kaydı API üzerinden oluşturuldu: ${nextProcurement.name}`);
      shouldResetForm = true;
    } catch (error) {
      if (CAN_USE_LOCAL_FALLBACK) {
        setProcurementItems((currentItems) => [newProcurement, ...currentItems]);
        setProcurementFetchState("warning");
        setProcurementError(
          "Tedarik kaydı API'ye kaydedilemedi. Yerel kayıt oluşturuldu."
        );
        addLog(`Yeni tedarik kaydı yerel olarak oluşturuldu: ${newProcurement.name}`);
        shouldResetForm = true;
      } else {
        setProcurementError(
          `Tedarik kaydı API'ye kaydedilemedi (${getApiFailureReason(error)}). Yerel fallback production ortamında kapalı.`
        );
        addLog(
          `Tedarik oluşturma production API hatası: ${getApiFailureReason(error)}.`
        );
      }
    } finally {
      procurementActiveMutationsRef.current -= 1;
      procurementTouchedRef.current += 1;
    }

    if (shouldResetForm) {
      setProcurementName("");
      setProcurementNote("");
      setShowProcurementForm(false);
    }
  };

  const createProcurement = async (event) => {
    event.preventDefault();
    if (!procurementName.trim()) return;
    const formValues = Object.fromEntries(new FormData(event.currentTarget).entries());
    await persistProcurementRecord({
      id: createId(),
      name: procurementName.trim(),
      note: procurementNote.trim() || "Not eklenmedi.",
      date: formatDate(),
      source: formValues.source.trim(),
      product: formValues.product.trim(),
      manufacturer: formValues.manufacturer.trim(),
      technicalInfo: formValues.technicalInfo.trim(),
      price: formValues.price.trim(),
      priceVerification: formValues.priceVerification || "Doğrulanmadı",
      url: formValues.url.trim(),
      projectId: formValues.projectId || "",
      productId: formValues.productId.trim(),
      status: formValues.status || "Taslak",
    });
  };

  const saveResearchResult = async (result) => {
    const title = result.product || result.manufacturer || result.source;
    if (!title) {
      setProcurementError("Sonuçta kaydedilebilir ürün, üretici veya kaynak adı yok.");
      return;
    }
    await persistProcurementRecord({
      id: createId(),
      name: title,
      note: result.technicalInfo || "Harici araştırma sonucu; kaynak kullanıcı tarafından kontrol edilmedi.",
      date: formatDate(),
      source: result.source || "",
      product: result.product || "",
      manufacturer: result.manufacturer || "",
      technicalInfo: result.technicalInfo || "",
      price: result.price || "",
      priceVerification: "Doğrulanmadı",
      url: result.url || "",
      projectId: result.projectId || "",
      productId: result.productId || "",
      status: "Harici sonuç · doğrulama bekliyor",
    });
  };

  const deleteProcurement = async (id) => {
    const item = procurementItems.find(
      (procurement) => procurement.id === id
    );
    procurementTouchedRef.current += 1;

    if (!isUuid(id)) {
      setProcurementItems((currentItems) =>
        currentItems.filter((procurement) => procurement.id !== id)
      );

      if (item) {
        addLog(`Yerel tedarik kaydı silindi: ${item.name}`);
      }

      return;
    }

    procurementActiveMutationsRef.current += 1;
    try {
      await deleteProcurementRequest(id);
      setProcurementError(null);
      setProcurementItems((currentItems) =>
        currentItems.filter((procurement) => procurement.id !== id)
      );

      if (item) {
        addLog(`Tedarik kaydı API üzerinden silindi: ${item.name}`);
      }
    } catch (error) {
      if (getApiStatusCode(error) === 404) {
        setProcurementItems((currentItems) =>
          currentItems.filter((procurement) => procurement.id !== id)
        );
        if (item) {
          addLog(`Tedarik kaydı listeden temizlendi: ${item.name}`);
        }
        return;
      }

      setProcurementError(
        `Tedarik silme işlemi API üzerinde tamamlanamadı (${getApiFailureReason(error)}).`
      );

      if (item) {
        addLog(`Tedarik silme hatası: ${item.name}`);
      }
    } finally {
      procurementActiveMutationsRef.current -= 1;
      procurementTouchedRef.current += 1;
    }
  };

  const updateProcurement = async (id, updates) => {
    procurementTouchedRef.current += 1;
    setProcurementError(null);
    procurementActiveMutationsRef.current += 1;
    try {
      const updated = await updateProcurementRequest(id, updates);
      if (!updated) throw new Error("Research API did not return the updated record.");
      setProcurementItems((items) => items.map((item) => item.id === id ? updated : item));
      addLog(`Tedarik kaydı API üzerinden güncellendi: ${updated.name}`);
    } catch (error) {
      if (CAN_USE_LOCAL_FALLBACK) {
        setProcurementItems((items) => items.map((item) => item.id === id ? { ...item, ...updates } : item));
        setProcurementError("Tedarik kaydı API'ye güncellenemedi; yalnızca bu geliştirme oturumunda yerel olarak güncellendi.");
      } else {
        setProcurementError(`Tedarik kaydı güncellenemedi (${getApiFailureReason(error)}).`);
      }
    } finally {
      procurementActiveMutationsRef.current -= 1;
      procurementTouchedRef.current += 1;
    }
  };

  const createOffer = async (event) => {
    event.preventDefault();

    if (!offerName.trim()) return false;
    offersTouchedRef.current += 1;
    let shouldResetForm = false;
    const formValues = new FormData(event.currentTarget);
    const editingOfferId = String(formValues.get("offerId") || "");

    const newOffer = mapOfferToViewModel({
      id: createId(),
      title: offerName.trim(),
      amount: offerAmount.trim() || "Tutar belirtilmedi",
      status: offerStatus,
      statusRaw: offerStatus,
      date: formatDate(),
      projectId: formValues.get("projectId") || null,
      crmContactId: formValues.get("crmContactId") || null,
      systemId: formValues.get("systemId") || null,
      productId: formValues.get("productId") || null,
      materialAnalysisId: formValues.get("materialAnalysisId") || null,
      source: "local",
    });

    setOffersError(null);

    if (editingOfferId) {
      offersActiveMutationsRef.current += 1;
      try {
        const updatedOffer = await updateOfferRequest(editingOfferId, {
          ...newOffer,
          source: "api",
        });
        if (!updatedOffer) throw new Error("Offers API did not return the updated offer.");
        setOffers((current) => current.map((offer) =>
          offer.id === editingOfferId ? updatedOffer : offer
        ));
        setSelectedOfferId(editingOfferId);
        setSelectedOfferDetail(updatedOffer);
        setShowOfferForm(false);
        setOfferName("");
        setOfferAmount("");
        setOfferStatus("Hazırlanıyor");
        addLog(`Teklif API üzerinden güncellendi: ${updatedOffer.title}`);
        return true;
      } catch (error) {
        setOffersError(`Teklif güncellenemedi: ${getApiFailureReason(error)}.`);
        addLog(`Teklif güncelleme hatası: ${getApiFailureReason(error)}.`);
        return false;
      } finally {
        offersActiveMutationsRef.current -= 1;
        offersTouchedRef.current += 1;
      }
    }

    offersActiveMutationsRef.current += 1;
    try {
      const createdOffer = await createOfferRequest(newOffer);
      if (!createdOffer) {
        throw new Error("Offers API did not return the saved offer.");
      }
      const nextOffer = createdOffer;

      setOffers((currentOffers) => [
        nextOffer,
        ...currentOffers,
      ]);
      setSelectedOfferId(nextOffer.id);
      addLog(`Yeni teklif API üzerinden oluşturuldu: ${newOffer.title}`);
      shouldResetForm = true;
    } catch (error) {
      console.warn("Teklif API'ye kaydedilemedi:", error.message);

      if (CAN_USE_LOCAL_FALLBACK) {
        setOffers((currentOffers) => [newOffer, ...currentOffers]);
        setSelectedOfferId(newOffer.id);
        setOffersFetchState("warning");
        setOffersError("Teklif API'ye kaydedilemedi. Yerel kayıt oluşturuldu.");
        addLog(`Yeni teklif yerel olarak oluşturuldu: ${newOffer.title}`);
        shouldResetForm = true;
      } else {
        setOffersFetchState("error");
        setOffersError(
          `Teklif API'ye kaydedilemedi (${getApiFailureReason(error)}). Yerel fallback production ortamında kapalı.`
        );
        addLog(
          `Teklif oluşturma production API hatası: ${getApiFailureReason(error)}.`
        );
      }
    } finally {
      offersActiveMutationsRef.current -= 1;
      offersTouchedRef.current += 1;
    }

    if (shouldResetForm) {
      setOfferName("");
      setOfferAmount("");
      setOfferStatus("Hazırlanıyor");
      setShowOfferForm(false);
    }
    return shouldResetForm;
  };

  const deleteOffer = async (id) => {
    const offer = offers.find((item) => item.id === id);
    offersTouchedRef.current += 1;

    if (!isUuid(id)) {
      setOffersError(null);
      offerDetailsCacheRef.current.delete(id);
      setOffers((currentOffers) =>
        currentOffers.filter((item) => item.id !== id)
      );
      if (selectedOfferId === id) {
        setSelectedOfferId(null);
      }
      setSelectedOfferDetail(null);

      if (offer) {
        addLog(`Yerel teklif silindi: ${offer.title || offer.name}`);
      }

      return;
    }

    offersActiveMutationsRef.current += 1;
    try {
      await deleteOfferRequest(id);
      setOffersError(null);
      offerDetailsCacheRef.current.delete(id);
      setOffers((currentOffers) =>
        currentOffers.filter((item) => item.id !== id)
      );
      if (selectedOfferId === id) {
        setSelectedOfferId(null);
      }
      setSelectedOfferDetail(null);

      if (offer) {
        addLog(`Teklif API üzerinden silindi: ${offer.title || offer.name}`);
      }
    } catch (error) {
      console.warn("Teklif API üzerinden silinemedi:", error.message);

      if (getApiStatusCode(error) === 404) {
        offerDetailsCacheRef.current.delete(id);
        setOffers((currentOffers) =>
          currentOffers.filter((item) => item.id !== id)
        );
        if (selectedOfferId === id) {
          setSelectedOfferId(null);
        }
        setSelectedOfferDetail(null);

        if (offer) {
          addLog(`Teklif yerelde temizlendi: ${offer.title || offer.name}`);
        }

        return;
      }

      setOffersError("Teklif silme işlemi API üzerinde tamamlanamadı.");

      if (offer) {
        addLog(`Teklif silme hatası: ${offer.title || offer.name}`);
      }
    } finally {
      offersActiveMutationsRef.current -= 1;
      offersTouchedRef.current += 1;
    }
  };

  const createMemory = (event) => {
    event.preventDefault();

    if (!memoryTitle.trim()) return;

    const newMemory = {
      id: createId(),
      title: memoryTitle.trim(),
      content: memoryContent.trim() || "İçerik eklenmedi.",
      date: formatDate(),
    };

    setMemoryItems((currentItems) => [
      newMemory,
      ...currentItems,
    ]);

    addLog(`Merkezi hafızaya kayıt eklendi: ${newMemory.title}`);

    setMemoryTitle("");
    setMemoryContent("");
    setShowMemoryForm(false);
  };

  const deleteMemory = (id) => {
    const memory = memoryItems.find((item) => item.id === id);

    setMemoryItems((currentItems) =>
      currentItems.filter((item) => item.id !== id)
    );

    if (memory) {
      addLog(`Hafıza kaydı silindi: ${memory.title}`);
    }
  };


  const sendAiMessage = async (event) => {
    event.preventDefault();

    const attachment = aiAttachment;
    const message = aiInput.trim() || (attachment
      ? "Ekli dosyayı analiz et, önemli bilgileri çıkar ve uygun DDPro modülünü öner. Herhangi bir kaydı kendiliğinden oluşturma veya değiştirme."
      : "");

    if (!message || aiSending) return;

    const userMessage = {
      id: createId(),
      role: "user",
      text: message,
      date: formatDate(),
      ...(attachment ? {
        attachments: [{ name: attachment.name, status: "Dosya gönderiliyor ve analiz ediliyor…" }],
      } : {}),
    };
    setAiMessages((currentMessages) => [...currentMessages, userMessage]);
    if (!attachment) setAiInput("");
    setAiSending(true);

    const normalizedMessage = message.toLocaleLowerCase("tr-TR");
    const suggestedModuleId =
      /entegrasyon|gmail|google calendar|whatsapp|supabase|app store|cms|bağlantı durumu/.test(normalizedMessage) ? "integrations"
        : /teklif|offer/.test(normalizedMessage) ? "offers"
        : /tedarik|araştır|malzeme/.test(normalizedMessage) ? "procurement"
          : /takvim|toplantı|saha ziyareti/.test(normalizedMessage) ? "calendar"
            : /crm|müşteri|firma|iletişim/.test(normalizedMessage) ? "crm"
              : /rapor/.test(normalizedMessage) ? "reports"
                : /proje/.test(normalizedMessage) ? "projects"
                  : /fiyat|maliyet/.test(normalizedMessage) ? "price-analysis"
                    : /ürün|product/.test(normalizedMessage) ? "products"
                      : /sistem|system/.test(normalizedMessage) ? "systems"
                        : null;

    const statusQuestion = attachment ? null : integrationStatusQuestion(message);
    if (statusQuestion) {
      try {
        const liveStatus = await getIntegrationStatus();
        setIntegrationState(liveStatus);
        setAiMessages((currentMessages) => [
          ...currentMessages,
          {
            id: createId(),
            role: "assistant",
            text: describeIntegrationStatus(statusQuestion[0], statusQuestion[1], liveStatus),
            date: formatDate(),
            moduleSuggestion: "integrations",
          },
        ]);
      } catch (error) {
        setAiMessages((currentMessages) => [
          ...currentMessages,
          {
            id: createId(),
            role: "assistant",
            text: `Entegrasyon durumu backend API'sinden alınamadı; bağlantı varmış gibi varsayım yapmıyorum. Hata: ${getApiFailureReason(error)}`,
            date: formatDate(),
            status: "unavailable",
            moduleSuggestion: "integrations",
          },
        ]);
      } finally {
        setAiSending(false);
      }
      return;
    }

    let crmContext = getStoredData("ddpro_crm_contacts_v1");
    try {
      const response = await getCrmContacts();
      crmContext = response.data || [];
    } catch {
      // Existing locally stored contacts remain available as context when authenticated CRM is offline.
    }

    let liveIntegrationContext;
    try {
      liveIntegrationContext = await getIntegrationStatus();
      setIntegrationState(liveIntegrationContext);
    } catch (error) {
      liveIntegrationContext = { available: false, error: getApiFailureReason(error) };
    }
    const context = {
      integrationStatus: liveIntegrationContext,
      projects: projects.slice(0, 30).map(({ id, name, type, status, areaM2, systems, notes }) => ({
        id,
        name,
        type,
        status,
        areaM2,
        systems,
        notes,
      })),
      offers: offers.slice(0, 30).map(({ id, title, amountDisplay, status, source }) => ({
        id,
        title,
        amount: amountDisplay,
        status,
        source,
      })),
      products: products.slice(0, 30).map(({ id, name, description }) => ({
        id,
        name,
        description,
      })),
      systems: systemInventory.slice(0, 30).map(({ id, name, status, description }) => ({
        id,
        name,
        status,
        description,
      })),
      research: procurementItems.slice(0, 30).map(({
        id,
        name,
        note,
        status,
        source,
        product,
        manufacturer,
        technicalInfo,
        price,
        priceVerification,
        url,
      }) => ({
        id,
        name,
        note,
        status,
        source,
        product,
        manufacturer,
        technicalInfo,
        price,
        priceVerification,
        url,
      })),
      crm: crmContext
        .slice(0, 20)
        .map(({ id, name, company, request, project, project_id, system, status, source }) => ({
          id,
          name,
          company,
          request,
          project: project || project_id,
          system,
          status,
          source,
        })),
      calendar: getStoredData("ddpro_calendar_events_v1")
        .slice(0, 20)
        .map(({ title, type, date, project, notes }) => ({
          title,
          type,
          date,
          project,
          notes,
        })),
        reports: reportItems.slice(0, 5).map(({ id, report_type, created_at }) => ({
          id,
          type: report_type,
          createdAt: created_at,
        })),
    };

    try {
      const completion = await requestAiCompletion({ message, context, attachment });
      let projectImport = completion.projectImport;
      if (projectImport) {
        try {
          const preview = await previewAiFileProjectImport({
            sourceFingerprint: projectImport.sourceFingerprint,
            headers: projectImport.table.headers,
            rows: projectImport.table.rows,
          });
          projectImport = { ...projectImport, ...preview, previewError: null };
        } catch (error) {
          projectImport = {
            ...projectImport,
            previewError: getApiFailureReason(error),
          };
        }
      }
      if (attachment) {
        setAiMessages((currentMessages) => currentMessages.map((item) =>
          item.id === userMessage.id
            ? { ...item, attachments: item.attachments.map((file) => ({
              ...file,
              status: "İşlem tamamlandı",
            })) }
            : item
        ));
        setAiAttachment((current) => current === attachment ? null : current);
        setAiInput("");
      }
      getAiUsageCount().then(setAiAnalysisCount).catch(() => {});
      setAiMessages((currentMessages) => [
        ...currentMessages,
        {
          id: createId(),
          role: "assistant",
          text: completion.answer,
          date: formatDate(),
          moduleSuggestion: suggestedModuleId,
          pendingAction: completion.pendingAction,
          projectImport,
        },
      ]);
      addLog("DDPro AI isteği yapılandırılmış sağlayıcıya gönderildi.");
    } catch (error) {
      if (attachment) {
        setAiMessages((currentMessages) => currentMessages.map((item) =>
          item.id === userMessage.id
            ? { ...item, attachments: item.attachments.map((file) => ({
              ...file,
              status: "İşleme başarısız",
            })) }
            : item
        ));
      }
      const explanation =
        error.code === "AI_PROVIDER_NOT_CONFIGURED" || error.status === 503
          ? "AI sağlayıcısı şu anda bağlı değil. Gerçek yanıt için backend ortamında AI_API_URL, AI_API_KEY ve AI_MODEL yapılandırılmalıdır."
          : `AI sağlayıcısından yanıt alınamadı (${getApiFailureReason(error)}). Mesajın yanıtlandığı varsayılmadı.`;
      setAiMessages((currentMessages) => [
        ...currentMessages,
        {
          id: createId(),
          role: "assistant",
          text: explanation,
          date: formatDate(),
          status: "unavailable",
          moduleSuggestion: suggestedModuleId,
        },
      ]);
    } finally {
      setAiSending(false);
    }
  };

  const confirmAiOperationalAction = async (messageId, confirmationId) => {
    if (aiSending) return;
    setAiSending(true);
    try {
      await confirmAiActionRequest(confirmationId);
      setAiMessages((currentMessages) => [
        ...currentMessages.map((message) =>
          message.id === messageId
            ? { ...message, pendingAction: null }
            : message
        ),
        {
          id: createId(),
          role: "assistant",
          text: "İşlem tamamlandı ve backend tarafından kaydedildi.",
          date: formatDate(),
        },
      ]);
      getAiUsageCount().then(setAiAnalysisCount).catch(() => {});
    } catch (error) {
      setAiMessages((currentMessages) => [
        ...currentMessages.map((message) =>
          message.id === messageId
            ? { ...message, pendingAction: null }
            : message
        ),
        {
          id: createId(),
          role: "assistant",
          text: `İşlem tamamlanamadı; değişiklik yapıldığı varsayılmadı. ${getApiFailureReason(error)}`,
          date: formatDate(),
          status: "unavailable",
        },
      ]);
    } finally {
      setAiSending(false);
    }
  };

  const confirmAiProjectImport = async (messageId, projectImport) => {
    if (
      aiSending ||
      projectImport?.previewError ||
      !Array.isArray(projectImport?.records) ||
      (projectImport?.result && projectImport.result.errors.length === 0)
    ) return;
    setAiSending(true);
    try {
      const result = await importAiFileProjects({
        sourceFingerprint: projectImport.sourceFingerprint,
        headers: projectImport.table.headers,
        rows: projectImport.table.rows,
      });
      const previousResult = projectImport.result || { added: [], existing: [] };
      const previousAddedRows = new Set(previousResult.added.map(({ row }) => row));
      const previouslyReportedRows = new Set([
        ...previousAddedRows,
        ...previousResult.existing.map(({ row }) => row),
      ]);
      const cumulativeAdded = [
        ...previousResult.added,
        ...result.added.filter(({ row }) => !previousAddedRows.has(row)),
      ];
      const cumulativeExisting = [
        ...previousResult.existing,
        ...result.existing.filter(({ row }) => !previouslyReportedRows.has(row)),
      ];
      setAiMessages((currentMessages) => currentMessages.map((message) => {
        if (message.id !== messageId) return message;
        return {
          ...message,
          projectImport: {
            ...message.projectImport,
            importError: null,
            result: {
              ...result,
              added: cumulativeAdded,
              existing: cumulativeExisting,
            },
          },
        };
      }));
      try {
        const savedProjects = await getProjects();
        setProjects(savedProjects);
        setProjectsError(null);
        setProjectsFetchState("success");
        const savedProjectIds = new Set(savedProjects.map(({ id }) => id));
        const verifiedAdded = cumulativeAdded.filter(({ id }) => savedProjectIds.has(id));
        setAiMessages((currentMessages) => currentMessages.map((message) =>
          message.id === messageId
            ? {
              ...message,
              projectImport: {
                ...message.projectImport,
                verification: {
                  expected: cumulativeAdded.length,
                  saved: verifiedAdded.length,
                  complete: verifiedAdded.length === cumulativeAdded.length,
                },
              },
            }
            : message
        ));
      } catch (error) {
        setProjectsError(`İçe aktarılan projeler yenilenemedi (${getApiFailureReason(error)}). Sayfayı yenileyerek tekrar deneyin.`);
        setAiMessages((currentMessages) => currentMessages.map((message) =>
          message.id === messageId
            ? {
              ...message,
              projectImport: {
                ...message.projectImport,
                verification: {
                  expected: cumulativeAdded.length,
                  saved: null,
                  complete: false,
                  error: getApiFailureReason(error),
                },
              },
            }
            : message
        ));
      }
      addLog(`AI dosya aktarımı tamamlandı: ${result.added.length} proje kaydedildi, ${result.existing.length} mükerrer atlandı, ${result.errors.length} hata.`);
    } catch (error) {
      setAiMessages((currentMessages) => currentMessages.map((message) =>
        message.id === messageId
          ? { ...message, projectImport: { ...message.projectImport, importError: getApiFailureReason(error) } }
          : message
      ));
    } finally {
      setAiSending(false);
    }
  };

  const retryAiProjectImportPreview = async (messageId, projectImport) => {
    if (aiSending || !projectImport?.table) return;
    setAiSending(true);
    try {
      const preview = await previewAiFileProjectImport({
        sourceFingerprint: projectImport.sourceFingerprint,
        headers: projectImport.table.headers,
        rows: projectImport.table.rows,
      });
      setAiMessages((currentMessages) => currentMessages.map((message) =>
        message.id === messageId
          ? { ...message, projectImport: { ...message.projectImport, ...preview, previewError: null } }
          : message
      ));
    } catch (error) {
      setAiMessages((currentMessages) => currentMessages.map((message) =>
        message.id === messageId
          ? { ...message, projectImport: { ...message.projectImport, previewError: getApiFailureReason(error) } }
          : message
      ));
    } finally {
      setAiSending(false);
    }
  };

  const renderDashboard = () => (
    <div className="dashboard-module">
      {apiHealthState.message ? (
        <p className="status-banner warning">{apiHealthState.message}</p>
      ) : null}

      <div className="stats-grid">
        {dashboardStats.map((stat) => (
          <button
            className="stat-card"
            key={stat.label}
            type="button"
            onClick={() => handleModuleNavigation(stat.moduleId)}
          >
            <span className="stat-icon" aria-hidden="true">{stat.icon}</span>
            <span className="stat-label">{stat.label}</span>
            <strong>{stat.value}</strong>
            <small>{stat.detail}</small>
          </button>
        ))}
      </div>

      <div className="dashboard-overview-grid">
        <section className="panel project-map-panel">
          <div className="panel-header">
            <h2>PROJE HARİTASI</h2>
            <span className="panel-kicker">DDPRO GLOBAL AĞI</span>
          </div>

          <div className="project-map-canvas">
            <svg className="world-map" viewBox="0 0 600 320" aria-hidden="true">
              <defs>
                <pattern id={`${dashboardMapId}-grid`} width="28" height="28" patternUnits="userSpaceOnUse">
                  <path d="M 28 0 L 0 0 0 28" fill="none" stroke="currentColor" strokeWidth="0.7" />
                </pattern>
                <pattern id={`${dashboardMapId}-dots`} width="9" height="9" patternUnits="userSpaceOnUse">
                  <circle cx="2" cy="2" r="1.1" fill="currentColor" />
                </pattern>
              </defs>
              <rect width="600" height="320" fill={`url(#${dashboardMapId}-grid)`} />
              <g className="map-land">
                <path d="m67 83 23-17 35-3 13-13 32 3 18 17 32 7 8 17-20 10-8 17-27 4-12 19-21-2-13 16-21-5-9-19-22-5-17-23-20-4-7-17zM166 160l28 8 17 20 2 27-14 22-10 28-16 21-14-17-1-26-13-24 1-30 10-29zM273 74l23-14 24 5 13-12 28 4 11-12 36 8 10 15 30 5 19 20-12 18-29 3-6 19-18 6-15 27-20 4-13 20-21-7-7-20-22-11-3-20-20-7-6-18-19-7-9-20 16-6zM310 181l18 6 11 18 16 7 17 22-5 28-17 19-17-8-5-20-19-13-6-23-12-15zM452 218l21-9 28 8 18 19-9 17-27 3-18-13-18-2z" />
                <path d="m60 70 57-26 45 4 36 21 32 16-14 24-29 10-18 27-26-4-16 16-19-18-25-7-19-22-21-9zM270 64l38-16 31 8 35-8 30 14 41 8 34 24-8 27-28 8-15 23-28 10-14 29-25 8-17-16-14-20-28-5-19-18-23-9-16-28-19-12z" />
              </g>
              <circle className="map-orbit" cx="304" cy="157" r="100" />
              <circle className="map-orbit map-orbit-inner" cx="304" cy="157" r="65" />
              <g className="map-network" aria-hidden="true">
                <path d="M138 129 236 104 316 157 401 109 482 166 365 218 236 205 138 129" />
                <circle cx="138" cy="129" r="5" />
                <circle cx="236" cy="104" r="4" />
                <circle cx="316" cy="157" r="6" />
                <circle cx="401" cy="109" r="4" />
                <circle cx="482" cy="166" r="5" />
                <circle cx="365" cy="218" r="4" />
                <circle cx="236" cy="205" r="4" />
              </g>
              <rect width="600" height="320" fill={`url(#${dashboardMapId}-dots)`} />
            </svg>
            <div className="map-legend"><span aria-hidden="true" /> Proje ağı görünümü</div>
          </div>
        </section>

        <section className="panel active-projects-panel">
          <div className="panel-header">
            <h2>AKTİF PROJELER</h2>
            <button type="button" onClick={() => handleModuleNavigation("projects")}>
              Tümü <span aria-hidden="true">↗</span>
            </button>
          </div>

          <div className="panel-content project-preview-list">
            {projectsLoading ? (
              <p className="empty-state">Projeler yükleniyor...</p>
            ) : projectsFetchState === "error" ? (
              <div className="dashboard-empty-state">
                <span aria-hidden="true">!</span>
                <p>{projectsError || "Projeler backend üzerinden alınamadı."}</p>
                <button type="button" onClick={() => handleModuleNavigation("projects")}>
                  Proje modülünü aç
                </button>
              </div>
            ) : activeProjects.length === 0 ? (
              <div className="dashboard-empty-state">
                <span aria-hidden="true">▣</span>
                <p>Henüz aktif proje bulunmuyor.</p>
                <button type="button" onClick={() => handleModuleNavigation("projects")}>
                  Projeleri görüntüle
                </button>
              </div>
            ) : (
              activeProjects.slice(0, 4).map((project, index) => (
                <button
                  className="project-preview"
                  key={project.id}
                  type="button"
                  onClick={() => handleModuleNavigation("projects", { id: project.id })}
                >
                  <span className={`project-preview-mark mark-${index % 4}`} aria-hidden="true">
                    {project.name.slice(0, 1).toLocaleUpperCase("tr-TR")}
                  </span>
                  <span className="project-preview-copy">
                    <strong>{project.name}</strong>
                    <small>{project.type || "Genel Proje"}</small>
                  </span>
                  <span className="project-status">{project.status}</span>
                </button>
              ))
            )}
          </div>
        </section>

        <DashboardCalendar
          now={currentDate}
          onOpenCalendar={() => handleModuleNavigation("calendar")}
          events={calendarEvents}
          fetchState={calendarFetchState}
        />
      </div>

      <div className="dashboard-footer-grid">
        <section className="panel system-panel">
          <div className="panel-header">
            <h2>SİSTEM DURUMLARI</h2>
            <span className={`system-overall ${headerStatusTone}`}>
              <span className={`status-dot ${headerStatusTone}`} aria-hidden="true" />
              API: {getConnectionLabel(apiHealthState.status)}
            </span>
          </div>
          <div className="system-status-list">
            <div className="system-status-item">
              <span>DDPro Core</span><strong>{getConnectionLabel(apiHealthState.status)}</strong>
            </div>
            <div className="system-status-item">
              <span>Projeler API</span><strong>{getConnectionLabel(projectsFetchState)}</strong>
            </div>
            <div className="system-status-item">
              <span>Teklifler API</span><strong>{getConnectionLabel(offersFetchState)}</strong>
            </div>
            <div className="system-status-item">
              <span>Tedarik API</span><strong>{getConnectionLabel(procurementFetchState)}</strong>
            </div>
            <div className="system-status-item integration-summary-item">
              <span>Entegrasyonlar</span>
              <strong>{integrationState ? `${[
                integrationState.gmail,
                integrationState.googleCalendar,
                integrationState.whatsapp,
                integrationState.crm,
                integrationState.web,
                integrationState.appStore,
                integrationState.supabase,
                integrationState.ai,
                integrationState.research,
              ].filter((item) => item?.connected).length}/9 bağlı` : "Durum alınamadı"}</strong>
            </div>
            <button className="integration-dashboard-link" type="button" onClick={() => handleModuleNavigation("integrations")}>
              Tüm entegrasyon durumları <span aria-hidden="true">↗</span>
            </button>
          </div>
        </section>
        <section className="panel quick-access-panel">
          <div className="panel-header">
            <h2>HIZLI ERİŞİM</h2>
          </div>
          <div className="quick-links-grid">
            {modules
              .filter((module) => dashboardQuickAccessModuleIds.has(module.id))
              .map((module) => (
                <button
                  type="button"
                  className="quick-link-card"
                  key={module.id}
                  aria-label={`${module.title} modülüne git`}
                  onClick={() => handleModuleNavigation(module.id)}
                >
                  <span aria-hidden="true">{module.icon}</span>
                  <strong>{module.title}</strong>
                  <span className="quick-link-arrow" aria-hidden="true">↗</span>
                </button>
              ))}
          </div>
        </section>
      </div>

      <section className="panel recent-activity-panel">
        <div className="panel-header">
          <h2>SON İŞLEMLER</h2>
          <span className="panel-kicker">KALICI BACKEND KAYITLARI</span>
        </div>
        {dashboardActivity.length > 0 ? (
          <div className="log-list">
            {dashboardActivity.map((log) => (
              <div className="log-item" key={log.id}>
                <strong>{log.message}</strong>
                <small>{log.date}</small>
              </div>
            ))}
          </div>
        ) : dashboardActivityLoading ? (
          <p className="activity-empty">Backend kayıtları yükleniyor…</p>
        ) : dashboardActivityUnavailable ? (
          <p className="activity-empty">Son kayıtlar backend üzerinden alınamadı.</p>
        ) : (
          <p className="activity-empty">Gösterilecek kalıcı proje, teklif veya tedarik kaydı bulunmuyor.</p>
        )}
      </section>
    </div>
  );

  const moduleCounts = useMemo(
    () => ({
      products: products.length,
      priceAnalysis: priceAnalysisItems.length,
      materialAnalysis: materialAnalysisItems.length,
      customers: customerItems.length,
      documents: documentItems.length,
      finance: financeItems.length,
      reports: reportItems.length,
    }),
    [
      products.length,
      priceAnalysisItems.length,
      materialAnalysisItems.length,
      customerItems.length,
      documentItems.length,
      financeItems.length,
      reportItems.length,
    ]
  );

  const skeletonModuleProps = useMemo(
    () => ({
      products: {
        title: "Ürünler",
        description:
          "Ürün yönetimi modülü production API entegrasyonu tamamlanana kadar yerel arayüz olarak kalır.",
        sections: [
          {
            id: "products-catalog",
            title: "Ürün Kataloğu",
            description: "Ürün kartları ve temel ürün detayları.",
            count: moduleCounts.products,
          },
          {
            id: "products-categories",
            title: "Ürün Kategorileri",
            description: "Ürün sınıflandırma alanı.",
            count: 0,
          },
          {
            id: "products-history",
            title: "Ürün Geçmişi",
            description: "Ürün işlem geçmişi kayıtları.",
            count: 0,
          },
        ],
        statusNote: {
          tone: "info",
          message: "Sistem kayıtları oturum korumalı backend ve Supabase üzerinden yüklenir.",
        },
      },
      "price-analysis": {
        title: "Fiyat Analizi",
        description:
          "Fiyat analizi ekranı malzeme analizinden bağımsız tutulur.",
        sections: [
          {
            id: "price-analysis-list",
            title: "Fiyat Analiz Kayıtları",
            description: "Ürün veya sistem bazlı fiyat analizi kayıtları.",
            count: moduleCounts.priceAnalysis,
          },
          {
            id: "price-analysis-comparison",
            title: "Fiyat Karşılaştırma",
            description: "Tedarikçi bazlı fiyat karşılaştırma sonuçları.",
            count: 0,
          },
        ],
        statusNote: {
          tone: "info",
          message: LOCAL_ONLY_MODULE_MESSAGE,
        },
      },
      "material-analysis": {
        title: "Malzeme Analizi",
        description:
          "Malzeme maliyet analizleri fiyat analizinden ayrı veri yapısıyla hazırlanır.",
        sections: [
          {
            id: "material-analysis-list",
            title: "Malzeme Analiz Kayıtları",
            description: "Malzeme maliyet ve tüketim analiz kayıtları.",
            count: moduleCounts.materialAnalysis,
          },
          {
            id: "material-analysis-breakdown",
            title: "Maliyet Kırılımı",
            description: "Birim ve toplam maliyet kırılım alanı.",
            count: 0,
          },
        ],
        statusNote: {
          tone: "info",
          message: LOCAL_ONLY_MODULE_MESSAGE,
        },
      },
      crm: {
        title: "Müşteriler / CRM",
        description:
          "CRM modülü müşteri yönetimi için API entegrasyonuna hazırdır.",
        sections: [
          {
            id: "crm-customers",
            title: "Müşteri Listesi",
            description: "Kurumsal ve bireysel müşteri kayıtları.",
            count: moduleCounts.customers,
          },
          {
            id: "crm-opportunities",
            title: "Fırsatlar",
            description: "Satış fırsatları ve durum takibi.",
            count: 0,
          },
        ],
        statusNote: {
          tone: "info",
          message: LOCAL_ONLY_MODULE_MESSAGE,
        },
      },
      documents: {
        title: "Belgeler",
        description:
          "Belge yönetimi modülü dijital arşiv bağlantıları için hazırlanmıştır.",
        sections: [
          {
            id: "documents-library",
            title: "Belge Kütüphanesi",
            description: "Sözleşme, teklif ve teknik belge arşivi.",
            count: moduleCounts.documents,
          },
          {
            id: "documents-approvals",
            title: "Onay Süreçleri",
            description: "Belge onay takip kayıtları.",
            count: 0,
          },
        ],
        statusNote: {
          tone: "info",
          message: LOCAL_ONLY_MODULE_MESSAGE,
        },
      },
      finance: {
        title: "Finans / Maliyet",
        description:
          "Finansal takip ve maliyet yönetimi için temel ekran iskeleti.",
        sections: [
          {
            id: "finance-records",
            title: "Finans Kayıtları",
            description: "Gelir-gider, maliyet ve bütçe kayıtları.",
            count: moduleCounts.finance,
          },
          {
            id: "finance-budget",
            title: "Bütçe Durumu",
            description: "Bütçe hedefleri ve gerçekleşme özetleri.",
            count: 0,
          },
        ],
        statusNote: {
          tone: "info",
          message: LOCAL_ONLY_MODULE_MESSAGE,
        },
      },
      reports: {
        title: "Raporlar",
        description: "Yönetim raporları ve analiz çıktıları için iskelet yapı.",
        sections: [
          {
            id: "reports-library",
            title: "Rapor Listesi",
            description: "Operasyonel ve finansal rapor kayıtları.",
            count: moduleCounts.reports,
          },
          {
            id: "reports-scheduled",
            title: "Planlı Raporlar",
            description: "Zamanlanmış rapor üretim alanı.",
            count: 0,
          },
        ],
        statusNote: {
          tone: "info",
          message: LOCAL_ONLY_MODULE_MESSAGE,
        },
      },
      settings: {
        title: "Ayarlar",
        description: "Uygulama tercihleri ve yapılandırma alanı.",
        sections: [
          {
            id: "settings-app",
            title: "Uygulama Tercihleri",
            description: "Temel arayüz ve kullanıcı ayarları.",
            count: 0,
          },
          {
            id: "settings-integrations",
            title: "Sistem Yapılandırması",
            description: "API ve entegrasyon ayarları.",
            count: 0,
          },
        ],
        statusNote: {
          tone: "info",
          message: LOCAL_ONLY_MODULE_MESSAGE,
        },
      },
      integrations: {
        title: "Entegrasyon Merkezi",
        description: "Provider bağlantılarını test et, durumlarını izle ve gerekli backend environment ayarlarını görüntüle.",
        sections: [
          {
            id: "integration-providers",
            title: "Bağlantı Merkezi",
            description: "Gmail, Google Calendar, WhatsApp, CRM, Web/CMS, Apple, Supabase, AI ve araştırma sağlayıcısı.",
            count: 9,
          },
        ],
        statusNote: {
          tone: "info",
          message: "API secret ve OAuth token değerleri yalnızca sunucuda kalır.",
        },
      },
    }),
    [moduleCounts]
  );

  const renderModule = () => {
    if (activeModule === "dashboard") {
      return renderDashboard();
    }

    if (activeModule === "integrations") {
      return <OperationsModule moduleId="integrations" onNavigate={handleModuleNavigation} />;
    }

    if (activeModule === "projects") {
      return (
        <ProjectsModule
          showProjectForm={showProjectForm}
          setShowProjectForm={setShowProjectForm}
          createProject={createProject}
          projectName={projectName}
          setProjectName={setProjectName}
          projectType={projectType}
          setProjectType={setProjectType}
          projectStatus={projectStatus}
          setProjectStatus={setProjectStatus}
          projectsLoading={projectsLoading}
          projectsError={projectsError}
          projects={projects}
          deleteProject={deleteProject}
          updateProject={updateProject}
          selectedProjectId={selectedProjectId}
          onNavigate={handleModuleNavigation}
        />
      );
    }

    if (activeModule === "systems") {
      return (
        <SystemsModule
          systemInventory={systemInventory}
          showMemoryForm={showMemoryForm}
          setShowMemoryForm={setShowMemoryForm}
          createMemory={createMemory}
          memoryTitle={memoryTitle}
          setMemoryTitle={setMemoryTitle}
          memoryContent={memoryContent}
          setMemoryContent={setMemoryContent}
          memoryItems={memoryItems}
          deleteMemory={deleteMemory}
          onNavigate={handleModuleNavigation}
          statusNote={{
            tone: "info",
            message: LOCAL_ONLY_MODULE_MESSAGE,
          }}
        />
      );
    }

    if (activeModule === "offers") {
      return (
        <OffersModule
          offersFetchState={offersFetchState}
          offersLoading={offersLoading}
          onOffersReload={handleOffersReload}
          showOfferForm={showOfferForm}
          setShowOfferForm={setShowOfferForm}
          offersError={offersError}
          offers={offers}
          createOffer={createOffer}
          offerName={offerName}
          setOfferName={setOfferName}
          offerAmount={offerAmount}
          setOfferAmount={setOfferAmount}
          offerStatus={offerStatus}
          setOfferStatus={setOfferStatus}
          selectedOfferId={selectedOfferId}
          setSelectedOfferId={setSelectedOfferId}
          deleteOffer={deleteOffer}
          selectedOfferDetail={selectedOfferDetail}
          offerDetailLoading={offerDetailLoading}
          offerDetailError={offerDetailError}
          getOfferStatusTone={getOfferStatusTone}
          canUseLocalFallback={CAN_USE_LOCAL_FALLBACK}
          projects={projects}
        />
      );
    }

    if (activeModule === "crm") {
      return <CRMModule projects={projects} onNavigate={handleModuleNavigation} setAiInput={setAiInput} />;
    }

    if (activeModule === "procurement") {
      return (
        <ProcurementModule
          showProcurementForm={showProcurementForm}
          setShowProcurementForm={setShowProcurementForm}
          createProcurement={createProcurement}
          procurementName={procurementName}
          setProcurementName={setProcurementName}
          procurementNote={procurementNote}
          setProcurementNote={setProcurementNote}
          procurementError={procurementError}
          procurementLoading={procurementLoading}
          procurementItems={procurementItems}
          deleteProcurement={deleteProcurement}
          updateProcurement={updateProcurement}
          saveResearchResult={saveResearchResult}
          projects={projects}
        />
      );
    }

    if (activeModule === "ai-assistant") {
      return (
        <AIModule
          aiMessages={aiMessages}
          sendAiMessage={sendAiMessage}
          aiInput={aiInput}
          setAiInput={setAiInput}
          aiAttachment={aiAttachment}
          setAiAttachment={setAiAttachment}
          onNavigate={handleModuleNavigation}
          aiSending={aiSending}
          onConfirmAction={confirmAiOperationalAction}
          onConfirmProjectImport={confirmAiProjectImport}
          onRetryProjectImportPreview={retryAiProjectImportPreview}
        />
      );
    }

    if (activeModule === "messages") {
      return <MessagesModule />;
    }
    if (activeModule === "documents") {
      return <DocumentsModule />;
    }

    if (
      [
        "products",
        "price-analysis",
        "material-analysis",
        "crm",
        "documents",
        "finance",
        "calendar",
        "reports",
        "settings",
        "website",
      ].includes(activeModule)
    ) {
      return (
        <OperationsModule
          moduleId={activeModule}
          onNavigate={handleModuleNavigation}
          setAiInput={setAiInput}
          projects={projects}
          offers={offers}
          research={procurementItems}
          aiMessages={aiMessages}
          onReportsChanged={setReportItems}
          onFinanceChanged={setFinanceItems}
        />
      );
    }

    const skeletonProps =
      skeletonModuleProps[activeModule] || skeletonModuleProps.settings;
    return <SkeletonModule {...skeletonProps} />;
  };

  const currentModule =
    modules.find((module) => module.id === activeModule) ||
    modules[0];

  return (
    <div className={`ddpro-app${activeModule === "dashboard" ? " dashboard-shell" : ""}${activeModule === "dashboard" && showDashboardReference ? " dashboard-reference-active" : ""}`}>
      <header className="app-header">
        <div className="brand-area">
          <img
            className="brand-logo"
            src={ddproMasterLogo}
            alt="DOĞRU DİZAYN PRO"
          />
          <div className="brand-content">
            <span>CREATIVE SOLUTIONS <i aria-hidden="true" /> AI TRADE</span>
          </div>
        </div>

        <div className="header-welcome">
          <span>Hoş Geldiniz</span>
          <strong>DOĞRU DİZAYN PRO</strong>
        </div>

        <div className={`header-status ${headerStatusTone}`}>
          <span className={`status-dot ${headerStatusTone}`} aria-hidden="true"></span>
          {headerStatusLabel}
        </div>
      </header>

      <div className="app-layout">
        <aside className="sidebar">
          {activeModule === "dashboard" ? (
            <div className="sidebar-master-card">
              <img
                className="sidebar-master-logo"
                src={ddproMasterLogo}
                alt=""
              />
            </div>
          ) : null}

          <div className="sidebar-title">
            ANA MODÜLLER
          </div>

          <nav className="module-nav">
            {modules.map((module) => (
              <button
                key={module.id}
                type="button"
                className={`module-button ${
                  activeModule === module.id ? "active" : ""
                }`}
                onClick={() => handleModuleNavigation(module.id)}
              >
                {module.id === "settings" ? (
                  <DDProIcon name="settings" className="module-icon" />
                ) : (
                  <span className="module-icon">{module.icon}</span>
                )}

                <span className="module-text">
                  <strong>{module.title}</strong>
                  <small>{module.short}</small>
                </span>
              </button>
            ))}
          </nav>

          <div className="sidebar-footer">
            <div className="sidebar-system">
              <span className="status-dot" aria-hidden="true"></span>
              DDPro Core v1.1
            </div>
          </div>
        </aside>

        <main className={`main-content${activeModule === "dashboard" ? " dashboard-main" : ""}`}>
          <section className="content-header">
            <div>
              <h1>{currentModule.title}</h1>
              <p>{currentModule.description}</p>
            </div>
            {activeModule === "dashboard" ? (
              <button
                className="dashboard-reference-return"
                type="button"
                ref={dashboardReferenceReturnRef}
                aria-expanded={showDashboardReference}
                onClick={() => setShowDashboardReference(true)}
              >
                ANA TASARIM GÖRÜNÜMÜ
              </button>
            ) : null}
          </section>

          <section className="content-body">
            <Suspense
              fallback={
                <p
                  className="module-loading"
                  role="status"
                  aria-live="polite"
                >
                  Modül yükleniyor...
                </p>
              }
            >
              {renderModule()}
            </Suspense>
          </section>
        </main>
      </div>

      <footer className="app-footer">
        <div className="footer-slogan">
          <span>DOĞRU <strong>ÇİZGİ</strong></span>
          <i aria-hidden="true" />
          <span>DOĞRU <strong>ÇÖZÜM</strong></span>
          <i aria-hidden="true" />
          <span>DOĞRU <strong>SİSTEM</strong></span>
        </div>
        <div className="footer-status">
          <span className="footer-clock" aria-hidden="true">◷</span>
          <span>{footerDateFormatter.format(currentDate)}</span>
          <i aria-hidden="true" />
          <span className="status-dot" aria-hidden="true" />
          <span>Arayüz Aktif</span>
        </div>
      </footer>

      {activeModule === "dashboard" && showDashboardReference ? (
        <section
          id="dashboard-reference-screen"
          className="dashboard-reference-screen"
          ref={dashboardReferenceDialogRef}
          role="dialog"
          aria-modal="true"
          aria-label="Ana Dashboard referans görünümü"
        >
          <div className="dashboard-reference-canvas">
            <img
              className="dashboard-reference-image"
              src={dashboardDesignReference}
              alt="DOĞRU DİZAYN PRO'nun grafit, metalik ve zümrüt operasyon merkezi Dashboard tasarımı"
            />
            <span
              className="dashboard-reference-clock"
              aria-label={`Türkiye saati: ${footerDateFormatter.format(currentDate)}`}
            >
              {footerDateFormatter.format(currentDate)}
            </span>
            <nav className="dashboard-reference-primary-nav" aria-label="Ana modüller">
              {dashboardReferenceNavigation.map((item) => (
                <button
                  className={`dashboard-reference-hotspot dashboard-reference-nav-${item.moduleId}`}
                  key={`${item.label}-${item.moduleId}`}
                  type="button"
                  aria-label={item.label}
                  onClick={() => handleModuleNavigation(item.moduleId)}
                />
              ))}
            </nav>
            <div
              className="dashboard-reference-kpis"
              role="group"
              aria-label="Dashboard KPI modülleri"
            >
              {dashboardStats.map((stat) => (
                <button
                  className={`dashboard-reference-hotspot dashboard-reference-kpi-${stat.moduleId}`}
                  key={stat.label}
                  type="button"
                  aria-label={`${stat.label}: ${stat.value}. Modülü aç`}
                  onClick={() => handleModuleNavigation(stat.moduleId)}
                />
              ))}
            </div>
            <button
              className="dashboard-reference-hotspot dashboard-reference-projects"
              type="button"
              aria-label="Aktif projeleri aç"
              onClick={() => handleModuleNavigation("projects")}
            />
            <button
              className="dashboard-reference-hotspot dashboard-reference-map"
              type="button"
              aria-label="Proje haritasından projeleri aç"
              onClick={() => handleModuleNavigation("projects")}
            />
            <button
              className="dashboard-reference-hotspot dashboard-reference-calendar"
              type="button"
              aria-label="Proje takvimini aç"
              onClick={() => handleModuleNavigation("calendar")}
            />
            <button
              className="dashboard-reference-hotspot dashboard-reference-systems"
              type="button"
              aria-label="Sistem durumlarını aç"
              onClick={() => handleModuleNavigation("systems")}
            />
            <button
              className="dashboard-reference-hotspot dashboard-reference-live"
              type="button"
              ref={dashboardReferenceLiveRef}
              aria-label="Tasarım görselinden canlı Dashboard modüllerine geç"
              title="Canlı Dashboard'u aç"
              data-tooltip="Canlı Dashboard"
              onClick={() => setShowDashboardReference(false)}
            />
            <details className="dashboard-reference-module-menu">
              <summary aria-label="Tüm uygulama modüllerini aç">
                <span className="sr-only">Tüm uygulama modülleri</span>
              </summary>
              <nav aria-label="Tüm uygulama modülleri">
                {modules.map((module) => (
                  <button
                    key={module.id}
                    type="button"
                    onClick={() => handleModuleNavigation(module.id)}
                  >
                    <span aria-hidden="true">{module.icon}</span>
                    {module.title}
                  </button>
                ))}
              </nav>
            </details>
          </div>
          <nav className="dashboard-reference-mobile-nav" aria-label="Dashboard modülleri">
            <button
              className="dashboard-reference-mobile-live"
              type="button"
              onClick={() => setShowDashboardReference(false)}
            >
              Canlı Dashboard
            </button>
            {modules.map((module) => (
              <button
                key={module.id}
                type="button"
                onClick={() => handleModuleNavigation(module.id)}
              >
                {module.title}
              </button>
            ))}
          </nav>
        </section>
      ) : null}
    </div>
  );
}

export default App;
