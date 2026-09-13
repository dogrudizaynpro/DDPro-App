import { useEffect, useMemo, useRef, useState } from "react";
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
import { getResearchItems } from "./services/research.service.js";

const STORAGE_KEYS = {
  projects: "ddpro_projects_v1",
  research: "ddpro_research_v1",
  offers: "ddpro_offers_v1",
  memory: "ddpro_memory_v1",
  logs: "ddpro_system_logs_v1",
  integrations: "ddpro_integrations_v1",
  products: "ddpro_products_v1",
  priceAnalysis: "ddpro_price_analysis_v1",
  materialAnalysis: "ddpro_material_analysis_v1",
  crm: "ddpro_crm_v1",
};

const modules = [
  {
    id: "dashboard",
    icon: "◉",
    title: "Genel Bakış",
    short: "Sistem Merkezi",
    description:
      "Tüm DDPro operasyonlarını, modüllerini ve üretim akışlarını tek merkezden takip et.",
  },
  {
    id: "products",
    icon: "◫",
    title: "Ürünler",
    short: "Ürün Yönetimi",
    description:
      "Ürün kayıtlarını oluştur, düzenle ve tedarik akışına hazır yerel taslaklar olarak yönet.",
  },
  {
    id: "systems",
    icon: "⚙",
    title: "Sistemler",
    short: "Altyapı Merkezi",
    description:
      "DDPro altyapısı, entegrasyonlar, hafıza ve operasyon kayıtlarını merkezi olarak yönet.",
  },
  {
    id: "price-analysis",
    icon: "₺",
    title: "Fiyat Analizi",
    short: "Maliyet Analizi",
    description:
      "Fiyat karşılaştırmalarını ayrı bir modülde tut, teklif öncesi maliyet taslaklarını yönet.",
  },
  {
    id: "material-analysis",
    icon: "▤",
    title: "Malzeme Analizi",
    short: "Malzeme İnceleme",
    description:
      "Malzeme özelliklerini, kullanım notlarını ve ihtiyaç analizlerini fiyat analizinden bağımsız tut.",
  },
  {
    id: "offers",
    icon: "€",
    title: "Teklif Merkezi",
    short: "Teklif Sistemi",
    description:
      "Tekliflerini oluştur, kayıt altına al, takip et ve proje süreçleriyle ilişkilendir.",
  },
  {
    id: "projects",
    icon: "▣",
    title: "Projeler",
    short: "Proje Yönetimi",
    description:
      "Aktif projelerini oluştur, yönet, düzenle ve tüm süreçlerini merkezi olarak takip et.",
  },
  {
    id: "crm",
    icon: "☏",
    title: "CRM",
    short: "Müşteri Yönetimi",
    description:
      "Müşteri kayıtlarını, temas notlarını ve satış aşamalarını yerel taslak akışıyla izle.",
  },
  {
    id: "research",
    icon: "⌕",
    title: "Tedarik & Araştırma",
    short: "Araştırma Merkezi",
    description:
      "Ürün, tedarikçi ve genel araştırma notlarını merkezi araştırma havuzunda topla.",
  },
  {
    id: "ai",
    icon: "✦",
    title: "DDPro AI",
    short: "Yapay Zeka Sistemi",
    description:
      "Araştırma, analiz ve operasyon süreçlerinde yapay zeka destekli merkezi çalışma alanı.",
  },
];

const systemModules = [
  {
    id: "product-system",
    title: "Ürün Sistemi",
    description:
      "Ürün taslaklarının eklenmesi, düzenlenmesi ve teklif akışına hazırlanması.",
  },
  {
    id: "price-system",
    title: "Fiyat Analizi Sistemi",
    description:
      "Birim fiyat, adet ve toplam maliyet analizlerinin bağımsız modülde saklanması.",
  },
  {
    id: "material-system",
    title: "Malzeme Analizi Sistemi",
    description:
      "Malzeme özelliklerinin ve kullanım notlarının fiyat analizinden ayrı tutulması.",
  },
  {
    id: "project-system",
    title: "Proje Sistemi",
    description:
      "Projelerin oluşturulması, merkezi takibi ve operasyon kayıtlarının yönetimi.",
  },
  {
    id: "offer-system",
    title: "Teklif Sistemi",
    description:
      "Teklif oluşturma, kayıt, takip ve proje süreçleriyle ilişkilendirme altyapısı.",
  },
  {
    id: "crm-system",
    title: "CRM Sistemi",
    description:
      "Müşteri temasları, satış aşamaları ve ilişki notlarının kalıcı taslak takibi.",
  },
];

const OFFER_STATUS_TONES = {
  Hazırlanıyor: "pending",
  Gönderildi: "info",
  Onaylandı: "success",
  Reddedildi: "danger",
};

const PRODUCT_STATUS_OPTIONS = ["Taslak", "Aktif", "Arşiv"];
const CRM_STAGE_OPTIONS = [
  "Yeni Lead",
  "İletişimde",
  "Teklif Hazırlanıyor",
  "Takipte",
  "Kazanıldı",
  "Kaybedildi",
];

const EMPTY_PRODUCT_FORM = {
  name: "",
  category: "",
  supplier: "",
  status: "Taslak",
  note: "",
};

const EMPTY_PRICE_FORM = {
  title: "",
  productName: "",
  supplier: "",
  unitPrice: "",
  quantity: "",
  note: "",
};

const EMPTY_MATERIAL_FORM = {
  title: "",
  materialName: "",
  specification: "",
  quantity: "",
  unit: "",
  usageArea: "",
  note: "",
};

const EMPTY_CRM_FORM = {
  customerName: "",
  companyName: "",
  contact: "",
  stage: "Yeni Lead",
  note: "",
};

const DEFAULT_MODULE_ID = "dashboard";
const MODULE_IDS = new Set(modules.map((module) => module.id));

const getOfferStatusTone = (status) => OFFER_STATUS_TONES[status] || "neutral";

const mergeOffers = (apiOffers, storedOffers) => {
  const storedViewModels = mapOffersToViewModel(storedOffers);
  const apiIds = new Set(apiOffers.map((offer) => offer.id));
  const localOnlyOffers = storedViewModels.filter(
    (offer) => offer.source === "local" && !apiIds.has(offer.id)
  );

  return [...apiOffers, ...localOnlyOffers];
};

const getStoredData = (key, fallback = []) => {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

const createId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

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

const getModuleFromHash = (hash = "") => {
  const normalizedHash = String(hash)
    .trim()
    .replace(/^#\/?/, "")
    .replace(/^\/+|\/+$/g, "");
  const [moduleId] = normalizedHash.split("/");

  return MODULE_IDS.has(moduleId) ? moduleId : DEFAULT_MODULE_ID;
};

const hasValidModuleHash = (hash = "") => {
  const normalizedHash = String(hash)
    .trim()
    .replace(/^#\/?/, "")
    .replace(/^\/+|\/+$/g, "");
  const [moduleId] = normalizedHash.split("/");

  return MODULE_IDS.has(moduleId);
};

const parseDecimalInput = (value) => {
  const normalized = String(value || "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(/,/g, ".");

  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : null;
};

const formatCurrency = (value) => {
  if (!Number.isFinite(value)) {
    return "Tutar belirtilmedi";
  }

  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 2,
  }).format(value);
};

function App() {
  const [activeModule, setActiveModule] = useState(() => {
    if (typeof window === "undefined") {
      return DEFAULT_MODULE_ID;
    }

    return getModuleFromHash(window.location.hash);
  });

  const [projects, setProjects] = useState(() => getStoredData(STORAGE_KEYS.projects));
  const [projectsLoading, setProjectsLoading] = useState(true);

  const [researchItems, setResearchItems] = useState(() => getStoredData(STORAGE_KEYS.research));
  const [researchLoading, setResearchLoading] = useState(true);
  const [researchError, setResearchError] = useState(null);

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

  const [products, setProducts] = useState(() => getStoredData(STORAGE_KEYS.products));
  const [priceAnalyses, setPriceAnalyses] = useState(() =>
    getStoredData(STORAGE_KEYS.priceAnalysis)
  );
  const [materialAnalyses, setMaterialAnalyses] = useState(() =>
    getStoredData(STORAGE_KEYS.materialAnalysis)
  );
  const [crmRecords, setCrmRecords] = useState(() => getStoredData(STORAGE_KEYS.crm));

  const projectsTouchedRef = useRef(false);
  const researchTouchedRef = useRef(false);
  const offersTouchedRef = useRef(false);

  const [memoryItems, setMemoryItems] = useState(() => getStoredData(STORAGE_KEYS.memory));
  const [systemLogs, setSystemLogs] = useState(() => getStoredData(STORAGE_KEYS.logs));
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
      {
        id: "github-pages",
        name: "GitHub Pages",
        status: "Aktif",
        description: "Production arayüz yayını ve hash tabanlı modül erişimi.",
      },
    ])
  );

  const [showProjectForm, setShowProjectForm] = useState(false);
  const [showResearchForm, setShowResearchForm] = useState(false);
  const [showOfferForm, setShowOfferForm] = useState(false);
  const [showMemoryForm, setShowMemoryForm] = useState(false);
  const [showProductForm, setShowProductForm] = useState(false);
  const [showPriceForm, setShowPriceForm] = useState(false);
  const [showMaterialForm, setShowMaterialForm] = useState(false);
  const [showCrmForm, setShowCrmForm] = useState(false);

  const [editingProductId, setEditingProductId] = useState(null);
  const [editingPriceId, setEditingPriceId] = useState(null);
  const [editingMaterialId, setEditingMaterialId] = useState(null);
  const [editingCrmId, setEditingCrmId] = useState(null);

  const [projectName, setProjectName] = useState("");
  const [projectType, setProjectType] = useState("");
  const [projectStatus, setProjectStatus] = useState("Aktif");

  const [researchName, setResearchName] = useState("");
  const [researchNote, setResearchNote] = useState("");

  const [offerName, setOfferName] = useState("");
  const [offerAmount, setOfferAmount] = useState("");
  const [offerStatus, setOfferStatus] = useState("Hazırlanıyor");

  const [memoryTitle, setMemoryTitle] = useState("");
  const [memoryContent, setMemoryContent] = useState("");

  const [productForm, setProductForm] = useState(EMPTY_PRODUCT_FORM);
  const [priceForm, setPriceForm] = useState(EMPTY_PRICE_FORM);
  const [materialForm, setMaterialForm] = useState(EMPTY_MATERIAL_FORM);
  const [crmForm, setCrmForm] = useState(EMPTY_CRM_FORM);

  const [aiInput, setAiInput] = useState("");
  const [aiMessages, setAiMessages] = useState([
    {
      id: "welcome",
      role: "assistant",
      text:
        "DDPro AI çalışma alanı hazır. Proje, teklif, ürün veya analiz süreçleriyle ilgili bir çalışma başlatabilirsin.",
      date: formatDate(),
    },
  ]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const syncModuleFromHash = () => {
      const nextModule = getModuleFromHash(window.location.hash);
      const nextHash = `#/${nextModule}`;

      if (!hasValidModuleHash(window.location.hash)) {
        window.history.replaceState(
          null,
          "",
          `${window.location.pathname}${window.location.search}${nextHash}`
        );
      }

      setActiveModule(nextModule);
    };

    syncModuleFromHash();
    window.addEventListener("hashchange", syncModuleFromHash);

    return () => {
      window.removeEventListener("hashchange", syncModuleFromHash);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.projects, JSON.stringify(projects));
  }, [projects]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.research, JSON.stringify(researchItems));
  }, [researchItems]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.offers, JSON.stringify(offers));
  }, [offers]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.memory, JSON.stringify(memoryItems));
  }, [memoryItems]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.logs, JSON.stringify(systemLogs));
  }, [systemLogs]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.integrations, JSON.stringify(integrations));
  }, [integrations]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.products, JSON.stringify(products));
  }, [products]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.priceAnalysis, JSON.stringify(priceAnalyses));
  }, [priceAnalyses]);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEYS.materialAnalysis,
      JSON.stringify(materialAnalyses)
    );
  }, [materialAnalyses]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.crm, JSON.stringify(crmRecords));
  }, [crmRecords]);

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

    const fetchResearchFromApi = async () => {
      const localResearchItems = getStoredData(STORAGE_KEYS.research);
      setResearchLoading(true);
      setResearchError(null);

      try {
        const apiResearchItems = await getResearchItems();

        if (cancelled) return;

        if (researchTouchedRef.current) {
          addLog(
            "Araştırmalarda yerel değişiklik algılandı, API yanıtı üzerine yazmadı."
          );
          return;
        }

        if (apiResearchItems && apiResearchItems.length > 0) {
          setResearchItems(apiResearchItems);
          addLog("Araştırmalar API üzerinden yüklendi.");
        } else {
          setResearchItems(localResearchItems);
          addLog("Araştırmalar API boş döndü, yerel veriler kullanıldı.");
        }
      } catch (error) {
        const reason = getApiFailureReason(error);
        if (!cancelled) {
          setResearchItems(localResearchItems);
          setResearchError(
            `Araştırma API erişimi başarısız (${reason}). Yerel araştırma verileri gösteriliyor.`
          );
          addLog(`Araştırmalar API bağlantı hatası: ${reason}. Yerel veriler kullanıldı.`);
        }
      } finally {
        if (!cancelled) {
          setResearchLoading(false);
        }
      }
    };

    fetchResearchFromApi();

    return () => {
      cancelled = true;
    };
  }, []);

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

    setSystemLogs((currentLogs) => [newLog, ...currentLogs].slice(0, 50));
  };

  const dashboardStats = useMemo(
    () => [
      {
        label: "AKTİF PROJELER",
        value: projects.filter((project) => project.status === "Aktif").length,
      },
      {
        label: "ÜRÜN TASLAKLARI",
        value: products.length,
      },
      {
        label: "FİYAT ANALİZİ",
        value: priceAnalyses.length,
      },
      {
        label: "MALZEME ANALİZİ",
        value: materialAnalyses.length,
      },
      {
        label: "TEKLİFLER",
        value: offers.length,
      },
      {
        label: "CRM KAYITLARI",
        value: crmRecords.length,
      },
    ],
    [projects, products, priceAnalyses, materialAnalyses, offers, crmRecords]
  );

  const priceAnalysisTotal = useMemo(
    () =>
      priceAnalyses.reduce(
        (total, item) => total + (Number.isFinite(item.totalAmount) ? item.totalAmount : 0),
        0
      ),
    [priceAnalyses]
  );

  const moduleReadiness = useMemo(
    () =>
      modules.map((module) => ({
        ...module,
        route: `#/${module.id}`,
        status: "Hazır",
      })),
    []
  );

  const openModule = (moduleId) => {
    if (typeof window === "undefined") {
      setActiveModule(moduleId);
      return;
    }

    if (typeof window !== "undefined") {
      const nextHash = `#/${moduleId}`;

      if (window.location.hash !== nextHash) {
        window.location.hash = nextHash;
      }
    }
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
      source: "local",
    };

    setProjects((currentProjects) => [newProject, ...currentProjects]);
    addLog(`Yeni proje oluşturuldu: ${newProject.name}`);

    setProjectName("");
    setProjectType("");
    setProjectStatus("Aktif");
    setShowProjectForm(false);
  };

  const deleteProject = (id) => {
    const project = projects.find((item) => item.id === id);
    projectsTouchedRef.current = true;

    setProjects((currentProjects) => currentProjects.filter((item) => item.id !== id));

    if (project) {
      addLog(`Proje silindi: ${project.name}`);
    }
  };

  const createResearch = (event) => {
    event.preventDefault();

    if (!researchName.trim()) return;
    researchTouchedRef.current = true;

    const newResearch = {
      id: createId(),
      name: researchName.trim(),
      note: researchNote.trim() || "Not eklenmedi.",
      date: formatDate(),
      source: "local",
    };

    setResearchItems((currentItems) => [newResearch, ...currentItems]);
    addLog(`Yeni araştırma kaydı oluşturuldu: ${newResearch.name}`);

    setResearchName("");
    setResearchNote("");
    setShowResearchForm(false);
  };

  const deleteResearch = (id) => {
    const item = researchItems.find((research) => research.id === id);
    researchTouchedRef.current = true;

    setResearchItems((currentItems) =>
      currentItems.filter((research) => research.id !== id)
    );

    if (item) {
      addLog(`Araştırma kaydı silindi: ${item.name}`);
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

      setOffers((currentOffers) => [nextOffer, ...currentOffers]);
      setSelectedOfferId(nextOffer.id);
      addLog(`Yeni teklif API üzerinden oluşturuldu: ${newOffer.title}`);
    } catch (error) {
      console.warn(
        "Teklif API'ye kaydedilemedi, yerel kayıt oluşturuluyor:",
        error.message
      );

      setOffers((currentOffers) => [newOffer, ...currentOffers]);
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
      setOffers((currentOffers) => currentOffers.filter((item) => item.id !== id));
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
      setOffers((currentOffers) => currentOffers.filter((item) => item.id !== id));
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
        setOffers((currentOffers) => currentOffers.filter((item) => item.id !== id));
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

    setMemoryItems((currentItems) => [newMemory, ...currentItems]);
    addLog(`Merkezi hafızaya kayıt eklendi: ${newMemory.title}`);

    setMemoryTitle("");
    setMemoryContent("");
    setShowMemoryForm(false);
  };

  const deleteMemory = (id) => {
    const memory = memoryItems.find((item) => item.id === id);

    setMemoryItems((currentItems) => currentItems.filter((item) => item.id !== id));

    if (memory) {
      addLog(`Hafıza kaydı silindi: ${memory.title}`);
    }
  };

  const toggleIntegration = (id) => {
    const integration = integrations.find((item) => item.id === id);

    if (!integration) return;

    const nextStatus = integration.status === "Aktif" ? "Pasif" : "Aktif";

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

    addLog(`${integration.name} entegrasyon durumu değiştirildi: ${nextStatus}`);
  };

  const resetProductForm = () => {
    setProductForm(EMPTY_PRODUCT_FORM);
    setEditingProductId(null);
    setShowProductForm(false);
  };

  const startProductEdit = (product) => {
    setProductForm({
      name: product.name || "",
      category: product.category || "",
      supplier: product.supplier || "",
      status: product.status || "Taslak",
      note: product.note || "",
    });
    setEditingProductId(product.id);
    setShowProductForm(true);
  };

  const saveProduct = (event) => {
    event.preventDefault();

    if (!productForm.name.trim()) return;
    const existingProduct = editingProductId
      ? products.find((item) => item.id === editingProductId)
      : null;

    const nextProduct = {
      id: editingProductId || createId(),
      name: productForm.name.trim(),
      category: productForm.category.trim() || "Genel Ürün",
      supplier: productForm.supplier.trim() || "Tedarikçi belirtilmedi",
      status: productForm.status,
      note: productForm.note.trim() || "Not eklenmedi.",
      date: existingProduct?.date || formatDate(),
      updatedAt: editingProductId ? formatDate() : existingProduct?.updatedAt || null,
      source: "local",
    };

    setProducts((currentItems) =>
      editingProductId
        ? currentItems.map((item) => (item.id === editingProductId ? nextProduct : item))
        : [nextProduct, ...currentItems]
    );

    addLog(
      `${editingProductId ? "Ürün güncellendi" : "Yeni ürün taslağı oluşturuldu"}: ${nextProduct.name}`
    );
    resetProductForm();
  };

  const deleteProduct = (id) => {
    const product = products.find((item) => item.id === id);
    setProducts((currentItems) => currentItems.filter((item) => item.id !== id));

    if (editingProductId === id) {
      resetProductForm();
    }

    if (product) {
      addLog(`Ürün taslağı silindi: ${product.name}`);
    }
  };

  const resetPriceForm = () => {
    setPriceForm(EMPTY_PRICE_FORM);
    setEditingPriceId(null);
    setShowPriceForm(false);
  };

  const startPriceEdit = (item) => {
    setPriceForm({
      title: item.title || "",
      productName: item.productName || "",
      supplier: item.supplier || "",
      unitPrice: item.unitPriceInput || item.unitPrice?.toString() || "",
      quantity: item.quantityInput || item.quantity?.toString() || "",
      note: item.note || "",
    });
    setEditingPriceId(item.id);
    setShowPriceForm(true);
  };

  const savePriceAnalysis = (event) => {
    event.preventDefault();

    if (!priceForm.title.trim()) return;
    const existingItem = editingPriceId
      ? priceAnalyses.find((item) => item.id === editingPriceId)
      : null;

    const unitPrice = parseDecimalInput(priceForm.unitPrice);
    const quantity = parseDecimalInput(priceForm.quantity);
    const totalAmount =
      Number.isFinite(unitPrice) && Number.isFinite(quantity) ? unitPrice * quantity : null;

    const nextItem = {
      id: editingPriceId || createId(),
      title: priceForm.title.trim(),
      productName: priceForm.productName.trim() || "Ürün belirtilmedi",
      supplier: priceForm.supplier.trim() || "Tedarikçi belirtilmedi",
      unitPrice,
      unitPriceInput: priceForm.unitPrice.trim(),
      quantity,
      quantityInput: priceForm.quantity.trim(),
      totalAmount,
      note: priceForm.note.trim() || "Not eklenmedi.",
      date: existingItem?.date || formatDate(),
      updatedAt: editingPriceId ? formatDate() : existingItem?.updatedAt || null,
      source: "local",
    };

    setPriceAnalyses((currentItems) =>
      editingPriceId
        ? currentItems.map((item) => (item.id === editingPriceId ? nextItem : item))
        : [nextItem, ...currentItems]
    );

    addLog(
      `${editingPriceId ? "Fiyat analizi güncellendi" : "Fiyat analizi oluşturuldu"}: ${nextItem.title}`
    );
    resetPriceForm();
  };

  const deletePriceAnalysis = (id) => {
    const item = priceAnalyses.find((entry) => entry.id === id);
    setPriceAnalyses((currentItems) => currentItems.filter((entry) => entry.id !== id));

    if (editingPriceId === id) {
      resetPriceForm();
    }

    if (item) {
      addLog(`Fiyat analizi silindi: ${item.title}`);
    }
  };

  const resetMaterialForm = () => {
    setMaterialForm(EMPTY_MATERIAL_FORM);
    setEditingMaterialId(null);
    setShowMaterialForm(false);
  };

  const startMaterialEdit = (item) => {
    setMaterialForm({
      title: item.title || "",
      materialName: item.materialName || "",
      specification: item.specification || "",
      quantity: item.quantity ?? "",
      unit: item.unit ?? "",
      usageArea: item.usageArea ?? "",
      note: item.note ?? "",
    });
    setEditingMaterialId(item.id);
    setShowMaterialForm(true);
  };

  const saveMaterialAnalysis = (event) => {
    event.preventDefault();

    if (!materialForm.title.trim()) return;
    const existingItem = editingMaterialId
      ? materialAnalyses.find((item) => item.id === editingMaterialId)
      : null;

    const nextItem = {
      id: editingMaterialId || createId(),
      title: materialForm.title.trim(),
      materialName: materialForm.materialName.trim() || "Malzeme belirtilmedi",
      specification: materialForm.specification.trim() || "Özellik belirtilmedi",
      quantity: materialForm.quantity.trim() || "Miktar belirtilmedi",
      unit: materialForm.unit.trim() || "Birim belirtilmedi",
      usageArea: materialForm.usageArea.trim() || "Kullanım alanı belirtilmedi",
      note: materialForm.note.trim() || "Not eklenmedi.",
      date: existingItem?.date || formatDate(),
      updatedAt:
        editingMaterialId ? formatDate() : existingItem?.updatedAt || null,
      source: "local",
    };

    setMaterialAnalyses((currentItems) =>
      editingMaterialId
        ? currentItems.map((item) => (item.id === editingMaterialId ? nextItem : item))
        : [nextItem, ...currentItems]
    );

    addLog(
      `${editingMaterialId ? "Malzeme analizi güncellendi" : "Malzeme analizi oluşturuldu"}: ${nextItem.title}`
    );
    resetMaterialForm();
  };

  const deleteMaterialAnalysis = (id) => {
    const item = materialAnalyses.find((entry) => entry.id === id);
    setMaterialAnalyses((currentItems) => currentItems.filter((entry) => entry.id !== id));

    if (editingMaterialId === id) {
      resetMaterialForm();
    }

    if (item) {
      addLog(`Malzeme analizi silindi: ${item.title}`);
    }
  };

  const resetCrmForm = () => {
    setCrmForm(EMPTY_CRM_FORM);
    setEditingCrmId(null);
    setShowCrmForm(false);
  };

  const startCrmEdit = (item) => {
    setCrmForm({
      customerName: item.customerName || "",
      companyName: item.companyName || "",
      contact: item.contact || "",
      stage: item.stage || "Yeni Lead",
      note: item.note || "",
    });
    setEditingCrmId(item.id);
    setShowCrmForm(true);
  };

  const saveCrmRecord = (event) => {
    event.preventDefault();

    if (!crmForm.customerName.trim()) return;
    const existingItem = editingCrmId
      ? crmRecords.find((item) => item.id === editingCrmId)
      : null;

    const nextItem = {
      id: editingCrmId || createId(),
      customerName: crmForm.customerName.trim(),
      companyName: crmForm.companyName.trim() || "Firma belirtilmedi",
      contact: crmForm.contact.trim() || "İletişim bilgisi belirtilmedi",
      stage: crmForm.stage,
      note: crmForm.note.trim() || "Not eklenmedi.",
      date: existingItem?.date || formatDate(),
      updatedAt: editingCrmId ? formatDate() : existingItem?.updatedAt || null,
      source: "local",
    };

    setCrmRecords((currentItems) =>
      editingCrmId
        ? currentItems.map((item) => (item.id === editingCrmId ? nextItem : item))
        : [nextItem, ...currentItems]
    );

    addLog(
      `${editingCrmId ? "CRM kaydı güncellendi" : "Yeni CRM kaydı oluşturuldu"}: ${nextItem.customerName}`
    );
    resetCrmForm();
  };

  const deleteCrmRecord = (id) => {
    const item = crmRecords.find((entry) => entry.id === id);
    setCrmRecords((currentItems) => currentItems.filter((entry) => entry.id !== id));

    if (editingCrmId === id) {
      resetCrmForm();
    }

    if (item) {
      addLog(`CRM kaydı silindi: ${item.customerName}`);
    }
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
        "Üretim arayüzünde modül ve analiz akışları bu kayıt üzerinden takip edilebilir.",
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
            <h2>Son Sistem Hareketleri</h2>
          </div>

          <div className="panel-content">
            {systemLogs.length === 0 ? (
              <p className="empty-state">Henüz sistem kaydı bulunmuyor.</p>
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

        <div className="panel">
          <div className="panel-header">
            <h2>Üretim Modül Durumu</h2>
          </div>

          <div className="panel-content">
            {moduleReadiness.map((module) => (
              <div className="quick-status" key={module.id}>
                <span>
                  {module.title} <small className="route-label">{module.route}</small>
                </span>
                <strong>{module.status}</strong>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderProducts = () => (
    <div className="module-page">
      <div className="module-toolbar">
        <button
          type="button"
          onClick={() => {
            if (showProductForm && !editingProductId) {
              setShowProductForm(false);
              return;
            }

            setEditingProductId(null);
            setProductForm(EMPTY_PRODUCT_FORM);
            setShowProductForm((value) => !value || Boolean(editingProductId));
          }}
        >
          {showProductForm ? "Formu Kapat" : "+ Yeni Ürün"}
        </button>
      </div>

      <p className="status-banner info">
        ℹ Ürün ekleme ve düzenleme akışı production arayüzünde yerel taslak olarak korunur.
      </p>

      {showProductForm && (
        <form className="data-form" onSubmit={saveProduct}>
          <input
            type="text"
            placeholder="Ürün adı"
            value={productForm.name}
            onChange={(event) =>
              setProductForm((current) => ({ ...current, name: event.target.value }))
            }
          />

          <input
            type="text"
            placeholder="Kategori"
            value={productForm.category}
            onChange={(event) =>
              setProductForm((current) => ({ ...current, category: event.target.value }))
            }
          />

          <input
            type="text"
            placeholder="Tedarikçi"
            value={productForm.supplier}
            onChange={(event) =>
              setProductForm((current) => ({ ...current, supplier: event.target.value }))
            }
          />

          <select
            value={productForm.status}
            onChange={(event) =>
              setProductForm((current) => ({ ...current, status: event.target.value }))
            }
          >
            {PRODUCT_STATUS_OPTIONS.map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>

          <textarea
            placeholder="Ürün notu"
            value={productForm.note}
            onChange={(event) =>
              setProductForm((current) => ({ ...current, note: event.target.value }))
            }
          />

          <div className="form-actions-row">
            <button type="submit">
              {editingProductId ? "Ürünü Güncelle" : "Ürünü Kaydet"}
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={resetProductForm}
            >
              İptal
            </button>
          </div>
        </form>
      )}

      <div className="data-list">
        {products.length === 0 ? (
          <p className="empty-state">Henüz ürün taslağı bulunmuyor.</p>
        ) : (
          products.map((product) => (
            <div className="data-card" key={product.id}>
              <div>
                <h3>{product.name}</h3>
                <p>
                  {product.category} · {product.supplier}
                </p>
                <p>{product.note}</p>
                <small>
                  {product.status} · Oluşturma: {product.date}
                  {product.updatedAt ? ` · Güncelleme: ${product.updatedAt}` : ""}
                </small>
              </div>

              <div className="data-card-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => startProductEdit(product)}
                >
                  Düzenle
                </button>
                <button type="button" onClick={() => deleteProduct(product.id)}>
                  Sil
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  const renderProjects = () => (
    <div className="module-page">
      <div className="module-toolbar">
        <button type="button" onClick={() => setShowProjectForm((value) => !value)}>
          {showProjectForm ? "Formu Kapat" : "+ Yeni Proje"}
        </button>
      </div>

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
          <p className="empty-state">Henüz proje kaydı bulunmuyor.</p>
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

              <button type="button" onClick={() => deleteProject(project.id)}>
                Sil
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );

  const renderPriceAnalysis = () => (
    <div className="module-page">
      <div className="module-toolbar">
        <button
          type="button"
          onClick={() => {
            if (showPriceForm && !editingPriceId) {
              setShowPriceForm(false);
              return;
            }

            setEditingPriceId(null);
            setPriceForm(EMPTY_PRICE_FORM);
            setShowPriceForm((value) => !value || Boolean(editingPriceId));
          }}
        >
          {showPriceForm ? "Formu Kapat" : "+ Yeni Fiyat Analizi"}
        </button>
      </div>

      <p className="status-banner info">
        ℹ Fiyat Analizi modülü Malzeme Analizi modülünden bağımsızdır ve toplam maliyet taslaklarını ayrı saklar.
      </p>

      <div className="offers-summary-grid compact-grid">
        <div className="offer-summary-card">
          <span>Toplam Analiz</span>
          <strong>{priceAnalyses.length}</strong>
        </div>
        <div className="offer-summary-card">
          <span>Toplam Tahmini Maliyet</span>
          <strong>{formatCurrency(priceAnalysisTotal)}</strong>
        </div>
      </div>

      {showPriceForm && (
        <form className="data-form" onSubmit={savePriceAnalysis}>
          <input
            type="text"
            placeholder="Analiz başlığı"
            value={priceForm.title}
            onChange={(event) =>
              setPriceForm((current) => ({ ...current, title: event.target.value }))
            }
          />

          <input
            type="text"
            placeholder="Ürün adı"
            value={priceForm.productName}
            onChange={(event) =>
              setPriceForm((current) => ({ ...current, productName: event.target.value }))
            }
          />

          <input
            type="text"
            placeholder="Tedarikçi"
            value={priceForm.supplier}
            onChange={(event) =>
              setPriceForm((current) => ({ ...current, supplier: event.target.value }))
            }
          />

          <input
            type="text"
            placeholder="Birim fiyat (₺)"
            value={priceForm.unitPrice}
            onChange={(event) =>
              setPriceForm((current) => ({ ...current, unitPrice: event.target.value }))
            }
          />

          <input
            type="text"
            placeholder="Adet"
            value={priceForm.quantity}
            onChange={(event) =>
              setPriceForm((current) => ({ ...current, quantity: event.target.value }))
            }
          />

          <textarea
            placeholder="Fiyat analizi notu"
            value={priceForm.note}
            onChange={(event) =>
              setPriceForm((current) => ({ ...current, note: event.target.value }))
            }
          />

          <div className="form-actions-row">
            <button type="submit">
              {editingPriceId ? "Analizi Güncelle" : "Analizi Kaydet"}
            </button>
            <button type="button" className="secondary-button" onClick={resetPriceForm}>
              İptal
            </button>
          </div>
        </form>
      )}

      <div className="data-list">
        {priceAnalyses.length === 0 ? (
          <p className="empty-state">Henüz fiyat analizi bulunmuyor.</p>
        ) : (
          priceAnalyses.map((item) => (
            <div className="data-card" key={item.id}>
              <div>
                <h3>{item.title}</h3>
                <p>
                  {item.productName} · {item.supplier}
                </p>
                <p>
                  Birim: {item.unitPrice !== null ? formatCurrency(item.unitPrice) : "Belirtilmedi"} · Adet: {item.quantityInput || "Belirtilmedi"}
                </p>
                <p>{item.note}</p>
                <small>
                  Toplam: {item.totalAmount !== null ? formatCurrency(item.totalAmount) : "Hesaplanamadı"} · Oluşturma: {item.date}
                  {item.updatedAt ? ` · Güncelleme: ${item.updatedAt}` : ""}
                </small>
              </div>

              <div className="data-card-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => startPriceEdit(item)}
                >
                  Düzenle
                </button>
                <button type="button" onClick={() => deletePriceAnalysis(item.id)}>
                  Sil
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  const renderMaterialAnalysis = () => (
    <div className="module-page">
      <div className="module-toolbar">
        <button
          type="button"
          onClick={() => {
            if (showMaterialForm && !editingMaterialId) {
              setShowMaterialForm(false);
              return;
            }

            setEditingMaterialId(null);
            setMaterialForm(EMPTY_MATERIAL_FORM);
            setShowMaterialForm((value) => !value || Boolean(editingMaterialId));
          }}
        >
          {showMaterialForm ? "Formu Kapat" : "+ Yeni Malzeme Analizi"}
        </button>
      </div>

      <p className="status-banner info">
        ℹ Malzeme Analizi modülü yalnızca malzeme özellikleri ve kullanım alanlarını yönetir; fiyat hesapları burada tutulmaz.
      </p>

      {showMaterialForm && (
        <form className="data-form" onSubmit={saveMaterialAnalysis}>
          <input
            type="text"
            placeholder="Analiz başlığı"
            value={materialForm.title}
            onChange={(event) =>
              setMaterialForm((current) => ({ ...current, title: event.target.value }))
            }
          />

          <input
            type="text"
            placeholder="Malzeme adı"
            value={materialForm.materialName}
            onChange={(event) =>
              setMaterialForm((current) => ({ ...current, materialName: event.target.value }))
            }
          />

          <input
            type="text"
            placeholder="Teknik özellik"
            value={materialForm.specification}
            onChange={(event) =>
              setMaterialForm((current) => ({ ...current, specification: event.target.value }))
            }
          />

          <input
            type="text"
            placeholder="Miktar"
            value={materialForm.quantity}
            onChange={(event) =>
              setMaterialForm((current) => ({ ...current, quantity: event.target.value }))
            }
          />

          <input
            type="text"
            placeholder="Birim"
            value={materialForm.unit}
            onChange={(event) =>
              setMaterialForm((current) => ({ ...current, unit: event.target.value }))
            }
          />

          <input
            type="text"
            placeholder="Kullanım alanı"
            value={materialForm.usageArea}
            onChange={(event) =>
              setMaterialForm((current) => ({ ...current, usageArea: event.target.value }))
            }
          />

          <textarea
            placeholder="Malzeme analizi notu"
            value={materialForm.note}
            onChange={(event) =>
              setMaterialForm((current) => ({ ...current, note: event.target.value }))
            }
          />

          <div className="form-actions-row">
            <button type="submit">
              {editingMaterialId ? "Analizi Güncelle" : "Analizi Kaydet"}
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={resetMaterialForm}
            >
              İptal
            </button>
          </div>
        </form>
      )}

      <div className="data-list">
        {materialAnalyses.length === 0 ? (
          <p className="empty-state">Henüz malzeme analizi bulunmuyor.</p>
        ) : (
          materialAnalyses.map((item) => (
            <div className="data-card" key={item.id}>
              <div>
                <h3>{item.title}</h3>
                <p>
                  {item.materialName} · {item.specification}
                </p>
                <p>
                  Kullanım: {item.usageArea} · Miktar: {item.quantity} {item.unit}
                </p>
                <p>{item.note}</p>
                <small>
                  Oluşturma: {item.date}
                  {item.updatedAt ? ` · Güncelleme: ${item.updatedAt}` : ""}
                </small>
              </div>

              <div className="data-card-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => startMaterialEdit(item)}
                >
                  Düzenle
                </button>
                <button type="button" onClick={() => deleteMaterialAnalysis(item.id)}>
                  Sil
                </button>
              </div>
            </div>
          ))
        )}
      </div>
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

          <button type="button" onClick={() => setShowOfferForm((value) => !value)}>
            {showOfferForm ? "Formu Kapat" : "+ Yeni Teklif"}
          </button>
        </div>
      </div>

      {offersError && <p className="status-banner warning">⚠ {offersError}</p>}

      {!offersError && offersFetchState === "empty" && (
        <p className="status-banner info">
          ℹ API üzerinde henüz teklif bulunmuyor
          {offers.some((offer) => offer.source === "local")
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

          <select value={offerStatus} onChange={(event) => setOfferStatus(event.target.value)}>
            <option>Hazırlanıyor</option>
            <option>Gönderildi</option>
            <option>Onaylandı</option>
            <option>Reddedildi</option>
          </select>

          <button type="submit">Teklifi Kaydet</button>

          <p className="form-hint">
            Yeni kayıtlar bu sürümde yerel taslak olarak eklenir.
          </p>
        </form>
      )}

      <div className="offers-summary-grid">
        <div className="offer-summary-card">
          <span>Toplam Teklif</span>
          <strong>{offers.length}</strong>
        </div>

        <div className="offer-summary-card">
          <span>API Kayıtları</span>
          <strong>{offers.filter((offer) => offer.source === "api").length}</strong>
        </div>

        <div className="offer-summary-card">
          <span>Onaylanan</span>
          <strong>{offers.filter((offer) => offer.status === "Onaylandı").length}</strong>
        </div>

        <div className="offer-summary-card">
          <span>Yerel Taslak</span>
          <strong>{offers.filter((offer) => offer.source === "local").length}</strong>
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
              <p className="empty-state">Henüz teklif kaydı bulunmuyor.</p>
            ) : (
              <div className="offers-list">
                {offers.map((offer) => (
                  <article
                    className={`offer-card${offer.id === selectedOfferId ? " selected" : ""}`}
                    key={offer.id}
                  >
                    <div className="offer-card-top">
                      <div>
                        <h3>{offer.title}</h3>
                        <p className="offer-amount">{offer.amountDisplay}</p>
                      </div>

                      <span className={`offer-status-badge ${getOfferStatusTone(offer.status)}`}>
                        {offer.status}
                      </span>
                    </div>

                    <div className="offer-meta-row">
                      <span>{offer.date}</span>
                      <span>{offer.source === "api" ? "Canlı API" : "Yerel taslak"}</span>
                    </div>

                    <div className="offer-card-actions">
                      <button
                        type="button"
                        className="offer-secondary-button"
                        onClick={() => setSelectedOfferId(offer.id)}
                      >
                        Detay
                      </button>

                      <button type="button" onClick={() => deleteOffer(offer.id)}>
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
                {selectedOfferDetail.source === "api" ? "API detayı" : "Taslak detay"}
              </span>
            )}
          </div>

          <div className="panel-content">
            {offersLoading ? (
              <p className="empty-state">Detay alanı hazırlanıyor…</p>
            ) : !selectedOfferDetail ? (
              <p className="empty-state">Detayları görmek için bir teklif seç.</p>
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

                {offerDetailError && <p className="status-banner warning">{offerDetailError}</p>}

                <div className="offer-detail-grid">
                  <div className="offer-detail-item">
                    <span>Kaynak</span>
                    <strong>
                      {selectedOfferDetail.source === "api" ? "Teklifler API" : "Yerel taslak"}
                    </strong>
                  </div>

                  <div className="offer-detail-item">
                    <span>Teklif Tarihi</span>
                    <strong>{selectedOfferDetail.date}</strong>
                  </div>

                  <div className="offer-detail-item">
                    <span>Para Birimi</span>
                    <strong>{selectedOfferDetail.currency || "Belirtilmedi"}</strong>
                  </div>

                  <div className="offer-detail-item">
                    <span>Proje Bağlantısı</span>
                    <strong>{selectedOfferDetail.projectId || "Atanmadı"}</strong>
                  </div>
                </div>

                <div className="offer-detail-note">
                  <strong>Detay görünümü hazır</strong>
                  <p>
                    Teklif seçildiğinde temel alanlar ve API detay sorgusu bu panelde yönetilir.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const renderCrm = () => (
    <div className="module-page">
      <div className="module-toolbar">
        <button
          type="button"
          onClick={() => {
            if (showCrmForm && !editingCrmId) {
              setShowCrmForm(false);
              return;
            }

            setEditingCrmId(null);
            setCrmForm(EMPTY_CRM_FORM);
            setShowCrmForm((value) => !value || Boolean(editingCrmId));
          }}
        >
          {showCrmForm ? "Formu Kapat" : "+ Yeni CRM Kaydı"}
        </button>
      </div>

      <p className="status-banner info">
        ℹ CRM modülü mevcut sürümde yerel taslak davranışını korur ve müşteri takip akışını bozmaz.
      </p>

      {showCrmForm && (
        <form className="data-form" onSubmit={saveCrmRecord}>
          <input
            type="text"
            placeholder="Müşteri adı"
            value={crmForm.customerName}
            onChange={(event) =>
              setCrmForm((current) => ({ ...current, customerName: event.target.value }))
            }
          />

          <input
            type="text"
            placeholder="Firma adı"
            value={crmForm.companyName}
            onChange={(event) =>
              setCrmForm((current) => ({ ...current, companyName: event.target.value }))
            }
          />

          <input
            type="text"
            placeholder="İletişim bilgisi"
            value={crmForm.contact}
            onChange={(event) =>
              setCrmForm((current) => ({ ...current, contact: event.target.value }))
            }
          />

          <select
            value={crmForm.stage}
            onChange={(event) =>
              setCrmForm((current) => ({ ...current, stage: event.target.value }))
            }
          >
            {CRM_STAGE_OPTIONS.map((stage) => (
              <option key={stage}>{stage}</option>
            ))}
          </select>

          <textarea
            placeholder="CRM notu"
            value={crmForm.note}
            onChange={(event) =>
              setCrmForm((current) => ({ ...current, note: event.target.value }))
            }
          />

          <div className="form-actions-row">
            <button type="submit">
              {editingCrmId ? "Kaydı Güncelle" : "Kaydı Kaydet"}
            </button>
            <button type="button" className="secondary-button" onClick={resetCrmForm}>
              İptal
            </button>
          </div>
        </form>
      )}

      <div className="data-list">
        {crmRecords.length === 0 ? (
          <p className="empty-state">Henüz CRM kaydı bulunmuyor.</p>
        ) : (
          crmRecords.map((item) => (
            <div className="data-card" key={item.id}>
              <div>
                <h3>{item.customerName}</h3>
                <p>
                  {item.companyName} · {item.contact}
                </p>
                <p>{item.note}</p>
                <small>
                  {item.stage} · Oluşturma: {item.date}
                  {item.updatedAt ? ` · Güncelleme: ${item.updatedAt}` : ""}
                </small>
              </div>

              <div className="data-card-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => startCrmEdit(item)}
                >
                  Düzenle
                </button>
                <button type="button" onClick={() => deleteCrmRecord(item.id)}>
                  Sil
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  const renderResearch = () => (
    <div className="module-page">
      <div className="module-toolbar">
        <button type="button" onClick={() => setShowResearchForm((value) => !value)}>
          {showResearchForm ? "Formu Kapat" : "+ Yeni Araştırma"}
        </button>
      </div>

      {showResearchForm && (
        <form className="data-form" onSubmit={createResearch}>
          <input
            type="text"
            placeholder="Araştırma başlığı"
            value={researchName}
            onChange={(event) => setResearchName(event.target.value)}
          />

          <textarea
            placeholder="Araştırma notu"
            value={researchNote}
            onChange={(event) => setResearchNote(event.target.value)}
          />

          <button type="submit">Araştırmayı Kaydet</button>
        </form>
      )}

      {researchError && (
        <p className="empty-state" style={{ color: "#f59e0b" }}>
          ⚠ {researchError}
        </p>
      )}

      <div className="data-list">
        {researchLoading ? (
          <p className="empty-state">Araştırmalar yükleniyor…</p>
        ) : researchItems.length === 0 ? (
          <p className="empty-state">Henüz araştırma kaydı bulunmuyor.</p>
        ) : (
          researchItems.map((item) => (
            <div className="data-card" key={item.id}>
              <div>
                <h3>{item.name}</h3>
                <p>{item.note}</p>
                <small>{item.date}</small>
              </div>

              <button type="button" onClick={() => deleteResearch(item.id)}>
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
          <div key={message.id} className={`ai-message ${message.role}`}>
            <strong>{message.role === "assistant" ? "DDPro AI" : "Sen"}</strong>
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

  const renderSystems = () => (
    <div className="module-page">
      <div className="systems-grid">
        {systemModules.map((system) => (
          <div className="system-card" key={system.id}>
            <h3>{system.title}</h3>
            <p>{system.description}</p>
          </div>
        ))}
      </div>

      <div className="panel memory-panel">
        <div className="panel-header">
          <h2>Merkezi Hafıza</h2>

          <button type="button" onClick={() => setShowMemoryForm((value) => !value)}>
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
            <p className="empty-state">Merkezi hafızada henüz kayıt bulunmuyor.</p>
          ) : (
            memoryItems.map((item) => (
              <div className="data-card" key={item.id}>
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.content}</p>
                  <small>{item.date}</small>
                </div>

                <button type="button" onClick={() => deleteMemory(item.id)}>
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

              <button type="button" onClick={() => toggleIntegration(item.id)}>
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
      case "projects":
        return renderProjects();
      case "crm":
        return renderCrm();
      case "research":
        return renderResearch();
      case "ai":
        return renderAI();
      case "dashboard":
      default:
        return renderDashboard();
    }
  };

  const currentModule =
    modules.find((module) => module.id === activeModule) || modules[0];

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
          <div className="sidebar-title">ANA MODÜLLER</div>

          <nav className="module-nav">
            {modules.map((module) => (
              <button
                key={module.id}
                type="button"
                className={`module-button ${activeModule === module.id ? "active" : ""}`}
                onClick={() => openModule(module.id)}
              >
                <span className="module-icon">{module.icon}</span>

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
              DDPro Core v1.0
            </div>
          </div>
        </aside>

        <main className="main-content">
          <section className="content-header">
            <div className="content-header-top">
              <div>
                <h1>{currentModule.title}</h1>
                <p>{currentModule.description}</p>
              </div>
              <span className="panel-meta module-route-badge">#/{activeModule}</span>
            </div>
          </section>

          <section className="content-body">{renderModule()}</section>
        </main>
      </div>
    </div>
  );
}

export default App;
