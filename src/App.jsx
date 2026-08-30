import { useMemo, useState } from "react";

const STORAGE_KEYS = {
  projects: "ddpro_projects_v1",
  research: "ddpro_research_v1",
  profile: "ddpro_profile_v1",
  offers: "ddpro_offers_v1",
  memory: "ddpro_memory_v1",
  systemLogs: "ddpro_system_logs_v1",
  integrations: "ddpro_integrations_v1",
};
const modules = [
  {
    id: "dashboard",
    icon: "◈",
    title: "Genel Bakış",
    short: "Sistem Merkezi",
    text: "Projeler, teklifler, tedarik, araştırma ve sistem aktivitelerini tek merkezden takip et.",
  },
  {
    id: "projects",
    icon: "▣",
    title: "Projeler",
    short: "Proje Yönetimi",
    text: "Aktif projelerini oluştur, yönet, düzenle ve tüm süreçlerini merkezi olarak takip et.",
  },
  {
    id: "research",
    icon: "⌕",
    title: "Tedarik & Araştırma",
    short: "Araştırma Merkezi",
    text: "Ürün, malzeme, fiyat ve tedarikçi araştırmalarını kayıt altına al ve karşılaştır.",
  },
  {
    id: "ai",
    icon: "✦",
    title: "DDPro AI",
    short: "AI Asistan",
    text: "Proje, araştırma ve operasyon verilerini analiz etmek için merkezi yapay zekâ çalışma alanı.",
  },
  {
    id: "offers",
    icon: "€",
    title: "Teklifler",
    short: "Teklif Sistemi",
    text: "Maliyetleri, metrajları, işçilikleri ve teklif süreçlerini profesyonel şekilde yönet.",
  },
  {
    id: "systems",
    icon: "◉",
    title: "Sistemlerimiz",
    short: "6 Ana Sistem",
    text: "DDPro altyapısında çalışan tüm ana sistemleri tek merkezden görüntüle ve yönet.",
  },
];

const systemList = [
  {
    id: "projects",
    icon: "▣",
    title: "Proje Yönetim Sistemi",
    text: "Proje oluşturma, takip, durum yönetimi ve süreç kontrol merkezi.",
  },
  {
    id: "research",
    icon: "⌕",
    title: "Tedarik & Araştırma Sistemi",
    text: "Ürün, malzeme, fiyat, tedarikçi ve pazar araştırma merkezi.",
  },
  {
    id: "ai",
    icon: "✦",
    title: "DDPro AI Sistemi",
    text: "Verileri analiz eden ve operasyon süreçlerine destek veren AI merkezi.",
  },
  {
    id: "offers",
    icon: "€",
    title: "Teklif & Maliyet Sistemi",
    text: "Metraj, işçilik, malzeme ve teklif hesaplama yönetim sistemi.",
  },
  {
    id: "data",
    icon: "▤",
    title: "Veri & Hafıza Sistemi",
    text: "Sistem verilerinin düzenli, erişilebilir ve merkezi şekilde yönetildiği alan.",
  },
  {
    id: "automation",
    icon: "⚙",
    title: "Otomasyon Sistemi",
    text: "Tekrarlayan operasyonları düzenlemek ve sistemler arası akışı güçlendirmek için otomasyon merkezi.",
  },
];

const getStoredData = (key, fallback) => {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

function App() {
  const [activePage, setActivePage] = useState("dashboard");
  const [search, setSearch] = useState("");
  const [projects, setProjects] = useState(() =>
    getStoredData(STORAGE_KEYS.projects, [
      {
        id: 1,
        name: "Göztepe MLP",
        status: "Aktif",
        type: "Metal Tavan",
      },
    ])
  );

  const [researchItems, setResearchItems] = useState(() =>
    getStoredData(STORAGE_KEYS.research, [])
  );

  const [showProjectForm, setShowProjectForm] = useState(false);
  const [showResearchForm, setShowResearchForm] = useState(false);

  const [projectName, setProjectName] = useState("");
  const [projectType, setProjectType] = useState("");

  const [researchName, setResearchName] = useState("");
  const [researchNote, setResearchNote] = useState("");

  const filteredModules = useMemo(() => {
    const value = search.trim().toLocaleLowerCase("tr");

    if (!value) return modules;

    return modules.filter((item) => {
      return (
        item.title.toLocaleLowerCase("tr").includes(value) ||
        item.short.toLocaleLowerCase("tr").includes(value) ||
        item.text.toLocaleLowerCase("tr").includes(value)
      );
    });
  }, [search]);

  const saveProjects = (nextProjects) => {
    setProjects(nextProjects);
    localStorage.setItem(STORAGE_KEYS.projects, JSON.stringify(nextProjects));
  };

  const saveResearch = (nextResearch) => {
    setResearchItems(nextResearch);
    localStorage.setItem(
      STORAGE_KEYS.research,
      JSON.stringify(nextResearch)
    );
  };

  const createProject = (event) => {
    event.preventDefault();

    const name = projectName.trim();

    if (!name) return;

    const nextProject = {
      id: Date.now(),
      name,
      status: "Aktif",
      type: projectType.trim() || "Genel Proje",
    };

    saveProjects([nextProject, ...projects]);

    setProjectName("");
    setProjectType("");
    setShowProjectForm(false);
  };

  const createResearch = (event) => {
    event.preventDefault();

    const name = researchName.trim();

    if (!name) return;

    const nextResearch = {
      id: Date.now(),
      name,
      note: researchNote.trim() || "Araştırma kaydı oluşturuldu.",
      date: new Date().toLocaleDateString("tr-TR"),
    };

    saveResearch([nextResearch, ...researchItems]);

    setResearchName("");
    setResearchNote("");
    setShowResearchForm(false);
  };

  const deleteProject = (id) => {
    saveProjects(projects.filter((project) => project.id !== id));
  };

  const deleteResearch = (id) => {
    saveResearch(researchItems.filter((item) => item.id !== id));
  };

  const renderHeader = (title, description) => (
    <div className="topbar">
      <div className="page-title">
        <h1>{title}</h1>
        <p>{description}</p>
      </div>

      <div className="top-actions">
        <div className="search-box">
          <span>⌕</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Sistemde ara..."
          />
        </div>

        <button
          className="icon-button"
          type="button"
          onClick={() => {
            setSearch("");
            setActivePage("dashboard");
          }}
          aria-label="Ana sayfaya dön"
        >
          ⌂
        </button>
      </div>
    </div>
  );

  const renderDashboard = () => (
    <>
      {renderHeader(
        "DDPro Sistem Merkezi",
        "Tüm operasyonlarını, projelerini ve sistemlerini tek merkezden yönet."
      )}

      <section className="hero">
        <div className="hero-content">
          <div className="hero-badge">
            <span>●</span>
            DDPRO CENTRAL ECOSYSTEM
          </div>

          <h2>
            Doğru Dizayn Pro’nun tüm operasyonları artık tek merkezde.
          </h2>

          <p>
            Projeler, tedarik, araştırma, teklifler, yapay zekâ ve sistem
            altyapısı tek bir merkezi yapı altında birbirine bağlı şekilde
            yönetilir.
          </p>

          <div className="hero-actions">
            <button
              className="primary-button"
              type="button"
              onClick={() => setActivePage("projects")}
            >
              Projeleri Yönet
            </button>

            <button
              className="secondary-button"
              type="button"
              onClick={() => setActivePage("systems")}
            >
              Sistemlerimizi Gör
            </button>
          </div>
        </div>
      </section>

      <section className="stats-grid">
        <div className="stat-card">
          <div className="stat-top">
            <span className="stat-label">Aktif Projeler</span>
            <span className="stat-icon">▣</span>
          </div>
          <div className="stat-value">{projects.length}</div>
          <div className="stat-change">Sistem üzerinden takip ediliyor</div>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <span className="stat-label">Araştırmalar</span>
            <span className="stat-icon">⌕</span>
          </div>
          <div className="stat-value">{researchItems.length}</div>
          <div className="stat-change">Merkezi araştırma havuzu</div>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <span className="stat-label">Ana Sistemler</span>
            <span className="stat-icon">◉</span>
          </div>
          <div className="stat-value">6</div>
          <div className="stat-change">Birbirine entegre altyapı</div>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <span className="stat-label">Sistem Durumu</span>
            <span className="stat-icon">✓</span>
          </div>
          <div className="stat-value">Aktif</div>
          <div className="stat-change">Merkezi yapı çalışıyor</div>
        </div>
      </section>

      <section className="section">
        <div className="section-header">
          <div>
            <h3>Merkezi Çalışma Alanları</h3>
            <p>
              DDPro ekosistemindeki ana modüllere buradan doğrudan ulaşabilirsin.
            </p>
          </div>
        </div>

        <div className="modules-grid">
          {filteredModules.map((module) => (
            <button
              className="module-card"
              type="button"
              key={module.id}
              onClick={() => setActivePage(module.id)}
            >
              <span className="module-icon">{module.icon}</span>

              <h4>{module.title}</h4>

              <p>{module.text}</p>

              <div className="module-footer">
                <span className="module-status">
                  <span className="status-dot" />
                  {module.short}
                </span>

                <span className="module-arrow">→</span>
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="bottom-grid">
        <div className="panel">
          <div className="section-header">
            <div>
              <h3>Son Projeler</h3>
              <p>Merkezi sistemde kayıtlı son proje hareketleri.</p>
            </div>
          </div>

          {projects.length === 0 ? (
            <p className="module-card p">
              Henüz proje kaydı bulunmuyor.
            </p>
          ) : (
            <div className="nav">
              {projects.slice(0, 4).map((project) => (
                <button
                  key={project.id}
                  className="nav-item"
                  type="button"
                  onClick={() => setActivePage("projects")}
                >
                  <span className="nav-icon">▣</span>
                  <span className="nav-label">
                    {project.name} — {project.type}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="panel">
          <div className="section-header">
            <div>
              <h3>Hızlı Erişim</h3>
              <p>Sık kullanılan merkezi işlemler.</p>
            </div>
          </div>

          <div className="nav">
            <button
              className="nav-item"
              type="button"
              onClick={() => setActivePage("projects")}
            >
              <span className="nav-icon">＋</span>
              <span className="nav-label">Yeni Proje</span>
            </button>

            <button
              className="nav-item"
              type="button"
              onClick={() => setActivePage("research")}
            >
              <span className="nav-icon">⌕</span>
              <span className="nav-label">Yeni Araştırma</span>
            </button>

            <button
              className="nav-item"
              type="button"
              onClick={() => setActivePage("offers")}
            >
              <span className="nav-icon">€</span>
              <span className="nav-label">Teklif Merkezi</span>
            </button>
          </div>
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
              onClick={() => setShowProjectForm(!showProjectForm)}
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

            <div className="hero-actions">
              <input
                value={projectName}
                onChange={(event) => setProjectName(event.target.value)}
                placeholder="Proje adı"
                style={{
                  flex: 1,
                  minWidth: "220px",
                  minHeight: "45px",
                  padding: "0 14px",
                  borderRadius: "12px",
                  border: "1px solid rgba(148, 163, 184, 0.15)",
                  background: "rgba(13, 27, 47, 0.82)",
                  color: "#edf3ff",
                }}
              />

              <input
                value={projectType}
                onChange={(event) => setProjectType(event.target.value)}
                placeholder="Proje türü"
                style={{
                  flex: 1,
                  minWidth: "220px",
                  minHeight: "45px",
                  padding: "0 14px",
                  borderRadius: "12px",
                  border: "1px solid rgba(148, 163, 184, 0.15)",
                  background: "rgba(13, 27, 47, 0.82)",
                  color: "#edf3ff",
                }}
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
          {projects.map((project) => (
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
          ))}
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
              onClick={() => setShowResearchForm(!showResearchForm)}
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

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              <input
                value={researchName}
                onChange={(event) => setResearchName(event.target.value)}
                placeholder="Araştırma başlığı"
                style={{
                  minHeight: "45px",
                  padding: "0 14px",
                  borderRadius: "12px",
                  border: "1px solid rgba(148, 163, 184, 0.15)",
                  background: "rgba(13, 27, 47, 0.82)",
                  color: "#edf3ff",
                }}
              />

              <textarea
                value={researchNote}
                onChange={(event) => setResearchNote(event.target.value)}
                placeholder="Araştırma notu"
                rows="5"
                style={{
                  padding: "14px",
                  borderRadius: "12px",
                  border: "1px solid rgba(148, 163, 184, 0.15)",
                  background: "rgba(13, 27, 47, 0.82)",
                  color: "#edf3ff",
                  resize: "vertical",
                }}
              />

              <div>
                <button className="primary-button" type="submit">
                  Araştırmayı Kaydet
                </button>
              </div>
            </div>
          </form>
        </section>
      )}

      <section className="section">
        <div className="modules-grid">
          {researchItems.length === 0 ? (
            <div className="module-card">
              <span className="module-icon">⌕</span>
              <h4>Henüz araştırma yok</h4>
              <p>
                İlk ürün, malzeme veya tedarikçi araştırmanı buradan sisteme
                ekleyebilirsin.
              </p>
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
        "DDPro ekosisteminin merkezi yapay zekâ çalışma alanı."
      )}

      <section className="hero">
        <div className="hero-content">
          <div className="hero-badge">DDPRO ARTIFICIAL INTELLIGENCE</div>

          <h2>Verileri analiz eden merkezi yapay zekâ çalışma alanı.</h2>

          <p>
            Projeler, araştırmalar ve operasyon verileri büyüdükçe DDPro AI bu
            merkezi yapının analiz ve karar destek katmanını oluşturacak.
          </p>
        </div>
      </section>

      <section className="modules-grid">
        <div className="module-card">
          <span className="module-icon">✦</span>
          <h4>Proje Analizi</h4>
          <p>Proje verilerini analiz etmek için hazırlanan merkezi AI alanı.</p>
        </div>

        <div className="module-card">
          <span className="module-icon">⌕</span>
          <h4>Araştırma Analizi</h4>
          <p>
            Tedarik, ürün ve fiyat araştırmalarını karşılaştırmaya yönelik AI
            çalışma alanı.
          </p>
        </div>

        <div className="module-card">
          <span className="module-icon">⚙</span>
          <h4>Operasyon Desteği</h4>
          <p>
            Tekrarlayan operasyonları ve merkezi iş akışlarını analiz etmek için
            sistem altyapısı.
          </p>
        </div>
      </section>
    </>
  );

  const renderOffers = () => (
    <>
      {renderHeader(
        "Teklifler",
        "Metraj, maliyet, işçilik ve teklif süreçlerinin merkezi yönetim alanı."
      )}

      <section className="hero">
        <div className="hero-content">
          <div className="hero-badge">TEKLİF & MALİYET SİSTEMİ</div>

          <h2>Teklif süreçlerini daha düzenli ve profesyonel yönet.</h2>

          <p>
            Malzeme, işçilik, metraj ve diğer maliyet kalemlerini merkezi
            sistemde toplayarak teklif altyapısını güçlendir.
          </p>
        </div>
      </section>

      <section className="modules-grid">
        <div className="module-card">
          <span className="module-icon">€</span>
          <h4>Maliyet Hesaplama</h4>
          <p>Proje maliyet kalemlerinin merkezi hesaplama alanı.</p>
        </div>

        <div className="module-card">
          <span className="module-icon">▤</span>
          <h4>Metraj Yönetimi</h4>
          <p>Metraj verilerini düzenli ve kontrol edilebilir yapıda yönet.</p>
        </div>

        <div className="module-card">
          <span className="module-icon">✓</span>
          <h4>Teklif Süreci</h4>
          <p>Hazırlanan teklifleri proje süreçleriyle merkezi olarak ilişkilendir.</p>
        </div>
      </section>
    </>
  );

  const renderSystems = () => (
    <>
      {renderHeader(
        "Sistemlerimiz",
        "DDPro merkezi ekosisteminde birbirine bağlı çalışan 6 ana sistem."
      )}

      <section className="hero">
        <div className="hero-content">
          <div className="hero-badge">DDPRO CENTRAL ECOSYSTEM</div>

          <h2>6 ana sistem. Tek merkez. Birbirine bağlı güçlü altyapı.</h2>

          <p>
            DDPro'nun ana amacı, farklı operasyonları birbirinden kopuk araçlar
            halinde değil, merkezi veri ve çalışma yapısı altında birbirine
            entegre şekilde yönetmektir.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="modules-grid">
          {systemList.map((system) => (
            <button
              className="module-card"
              key={system.id}
              type="button"
              onClick={() => {
                if (
                  ["projects", "research", "ai", "offers"].includes(system.id)
                ) {
                  setActivePage(system.id);
                }
              }}
            >
              <span className="module-icon">{system.icon}</span>

              <h4>{system.title}</h4>

              <p>{system.text}</p>

              <div className="module-footer">
                <span className="module-status">
                  <span className="status-dot" />
                  Sistem Merkezi
                </span>

                <span className="module-arrow">→</span>
              </div>
            </button>
          ))}
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
    <div className="app">
      <aside className="sidebar">
        <div className="logo">
          <div className="logo-mark">D</div>

          <div className="logo-text">
            <strong>DDPro</strong>
            <span>Central Ecosystem</span>
          </div>
        </div>

        <nav className="nav">
          <button
            className={`nav-item ${
              activePage === "dashboard" ? "active" : ""
            }`}
            type="button"
            onClick={() => setActivePage("dashboard")}
          >
            <span className="nav-icon">◈</span>
            <span className="nav-label">Genel Bakış</span>
          </button>

          <button
            className={`nav-item ${
              activePage === "projects" ? "active" : ""
            }`}
            type="button"
            onClick={() => setActivePage("projects")}
          >
            <span className="nav-icon">▣</span>
            <span className="nav-label">Projeler</span>
          </button>

          <button
            className={`nav-item ${
              activePage === "research" ? "active" : ""
            }`}
            type="button"
            onClick={() => setActivePage("research")}
          >
            <span className="nav-icon">⌕</span>
            <span className="nav-label">Tedarik & Araştırma</span>
          </button>

          <button
            className={`nav-item ${activePage === "ai" ? "active" : ""}`}
            type="button"
            onClick={() => setActivePage("ai")}
          >
            <span className="nav-icon">✦</span>
            <span className="nav-label">DDPro AI</span>
          </button>

          <button
            className={`nav-item ${
              activePage === "offers" ? "active" : ""
            }`}
            type="button"
            onClick={() => setActivePage("offers")}
          >
            <span className="nav-icon">€</span>
            <span className="nav-label">Teklifler</span>
          </button>

          <button
            className={`nav-item ${
              activePage === "systems" ? "active" : ""
            }`}
            type="button"
            onClick={() => setActivePage("systems")}
          >
            <span className="nav-icon">◉</span>
            <span className="nav-label">Sistemlerimiz</span>
          </button>
        </nav>

        <div className="sidebar-bottom">
          <div className="user-card">
            <div className="avatar">DD</div>

            <div className="user-info">
              <strong>Doğru Dizayn Pro</strong>
              <span>Merkezi Sistem Aktif</span>
            </div>
          </div>
        </div>
      </aside>

      <main className="main-content">{renderContent()}</main>
    </div>
  );
}

export default App;
