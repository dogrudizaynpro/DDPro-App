import { useEffect, useMemo, useRef, useState } from "react";
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
    title: "Dashboard",
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
      setActiveModule(resolveModuleFromHash(window.location.hash));
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
        setApiHealthState({
          status: "success",
          message:
            data?.database?.ready === false
              ? "Production backend yanıt veriyor ancak veritabanı hazır değil."
              : "",
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
    localStorage.setItem(STORAGE_KEYS.projects, JSON.stringify(projects));
  }, [projects]);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEYS.procurement,
      JSON.stringify(procurementItems)
    );
  }, [procurementItems]);

  useEffect(() => {
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

    let cancelled = false;
    setOfferDetailLoading(true);
    setOfferDetailError(null);

    getOfferById(selectedOfferId)
      .then((offer) => {
        if (!cancelled) {
          setSelectedOfferDetail(offer || selectedOffer);
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

  const dashboardStats = useMemo(
    () => [
      {
        label: "AKTİF PROJELER",
        value: projects.filter(
          (project) => project.status === "Aktif"
        ).length,
      },
      {
        label: "BEKLEYEN TEKLİFLER",
        value: offers.filter((offer) => offer.status === "Hazırlanıyor")
          .length,
      },
      {
        label: "ÜRÜNLER",
        value: products.length,
      },
      {
        label: "SİSTEMLER",
        value: systemInventory.length,
      },
    ],
    [projects, offers, products, systemInventory]
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

  const renderModuleSkeleton = (title, description, sections, statusNote = null) => (
    <div className="module-page">
      <div className="panel">
        <div className="panel-header">
          <h2>{title}</h2>
        </div>
        <div className="panel-content">
          <p className="module-intro">{description}</p>
          {statusNote ? (
            <p className={`status-banner ${statusNote.tone || "info"}`}>
              {statusNote.message}
            </p>
          ) : null}
        </div>
      </div>

      <div className="skeleton-grid">
        {sections.map((section) => (
          <article className="skeleton-card" key={section.id}>
            <h3>{section.title}</h3>
            <p>{section.description}</p>
            {section.count > 0 ? (
              <small>{section.count} kayıt bulundu.</small>
            ) : (
              <p className="empty-state compact">Henüz veri bulunmuyor.</p>
            )}
          </article>
        ))}
      </div>
    </div>
  );

  const createProject = async (event) => {
    event.preventDefault();

    if (!projectName.trim()) return;
    projectsTouchedRef.current = true;

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
    } catch (error) {
      if (CAN_USE_LOCAL_FALLBACK) {
        setProjects((currentProjects) => [newProject, ...currentProjects]);
        setProjectsFetchState("warning");
        setProjectsError("Proje API'ye kaydedilemedi. Yerel kayıt oluşturuldu.");
        addLog(`Yeni proje yerel olarak oluşturuldu: ${newProject.name}`);
      } else {
        setProjectsError(
          `Proje API'ye kaydedilemedi (${getApiFailureReason(error)}). Yerel fallback production ortamında kapalı.`
        );
        addLog(
          `Proje oluşturma production API hatası: ${getApiFailureReason(error)}.`
        );
      }
    }

    setProjectName("");
    setProjectType("");
    setProjectStatus("Aktif");
    setShowProjectForm(false);
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
      if (error.status === 404) {
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
    } catch (error) {
      if (CAN_USE_LOCAL_FALLBACK) {
        setProcurementItems((currentItems) => [newProcurement, ...currentItems]);
        setProcurementFetchState("warning");
        setProcurementError(
          "Tedarik kaydı API'ye kaydedilemedi. Yerel kayıt oluşturuldu."
        );
        addLog(`Yeni tedarik kaydı yerel olarak oluşturuldu: ${newProcurement.name}`);
      } else {
        setProcurementError(
          `Tedarik kaydı API'ye kaydedilemedi (${getApiFailureReason(error)}). Yerel fallback production ortamında kapalı.`
        );
        addLog(
          `Tedarik oluşturma production API hatası: ${getApiFailureReason(error)}.`
        );
      }
    }

    setProcurementName("");
    setProcurementNote("");
    setShowProcurementForm(false);
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
      if (error.status === 404) {
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
    } catch (error) {
      console.warn("Teklif API'ye kaydedilemedi:", error.message);

      if (CAN_USE_LOCAL_FALLBACK) {
        setOffers((currentOffers) => [newOffer, ...currentOffers]);
        setSelectedOfferId(newOffer.id);
        setOffersFetchState("warning");
        setOffersError("Teklif API'ye kaydedilemedi. Yerel kayıt oluşturuldu.");
        addLog(`Yeni teklif yerel olarak oluşturuldu: ${newOffer.title}`);
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

    setOfferName("");
    setOfferAmount("");
    setOfferStatus("Hazırlanıyor");
    setShowOfferForm(false);
  };

  const deleteOffer = async (id) => {
    const offer = offers.find((item) => item.id === id);
    offersTouchedRef.current = true;

    if (!isUuid(id)) {
      setOffersError(null);
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

      if (error.status === 404) {
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
          <div className="stat-card" key={stat.label}>
            <span>{stat.label}</span>
            <strong>{stat.value}</strong>
          </div>
        ))}
      </div>

      <div className="dashboard-grid">
        <div className="panel">
          <div className="panel-header">
            <h2>Proje Özeti</h2>
          </div>

          <div className="panel-content">
            <div className="quick-status">
              <span>Toplam Proje</span>
              <strong>{projects.length}</strong>
            </div>
            <div className="quick-status">
              <span>Aktif Projeler</span>
              <strong>
                {projects.filter((project) => project.status === "Aktif").length}
              </strong>
            </div>
            <div className="quick-status">
              <span>Bekleyen Teklifler</span>
              <strong>
                {offers.filter((offer) => offer.status === "Hazırlanıyor").length}
              </strong>
            </div>
            <div className="quick-status">
              <span>Ürün / Sistem Özeti</span>
              <strong>{products.length + systemInventory.length}</strong>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <h2>Hızlı Erişim Kartları</h2>
          </div>

          <div className="panel-content quick-links-grid">
            {modules
              .filter((module) => module.id !== "dashboard")
              .slice(0, 6)
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
                </button>
              ))}
          </div>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="panel">
          <div className="panel-header">
            <h2>Aktif Projeler</h2>
          </div>

          <div className="panel-content">
            {projectsLoading ? (
              <p className="empty-state">Projeler yükleniyor...</p>
            ) : projects.filter((project) => project.status === "Aktif").length ===
              0 ? (
              <p className="empty-state">Henüz veri bulunmuyor.</p>
            ) : (
              <div className="log-list">
                {projects
                  .filter((project) => project.status === "Aktif")
                  .slice(0, 6)
                  .map((project) => (
                    <div className="log-item" key={project.id}>
                      <strong>{project.name}</strong>
                      <small>
                        {project.type} · {project.date}
                      </small>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <h2>Sistem Durumu</h2>
          </div>

          <div className="panel-content">
            <div className="quick-status">
              <span>DDPro Core</span>
              <strong>Hazır</strong>
            </div>
            <div className="quick-status">
              <span>Projeler API</span>
              <strong>{getConnectionLabel(projectsFetchState)}</strong>
            </div>
            <div className="quick-status">
              <span>Teklifler API</span>
              <strong>{getConnectionLabel(offersFetchState)}</strong>
            </div>
            <div className="quick-status">
              <span>Tedarik API</span>
              <strong>{getConnectionLabel(procurementFetchState)}</strong>
            </div>
            <div className="quick-status">
              <span>Diğer Modüller</span>
              <strong>API entegrasyonu bekliyor</strong>
            </div>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h2>Son İşlemler</h2>
        </div>

        <div className="panel-content">
          {systemLogs.length === 0 ? (
            <p className="empty-state">Henüz veri bulunmuyor.</p>
          ) : (
            <div className="log-list">
              {systemLogs.slice(0, 8).map((log) => (
                <div className="log-item" key={log.id}>
                  <strong>{log.message}</strong>
                  <small>{log.date}</small>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderProducts = () =>
    renderModuleSkeleton(
      "Ürünler",
      "Ürün yönetimi modülü production API entegrasyonu tamamlanana kadar yerel arayüz olarak kalır.",
      [
        {
          id: "products-catalog",
          title: "Ürün Kataloğu",
          description: "Ürün kartları ve temel ürün detayları.",
          count: products.length,
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
      {
        tone: "info",
        message: LOCAL_ONLY_MODULE_MESSAGE,
      }
    );

  const renderPriceAnalysis = () =>
    renderModuleSkeleton(
      "Fiyat Analizi",
      "Fiyat analizi ekranı malzeme analizinden bağımsız tutulur.",
      [
        {
          id: "price-analysis-list",
          title: "Fiyat Analiz Kayıtları",
          description: "Ürün veya sistem bazlı fiyat analizi kayıtları.",
          count: priceAnalysisItems.length,
        },
        {
          id: "price-analysis-comparison",
          title: "Fiyat Karşılaştırma",
          description: "Tedarikçi bazlı fiyat karşılaştırma sonuçları.",
          count: 0,
        },
      ],
      {
        tone: "info",
        message: LOCAL_ONLY_MODULE_MESSAGE,
      }
    );

  const renderMaterialAnalysis = () =>
    renderModuleSkeleton(
      "Malzeme Analizi",
      "Malzeme maliyet analizleri fiyat analizinden ayrı veri yapısıyla hazırlanır.",
      [
        {
          id: "material-analysis-list",
          title: "Malzeme Analiz Kayıtları",
          description: "Malzeme maliyet ve tüketim analiz kayıtları.",
          count: materialAnalysisItems.length,
        },
        {
          id: "material-analysis-breakdown",
          title: "Maliyet Kırılımı",
          description: "Birim ve toplam maliyet kırılım alanı.",
          count: 0,
        },
      ],
      {
        tone: "info",
        message: LOCAL_ONLY_MODULE_MESSAGE,
      }
    );

  const renderCRM = () =>
    renderModuleSkeleton(
      "Müşteriler / CRM",
      "CRM modülü müşteri yönetimi için API entegrasyonuna hazırdır.",
      [
        {
          id: "crm-customers",
          title: "Müşteri Listesi",
          description: "Kurumsal ve bireysel müşteri kayıtları.",
          count: customerItems.length,
        },
        {
          id: "crm-opportunities",
          title: "Fırsatlar",
          description: "Satış fırsatları ve durum takibi.",
          count: 0,
        },
      ],
      {
        tone: "info",
        message: LOCAL_ONLY_MODULE_MESSAGE,
      }
    );

  const renderDocuments = () =>
    renderModuleSkeleton(
      "Belgeler",
      "Belge yönetimi modülü dijital arşiv bağlantıları için hazırlanmıştır.",
      [
        {
          id: "documents-library",
          title: "Belge Kütüphanesi",
          description: "Sözleşme, teklif ve teknik belge arşivi.",
          count: documentItems.length,
        },
        {
          id: "documents-approvals",
          title: "Onay Süreçleri",
          description: "Belge onay takip kayıtları.",
          count: 0,
        },
      ],
      {
        tone: "info",
        message: LOCAL_ONLY_MODULE_MESSAGE,
      }
    );

  const renderFinance = () =>
    renderModuleSkeleton(
      "Finans / Maliyet",
      "Finansal takip ve maliyet yönetimi için temel ekran iskeleti.",
      [
        {
          id: "finance-records",
          title: "Finans Kayıtları",
          description: "Gelir-gider, maliyet ve bütçe kayıtları.",
          count: financeItems.length,
        },
        {
          id: "finance-budget",
          title: "Bütçe Durumu",
          description: "Bütçe hedefleri ve gerçekleşme özetleri.",
          count: 0,
        },
      ],
      {
        tone: "info",
        message: LOCAL_ONLY_MODULE_MESSAGE,
      }
    );

  const renderReports = () =>
    renderModuleSkeleton(
      "Raporlar",
      "Yönetim raporları ve analiz çıktıları için iskelet yapı.",
      [
        {
          id: "reports-library",
          title: "Rapor Listesi",
          description: "Operasyonel ve finansal rapor kayıtları.",
          count: reportItems.length,
        },
        {
          id: "reports-scheduled",
          title: "Planlı Raporlar",
          description: "Zamanlanmış rapor üretim alanı.",
          count: 0,
        },
      ],
      {
        tone: "info",
        message: LOCAL_ONLY_MODULE_MESSAGE,
      }
    );

  const renderSettings = () =>
    renderModuleSkeleton(
      "Ayarlar",
      "Uygulama tercihleri ve yapılandırma alanı.",
      [
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
          count: integrations.length,
        },
      ],
      {
        tone: "info",
        message: LOCAL_ONLY_MODULE_MESSAGE,
      }
    );

  const renderProjects = () => (
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
        <p className="status-banner warning">
          ⚠ {projectsError}
        </p>
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

  const renderProcurement = () => (
    <div className="module-page">
      <div className="module-toolbar">
        <button
          type="button"
          onClick={() => setShowProcurementForm((value) => !value)}
        >
          {showProcurementForm ? "Formu Kapat" : "+ Yeni Tedarik Kaydı"}
        </button>
      </div>

      {showProcurementForm && (
        <form className="data-form" onSubmit={createProcurement}>
          <input
            type="text"
            placeholder="Tedarik başlığı"
            value={procurementName}
            onChange={(event) => setProcurementName(event.target.value)}
          />

          <textarea
            placeholder="Tedarik notu"
            value={procurementNote}
            onChange={(event) => setProcurementNote(event.target.value)}
          />

          <button type="submit">Kaydet</button>
        </form>
      )}

      {procurementError && (
        <p className="status-banner warning">
          ⚠ {procurementError}
        </p>
      )}

      <div className="data-list">
        {procurementLoading ? (
          <p className="empty-state">Tedarik kayıtları yükleniyor…</p>
        ) : procurementItems.length === 0 ? (
          <p className="empty-state">Henüz veri bulunmuyor.</p>
        ) : (
          procurementItems.map((item) => (
            <div className="data-card" key={item.id}>
              <div>
                <h3>{item.name}</h3>
                <p>{item.note}</p>
                <small>{item.date}</small>
              </div>

              <button
                type="button"
                onClick={() => deleteProcurement(item.id)}
              >
                Sil
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );

  const renderAI = () => (
    <div className="module-page ai-module">
      <div className="ai-chat">
        {aiMessages.map((message) => (
          <div
            key={message.id}
            className={`ai-message ${message.role}`}
          >
            <strong>
              {message.role === "assistant"
                ? "DDPro AI"
                : "Sen"}
            </strong>
            <p>{message.text}</p>
            <small>{message.date}</small>
          </div>
        ))}
      </div>

      <form className="ai-form" onSubmit={sendAiMessage}>
        <textarea
          placeholder="DDPro AI için mesajını yaz..."
          value={aiInput}
          onChange={(event) => setAiInput(event.target.value)}
        />

        <button type="submit">Gönder</button>
      </form>
    </div>
  );

  const renderOffers = () => (
    <div className="module-page">
      <div className="module-toolbar">
        <div className="offers-toolbar-actions">
          <span className={`offers-status-pill ${offersFetchState}`}>
            {offersFetchState === "loading" && "API yükleniyor"}
            {offersFetchState === "success" && "API bağlı"}
            {offersFetchState === "empty" && "API boş veri döndü"}
            {offersFetchState === "warning" && "Yerel fallback"}
            {offersFetchState === "error" && "API bağlantı hatası"}
          </span>

          <button
            type="button"
            className="secondary-button"
            disabled={offersLoading}
            onClick={() => setOffersReloadKey((value) => value + 1)}
          >
            {offersLoading ? "Yenileniyor..." : "Yenile"}
          </button>

          <button
            type="button"
            onClick={() => setShowOfferForm((value) => !value)}
          >
            {showOfferForm ? "Formu Kapat" : "+ Yeni Teklif"}
          </button>
        </div>
      </div>

      {offersError && (
        <p className="status-banner warning">
          ⚠ {offersError}
        </p>
      )}

      {!offersError && offersFetchState === "empty" && (
        <p className="status-banner info">
          ℹ API üzerinde henüz teklif bulunmuyor
        {CAN_USE_LOCAL_FALLBACK && offers.some((offer) => offer.source === "local")
            ? ", kayıtlı yerel taslaklar listeleniyor."
            : "."}
        </p>
      )}

      {showOfferForm && (
        <form className="data-form" onSubmit={createOffer}>
          <input
            type="text"
            placeholder="Teklif adı"
            value={offerName}
            onChange={(event) => setOfferName(event.target.value)}
          />

          <input
            type="text"
            placeholder="Teklif tutarı"
            value={offerAmount}
            onChange={(event) => setOfferAmount(event.target.value)}
          />

          <select
            value={offerStatus}
            onChange={(event) => setOfferStatus(event.target.value)}
          >
            <option>Hazırlanıyor</option>
            <option>Gönderildi</option>
            <option>Onaylandı</option>
            <option>Reddedildi</option>
          </select>

          <button type="submit">Teklifi Kaydet</button>

          {CAN_USE_LOCAL_FALLBACK ? (
            <p className="form-hint">
              API hata verirse geliştirme ortamında yerel taslak korunur.
            </p>
          ) : null}
        </form>
      )}

      <div className="offers-summary-grid">
        <div className="offer-summary-card">
          <span>Toplam Teklif</span>
          <strong>{offers.length}</strong>
        </div>

        <div className="offer-summary-card">
          <span>API Kayıtları</span>
          <strong>
            {offers.filter((offer) => offer.source === "api").length}
          </strong>
        </div>

        <div className="offer-summary-card">
          <span>Onaylanan</span>
          <strong>
            {offers.filter((offer) => offer.status === "Onaylandı").length}
          </strong>
        </div>

        <div className="offer-summary-card">
          <span>Yerel Taslak</span>
          <strong>
            {offers.filter((offer) => offer.source === "local").length}
          </strong>
        </div>
      </div>

      <div className="offers-layout">
        <div className="panel">
          <div className="panel-header">
            <h2>Teklif Listesi</h2>
            <span className="panel-meta">{offers.length} kayıt</span>
          </div>

          <div className="panel-content">
            {offersLoading ? (
              <p className="empty-state">Teklifler yükleniyor…</p>
            ) : offers.length === 0 ? (
              <p className="empty-state">Henüz veri bulunmuyor.</p>
            ) : (
              <div className="offers-list">
                {offers.map((offer) => (
                  <article
                    className={`offer-card${
                      offer.id === selectedOfferId ? " selected" : ""
                    }`}
                    key={offer.id}
                  >
                    <div className="offer-card-top">
                      <div>
                        <h3>{offer.title}</h3>
                        <p className="offer-amount">{offer.amountDisplay}</p>
                      </div>

                      <span
                        className={`offer-status-badge ${getOfferStatusTone(
                          offer.status
                        )}`}
                      >
                        {offer.status}
                      </span>
                    </div>

                    <div className="offer-meta-row">
                      <span>{offer.date}</span>
                      <span>
                        {offer.source === "api"
                          ? "Canlı API"
                          : "Yerel taslak"}
                      </span>
                    </div>

                    <div className="offer-card-actions">
                      <button
                        type="button"
                        className="offer-secondary-button"
                        onClick={() => setSelectedOfferId(offer.id)}
                      >
                        Detay
                      </button>

                      <button
                        type="button"
                        onClick={() => deleteOffer(offer.id)}
                      >
                        {offer.source === "local" ? "Sil" : "Listeden Kaldır"}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="panel offer-detail-panel">
          <div className="panel-header">
            <h2>Teklif Detayı</h2>
            {selectedOfferDetail && (
              <span className="panel-meta">
                {selectedOfferDetail.source === "api"
                  ? "API detayı"
                  : "Taslak detay"}
              </span>
            )}
          </div>

          <div className="panel-content">
            {offersLoading ? (
              <p className="empty-state">Detay alanı hazırlanıyor…</p>
            ) : !selectedOfferDetail ? (
              <p className="empty-state">
                Detayları görmek için bir teklif seç.
              </p>
            ) : offerDetailLoading ? (
              <p className="empty-state">Teklif detayı yükleniyor…</p>
            ) : (
              <div className="offer-detail-content">
                <div className="offer-detail-header">
                  <div>
                    <h3>{selectedOfferDetail.title}</h3>
                    <p>{selectedOfferDetail.amountDisplay}</p>
                  </div>

                  <span
                    className={`offer-status-badge ${getOfferStatusTone(
                      selectedOfferDetail.status
                    )}`}
                  >
                    {selectedOfferDetail.status}
                  </span>
                </div>

                {offerDetailError && (
                  <p className="status-banner warning">{offerDetailError}</p>
                )}

                <div className="offer-detail-grid">
                  <div className="offer-detail-item">
                    <span>Kaynak</span>
                    <strong>
                      {selectedOfferDetail.source === "api"
                        ? "Teklifler API"
                        : "Yerel taslak"}
                    </strong>
                  </div>

                  <div className="offer-detail-item">
                    <span>Teklif Tarihi</span>
                    <strong>{selectedOfferDetail.date}</strong>
                  </div>

                  <div className="offer-detail-item">
                    <span>Para Birimi</span>
                    <strong>
                      {selectedOfferDetail.currency || "Belirtilmedi"}
                    </strong>
                  </div>

                  <div className="offer-detail-item">
                    <span>Proje Bağlantısı</span>
                    <strong>
                      {selectedOfferDetail.projectId || "Atanmadı"}
                    </strong>
                  </div>
                </div>

                <div className="offer-detail-note">
                  <strong>Detay görünümü hazır</strong>
                  <p>
                    Teklif seçildiğinde temel alanlar ve API detay sorgusu bu
                    panelde yönetilir.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const renderSystems = () => (
    <div className="module-page">
      <div className="panel">
        <div className="panel-header">
          <h2>Sistem Envanteri</h2>
        </div>

        <div className="panel-content">
          {systemInventory.length === 0 ? (
            <p className="empty-state">Henüz veri bulunmuyor.</p>
          ) : (
            <div className="systems-grid">
              {systemInventory.map((item) => (
                <div
                  className="system-card"
                  key={
                    item.id ||
                    `${item.name || "system"}::${item.description || "description-missing"}`
                  }
                >
                  <h3>{item.name || "Sistem Kaydı"}</h3>
                  <p>{item.description || "Sistem detay açıklaması bulunmuyor."}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="panel memory-panel">
        <div className="panel-header">
          <h2>Merkezi Hafıza</h2>

          <button
            type="button"
            onClick={() => setShowMemoryForm((value) => !value)}
          >
            {showMemoryForm ? "Kapat" : "+ Yeni Kayıt"}
          </button>
        </div>

        {showMemoryForm && (
          <form className="data-form" onSubmit={createMemory}>
            <input
              type="text"
              placeholder="Hafıza başlığı"
              value={memoryTitle}
              onChange={(event) => setMemoryTitle(event.target.value)}
            />

            <textarea
              placeholder="Hafıza içeriği"
              value={memoryContent}
              onChange={(event) => setMemoryContent(event.target.value)}
            />

            <button type="submit">Hafızaya Kaydet</button>
          </form>
        )}

        <div className="data-list">
          {memoryItems.length === 0 ? (
            <p className="empty-state">
              Merkezi hafızada henüz kayıt bulunmuyor.
            </p>
          ) : (
            memoryItems.map((item) => (
              <div className="data-card" key={item.id}>
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.content}</p>
                  <small>{item.date}</small>
                </div>

                <button
                  type="button"
                  onClick={() => deleteMemory(item.id)}
                >
                  Sil
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h2>Entegrasyonlar</h2>
        </div>

        <div className="data-list">
          {integrations.map((item) => (
            <div className="data-card" key={item.id}>
              <div>
                <h3>{item.name}</h3>
                <p>{item.description}</p>
                <small>Durum: {item.status}</small>
              </div>

              <button
                type="button"
                onClick={() => toggleIntegration(item.id)}
              >
                {item.status === "Aktif" ? "Pasifleştir" : "Aktifleştir"}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderModule = () => {
    switch (activeModule) {
      case "projects":
        return renderProjects();

      case "products":
        return renderProducts();

      case "systems":
        return renderSystems();

      case "price-analysis":
        return renderPriceAnalysis();

      case "material-analysis":
        return renderMaterialAnalysis();

      case "offers":
        return renderOffers();

      case "crm":
        return renderCRM();

      case "procurement":
        return renderProcurement();

      case "documents":
        return renderDocuments();

      case "ai-assistant":
        return renderAI();

      case "finance":
        return renderFinance();

      case "reports":
        return renderReports();

      case "settings":
        return renderSettings();

      case "dashboard":
      default:
        return renderDashboard();
    }
  };

  const currentModule =
    modules.find((module) => module.id === activeModule) ||
    modules[0];

  return (
    <div className="ddpro-app">
      <header className="app-header">
        <div className="brand-area">
          <div className="brand-logo">DD</div>

          <div className="brand-content">
            <strong>DOĞRU DİZAYN PRO</strong>
            <span>DDPro Dijital Yönetim Sistemi</span>
          </div>
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
            <div className="sidebar-system">
              <span className="status-dot"></span>
              DDPro Core v1.1
            </div>
          </div>
        </aside>

        <main className="main-content">
          <section className="content-header">
            <div>
              <h1>{currentModule.title}</h1>
              <p>{currentModule.description}</p>
            </div>
          </section>

          <section className="content-body">
            {renderModule()}
          </section>
        </main>
      </div>
    </div>
  );
}

export default App;
