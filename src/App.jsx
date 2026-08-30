import { useEffect, useMemo, useState } from "react";
import { getOffers } from "./services/offers.service.js";
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
  const [activeModule, setActiveModule] = useState("dashboard");

  const [projects, setProjects] = useState(() =>
    getStoredData(STORAGE_KEYS.projects)
  );

  const [researchItems, setResearchItems] = useState(() =>
    getStoredData(STORAGE_KEYS.research)
  );

  const [offers, setOffers] = useState(() =>
    getStoredData(STORAGE_KEYS.offers)
  );
  const [offersLoading, setOffersLoading] = useState(true);
  const [offersError, setOffersError] = useState("");

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

  useEffect(() => {
    let isMounted = true;

    const loadOffers = async () => {
      try {
        const apiOffers = await getOffers();

        if (!isMounted) return;

        setOffersError("");

        if (Array.isArray(apiOffers) && apiOffers.length > 0) {
          setOffers(apiOffers);
        }
      } catch (error) {
        if (!isMounted) return;

        setOffersError(
          "Teklifler sunucudan yüklenemedi. Kayıtlı veriler gösteriliyor."
        );

        addLog(
          `Teklifler yüklenemedi, localStorage verileri kullanıldı: ${
            error?.message || "Bilinmeyen hata"
          }`
        );
      } finally {
        if (isMounted) {
          setOffersLoading(false);
        }
      }
    };

    loadOffers();

    return () => {
      isMounted = false;
    };
  }, []);

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

    addLog(`Yeni araştırma kaydı oluşturuldu: ${newResearch.name}`);

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
              <span>Proje Sistemi</span>
              <strong>Hazır</strong>
            </div>
            <div className="quick-status">
              <span>Araştırma Sistemi</span>
              <strong>Hazır</strong>
            </div>
            <div className="quick-status">
              <span>Teklif Sistemi</span>
              <strong>Hazır</strong>
            </div>
            <div className="quick-status">
              <span>Merkezi Hafıza</span>
              <strong>Hazır</strong>
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
        {projects.length === 0 ? (
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

          <button type="submit">Araştırmayı Kaydet</button>
        </form>
      )}

      <div className="data-list">
        {researchItems.length === 0 ? (
          <p className="empty-state">
            Henüz araştırma kaydı bulunmuyor.
          </p>
        ) : (
          researchItems.map((item) => (
            <div className="data-card" key={item.id}>
              <div>
                <h3>{item.name}</h3>
                <p>{item.note}</p>
                <small>{item.date}</small>
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
        <button
          type="button"
          onClick={() => setShowOfferForm((value) => !value)}
        >
          {showOfferForm ? "Formu Kapat" : "+ Yeni Teklif"}
        </button>
      </div>

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
        </form>
      )}

      <div className="data-list">
        {offersError && (
          <p className="empty-state">{offersError}</p>
        )}

        {offersLoading ? (
          <p className="empty-state">Teklifler yükleniyor...</p>
        ) : offers.length === 0 ? (
          <p className="empty-state">Henüz teklif kaydı bulunmuyor.</p>
        ) : (
          offers.map((offer) => (
            <div className="data-card" key={offer.id}>
              <div>
                <h3>{offer.name}</h3>
                <p>{offer.amount}</p>
                <small>
                  {offer.status} · {offer.date}
                </small>
              </div>

              <button
                type="button"
                onClick={() => deleteOffer(offer.id)}
              >
                Sil
              </button>
            </div>
          ))
        )}
      </div>
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
