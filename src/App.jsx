import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import ddproMasterLogo from "../DDPRO_LOGO_MASTER_V1_EXACT.png";
import {
  createProject as createProjectRequest,
  deleteProject as deleteProjectRequest,
  getProjects,
} from "./services/projects.service.js";
import "./styles.css";
import {
  createOffer as createOfferRequest,
  deleteOffer as deleteOfferRequest,
  getOfferById,
  getOffers,
  mapOfferToViewModel,
  mapOffersToViewModel,
} from "./services/offers.service.js";
import {
  CAN_USE_LOCAL_FALLBACK,
  getApiHealth,
} from "./services/api.js";
import {
  createResearchItem as createProcurementRequest,
  deleteResearchItem as deleteProcurementRequest,
  getResearchItems as getProcurementItems,
} from "./services/research.service.js";

const ProjectsModule = lazy(() => import("./modules/ProjectsModule.jsx"));
const ProcurementModule = lazy(() => import("./modules/ProcurementModule.jsx"));
const OffersModule = lazy(() => import("./modules/OffersModule.jsx"));
const SystemsModule = lazy(() => import("./modules/SystemsModule.jsx"));
const AIModule = lazy(() => import("./modules/AIModule.jsx"));
const SkeletonModule = lazy(() => import("./modules/SkeletonModule.jsx"));

const STORAGE_KEYS = {
  projects: "ddpro_projects_v1",
  procurement: "ddpro_research_v1",
  offers: "ddpro_offers_v1",
  memory: "ddpro_memory_v1",
  logs: "ddpro_system_logs_v1",
  integrations: "ddpro_integrations_v1",
  products: "ddpro_products_v1",
  systems: "ddpro_system_inventory_v1",
  priceAnalysis: "ddpro_price_analysis_v1",
  materialAnalysis: "ddpro_material_analysis_v1",
  customers: "ddpro_customers_v1",
  documents: "ddpro_documents_v1",
  finance: "ddpro_finance_v1",
  reports: "ddpro_reports_v1",
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
];

const moduleRouteMap = Object.fromEntries(
  modules.map((module) => [module.id, module.path])
);

const routeModuleMap = Object.fromEntries(
  modules.map((module) => [module.path, module.id])
);
const moduleIds = new Set(modules.map((module) => module.id));

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

function App() {
  const [activeModule, setActiveModule] = useState(() =>
    resolveModuleFromHash(window.location.hash)
  );

  const [apiHealthState, setApiHealthState] = useState({
    status: "loading",
    message: "",
  });

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
  const projectsTouchedRef = useRef(false);
  const procurementTouchedRef = useRef(false);
  const offersTouchedRef = useRef(false);
  const offerDetailsCacheRef = useRef(new Map());

  const [memoryItems, setMemoryItems] = useState(() =>
    getStoredData(STORAGE_KEYS.memory)
  );

  const [systemLogs, setSystemLogs] = useState(() =>
    getStoredData(STORAGE_KEYS.logs)
  );

  const [integrations, setIntegrations] = useState(() =>
    getStoredData(STORAGE_KEYS.integrations, [
      {
        id: "ddpro-core",
        name: "DDPro Core",
        status: "Aktif",
        description: "Merkezi uygulama ve veri yönetim katmanı.",
      },
      {
        id: "local-storage",
        name: "Local Storage",
        status: "Aktif",
        description: "Tarayıcı içi kalıcı kayıt sistemi.",
      },
    ])
  );
  const [products] = useStoredDataState(STORAGE_KEYS.products);
  const [systemInventory] = useStoredDataState(STORAGE_KEYS.systems);
  const [priceAnalysisItems] = useStoredDataState(STORAGE_KEYS.priceAnalysis);
  const [materialAnalysisItems] = useStoredDataState(STORAGE_KEYS.materialAnalysis);
  const [customerItems] = useStoredDataState(STORAGE_KEYS.customers);
  const [documentItems] = useStoredDataState(STORAGE_KEYS.documents);
  const [financeItems] = useStoredDataState(STORAGE_KEYS.finance);
  const [reportItems] = useStoredDataState(STORAGE_KEYS.reports);

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
    const syncModuleFromHash = () => {
      const nextModule = resolveModuleFromHash(window.location.hash);
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
      const localOffers = getStoredData(STORAGE_KEYS.offers);
      const localOfferViewModels = mapOffersToViewModel(localOffers);
      setOffersLoading(true);
      setOffersError(null);
      setOffersFetchState("loading");

      try {
        const apiOffers = await getOffers();

        if (cancelled) return;

        offerDetailsCacheRef.current.clear();

        if (offersTouchedRef.current) {
          addLog(
            "Tekliflerde yerel değişiklik algılandı, API yanıtı üzerine yazmadı."
          );
          setOffersFetchState(apiOffers.length > 0 ? "success" : "empty");
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
        if (!cancelled) {
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
          setOffersLoading(false);
        }
      }
    };

    fetchOffersFromApi();

    return () => {
      cancelled = true;
    };
  }, [offersReloadKey]);

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
      const localProcurementItems = getInitialItems(STORAGE_KEYS.procurement);
      setProcurementLoading(true);
      setProcurementError(null);
      setProcurementFetchState("loading");

      try {
        const apiProcurementItems = await getProcurementItems();

        if (cancelled) return;

        if (procurementTouchedRef.current) {
          addLog(
            "Tedarik kayıtlarında yerel değişiklik algılandı, API yanıtı üzerine yazmadı."
          );
          setProcurementFetchState(
            apiProcurementItems.length > 0 ? "success" : "empty"
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
        if (!cancelled) {
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
          setProcurementLoading(false);
        }
      }
    };

    fetchProcurementFromApi();

    return () => {
      cancelled = true;
    };
  }, []);

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
    localStorage.setItem(
      STORAGE_KEYS.integrations,
      JSON.stringify(integrations)
    );
  }, [integrations]);

  useEffect(() => {
    let cancelled = false;

    const fetchProjectsFromApi = async () => {
      const localProjects = getInitialItems(STORAGE_KEYS.projects);
      setProjectsLoading(true);
      setProjectsError(null);
      setProjectsFetchState("loading");

      try {
        const apiProjects = await getProjects();

        if (cancelled) return;

        if (projectsTouchedRef.current) {
          addLog(
            "Projelerde yerel değişiklik algılandı, API yanıtı üzerine yazmadı."
          );
          setProjectsFetchState(apiProjects.length > 0 ? "success" : "empty");
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
        if (!cancelled) {
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
          setProjectsLoading(false);
        }
      }
    };

    fetchProjectsFromApi();

    return () => {
      cancelled = true;
    };
  }, []);

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

  const dashboardStats = useMemo(
    () => [
      {
        label: "AKTİF PROJELER",
        value: activeProjects.length,
        detail: "Devam eden projeler",
        icon: "▣",
        moduleId: "projects",
      },
      {
        label: "TEKLİFLER",
        value: offers.length,
        detail: `${pendingOffers.length} bekleyen teklif`,
        icon: "◈",
        moduleId: "offers",
      },
      {
        label: "ARAŞTIRMALAR",
        value: procurementItems.length,
        detail: "Tedarik ve ürün araştırması",
        icon: "⌕",
        moduleId: "procurement",
      },
      {
        label: "AI ETKİLEŞİMİ",
        value: aiMessages.filter((message) => message.role === "user").length,
        detail: "Asistan sohbet isteği",
        icon: "AI",
        moduleId: "ai-assistant",
      },
    ],
    [
      activeProjects.length,
      aiMessages,
      offers.length,
      pendingOffers.length,
      procurementItems.length,
    ]
  );

  const handleModuleNavigation = (moduleId) => {
    const nextRoute = moduleRouteMap[moduleId] || "/dashboard";
    if (window.location.hash !== `#${nextRoute}`) {
      window.location.hash = nextRoute;
      return;
    }

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
    projectsTouchedRef.current = true;
    let shouldResetForm = false;

    const newProject = {
      id: createId(),
      name: projectName.trim(),
      type: projectType.trim() || "Genel Proje",
      status: projectStatus,
      date: formatDate(),
    };

    setProjectsError(null);

    try {
      const createdProject = await createProjectRequest(newProject);
      const nextProject = createdProject || newProject;

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
    projectsTouchedRef.current = true;

    if (!isUuid(id)) {
      setProjects((currentProjects) =>
        currentProjects.filter((item) => item.id !== id)
      );

      if (project) {
        addLog(`Yerel proje silindi: ${project.name}`);
      }

      return;
    }

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
    }
  };

  const createProcurement = async (event) => {
    event.preventDefault();

    if (!procurementName.trim()) return;
    procurementTouchedRef.current = true;
    let shouldResetForm = false;

    const newProcurement = {
      id: createId(),
      name: procurementName.trim(),
      note: procurementNote.trim() || "Not eklenmedi.",
      date: formatDate(),
    };

    setProcurementError(null);

    try {
      const createdProcurement = await createProcurementRequest(newProcurement);
      const nextProcurement = createdProcurement || newProcurement;

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
    }

    if (shouldResetForm) {
      setProcurementName("");
      setProcurementNote("");
      setShowProcurementForm(false);
    }
  };

  const deleteProcurement = async (id) => {
    const item = procurementItems.find(
      (procurement) => procurement.id === id
    );
    procurementTouchedRef.current = true;

    if (!isUuid(id)) {
      setProcurementItems((currentItems) =>
        currentItems.filter((procurement) => procurement.id !== id)
      );

      if (item) {
        addLog(`Yerel tedarik kaydı silindi: ${item.name}`);
      }

      return;
    }

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
    }
  };

  const createOffer = async (event) => {
    event.preventDefault();

    if (!offerName.trim()) return;
    offersTouchedRef.current = true;
    let shouldResetForm = false;

    const newOffer = mapOfferToViewModel({
      id: createId(),
      title: offerName.trim(),
      amount: offerAmount.trim() || "Tutar belirtilmedi",
      status: offerStatus,
      statusRaw: offerStatus,
      date: formatDate(),
      source: "local",
    });

    setOffersError(null);

    try {
      const createdOffer = await createOfferRequest(newOffer);
      const nextOffer = createdOffer || newOffer;

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
    }

    if (shouldResetForm) {
      setOfferName("");
      setOfferAmount("");
      setOfferStatus("Hazırlanıyor");
      setShowOfferForm(false);
    }
  };

  const deleteOffer = async (id) => {
    const offer = offers.find((item) => item.id === id);
    offersTouchedRef.current = true;

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

  const toggleIntegration = (id) => {
    const integration = integrations.find((item) => item.id === id);

    if (!integration) return;

    const nextStatus =
      integration.status === "Aktif" ? "Pasif" : "Aktif";

    setIntegrations((currentItems) =>
      currentItems.map((item) =>
        item.id === id
          ? {
              ...item,
              status: nextStatus,
            }
          : item
      )
    );

    addLog(
      `${integration.name} entegrasyon durumu değiştirildi: ${nextStatus}`
    );
  };

  const sendAiMessage = (event) => {
    event.preventDefault();

    const message = aiInput.trim();

    if (!message) return;

    const userMessage = {
      id: createId(),
      role: "user",
      text: message,
      date: formatDate(),
    };

    const assistantMessage = {
      id: createId(),
      role: "assistant",
      text:
        `Mesaj alındı: "${message}". ` +
        "DDPro AI çalışma alanı bu mesajı kayıt altına aldı. " +
        "Gelişmiş AI/API entegrasyonu sonraki altyapı aşamasında bu alana bağlanabilir.",
      date: formatDate(),
    };

    setAiMessages((currentMessages) => [
      ...currentMessages,
      userMessage,
      assistantMessage,
    ]);

    addLog(`DDPro AI mesajı gönderildi: ${message}`);

    setAiInput("");
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

          <div className="project-map-canvas" aria-label={`${activeProjects.length} aktif proje`}>
            <svg className="world-map" viewBox="0 0 600 320" role="img" aria-label="Dekoratif dünya haritası">
              <defs>
                <pattern id="map-grid" width="28" height="28" patternUnits="userSpaceOnUse">
                  <path d="M 28 0 L 0 0 0 28" fill="none" stroke="currentColor" strokeWidth="0.7" />
                </pattern>
                <pattern id="map-dots" width="9" height="9" patternUnits="userSpaceOnUse">
                  <circle cx="2" cy="2" r="1.1" fill="currentColor" />
                </pattern>
              </defs>
              <rect width="600" height="320" fill="url(#map-grid)" />
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
              <rect width="600" height="320" fill="url(#map-dots)" />
            </svg>
            <div className="map-legend"><span /> Proje ağı görünümü</div>
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
                  onClick={() => handleModuleNavigation("projects")}
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

        <section className="panel calendar-panel">
          <div className="panel-header">
            <h2>YAKLAŞAN TAKVİM</h2>
            <span className="calendar-month">
              {new Intl.DateTimeFormat("tr-TR", { month: "short", year: "numeric" }).format(new Date())}
            </span>
          </div>
          {(() => {
            const now = new Date();
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
            const leadingDays = (monthStart.getDay() + 6) % 7;
            return (
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
                <div className="calendar-empty">
                  <span className="status-dot" />
                  <p>Planlanmış yaklaşan etkinlik bulunmuyor.</p>
                </div>
                <button
                  className="calendar-action"
                  type="button"
                  onClick={() => handleModuleNavigation("projects")}
                >
                  Proje takvimini görüntüle <span aria-hidden="true">→</span>
                </button>
              </div>
            );
          })()}
        </section>
      </div>

      <div className="dashboard-footer-grid">
        <section className="panel system-panel">
          <div className="panel-header">
            <h2>SİSTEM DURUMLARI</h2>
            <span className="system-overall"><span className="status-dot" /> CANLI</span>
          </div>
          <div className="system-status-list">
            <div className="system-status-item">
              <span>DDPro Core</span><strong>Hazır</strong>
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
          </div>
        </section>
        <section className="panel quick-access-panel">
          <div className="panel-header">
            <h2>HIZLI ERİŞİM</h2>
          </div>
          <div className="quick-links-grid">
            {modules
              .filter((module) => ["offers", "procurement", "ai-assistant", "reports"].includes(module.id))
              .map((module) => (
                <button
                  type="button"
                  className="quick-link-card"
                  key={module.id}
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

      {systemLogs.length > 0 ? (
        <section className="panel recent-activity-panel">
          <div className="panel-header">
            <h2>SON İŞLEMLER</h2>
          </div>
          <div className="log-list">
            {systemLogs.slice(0, 4).map((log) => (
              <div className="log-item" key={log.id}>
                <strong>{log.message}</strong>
                <small>{log.date}</small>
              </div>
            ))}
          </div>
        </section>
      ) : null}
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
      integrations: integrations.length,
    }),
    [
      products.length,
      priceAnalysisItems.length,
      materialAnalysisItems.length,
      customerItems.length,
      documentItems.length,
      financeItems.length,
      reportItems.length,
      integrations.length,
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
          message: LOCAL_ONLY_MODULE_MESSAGE,
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
            count: moduleCounts.integrations,
          },
        ],
        statusNote: {
          tone: "info",
          message: LOCAL_ONLY_MODULE_MESSAGE,
        },
      },
    }),
    [moduleCounts]
  );

  const renderModule = () => {
    if (activeModule === "dashboard") {
      return renderDashboard();
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
          integrations={integrations}
          toggleIntegration={toggleIntegration}
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
        />
      );
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
    <div className={`ddpro-app${activeModule === "dashboard" ? " dashboard-shell" : ""}`}>
      <header className="app-header">
        <div className="brand-area">
          <img
            className="brand-logo"
            src={ddproMasterLogo}
            alt="DOĞRU DİZAYN PRO"
          />
          <div className="brand-content">
            <span>CREATIVE SOLUTIONS <i /> AI TRADE</span>
          </div>
        </div>

        <div className="header-welcome">
          <span>Hoş Geldiniz</span>
          <strong>DOĞRU DİZAYN PRO</strong>
        </div>

        <div className={`header-status ${headerStatusTone}`}>
          <span className={`status-dot ${headerStatusTone}`}></span>
          {headerStatusLabel}
        </div>
      </header>

      <div className="app-layout">
        <aside className="sidebar">
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
                <span className="module-icon">
                  {module.icon}
                </span>

                <span className="module-text">
                  <strong>{module.title}</strong>
                  <small>{module.short}</small>
                </span>
              </button>
            ))}
          </nav>

          <div className="sidebar-footer">
            {activeModule === "dashboard" ? (
              <div className="sidebar-master-card">
                <img
                  className="sidebar-master-logo"
                  src={ddproMasterLogo}
                  alt="DOĞRU DİZAYN PRO"
                />
              </div>
            ) : null}
            <div className="sidebar-system">
              <span className="status-dot"></span>
              DDPro Core v1.1
            </div>
          </div>
        </aside>

        <main className={`main-content ${activeModule === "dashboard" ? "dashboard-main" : ""}`}>
          <section className="content-header">
            <div>
              <h1>{currentModule.title}</h1>
              <p>{currentModule.description}</p>
            </div>
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
          <i />
          <span>DOĞRU <strong>ÇÖZÜM</strong></span>
          <i />
          <span>DOĞRU <strong>SİSTEM</strong></span>
        </div>
        <div className="footer-status">
          <span className="footer-clock" aria-hidden="true">◷</span>
          <span>{new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium" }).format(new Date())}</span>
          <i />
          <span className="status-dot" />
          <span>Sistem Aktif</span>
        </div>
      </footer>
    </div>
  );
}

export default App;
