import { useEffect, useMemo, useRef, useState } from "react";
import { getProjects } from "./services/projects.service.js";
import "./styles.css";
import { getRuntimeDataLayer } from "./services/api.js";
import {
  getCentralStoreKey,
  getInitialAppState,
  isPersistentStorageAvailable,
  persistAppState,
} from "./services/centralStore.service.js";
import {
  createOffer as createOfferRequest,
  deleteOffer as deleteOfferRequest,
  getOfferById,
  getOffers,
  mapOfferToViewModel,
  mapOffersToViewModel,
} from "./services/offers.service.js";
import { getResearchItems } from "./services/research.service.js";

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
    id: "projects",
    icon: "▣",
    title: "Projeler",
    short: "Proje Yönetimi",
    description:
      "Aktif projelerini oluştur, yönet, düzenle ve tüm süreçlerini merkezi olarak takip et.",
  },
  {
    id: "research",
    icon: "⌕",
    title: "Tedarik & Araştırma",
    short: "Araştırma Merkezi",
    description:
      "Ürün, malzeme, fiyat ve tedarikçi araştırmalarını merkezi araştırma havuzunda topla.",
  },
  {
    id: "ai",
    icon: "✦",
    title: "DDPro AI",
    short: "Yapay Zeka Sistemi",
    description:
      "Araştırma, analiz ve operasyon süreçlerinde yapay zeka destekli merkezi çalışma alanı.",
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
    id: "systems",
    icon: "⚙",
    title: "Sistemler",
    short: "Altyapı Merkezi",
    description:
      "DDPro altyapısı, entegrasyonlar, kayıtlar ve merkezi sistem bileşenlerini yönet.",
  },
];

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

const mergeRecords = (primaryRecords = [], secondaryRecords = []) => {
  const primaryIds = new Set(primaryRecords.map((record) => record?.id));
  const secondaryOnlyRecords = secondaryRecords.filter(
    (record) => record?.id && !primaryIds.has(record.id)
  );

  return [...primaryRecords, ...secondaryOnlyRecords];
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
  const initialSnapshotRef = useRef(null);
  if (!initialSnapshotRef.current) {
    initialSnapshotRef.current = getInitialAppState();
  }

  const initialSnapshot = initialSnapshotRef.current;
  const runtimeDataLayer = getRuntimeDataLayer();
  const persistentStorageActive = isPersistentStorageAvailable();
  const storeKey = getCentralStoreKey();
  const [activeModule, setActiveModule] = useState("dashboard");

  const [projects, setProjects] = useState(() => initialSnapshot.projects);

  const [projectsLoading, setProjectsLoading] = useState(true);

  const [researchItems, setResearchItems] = useState(
    () => initialSnapshot.researchItems
  );
  const [researchLoading, setResearchLoading] = useState(true);
  const [researchError, setResearchError] = useState(null);

  const [offers, setOffers] = useState(() =>
    mapOffersToViewModel(initialSnapshot.offers)
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
  const dataLayerInitializedRef = useRef(false);

  const [memoryItems, setMemoryItems] = useState(
    () => initialSnapshot.memoryItems
  );

  const [systemLogs, setSystemLogs] = useState(() => initialSnapshot.systemLogs);

  const [showProjectForm, setShowProjectForm] = useState(false);
  const [showResearchForm, setShowResearchForm] = useState(false);
  const [showOfferForm, setShowOfferForm] = useState(false);
  const [showMemoryForm, setShowMemoryForm] = useState(false);

  const [projectName, setProjectName] = useState("");
  const [projectType, setProjectType] = useState("");
  const [projectStatus, setProjectStatus] = useState("Aktif");

  const [researchName, setResearchName] = useState("");
  const [researchNote, setResearchNote] = useState("");
  const [researchProjectId, setResearchProjectId] = useState("");

  const [offerName, setOfferName] = useState("");
  const [offerAmount, setOfferAmount] = useState("");
  const [offerStatus, setOfferStatus] = useState("Hazırlanıyor");
  const [offerProjectId, setOfferProjectId] = useState("");

  const [memoryTitle, setMemoryTitle] = useState("");
  const [memoryContent, setMemoryContent] = useState("");
  const [memoryProjectId, setMemoryProjectId] = useState("");

  const [aiInput, setAiInput] = useState("");

  const [aiMessages, setAiMessages] = useState(() => initialSnapshot.aiMessages);

  useEffect(() => {
    persistAppState({
      projects,
      researchItems,
      offers,
      memoryItems,
      systemLogs,
      aiMessages,
    });
  }, [projects, researchItems, offers, memoryItems, systemLogs, aiMessages]);

  useEffect(() => {
    if (dataLayerInitializedRef.current) {
      return;
    }

    dataLayerInitializedRef.current = true;

    if (runtimeDataLayer.mode !== "api") {
      setProjectsLoading(false);
      setResearchLoading(false);
      setOffersLoading(false);
      setOffersFetchState("local");
      setOffersError(null);
      setResearchError(null);
      setSystemLogs((currentLogs) => {
        if (
          currentLogs.some(
            (log) => log.message === "Kalıcı yerel veri katmanı etkinleştirildi."
          )
        ) {
          return currentLogs;
        }

        return [
          {
            id: createId(),
            message: "Kalıcı yerel veri katmanı etkinleştirildi.",
            date: formatDate(),
          },
          ...currentLogs,
        ].slice(0, 50);
      });
    }
  }, [runtimeDataLayer.mode]);

  useEffect(() => {
    if (runtimeDataLayer.mode !== "api") {
      return undefined;
    }

    let cancelled = false;

    const fetchOffersFromApi = async () => {
      const localOffers = initialSnapshot.offers;
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
          addLog(
            `Tekliflerde API bağlantı hatası: ${reason}. Yerel veriler kullanıldı.`
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
  }, [initialSnapshot.offers, offersReloadKey, runtimeDataLayer.mode]);

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

    if (
      runtimeDataLayer.mode !== "api" ||
      selectedOffer.source !== "api"
    ) {
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
  }, [offers, selectedOfferId, runtimeDataLayer.mode]);

  useEffect(() => {
    if (runtimeDataLayer.mode !== "api") {
      return undefined;
    }

    let cancelled = false;

    const fetchResearchFromApi = async () => {
      const localResearchItems = initialSnapshot.researchItems;
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
          setResearchItems(mergeRecords(apiResearchItems, localResearchItems));
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
  }, [initialSnapshot.researchItems, runtimeDataLayer.mode]);

  useEffect(() => {
    if (runtimeDataLayer.mode !== "api") {
      return undefined;
    }

    let cancelled = false;

    const fetchProjectsFromApi = async () => {
      const localProjects = initialSnapshot.projects;
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
          setProjects(mergeRecords(apiProjects, localProjects));
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
  }, [initialSnapshot.projects, runtimeDataLayer.mode]);

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
        label: "ARAŞTIRMALAR",
        value: researchItems.length,
      },
      {
        label: "TEKLİFLER",
        value: offers.length,
      },
      {
        label: "SİSTEM KAYITLARI",
        value: systemLogs.length,
      },
    ],
    [projects, researchItems, offers, systemLogs]
  );

  const projectOptions = useMemo(
    () =>
      projects.map((project) => ({
        id: project.id,
        name: project.name,
      })),
    [projects]
  );

  const getProjectNameById = (projectId) =>
    projects.find((project) => project.id === projectId)?.name || "Bağlı değil";

  const systemsOverview = useMemo(
    () => [
      {
        id: "project-system",
        title: "Proje Sistemi",
        description:
          "Projelerin oluşturulması, merkezi takibi ve operasyon kayıtlarının yönetimi.",
        status: projectsLoading ? "Yükleniyor" : "Aktif",
        detail: `${projects.length} proje kaydı`,
      },
      {
        id: "research-system",
        title: "Araştırma Sistemi",
        description:
          "Ürün, malzeme, fiyat ve tedarikçi araştırmalarının merkezi havuzda toplanması.",
        status: researchLoading ? "Yükleniyor" : "Aktif",
        detail: `${researchItems.length} araştırma kaydı`,
      },
      {
        id: "offer-system",
        title: "Teklif Sistemi",
        description:
          "Teklif oluşturma, kayıt, takip ve proje süreçleriyle ilişkilendirme altyapısı.",
        status: offersLoading ? "Yükleniyor" : "Aktif",
        detail: `${offers.length} teklif kaydı`,
      },
      {
        id: "ai-system",
        title: "DDPro AI Sistemi",
        description:
          "Yapay zeka destekli analiz, araştırma ve karar süreçlerinin merkezi çalışma alanı.",
        status: "Aktif",
        detail: `${aiMessages.length} mesaj işlendi`,
      },
      {
        id: "memory-system",
        title: "Merkezi Hafıza",
        description:
          "Önemli notların, kararların ve sistem bilgisinin kalıcı olarak merkezi hafızada tutulması.",
        status: persistentStorageActive ? "Aktif" : "Pasif",
        detail: `${memoryItems.length} hafıza kaydı`,
      },
      {
        id: "integration-system",
        title: "Entegrasyon Sistemi",
        description:
          "Harici servisler ve gelecekteki API bağlantıları için merkezi entegrasyon altyapısı.",
        status: runtimeDataLayer.mode === "api" ? "Aktif" : "Yerel Mod",
        detail:
          runtimeDataLayer.mode === "api"
            ? runtimeDataLayer.apiBaseUrl
            : "GitHub Pages için kalıcı tarayıcı deposu",
      },
    ],
    [
      aiMessages.length,
      memoryItems.length,
      offers.length,
      offersLoading,
      persistentStorageActive,
      projects.length,
      projectsLoading,
      researchItems.length,
      researchLoading,
      runtimeDataLayer.apiBaseUrl,
      runtimeDataLayer.mode,
    ]
  );

  const integrations = useMemo(
    () => [
      {
        id: "ddpro-core",
        name: "DDPro Core",
        status: "Aktif",
        description:
          runtimeDataLayer.mode === "api"
            ? "Merkezi veri katmanı canlı API ve kalıcı tarayıcı deposunu birlikte yönetiyor."
            : "Merkezi veri katmanı GitHub Pages üretiminde kalıcı tarayıcı deposu ile çalışıyor.",
      },
      {
        id: "local-storage",
        name: "Local Storage",
        status: persistentStorageActive ? "Aktif" : "Pasif",
        description: persistentStorageActive
          ? `Kalıcı kayıtlar ortak ${storeKey} anahtarı altında tutuluyor.`
          : "Tarayıcı depolaması bu oturumda kullanılamıyor.",
      },
      {
        id: "data-source",
        name: runtimeDataLayer.label,
        status: runtimeDataLayer.mode === "api" ? "Aktif" : "Yerel Mod",
        description:
          runtimeDataLayer.mode === "api"
            ? runtimeDataLayer.apiBaseUrl
            : runtimeDataLayer.message,
      },
    ],
    [persistentStorageActive, runtimeDataLayer, storeKey]
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
      createdAt: new Date().toISOString(),
      source: "local",
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
    researchTouchedRef.current = true;
    offersTouchedRef.current = true;

    setProjects((currentProjects) =>
      currentProjects.filter((item) => item.id !== id)
    );
    setResearchItems((currentItems) =>
      currentItems.map((item) =>
        item.projectId === id
          ? {
              ...item,
              projectId: null,
            }
          : item
      )
    );
    setOffers((currentOffers) =>
      currentOffers.map((item) =>
        item.projectId === id
          ? mapOfferToViewModel({
              ...item,
              projectId: null,
              project_id: null,
            })
          : item
      )
    );
    setMemoryItems((currentItems) =>
      currentItems.map((item) =>
        item.projectId === id
          ? {
              ...item,
              projectId: null,
            }
          : item
      )
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
      createdAt: new Date().toISOString(),
      projectId: researchProjectId || null,
      source: "local",
    };

    setResearchItems((currentItems) => [
      newResearch,
      ...currentItems,
    ]);

    addLog(`Yeni araştırma kaydı oluşturuldu: ${newResearch.name}`);

    setResearchName("");
    setResearchNote("");
    setResearchProjectId("");
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
      createdAt: new Date().toISOString(),
      projectId: offerProjectId || null,
      project_id: offerProjectId || null,
      source: "local",
    });

    setOffersError(null);

    if (runtimeDataLayer.mode === "api") {
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
    } else {
      setOffers((currentOffers) => [
        newOffer,
        ...currentOffers,
      ]);
      setSelectedOfferId(newOffer.id);
      addLog(`Yeni teklif oluşturuldu: ${newOffer.title}`);
    }

    setOfferName("");
    setOfferAmount("");
    setOfferStatus("Hazırlanıyor");
    setOfferProjectId("");
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
      createdAt: new Date().toISOString(),
      projectId: memoryProjectId || null,
    };

    setMemoryItems((currentItems) => [
      newMemory,
      ...currentItems,
    ]);

    addLog(`Merkezi hafızaya kayıt eklendi: ${newMemory.title}`);

    setMemoryTitle("");
    setMemoryContent("");
    setMemoryProjectId("");
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

  const sendAiMessage = (event) => {
    event.preventDefault();

    const message = aiInput.trim();

    if (!message) return;

    const userMessage = {
      id: createId(),
      role: "user",
      text: message,
      date: formatDate(),
      createdAt: new Date().toISOString(),
    };

    const assistantMessage = {
      id: createId(),
      role: "assistant",
      text:
        `Mesaj alındı: "${message}". ` +
        "DDPro AI çalışma alanı bu mesajı kayıt altına aldı ve merkezi sistem kayıtlarına işledi. " +
        (runtimeDataLayer.mode === "api"
          ? "Harici servis entegrasyonu tanımlandığında bu akış canlı API üzerinden genişletilebilir."
          : "GitHub Pages üretiminde bu akış kalıcı yerel veri katmanı üzerinden sürdürülüyor."),
      date: formatDate(),
      createdAt: new Date().toISOString(),
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
              <span>Proje Sistemi</span>
              <strong>{projectsLoading ? "Yükleniyor" : `${projects.length} kayıt`}</strong>
            </div>
            <div className="quick-status">
              <span>Araştırma Sistemi</span>
              <strong>
                {researchLoading ? "Yükleniyor" : `${researchItems.length} kayıt`}
              </strong>
            </div>
            <div className="quick-status">
              <span>Teklif Sistemi</span>
              <strong>{offersLoading ? "Yükleniyor" : `${offers.length} kayıt`}</strong>
            </div>
            <div className="quick-status">
              <span>Veri Katmanı</span>
              <strong>{runtimeDataLayer.label}</strong>
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

  const renderResearch = () => (
    <div className="module-page">
      <div className="module-toolbar">
        <button
          type="button"
          onClick={() => setShowResearchForm((value) => !value)}
        >
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

          <select
            value={researchProjectId}
            onChange={(event) => setResearchProjectId(event.target.value)}
          >
            <option value="">Projeye bağla (opsiyonel)</option>
            {projectOptions.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>

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
          <p className="empty-state">
            Henüz araştırma kaydı bulunmuyor.
          </p>
        ) : (
          researchItems.map((item) => (
            <div className="data-card" key={item.id}>
              <div>
                <h3>{item.name}</h3>
                <p>{item.note}</p>
                <small>
                  {item.date}
                  {item.projectId
                    ? ` · ${getProjectNameById(item.projectId)}`
                    : ""}
                </small>
              </div>

              <button
                type="button"
                onClick={() => deleteResearch(item.id)}
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
            {offersFetchState === "error" && "API bağlantı hatası"}
            {offersFetchState === "local" && "Kalıcı yerel veri"}
          </span>

          <button
            type="button"
            className="secondary-button"
            disabled={offersLoading}
            onClick={() => {
              if (runtimeDataLayer.mode === "api") {
                setOffersReloadKey((value) => value + 1);
              }
            }}
          >
            {offersLoading
              ? "Yenileniyor..."
              : runtimeDataLayer.mode === "api"
                ? "Yenile"
                : "Kalıcı veri aktif"}
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

      {!offersError && offersFetchState === "local" && (
        <p className="status-banner info">
          ℹ GitHub Pages üretiminde teklifler kalıcı yerel veri katmanında saklanıyor.
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

          <select
            value={offerProjectId}
            onChange={(event) => setOfferProjectId(event.target.value)}
          >
            <option value="">Projeye bağla (opsiyonel)</option>
            {projectOptions.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>

          <button type="submit">Teklifi Kaydet</button>

          <p className="form-hint">
            {runtimeDataLayer.mode === "api"
              ? "Yeni kayıtlar öncelikle API'ye kaydedilir; gerekirse kalıcı yerel veri korunur."
              : "Yeni kayıtlar kalıcı yerel veri katmanına kaydedilir ve yenilemede korunur."}
          </p>
        </form>
      )}

      <div className="offers-summary-grid">
        <div className="offer-summary-card">
          <span>Toplam Teklif</span>
          <strong>{offers.length}</strong>
        </div>

        <div className="offer-summary-card">
          <span>{runtimeDataLayer.mode === "api" ? "API Kayıtları" : "Bağlı Projeler"}</span>
          <strong>
            {runtimeDataLayer.mode === "api"
              ? offers.filter((offer) => offer.source === "api").length
              : offers.filter((offer) => offer.projectId).length}
          </strong>
        </div>

        <div className="offer-summary-card">
          <span>Onaylanan</span>
          <strong>
            {offers.filter((offer) => offer.status === "Onaylandı").length}
          </strong>
        </div>

        <div className="offer-summary-card">
          <span>{runtimeDataLayer.mode === "api" ? "Yerel Taslak" : "Kalıcı Yerel"}</span>
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
                          : offer.projectId
                            ? getProjectNameById(offer.projectId)
                            : "Kalıcı yerel kayıt"}
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
                      {selectedOfferDetail.projectId
                        ? getProjectNameById(selectedOfferDetail.projectId)
                        : "Atanmadı"}
                    </strong>
                  </div>
                </div>

                <div className="offer-detail-note">
                  <strong>Detay görünümü aktif</strong>
                  <p>
                    Teklif seçildiğinde temel alanlar, proje bağlantısı ve veri
                    kaynağı bu panelde yönetilir.
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
      <div className="systems-grid">
        {systemsOverview.map((system) => (
          <div className="system-card" key={system.id}>
            <h3>{system.title}</h3>
            <p>{system.description}</p>
            <small>
              Durum: {system.status}
              {system.detail ? ` · ${system.detail}` : ""}
            </small>
          </div>
        ))}
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

            <select
              value={memoryProjectId}
              onChange={(event) => setMemoryProjectId(event.target.value)}
            >
              <option value="">Projeye bağla (opsiyonel)</option>
              {projectOptions.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>

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
                  <small>
                    {item.date}
                    {item.projectId
                      ? ` · ${getProjectNameById(item.projectId)}`
                      : ""}
                  </small>
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

      case "research":
        return renderResearch();

      case "ai":
        return renderAI();

      case "offers":
        return renderOffers();

      case "systems":
        return renderSystems();

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
