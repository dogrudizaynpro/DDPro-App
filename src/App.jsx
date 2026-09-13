import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AppShell from "./components/layout/AppShell.jsx";
import Header from "./components/layout/Header.jsx";
import Sidebar from "./components/layout/Sidebar.jsx";
import FooterStatus from "./components/layout/FooterStatus.jsx";
import CommandCenter from "./components/common/CommandCenter.jsx";
import DashboardModule from "./components/modules/DashboardModule.jsx";
import ProjectsModule from "./components/modules/ProjectsModule.jsx";
import ResearchModule from "./components/modules/ResearchModule.jsx";
import OffersModule from "./components/modules/OffersModule.jsx";
import AIModule from "./components/modules/AIModule.jsx";
import SystemsModule from "./components/modules/SystemsModule.jsx";
import PlaceholderModule from "./components/modules/PlaceholderModule.jsx";
import { MASTER_MODULES } from "./config/modules.js";
import { getProjects } from "./services/projects.service.js";
import {
  createOffer as createOfferRequest,
  deleteOffer as deleteOfferRequest,
  getOfferById,
  getOffers,
  mapOfferToViewModel,
  mapOffersToViewModel,
} from "./services/offers.service.js";
import { getResearchItems } from "./services/research.service.js";
import "./styles.css";

const STORAGE_KEYS = {
  projects: "ddpro_projects_v1",
  research: "ddpro_research_v1",
  offers: "ddpro_offers_v1",
  memory: "ddpro_memory_v1",
  logs: "ddpro_system_logs_v1",
  integrations: "ddpro_integrations_v1",
};

const systemModules = [
  {
    id: "project-system",
    title: "Proje Sistemi",
    description:
      "Projelerin oluşturulması, merkezi takibi ve operasyon kayıtlarının yönetimi.",
  },
  {
    id: "research-system",
    title: "Araştırma Sistemi",
    description:
      "Ürün, malzeme, fiyat ve tedarikçi araştırmalarının merkezi havuzda toplanması.",
  },
  {
    id: "offer-system",
    title: "Teklif Sistemi",
    description:
      "Teklif oluşturma, kayıt, takip ve proje süreçleriyle ilişkilendirme altyapısı.",
  },
  {
    id: "ai-system",
    title: "DDPro AI Sistemi",
    description:
      "Yapay zeka destekli analiz, araştırma ve karar süreçlerinin merkezi çalışma alanı.",
  },
  {
    id: "memory-system",
    title: "Merkezi Hafıza",
    description:
      "Önemli notların, kararların ve sistem bilgisinin kalıcı olarak merkezi hafızada tutulması.",
  },
  {
    id: "integration-system",
    title: "Entegrasyon Sistemi",
    description:
      "Harici servisler ve gelecekteki API bağlantıları için merkezi entegrasyon altyapısı.",
  },
];

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

const normalizeModuleDataSource = (items = []) =>
  items.some((item) => item?.source === "api") ? "api" : "local";

function App() {
  const [activeModule, setActiveModule] = useState("dashboard");
  const [commandQuery, setCommandQuery] = useState("");

  const [projects, setProjects] = useState(() => getStoredData(STORAGE_KEYS.projects));
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [projectsError, setProjectsError] = useState(null);

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

  const closeCreateForms = useCallback(() => {
    setShowProjectForm(false);
    setShowResearchForm(false);
    setShowOfferForm(false);
    setShowMemoryForm(false);
  }, []);

  const addLog = (message) => {
    const newLog = {
      id: createId(),
      message,
      date: formatDate(),
    };

    setSystemLogs((currentLogs) => [newLog, ...currentLogs].slice(0, 50));
  };

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
          addLog("Tekliflerde yerel değişiklik algılandı, API yanıtı üzerine yazmadı.");
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
          addLog("Araştırmalarda yerel değişiklik algılandı, API yanıtı üzerine yazmadı.");
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
      setProjectsError(null);

      try {
        const apiProjects = await getProjects();

        if (cancelled) return;

        if (projectsTouchedRef.current) {
          addLog("Projelerde yerel değişiklik algılandı, API yanıtı üzerine yazmadı.");
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
          setProjectsError(
            `Proje API erişimi başarısız (${reason}). Yerel proje verileri gösteriliyor.`
          );
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

  const dashboardStats = useMemo(
    () => [
      {
        label: "Aktif Projeler",
        value: projects.filter((project) => project.status === "Aktif").length,
        description: "Canlı veya yerel kayıtlarda aktif durumdaki proje sayısı",
        tone: "emerald",
      },
      {
        label: "Teklifler",
        value: offers.length,
        description: `${offers.filter((offer) => offer.source === "api").length} API, ${
          offers.filter((offer) => offer.source !== "api").length
        } yerel kayıt`,
        tone: "silver",
      },
      {
        label: "Tedarik & Araştırma",
        value: researchItems.length,
        description: "Araştırma havuzundaki mevcut kayıt sayısı",
        tone: "emerald",
      },
      {
        label: "AI Analizleri",
        value: aiMessages.filter((message) => message.role === "assistant").length,
        description: "Yerel DDPro AI çalışma alanı etkileşimleri",
        tone: "graphite",
      },
      {
        label: "Sistem Durumu",
        value: `${[
          !projectsLoading && !projectsError,
          !researchLoading && !researchError,
          offersFetchState === "success" || offersFetchState === "empty",
        ].filter(Boolean).length}/3`,
        description: "Canlı veri modülleri erişim özeti",
        tone: "silver",
      },
    ],
    [
      aiMessages,
      offers,
      offersFetchState,
      projects,
      projectsError,
      projectsLoading,
      researchError,
      researchItems,
      researchLoading,
    ]
  );

  const systemStatusItems = useMemo(
    () => [
      {
        label: "Projeler API",
        value: projectsLoading
          ? "Yükleniyor"
          : projectsError
            ? "Yerel yedek"
            : normalizeModuleDataSource(projects) === "api"
              ? "Canlı bağlı"
              : "Yerel veri",
        tone: projectsLoading
          ? "info"
          : projectsError
            ? "warning"
            : normalizeModuleDataSource(projects) === "api"
              ? "success"
              : "neutral",
      },
      {
        label: "Araştırma API",
        value: researchLoading
          ? "Yükleniyor"
          : researchError
            ? "Yerel yedek"
            : normalizeModuleDataSource(researchItems) === "api"
              ? "Canlı bağlı"
              : "Yerel veri",
        tone: researchLoading
          ? "info"
          : researchError
            ? "warning"
            : normalizeModuleDataSource(researchItems) === "api"
              ? "success"
              : "neutral",
      },
      {
        label: "Teklifler API",
        value:
          offersFetchState === "loading"
            ? "Yükleniyor"
            : offersFetchState === "success"
              ? "Canlı bağlı"
              : offersFetchState === "empty"
                ? "Bağlı / boş veri"
                : "Yerel yedek",
        tone:
          offersFetchState === "loading"
            ? "info"
            : offersFetchState === "success"
              ? "success"
              : offersFetchState === "empty"
                ? "neutral"
                : "warning",
      },
      {
        label: "DDPro AI",
        value: "Yerel çalışma alanı",
        tone: "neutral",
      },
      {
        label: "Planlı Modüller",
        value: `${MASTER_MODULES.filter((module) => module.dataMode === "placeholder").length} adet`,
        tone: "muted",
      },
      {
        label: "Local Storage",
        value: "Aktif",
        tone: "success",
      },
    ],
    [
      offersFetchState,
      projects,
      projectsError,
      projectsLoading,
      researchError,
      researchItems,
      researchLoading,
    ]
  );

  const recentActivities = useMemo(
    () =>
      [
        ...projects
          .filter((project) => project.status === "Aktif")
          .slice(0, 2)
          .map((project) => ({
            id: `project-${project.id}`,
            title: project.name,
            meta: project.type,
            date: project.date,
            status: project.status,
            section: "Proje",
          })),
        ...offers
          .filter((offer) => offer.status !== "Onaylandı")
          .slice(0, 2)
          .map((offer) => ({
            id: `offer-${offer.id}`,
            title: offer.title,
            meta: offer.amountDisplay,
            date: offer.date,
            status: offer.status,
            section: "Teklif",
          })),
        ...researchItems.slice(0, 2).map((item) => ({
          id: `research-${item.id}`,
          title: item.name,
          meta: item.note,
          date: item.date,
          status: item.status || "Takipte",
          section: "Araştırma",
        })),
      ].slice(0, 6),
    [offers, projects, researchItems]
  );

  const filteredModules = useMemo(() => {
    const query = commandQuery.trim().toLocaleLowerCase("tr-TR");

    if (!query) {
      return MASTER_MODULES;
    }

    return MASTER_MODULES.filter((module) =>
      [module.title, module.short, module.description, ...(module.keywords || [])]
        .join(" ")
        .toLocaleLowerCase("tr-TR")
        .includes(query)
    );
  }, [commandQuery]);

  const currentModule =
    MASTER_MODULES.find((module) => module.id === activeModule) || MASTER_MODULES[0];

  useEffect(() => {
    if (filteredModules.length === 0) {
      return;
    }

    if (!filteredModules.some((module) => module.id === activeModule)) {
      setActiveModule(filteredModules[0].id);
    }
  }, [activeModule, filteredModules]);

  const openModule = useCallback((moduleId) => {
    closeCreateForms();
    setActiveModule(moduleId);
  }, [closeCreateForms]);

  const openModuleWithForm = useCallback((moduleId, form) => {
    closeCreateForms();
    setActiveModule(moduleId);

    if (form === "project") setShowProjectForm(true);
    if (form === "research") setShowResearchForm(true);
    if (form === "offer") setShowOfferForm(true);
    if (form === "memory") setShowMemoryForm(true);
  }, [closeCreateForms]);

  const handleCommandSubmit = (event) => {
    event.preventDefault();

    const query = commandQuery.trim().toLocaleLowerCase("tr-TR");
    if (!query) return;

    const matchedModule = MASTER_MODULES.find((module) =>
      [module.title, module.short, ...(module.keywords || [])]
        .join(" ")
        .toLocaleLowerCase("tr-TR")
        .includes(query)
    );

    if (matchedModule) {
      openModule(matchedModule.id);
      addLog(`Komut merkezi üzerinden modül açıldı: ${matchedModule.title}`);
      return;
    }

    addLog(`Komut eşleşmesi bulunamadı: ${commandQuery.trim()}`);
  };

  const quickActions = useMemo(
    () => [
      {
        id: "new-project",
        label: "Yeni Proje",
        description: "Projeler modülünde yeni kayıt formunu aç",
        action: () => openModuleWithForm("projects", "project"),
      },
      {
        id: "new-research",
        label: "Yeni Araştırma",
        description: "Tedarik & Araştırma modülüne geç",
        action: () => openModuleWithForm("research", "research"),
      },
      {
        id: "new-offer",
        label: "Yeni Teklif",
        description: "Teklif merkezi kayıt formunu aç",
        action: () => openModuleWithForm("offers", "offer"),
      },
      {
        id: "open-ai",
        label: "DDPro AI",
        description: "AI komut alanına geç",
        action: () => openModule("ai"),
      },
      {
        id: "open-system",
        label: "Sistem Merkezi",
        description: "Hafıza ve entegrasyon alanlarını aç",
        action: () => openModule("systems"),
      },
    ],
    [openModule, openModuleWithForm]
  );

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

    setResearchItems((currentItems) => currentItems.filter((research) => research.id !== id));

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
      console.warn("Teklif API'ye kaydedilemedi, yerel kayıt oluşturuluyor:", error.message);

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

  const renderModule = () => {
    switch (activeModule) {
      case "projects":
        return (
          <ProjectsModule
            projects={projects}
            loading={projectsLoading}
            error={projectsError}
            showForm={showProjectForm}
            onToggleForm={() => setShowProjectForm((value) => !value)}
            onSubmit={createProject}
            onDelete={deleteProject}
            projectName={projectName}
            onProjectNameChange={setProjectName}
            projectType={projectType}
            onProjectTypeChange={setProjectType}
            projectStatus={projectStatus}
            onProjectStatusChange={setProjectStatus}
          />
        );
      case "research":
        return (
          <ResearchModule
            items={researchItems}
            loading={researchLoading}
            error={researchError}
            showForm={showResearchForm}
            onToggleForm={() => setShowResearchForm((value) => !value)}
            onSubmit={createResearch}
            onDelete={deleteResearch}
            researchName={researchName}
            onResearchNameChange={setResearchName}
            researchNote={researchNote}
            onResearchNoteChange={setResearchNote}
          />
        );
      case "offers":
        return (
          <OffersModule
            offers={offers}
            loading={offersLoading}
            error={offersError}
            fetchState={offersFetchState}
            showForm={showOfferForm}
            onToggleForm={() => setShowOfferForm((value) => !value)}
            onReload={() => setOffersReloadKey((value) => value + 1)}
            onSubmit={createOffer}
            onDelete={deleteOffer}
            offerName={offerName}
            onOfferNameChange={setOfferName}
            offerAmount={offerAmount}
            onOfferAmountChange={setOfferAmount}
            offerStatus={offerStatus}
            onOfferStatusChange={setOfferStatus}
            selectedOfferId={selectedOfferId}
            onSelectOffer={setSelectedOfferId}
            selectedOfferDetail={selectedOfferDetail}
            offerDetailLoading={offerDetailLoading}
            offerDetailError={offerDetailError}
          />
        );
      case "ai":
        return (
          <AIModule
            messages={aiMessages}
            aiInput={aiInput}
            onAiInputChange={setAiInput}
            onSubmit={sendAiMessage}
          />
        );
      case "systems":
        return (
          <SystemsModule
            systems={systemModules}
            memoryItems={memoryItems}
            integrations={integrations}
            showMemoryForm={showMemoryForm}
            onToggleMemoryForm={() => setShowMemoryForm((value) => !value)}
            onCreateMemory={createMemory}
            onDeleteMemory={deleteMemory}
            onToggleIntegration={toggleIntegration}
            memoryTitle={memoryTitle}
            onMemoryTitleChange={setMemoryTitle}
            memoryContent={memoryContent}
            onMemoryContentChange={setMemoryContent}
          />
        );
      case "dashboard":
        return (
          <DashboardModule
            stats={dashboardStats}
            systemStatusItems={systemStatusItems}
            recentLogs={systemLogs.slice(0, 8)}
            recentActivities={recentActivities}
            modules={MASTER_MODULES.filter((module) => module.id !== "dashboard")}
            quickActions={quickActions}
            onSelectModule={openModule}
          />
        );
      default:
        return <PlaceholderModule module={currentModule} onOpenDashboard={() => openModule("dashboard")} />;
    }
  };

  return (
    <AppShell
      sidebar={
        <Sidebar
          modules={filteredModules}
          activeModule={activeModule}
          onSelectModule={openModule}
          totalModuleCount={MASTER_MODULES.length}
        />
      }
      header={
        <Header
          currentModule={currentModule}
          commandQuery={commandQuery}
          onCommandChange={setCommandQuery}
          onCommandSubmit={handleCommandSubmit}
          filteredCount={filteredModules.length}
          totalCount={MASTER_MODULES.length}
          systemStatusItems={systemStatusItems.slice(0, 3)}
        />
      }
      footer={<FooterStatus items={systemStatusItems} />}
    >
      <section className="content-shell">
        <div className="content-header">
          <div>
            <p className="eyebrow-label">MASTER DDPRO ARAYÜZÜ</p>
            <h1>{currentModule.title}</h1>
            <p>{currentModule.description}</p>
          </div>
          <div className="content-header-meta">
            <span className={`availability-badge ${currentModule.statusTone}`}>
              {currentModule.availabilityLabel}
            </span>
            <span className="content-header-note">{currentModule.short}</span>
          </div>
        </div>

        <CommandCenter
          activeModule={currentModule}
          systemStatusItems={systemStatusItems.slice(0, 4)}
          quickActions={quickActions}
        />

        <section className="content-body">{renderModule()}</section>
      </section>
    </AppShell>
  );
}

export default App;
