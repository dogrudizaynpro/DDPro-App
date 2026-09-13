import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { getProjects } from "./services/projects.service.js";
import "./styles.css";
import {
  createOffer as createOfferRequest,
  deleteOffer as deleteOfferRequest,
  getOfferById,
  getOffers,
  mapOfferToViewModel,
  mapOffersToViewModel,
} from "./services/offers.service.js";
import { getResearchItems as getProcurementItems } from "./services/research.service.js";

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

  const [projects, setProjects] = useState(() =>
    getStoredData(STORAGE_KEYS.projects)
  );

  const [projectsLoading, setProjectsLoading] = useState(true);

  const [procurementItems, setProcurementItems] = useState(() =>
    getStoredData(STORAGE_KEYS.procurement)
  );
  const [procurementLoading, setProcurementLoading] = useState(true);
  const [procurementError, setProcurementError] = useState(null);

  const [offers, setOffers] = useState(() =>
    mapOffersToViewModel(getStoredData(STORAGE_KEYS.offers))
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

        offerDetailsCacheRef.current.clear();

        if (offersTouchedRef.current) {
          addLog(
            "Tekliflerde yerel değişiklik algılandı, API yanıtı üzerine yazmadı."
          );
          setOffersFetchState(apiOffers.length > 0 ? "success" : "empty");
          return;
        }

        if (apiOffers && apiOffers.length > 0) {
          setOffers(mergeOffers(apiOffers, localOffers));
          setOffersFetchState("success");
          addLog("Teklifler API üzerinden yüklendi.");
        } else {
          const localDrafts = localOfferViewModels.filter(
            (offer) => offer.source === "local"
          );

          setOffers(localDrafts);
          setOffersFetchState("empty");
          addLog(
            localDrafts.length > 0
              ? "Teklif API boş döndü, yerel taslaklar korundu."
              : "Teklif API boş döndü."
          );
        }
      } catch (error) {
        const reason = getApiFailureReason(error);
        if (!cancelled) {
          console.warn(
            "API erişilemedi, localStorage verileri kullanılıyor:",
            error.message
          );
          setOffers(localOfferViewModels);
          setSelectedOfferId((currentId) =>
            localOfferViewModels.some((offer) => offer.id === currentId)
              ? currentId
              : localOfferViewModels[0]?.id || null
          );
          setOffersFetchState("error");
          setOffersError(
            localOfferViewModels.length > 0
              ? `Teklif API’sine ulaşılamadı (${reason}). Son kaydedilen veriler gösteriliyor.`
              : `Teklif API’sine ulaşılamadı (${reason}). Lütfen tekrar deneyin.`
          );
          addLog(`Tekliflerde API bağlantı hatası: ${reason}. Yerel veriler kullanıldı.`);
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

    const cachedOfferDetail = offerDetailsCacheRef.current.get(selectedOfferId);
    if (cachedOfferDetail) {
      setSelectedOfferDetail(cachedOfferDetail);
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
          offerDetailsCacheRef.current.set(selectedOfferId, nextDetail);
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
      const localProcurementItems = getStoredData(STORAGE_KEYS.procurement);
      setProcurementLoading(true);
      setProcurementError(null);

      try {
        const apiProcurementItems = await getProcurementItems();

        if (cancelled) return;

        if (procurementTouchedRef.current) {
          addLog(
            "Tedarik kayıtlarında yerel değişiklik algılandı, API yanıtı üzerine yazmadı."
          );
        } else if (apiProcurementItems && apiProcurementItems.length > 0) {
          setProcurementItems(apiProcurementItems);
          addLog("Tedarik kayıtları API üzerinden yüklendi.");
        } else {
          setProcurementItems(localProcurementItems);
          addLog("Tedarik API boş döndü, yerel veriler kullanıldı.");
        }
      } catch (error) {
        const reason = getApiFailureReason(error);
        if (!cancelled) {
          setProcurementItems(localProcurementItems);
          setProcurementError(
            `Tedarik API erişimi başarısız (${reason}). Yerel tedarik verileri gösteriliyor.`
          );
          addLog(`Tedarik API bağlantı hatası: ${reason}. Yerel veriler kullanıldı.`);
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
      const localProjects = getStoredData(STORAGE_KEYS.projects);
      setProjectsLoading(true);

      try {
        const apiProjects = await getProjects();

        if (cancelled) return;

        if (projectsTouchedRef.current) {
          addLog(
            "Projelerde yerel değişiklik algılandı, API yanıtı üzerine yazmadı."
          );
          return;
        }

        if (apiProjects && apiProjects.length > 0) {
          setProjects(apiProjects);
          addLog("Projeler API üzerinden yüklendi.");
        } else {
          setProjects(localProjects);
          addLog("Projeler API boş döndü, yerel veriler kullanıldı.");
        }
      } catch (error) {
        const reason = getApiFailureReason(error);
        if (!cancelled) {
          setProjects(localProjects);
          addLog(`Projelerde API bağlantı hatası: ${reason}. Yerel veriler kullanıldı.`);
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
      },
      {
        label: "BEKLEYEN TEKLİFLER",
        value: pendingOffers.length,
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
    [activeProjects.length, pendingOffers.length, products.length, systemInventory.length]
  );

  const handleModuleNavigation = (moduleId) => {
    const nextRoute = moduleRouteMap[moduleId] || "/dashboard";
    if (window.location.hash !== `#${nextRoute}`) {
      window.location.hash = nextRoute;
      return;
    }

    setActiveModule(moduleId);
  };

  const createProject = (event) => {
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

    setProjects((currentProjects) => [
      newProject,
      ...currentProjects,
    ]);

    addLog(`Yeni proje oluşturuldu: ${newProject.name}`);

    setProjectName("");
    setProjectType("");
    setProjectStatus("Aktif");
    setShowProjectForm(false);
  };

  const deleteProject = (id) => {
    const project = projects.find((item) => item.id === id);
    projectsTouchedRef.current = true;

    setProjects((currentProjects) =>
      currentProjects.filter((item) => item.id !== id)
    );

    if (project) {
      addLog(`Proje silindi: ${project.name}`);
    }
  };

  const createProcurement = (event) => {
    event.preventDefault();

    if (!procurementName.trim()) return;
    procurementTouchedRef.current = true;

    const newProcurement = {
      id: createId(),
      name: procurementName.trim(),
      note: procurementNote.trim() || "Not eklenmedi.",
      date: formatDate(),
    };

    setProcurementItems((currentItems) => [
      newProcurement,
      ...currentItems,
    ]);

    addLog(`Yeni tedarik kaydı oluşturuldu: ${newProcurement.name}`);

    setProcurementName("");
    setProcurementNote("");
    setShowProcurementForm(false);
  };

  const deleteProcurement = (id) => {
    const item = procurementItems.find(
      (procurement) => procurement.id === id
    );
    procurementTouchedRef.current = true;

    setProcurementItems((currentItems) =>
      currentItems.filter((procurement) => procurement.id !== id)
    );

    if (item) {
      addLog(`Tedarik kaydı silindi: ${item.name}`);
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
      console.warn(
        "Teklif API'ye kaydedilemedi, yerel kayıt oluşturuluyor:",
        error.message
      );

      setOffers((currentOffers) => [
        newOffer,
        ...currentOffers,
      ]);
      setSelectedOfferId(newOffer.id);
      setOffersError("Teklif API'ye kaydedilemedi. Yerel kayıt oluşturuldu.");
      addLog(`Yeni teklif yerel olarak oluşturuldu: ${newOffer.title}`);
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

      if (error.status === 404) {
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
                {activeProjects.length}
              </strong>
            </div>
            <div className="quick-status">
              <span>Bekleyen Teklifler</span>
              <strong>
                {pendingOffers.length}
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
            ) : activeProjects.length === 0 ? (
              <p className="empty-state">Henüz veri bulunmuyor.</p>
            ) : (
              <div className="log-list">
                {activeProjects
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
              <strong>{projectsLoading ? "Yükleniyor" : "Hazır"}</strong>
            </div>
            <div className="quick-status">
              <span>Teklifler API</span>
              <strong>
                {offersFetchState === "success"
                  ? "Bağlı"
                  : offersFetchState === "loading"
                    ? "Yükleniyor"
                    : "Kontrol Gerekli"}
              </strong>
            </div>
            <div className="quick-status">
              <span>Tedarik Modülü</span>
              <strong>{procurementLoading ? "Yükleniyor" : "Hazır"}</strong>
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

  const skeletonModuleProps = {
    products: {
      title: "Ürünler",
      description: "Ürün yönetimi modülü backend bağlantısına hazır.",
      sections: [
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
    },
    "price-analysis": {
      title: "Fiyat Analizi",
      description: "Fiyat analizi ekranı malzeme analizinden bağımsız tutulur.",
      sections: [
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
          count: materialAnalysisItems.length,
        },
        {
          id: "material-analysis-breakdown",
          title: "Maliyet Kırılımı",
          description: "Birim ve toplam maliyet kırılım alanı.",
          count: 0,
        },
      ],
    },
    crm: {
      title: "Müşteriler / CRM",
      description: "CRM modülü müşteri yönetimi için API entegrasyonuna hazırdır.",
      sections: [
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
    },
    documents: {
      title: "Belgeler",
      description: "Belge yönetimi modülü dijital arşiv bağlantıları için hazırlanmıştır.",
      sections: [
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
    },
    finance: {
      title: "Finans / Maliyet",
      description: "Finansal takip ve maliyet yönetimi için temel ekran iskeleti.",
      sections: [
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
    },
    reports: {
      title: "Raporlar",
      description: "Yönetim raporları ve analiz çıktıları için iskelet yapı.",
      sections: [
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
          count: integrations.length,
        },
      ],
    },
  };

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
        />
      );
    }

    if (activeModule === "offers") {
      return (
        <OffersModule
          offersFetchState={offersFetchState}
          offersLoading={offersLoading}
          setOffersReloadKey={setOffersReloadKey}
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
    <div className="ddpro-app">
      <header className="app-header">
        <div className="brand-area">
          <div className="brand-logo">DD</div>

          <div className="brand-content">
            <strong>DOĞRU DİZAYN PRO</strong>
            <span>DDPro Dijital Yönetim Sistemi</span>
          </div>
        </div>

        <div className="header-status">
          <span className="status-dot"></span>
          Sistem Aktif
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
            <Suspense fallback={<p className="module-loading">Modül yükleniyor...</p>}>{renderModule()}</Suspense>
          </section>
        </main>
      </div>
    </div>
  );
}

export default App;
