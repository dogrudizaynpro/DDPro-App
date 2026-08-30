import { useState, useEffect } from "react";
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

const getStoredData = (key, fallback = []) => {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

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

  const [systemLogs, setSystemLogs] = useState(() =>
    getStoredData(STORAGE_KEYS.logs)
  );

  const [showProjectForm, setShowProjectForm] = useState(false);
  const [showResearchForm, setShowResearchForm] = useState(false);
  const [showOfferForm, setShowOfferForm] = useState(false);

  const [projectName, setProjectName] = useState("");
  const [projectType, setProjectType] = useState("");

  const [researchName, setResearchName] = useState("");
  const [researchNote, setResearchNote] = useState("");

  const [offerName, setOfferName] = useState("");
  const [offerAmount, setOfferAmount] = useState("");

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
    localStorage.setItem(STORAGE_KEYS.logs, JSON.stringify(systemLogs));
  }, [systemLogs]);

  const addLog = (message) => {
    const newLog = {
      id: Date.now(),
      message,
      date: new Date().toLocaleString("tr-TR"),
    };

    setSystemLogs((currentLogs) => [newLog, ...currentLogs].slice(0, 20));
  };

  const createProject = (event) => {
    event.preventDefault();

    if (!projectName.trim()) return;

    const newProject = {
      id: Date.now(),
      name: projectName.trim(),
      type: projectType.trim() || "Genel Proje",
      status: "Aktif",
      date: new Date().toLocaleDateString("tr-TR"),
    };

    setProjects((currentProjects) => [newProject, ...currentProjects]);

    addLog(`Yeni proje oluşturuldu: ${newProject.name}`);

    setProjectName("");
    setProjectType("");
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
      id: Date.now(),
      name: researchName.trim(),
      note: researchNote.trim() || "Not eklenmedi.",
      date: new Date().toLocaleDateString("tr-TR"),
    };

    setResearchItems((currentItems) => [newResearch, ...currentItems]);

    addLog(`Yeni araştırma kaydı oluşturuldu: ${newResearch.name}`);

    setResearchName("");
    setResearchNote("");
    setShowResearchForm(false);
  };

  const deleteResearch = (id) => {
    const item = researchItems.find((research) => research.id === id);

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
      id: Date.now(),
      name: offerName.trim(),
      amount: offerAmount.trim() || "Tutar belirtilmedi",
      status: "Hazırlanıyor",
      date: new Date().toLocaleDateString("tr-TR"),
    };

    setOffers((currentOffers) => [newOffer, ...currentOffers]);

    addLog(`Yeni teklif oluşturuldu: ${newOffer.name}`);

    setOfferName("");
    setOfferAmount("");
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

  const renderHeader = (title, description) => (
    <div className="page-header">
      <div>
        <div className="page-eyebrow">DDPRO MERKEZİ SİSTEM</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
    </div>
  );

  const renderDashboard = () => (
    <>
      {renderHeader(
        "Genel Bakış",
        "Tüm DDPro sistemlerini tek bir merkezi yapı üzerinden takip et."
      )}

      <section className="hero">
        <div className="hero-content">
          <div className="hero-badge">DOĞRU DİZAYN PRO AI TRADE</div>

          <h2>Doğru çizgi. Doğru çözüm. Doğru sistem.</h2>

          <p>
            Projeler, tedarik araştırmaları, teklifler, yapay zeka ve sistem
            altyapısı tek bir merkezi operasyon yapısında birleşir.
          </p>

          <div className="hero-actions">
            <button
              className="primary-button"
              type="button"
              onClick={() => setActivePage("projects")}
            >
              Projelere Git
            </button>

            <button
              className="secondary-button"
              type="button"
              onClick={() => setActivePage("research")}
            >
              Araştırma Merkezi
            </button>
          </div>
        </div>
      </section>

      <section className="stats-grid">
        <div className="stat-card">
          <span>AKTİF PROJELER</span>
          <strong>{projects.length}</strong>
        </div>

        <div className="stat-card">
          <span>ARAŞTIRMALAR</span>
          <strong>{researchItems.length}</strong>
        </div>

        <div className="stat-card">
          <span>TEKLİFLER</span>
          <strong>{offers.length}</strong>
        </div>

        <div className="stat-card">
          <span>SİSTEM KAYITLARI</span>
          <strong>{systemLogs.length}</strong>
        </div>
      </section>

      <section className="section">
        <div className="section-header">
          <div>
            <h3>DDPro Sistemleri</h3>
            <p>Merkezi operasyon yapısındaki ana çalışma alanları.</p>
          </div>
        </div>

        <div className="modules-grid">
          {modules.slice(1).map((module) => (
            <button
              className="module-card module-button"
              type="button"
              key={module.id}
              onClick={() => setActivePage(module.id)}
            >
              <span className="module-icon">{module.icon}</span>
              <h4>{module.title}</h4>
              <p>{module.description}</p>
            </button>
          ))}
        </div>
      </section>
    </>
  );

  const renderProjects = () => (
    <>
      {renderHeader(
        "Projeler",
        "Aktif projelerini merkezi olarak oluştur, takip et ve yönet."
      )}

      <section className="hero">
        <div className="hero-content">
          <div className="hero-badge">PROJE YÖNETİM SİSTEMİ</div>

          <h2>Tüm projelerin tek bir merkezi sistemde.</h2>

          <p>
            Proje bilgilerini düzenli şekilde sakla, süreçleri takip et ve
            operasyonlarını merkezi DDPro yapısı üzerinden yönet.
          </p>

          <div className="hero-actions">
            <button
              className="primary-button"
              type="button"
              onClick={() => setShowProjectForm((value) => !value)}
            >
              {showProjectForm ? "Formu Kapat" : "Yeni Proje Oluştur"}
            </button>
          </div>
        </div>
      </section>

      {showProjectForm && (
        <section className="panel">
          <form onSubmit={createProject}>
            <div className="section-header">
              <div>
                <h3>Yeni Proje</h3>
                <p>Yeni projeyi merkezi sisteme kaydet.</p>
              </div>
            </div>

            <div className="form-grid">
              <input
                value={projectName}
                onChange={(event) => setProjectName(event.target.value)}
                placeholder="Proje adı"
              />

              <input
                value={projectType}
                onChange={(event) => setProjectType(event.target.value)}
                placeholder="Proje türü"
              />

              <button className="primary-button" type="submit">
                Kaydet
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="section">
        <div className="section-header">
          <div>
            <h3>Kayıtlı Projeler</h3>
            <p>Sistem merkezindeki proje kayıtları.</p>
          </div>
        </div>

        <div className="modules-grid">
          {projects.length === 0 ? (
            <div className="empty-card">
              <span className="module-icon">▣</span>
              <h4>Henüz proje yok</h4>
              <p>İlk proje kaydını oluşturarak başlayabilirsin.</p>
            </div>
          ) : (
            projects.map((project) => (
              <div className="module-card" key={project.id}>
                <span className="module-icon">▣</span>
                <h4>{project.name}</h4>
                <p>{project.type}</p>

                <div className="module-footer">
                  <span className="module-status">
                    <span className="status-dot" />
                    {project.status}
                  </span>

                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => deleteProject(project.id)}
                  >
                    Sil
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </>
  );

  const renderResearch = () => (
    <>
      {renderHeader(
        "Tedarik & Araştırma",
        "Ürün, malzeme, fiyat ve tedarikçi araştırmalarını merkezi olarak yönet."
      )}

      <section className="hero">
        <div className="hero-content">
          <div className="hero-badge">ARAŞTIRMA MERKEZİ</div>

          <h2>Doğru veriyi bul. Karşılaştır. Kaydet. Karar ver.</h2>

          <p>
            Tedarik ve araştırma süreçlerini sistemli hale getirerek tüm önemli
            bilgileri merkezi araştırma havuzunda topla.
          </p>

          <div className="hero-actions">
            <button
              className="primary-button"
              type="button"
              onClick={() => setShowResearchForm((value) => !value)}
            >
              {showResearchForm ? "Formu Kapat" : "Yeni Araştırma Ekle"}
            </button>
          </div>
        </div>
      </section>

      {showResearchForm && (
        <section className="panel">
          <form onSubmit={createResearch}>
            <div className="section-header">
              <div>
                <h3>Araştırma Kaydı</h3>
                <p>Yeni ürün, malzeme veya tedarik araştırmasını kaydet.</p>
              </div>
            </div>

            <div className="form-column">
              <input
                value={researchName}
                onChange={(event) => setResearchName(event.target.value)}
                placeholder="Araştırma başlığı"
              />

              <textarea
                value={researchNote}
                onChange={(event) => setResearchNote(event.target.value)}
                placeholder="Araştırma notu"
                rows="5"
              />

              <button className="primary-button" type="submit">
                Araştırmayı Kaydet
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="section">
        <div className="section-header">
          <div>
            <h3>Araştırma Havuzu</h3>
            <p>Kayıt altına alınan merkezi araştırma verileri.</p>
          </div>
        </div>

        <div className="modules-grid">
          {researchItems.length === 0 ? (
            <div className="empty-card">
              <span className="module-icon">⌕</span>
              <h4>Henüz araştırma yok</h4>
              <p>İlk araştırma kaydını oluşturarak merkezi havuzu başlat.</p>
            </div>
          ) : (
            researchItems.map((item) => (
              <div className="module-card" key={item.id}>
                <span className="module-icon">⌕</span>
                <h4>{item.name}</h4>
                <p>{item.note}</p>

                <div className="module-footer">
                  <span className="module-status">{item.date}</span>

                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => deleteResearch(item.id)}
                  >
                    Sil
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </>
  );

  const renderAI = () => (
    <>
      {renderHeader(
        "DDPro AI",
        "Merkezi yapay zeka çalışma ve analiz sistemi."
      )}

      <section className="hero">
        <div className="hero-content">
          <div className="hero-badge">DDPRO AI CORE</div>
          <h2>Analiz eden, araştıran ve karar süreçlerini güçlendiren yapı.</h2>
          <p>
            DDPro AI, proje, tedarik, maliyet, teklif ve sistem verilerinin
            gelecekte merkezi olarak işlenmesi için hazırlanan ana yapıdır.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="modules-grid">
          <div className="module-card">
            <span className="module-icon">✦</span>
            <h4>AI Araştırma</h4>
            <p>Ürün, malzeme, fiyat ve tedarikçi verilerinin analizi.</p>
          </div>

          <div className="module-card">
            <span className="module-icon">◈</span>
            <h4>AI Karar Desteği</h4>
            <p>Toplanan verilerden karşılaştırmalı karar desteği üretir.</p>
          </div>

          <div className="module-card">
            <span className="module-icon">◌</span>
            <h4>AI Operasyon</h4>
            <p>DDPro sistemleri arasında akıllı operasyon akışları için altyapı.</p>
          </div>
        </div>
      </section>
    </>
  );

  const renderOffers = () => (
    <>
      {renderHeader(
        "Teklif Merkezi",
        "Teklif oluşturma ve merkezi teklif yönetim sistemi."
      )}

      <section className="hero">
        <div className="hero-content">
          <div className="hero-badge">TEKLİF YÖNETİM SİSTEMİ</div>

          <h2>Tekliflerini düzenli, hızlı ve merkezi şekilde yönet.</h2>

          <p>
            Proje tekliflerini kayıt altına al, tutarlarını takip et ve tüm
            teklif süreçlerini tek merkezden kontrol et.
          </p>

          <div className="hero-actions">
            <button
              className="primary-button"
              type="button"
              onClick={() => setShowOfferForm((value) => !value)}
            >
              {showOfferForm ? "Formu Kapat" : "Yeni Teklif Oluştur"}
            </button>
          </div>
        </div>
      </section>

      {showOfferForm && (
        <section className="panel">
          <form onSubmit={createOffer}>
            <div className="section-header">
              <div>
                <h3>Yeni Teklif</h3>
                <p>Yeni teklif kaydını merkezi sisteme ekle.</p>
              </div>
            </div>

            <div className="form-grid">
              <input
                value={offerName}
                onChange={(event) => setOfferName(event.target.value)}
                placeholder="Teklif adı"
              />

              <input
                value={offerAmount}
                onChange={(event) => setOfferAmount(event.target.value)}
                placeholder="Teklif tutarı"
              />

              <button className="primary-button" type="submit">
                Kaydet
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="section">
        <div className="modules-grid">
          {offers.length === 0 ? (
            <div className="empty-card">
              <span className="module-icon">€</span>
              <h4>Henüz teklif yok</h4>
              <p>Yeni teklif oluşturarak teklif merkezini başlat.</p>
            </div>
          ) : (
            offers.map((offer) => (
              <div className="module-card" key={offer.id}>
                <span className="module-icon">€</span>
                <h4>{offer.name}</h4>
                <p>{offer.amount}</p>

                <div className="module-footer">
                  <span className="module-status">
                    <span className="status-dot" />
                    {offer.status}
                  </span>

                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => deleteOffer(offer.id)}
                  >
                    Sil
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </>
  );

  const renderSystems = () => (
    <>
      {renderHeader(
        "Sistemler",
        "DDPro merkezi altyapısı ve sistem hareketleri."
      )}

      <section className="stats-grid">
        <div className="stat-card">
          <span>PROJE SİSTEMİ</span>
          <strong>AKTİF</strong>
        </div>

        <div className="stat-card">
          <span>ARAŞTIRMA SİSTEMİ</span>
          <strong>AKTİF</strong>
        </div>

        <div className="stat-card">
          <span>TEKLİF SİSTEMİ</span>
          <strong>AKTİF</strong>
        </div>

        <div className="stat-card">
          <span>DDPRO AI CORE</span>
          <strong>HAZIR</strong>
        </div>
      </section>

      <section className="section">
        <div className="section-header">
          <div>
            <h3>Sistem Hareketleri</h3>
            <p>Merkezi DDPro sistemi tarafından kaydedilen son işlemler.</p>
          </div>
        </div>

        <div className="logs-list">
          {systemLogs.length === 0 ? (
            <div className="empty-card">
              <span className="module-icon">⚙</span>
              <h4>Henüz sistem hareketi yok</h4>
              <p>Yapılan işlemler burada kayıt altına alınacaktır.</p>
            </div>
          ) : (
            systemLogs.map((log) => (
              <div className="log-item" key={log.id}>
                <div>
                  <strong>{log.message}</strong>
                  <span>{log.date}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </>
  );

  const renderContent = () => {
    switch (activePage) {
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

      default:
        return renderDashboard();
    }
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">DD</div>

          <div>
            <strong>DDPro</strong>
            <span>DOĞRU DİZAYN PRO</span>
          </div>
        </div>

        <nav className="navigation">
        {modules.map((module) => (
          <button
            key={module.id}
            className={`nav-item ${activePage === module.id ? "active" : ""}`}
            onClick={() => setActivePage(module.id)}
          >
            <span className="nav-icon">{module.icon}</span>
            <span>{module.title}</span>
          </button>
        ))}
      </nav>
    </aside>

    <main className="main-content">
      {renderContent()}
    </main>
  </div>
);
}

export default App;
