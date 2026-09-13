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
};

const modules = [
  {
    id: "dashboard",
    icon: "◉",
    title: "Genel Bakış",
    short: "Sistem Merkezi",
    description:
      "Tüm DDPro operasyonlarını, kayıtları ve sistem hareketlerini tek merkezden takip et.",
  },
  {
    id: "products",
    icon: "◫",
    title: "Ürünler",
    short: "Ürün Yönetimi",
    description:
      "Ürün listesi, filtreleme ve detay iskeleti ile ürün ana verisini yönet.",
  },
  {
    id: "systems",
    icon: "⚙",
    title: "Sistemler",
    short: "Sistem Yönetimi",
    description:
      "Sistem listesi, sistem detayları ve bağlı ürün ilişkilerini takip et.",
  },
  {
    id: "price-analysis",
    icon: "₺",
    title: "Fiyat Analizi",
    short: "Bağımsız Analiz",
    description:
      "Fiyat analiz kalemlerini bağımsız analiz ekranında yönet.",
  },
  {
    id: "material-analysis",
    icon: "⎇",
    title: "Malzeme Analizi",
    short: "Bağımsız Analiz",
    description:
      "Malzeme ağacı ve maliyet kalemlerini bağımsız olarak yönet.",
  },
  {
    id: "offers",
    icon: "€",
    title: "Teklifler",
    short: "Teklif Sistemi",
    description:
      "Teklif listesi, yeni teklif iskeleti ve toplam alanlarını takip et.",
  },
  {
    id: "projects",
    icon: "▣",
    title: "Projeler",
    short: "Proje Yönetimi",
    description:
      "Proje listesi, proje detayı ve sistem/teklif ilişkilerini yönet.",
  },
  {
    id: "crm",
    icon: "☰",
    title: "CRM",
    short: "Müşteri Yönetimi",
    description:
      "Müşteri listesi ve müşteri-proje-teklif ilişkilerini takip et.",
  },
];

const systemModules = [
  {
    id: "sys-001",
    code: "SYS-001",
    category: "Elektrik",
    title: "Aydınlatma Altyapısı",
    description:
      "Aydınlatma grubu ve ana kontrol hattı sistemi.",
  },
  {
    id: "sys-002",
    code: "SYS-002",
    category: "Mekanik",
    title: "İklimlendirme Hattı",
    description:
      "Mekanik dağıtım ve iklimlendirme kontrol altyapısı.",
  },
];

const moduleByRoute = modules.reduce((accumulator, module) => {
  accumulator[module.id] = module.id;
  return accumulator;
}, {});

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

const getStoredData = (key, fallback = []) => {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

const createId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const isUuid = (value) =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );

const productsSeed = [
  {
    id: "prd-001",
    name: "Panel Armatür",
    productCode: "PRD-001",
    systemCode: "SYS-001",
    unit: "Adet",
    status: "Aktif",
  },
  {
    id: "prd-002",
    name: "Kanal Tipi Klima",
    productCode: "PRD-002",
    systemCode: "SYS-002",
    unit: "Adet",
    status: "Taslak",
  },
];

const priceAnalysisSeed = [];
const materialAnalysisSeed = [];
const crmCustomersSeed = [];

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
  const [activeModule, setActiveModule] = useState(() => {
    const hashValue =
      typeof window !== "undefined"
        ? window.location.hash.replace(/^#/, "").trim()
        : "";
    return moduleByRoute[hashValue] || "dashboard";
  });
  const [productSearch, setProductSearch] = useState("");
  const [productStatusFilter, setProductStatusFilter] = useState("Tümü");
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [selectedSystemId, setSelectedSystemId] = useState(null);

  const [projects, setProjects] = useState(() =>
    getStoredData(STORAGE_KEYS.projects)
  );

  const [projectsLoading, setProjectsLoading] = useState(true);

  const [researchItems, setResearchItems] = useState(() =>
    getStoredData(STORAGE_KEYS.research)
  );
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
  const projectsTouchedRef = useRef(false);
  const researchTouchedRef = useRef(false);
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

  const [showProjectForm, setShowProjectForm] = useState(false);
  const [showResearchForm, setShowResearchForm] = useState(false);
  const [showOfferForm, setShowOfferForm] = useState(false);
  const [showMemoryForm, setShowMemoryForm] = useState(false);

  const [projectName, setProjectName] = useState("");
  const [projectType, setProjectType] = useState("");
  const [projectStatus, setProjectStatus] = useState("Aktif");

  const [researchName, setResearchName] = useState("");
  const [researchNote, setResearchNote] = useState("");

  const [offerName, setOfferName] = useState("");
  const [offerAmount, setOfferAmount] = useState("");
  const [offerCustomer, setOfferCustomer] = useState("");
  const [offerProjectName, setOfferProjectName] = useState("");
  const [offerAnalysisItems, setOfferAnalysisItems] = useState("");
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
    localStorage.setItem(STORAGE_KEYS.projects, JSON.stringify(projects));
  }, [projects]);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEYS.research,
      JSON.stringify(researchItems)
    );
  }, [researchItems]);

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
    if (typeof window === "undefined") return undefined;

    const applyHashModule = () => {
      const hashValue = window.location.hash.replace(/^#/, "").trim();
      const nextModule = moduleByRoute[hashValue] || "dashboard";
      setActiveModule(nextModule);
    };

    window.addEventListener("hashchange", applyHashModule);
    applyHashModule();

    return () => {
      window.removeEventListener("hashchange", applyHashModule);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const expectedHash = `#${activeModule}`;
    if (window.location.hash !== expectedHash) {
      window.location.hash = expectedHash;
    }
  }, [activeModule]);

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

  const dashboardStats = useMemo(
    () => [
      {
        label: "AKTİF PROJELER",
        value: projects.filter(
          (project) => project.status === "Aktif"
        ).length,
      },
      {
        label: "ÜRÜNLER",
        value: productsSeed.length,
      },
      {
        label: "TEKLİFLER",
        value: offers.length,
      },
      {
        label: "SİSTEMLER",
        value: systemModules.length,
      },
    ],
    [projects, offers]
  );

  const filteredProducts = useMemo(
    () =>
      productsSeed.filter((product) => {
        const search = productSearch.trim().toLowerCase();
        const matchesSearch =
          !search ||
          [product.name, product.productCode, product.systemCode]
            .join(" ")
            .toLowerCase()
            .includes(search);
        const matchesStatus =
          productStatusFilter === "Tümü" ||
          product.status === productStatusFilter;
        return matchesSearch && matchesStatus;
      }),
    [productSearch, productStatusFilter]
  );

  const selectedProduct =
    filteredProducts.find((product) => product.id === selectedProductId) ||
    filteredProducts[0] ||
    null;

  const selectedSystem =
    systemModules.find((system) => system.id === selectedSystemId) ||
    systemModules[0] ||
    null;

  useEffect(() => {
    if (filteredProducts.length === 0) {
      setSelectedProductId(null);
      return;
    }

    if (!filteredProducts.some((product) => product.id === selectedProductId)) {
      setSelectedProductId(filteredProducts[0].id);
    }
  }, [filteredProducts, selectedProductId]);

  useEffect(() => {
    if (!selectedSystemId && systemModules[0]) {
      setSelectedSystemId(systemModules[0].id);
    }
  }, [selectedSystemId]);

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

  const createResearch = (event) => {
    event.preventDefault();

    if (!researchName.trim()) return;
    researchTouchedRef.current = true;

    const newResearch = {
      id: createId(),
      name: researchName.trim(),
      note: researchNote.trim() || "Not eklenmedi.",
      date: formatDate(),
    };

    setResearchItems((currentItems) => [
      newResearch,
      ...currentItems,
    ]);

    addLog(`Yeni araştırma kaydı oluşturuldu: ${newResearch.name}`);

    setResearchName("");
    setResearchNote("");
    setShowResearchForm(false);
  };

  const deleteResearch = (id) => {
    const item = researchItems.find(
      (research) => research.id === id
    );
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
      customerName: offerCustomer.trim() || null,
      projectName: offerProjectName.trim() || null,
      analysisItems: offerAnalysisItems
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      subtotalDisplay: offerAmount.trim() || null,
      vatDisplay: null,
      totalDisplay: offerAmount.trim() || null,
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
    setOfferCustomer("");
    setOfferProjectName("");
    setOfferAnalysisItems("");
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
              <p className="empty-state">
                Henüz sistem kaydı bulunmuyor.
              </p>
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
            <h2>Hızlı Durum</h2>
          </div>

          <div className="panel-content">
            <div className="quick-status">
              <span>Ürün Sistemi</span>
              <strong>Hazır</strong>
            </div>
            <div className="quick-status">
              <span>Fiyat Analizi</span>
              <strong>Hazır</strong>
            </div>
            <div className="quick-status">
              <span>Malzeme Analizi</span>
              <strong>Hazır</strong>
            </div>
            <div className="quick-status">
              <span>CRM Sistemi</span>
              <strong>Hazır</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderProducts = () => (
    <div className="module-page">
      <div className="module-toolbar split">
        <input
          type="search"
          placeholder="Ürün adı / ürün kodu / sistem kodu ara"
          value={productSearch}
          onChange={(event) => setProductSearch(event.target.value)}
        />
        <select
          value={productStatusFilter}
          onChange={(event) => setProductStatusFilter(event.target.value)}
        >
          <option>Tümü</option>
          <option>Aktif</option>
          <option>Taslak</option>
          <option>Pasif</option>
        </select>
      </div>

      <div className="split-layout">
        <div className="panel">
          <div className="panel-header">
            <h2>Ürün Listesi</h2>
            <span className="panel-meta">{filteredProducts.length} kayıt</span>
          </div>
          <div className="panel-content">
            {filteredProducts.length === 0 ? (
              <p className="empty-state">Henüz veri bulunmuyor.</p>
            ) : (
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Ürün</th>
                      <th>Ürün Kodu</th>
                      <th>Sistem</th>
                      <th>Birim</th>
                      <th>Durum</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.map((product) => (
                      <tr key={product.id}>
                        <td>{product.name}</td>
                        <td>{product.productCode}</td>
                        <td>{product.systemCode}</td>
                        <td>{product.unit}</td>
                        <td>{product.status}</td>
                        <td>
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={() => setSelectedProductId(product.id)}
                          >
                            Detay
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <h2>Ürün Detay İskeleti</h2>
          </div>
          <div className="panel-content">
            {!selectedProduct ? (
              <p className="empty-state">Henüz veri bulunmuyor.</p>
            ) : (
              <div className="detail-grid">
                <div className="offer-detail-item">
                  <span>Ürün Kodu</span>
                  <strong>{selectedProduct.productCode}</strong>
                </div>
                <div className="offer-detail-item">
                  <span>Sistem İlişkisi</span>
                  <strong>{selectedProduct.systemCode}</strong>
                </div>
                <div className="offer-detail-item">
                  <span>Birim</span>
                  <strong>{selectedProduct.unit}</strong>
                </div>
                <div className="offer-detail-item">
                  <span>Durum</span>
                  <strong>{selectedProduct.status}</strong>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const renderPriceAnalysis = () => (
    <div className="module-page">
      <div className="panel">
        <div className="panel-header">
          <h2>Bağımsız Fiyat Analiz Ekranı</h2>
        </div>
        <div className="panel-content">
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Analiz Kalemi</th>
                  <th>Miktar</th>
                  <th>Birim</th>
                  <th>Birim Fiyat</th>
                  <th>Katsayı</th>
                  <th>Toplam</th>
                </tr>
              </thead>
              <tbody>
                {priceAnalysisSeed.length === 0 && (
                  <tr>
                    <td colSpan="6" className="empty-cell">
                      Henüz veri bulunmuyor.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );

  const renderMaterialAnalysis = () => (
    <div className="module-page">
      <div className="split-layout">
        <div className="panel">
          <div className="panel-header">
            <h2>Bağımsız Malzeme Analiz Ekranı</h2>
          </div>
          <div className="panel-content">
            <p className="empty-state">Malzeme ağacı için henüz veri bulunmuyor.</p>
          </div>
        </div>
        <div className="panel">
          <div className="panel-header">
            <h2>Malzeme Maliyet Kalemleri</h2>
          </div>
          <div className="panel-content">
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Malzeme</th>
                    <th>Miktar</th>
                    <th>Birim</th>
                    <th>Birim Maliyet</th>
                    <th>Toplam Malzeme Maliyeti</th>
                  </tr>
                </thead>
                <tbody>
                  {materialAnalysisSeed.length === 0 && (
                    <tr>
                      <td colSpan="5" className="empty-cell">
                        Henüz veri bulunmuyor.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
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

      <div className="split-layout">
        <div className="panel">
          <div className="panel-header">
            <h2>Proje Listesi</h2>
            <span className="panel-meta">{projects.length} kayıt</span>
          </div>
          <div className="panel-content">
            {projectsLoading ? (
              <p className="empty-state">Projeler yükleniyor...</p>
            ) : projects.length === 0 ? (
              <p className="empty-state">Henüz veri bulunmuyor.</p>
            ) : (
              <div className="data-list">
                {projects.map((project) => (
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
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <h2>Proje Detay</h2>
          </div>
          <div className="panel-content">
            {projects.length === 0 ? (
              <p className="empty-state">Henüz veri bulunmuyor.</p>
            ) : (
              <div className="detail-grid">
                <div className="offer-detail-item">
                  <span>Sistem İlişkileri</span>
                  <strong>
                    {systemModules.map((system) => system.code).join(", ")}
                  </strong>
                </div>
                <div className="offer-detail-item">
                  <span>Teklif İlişkileri</span>
                  <strong>
                    {offers.length > 0
                      ? offers
                          .slice(0, 3)
                          .map((offer) => offer.title)
                          .join(", ")
                      : "Henüz veri bulunmuyor"}
                  </strong>
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
      <div className="split-layout">
        <div className="panel">
          <div className="panel-header">
            <h2>Müşteri Listesi</h2>
            <span className="panel-meta">{crmCustomersSeed.length} kayıt</span>
          </div>
          <div className="panel-content">
            {crmCustomersSeed.length === 0 ? (
              <p className="empty-state">Henüz veri bulunmuyor.</p>
            ) : (
              <div className="data-list"></div>
            )}
          </div>
        </div>
        <div className="panel">
          <div className="panel-header">
            <h2>Müşteri Detay</h2>
          </div>
          <div className="panel-content">
            <div className="detail-grid">
              <div className="offer-detail-item">
                <span>İletişim Bilgileri</span>
                <strong>Henüz veri bulunmuyor</strong>
              </div>
              <div className="offer-detail-item">
                <span>Proje İlişkisi</span>
                <strong>Henüz veri bulunmuyor</strong>
              </div>
              <div className="offer-detail-item">
                <span>Teklif İlişkisi</span>
                <strong>Henüz veri bulunmuyor</strong>
              </div>
            </div>
          </div>
        </div>
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

          <input
            type="text"
            placeholder="Müşteri"
            value={offerCustomer}
            onChange={(event) => setOfferCustomer(event.target.value)}
          />

          <input
            type="text"
            placeholder="Proje"
            value={offerProjectName}
            onChange={(event) => setOfferProjectName(event.target.value)}
          />

          <textarea
            placeholder="Analiz kalemleri (virgülle ayır)"
            value={offerAnalysisItems}
            onChange={(event) => setOfferAnalysisItems(event.target.value)}
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
              <p className="empty-state">Henüz teklif kaydı bulunmuyor.</p>
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
                    <span>Müşteri</span>
                    <strong>
                      {selectedOfferDetail.customerName || "Henüz veri bulunmuyor"}
                    </strong>
                  </div>

                  <div className="offer-detail-item">
                    <span>Proje</span>
                    <strong>
                      {selectedOfferDetail.projectName ||
                        selectedOfferDetail.projectId ||
                        "Henüz veri bulunmuyor"}
                    </strong>
                  </div>

                  <div className="offer-detail-item">
                    <span>Analiz Kalemleri</span>
                    <strong>
                      {Array.isArray(selectedOfferDetail.analysisItems) &&
                      selectedOfferDetail.analysisItems.length > 0
                        ? selectedOfferDetail.analysisItems.join(", ")
                        : "Henüz veri bulunmuyor"}
                    </strong>
                  </div>

                  <div className="offer-detail-item">
                    <span>Ara Toplam</span>
                    <strong>
                      {selectedOfferDetail.subtotalDisplay ||
                        selectedOfferDetail.amountDisplay ||
                        "Henüz veri bulunmuyor"}
                    </strong>
                  </div>

                  <div className="offer-detail-item">
                    <span>KDV</span>
                    <strong>{selectedOfferDetail.vatDisplay || "Henüz veri bulunmuyor"}</strong>
                  </div>

                  <div className="offer-detail-item">
                    <span>Genel Toplam</span>
                    <strong>{selectedOfferDetail.totalDisplay || "Henüz veri bulunmuyor"}</strong>
                  </div>

                  <div className="offer-detail-item">
                    <span>Durum</span>
                    <strong>{selectedOfferDetail.status || "Henüz veri bulunmuyor"}</strong>
                  </div>

                  <div className="offer-detail-item">
                    <span>Teklif Tarihi</span>
                    <strong>{selectedOfferDetail.date || "Henüz veri bulunmuyor"}</strong>
                  </div>

                  <div className="offer-detail-item">
                    <span>Kaynak</span>
                    <strong>
                      {selectedOfferDetail.source === "api"
                        ? "Teklifler API"
                        : "Yerel taslak"}
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
      <div className="split-layout">
        <div className="panel">
          <div className="panel-header">
            <h2>Sistem Listesi</h2>
            <span className="panel-meta">{systemModules.length} kayıt</span>
          </div>
          <div className="panel-content">
            <div className="systems-grid">
              {systemModules.map((system) => (
                <button
                  key={system.id}
                  type="button"
                  className={`system-card${
                    selectedSystem?.id === system.id ? " selected" : ""
                  }`}
                  onClick={() => setSelectedSystemId(system.id)}
                >
                  <h3>{system.title}</h3>
                  <p>{system.description}</p>
                  <small>
                    {system.code} · {system.category}
                  </small>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <h2>Sistem Detayı</h2>
          </div>
          <div className="panel-content">
            {!selectedSystem ? (
              <p className="empty-state">Henüz veri bulunmuyor.</p>
            ) : (
              <div className="detail-grid">
                <div className="offer-detail-item">
                  <span>Sistem Kodu</span>
                  <strong>{selectedSystem.code}</strong>
                </div>
                <div className="offer-detail-item">
                  <span>Kategori</span>
                  <strong>{selectedSystem.category}</strong>
                </div>
                <div className="offer-detail-item full">
                  <span>Bağlı Ürünler</span>
                  <strong>
                    {productsSeed
                      .filter(
                        (product) =>
                          product.systemCode === selectedSystem.code
                      )
                      .map((product) => product.productCode)
                      .join(", ") || "Henüz veri bulunmuyor"}
                  </strong>
                </div>
              </div>
            )}
          </div>
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

      case "crm":
        return renderCrm();

      case "projects":
        return renderProjects();

      case "offers":
        return renderOffers();

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
                onClick={() => setActiveModule(module.id)}
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
              DDPro Core v1.0
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
