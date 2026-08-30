import { useEffect, useMemo, useState } from "react";
import "./styles.css";

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

const formatDate = () =>
  new Date().toLocaleString("tr-TR", {
    dateStyle: "short",
    timeStyle: "short",
  });

function App() {
  const [activePage, setActivePage] = useState("dashboard");

  const [projects, setProjects] = useState(() =>
    getStoredData(STORAGE_KEYS.projects)
  );

  const [researchItems, setResearchItems] = useState(() =>
    getStoredData(STORAGE_KEYS.research)
  );

  const [offers, setOffers] = useState(() =>
    getStoredData(STORAGE_KEYS.offers)
  );

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

  const createProject = (event) => {
    event.preventDefault();

    if (!projectName.trim()) return;

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

    addLog(
      `Yeni araştırma kaydı oluşturuldu: ${newResearch.name}`
    );

    setResearchName("");
    setResearchNote("");
    setShowResearchForm(false);
  };

  const deleteResearch = (id) => {
    const item = researchItems.find(
      (research) => research.id === id
    );

    setResearchItems((currentItems) =>
      currentItems.filter((research) => research.id !== id)
    );

    if (item) {
      addLog(`Araştırma kaydı silindi: ${item.name}`);
    }
  };

  const createOffer = (event) => {
    event.preventDefault();

    if (!offerName.trim()) return;

    const newOffer = {
      id: createId(),
      name: offerName.trim(),
      amount: offerAmount.trim() || "Tutar belirtilmedi",
      status: offerStatus,
      date: formatDate(),
    };

    setOffers((currentOffers) => [
      newOffer,
      ...currentOffers,
    ]);

    addLog(`Yeni teklif oluşturuldu: ${newOffer.name}`);

    setOfferName("");
    setOfferAmount("");
    setOfferStatus("Hazırlanıyor");
    setShowOfferForm(false);
  };

  const deleteOffer = (id) => {
    const offer = offers.find((item) => item.id === id);

    setOffers((currentOffers) =>
      currentOffers.filter((item) => item.id !== id)
    );

    if (offer) {
      addLog(`Teklif silindi: ${offer.name}`);
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
    setIntegrations((currentItems) =>
      currentItems.map((item) => {
        if (item.id !== id) return item;

        const nextStatus =
          item.status === "Aktif" ? "Pasif" : "Aktif";

        addLog(
          `${item.name} entegrasyon durumu değiştirildi: ${nextStatus}`
        );

        return {
          ...item,
          status: nextStatus,
        };
      })
    );
  };

  const sendAiMessage = (event)
