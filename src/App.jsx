import { useMemo, useState } from "react";

const STORAGE_KEYS = {
  projects: "ddpro_projects_v1",
  research: "ddpro_research_v1",
  profile: "ddpro_profile_v1",
};

const modules = [
  {
    id: "dashboard",
    icon: "⌂",
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
    short: "Akıllı Araştırma",
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
    id: "database",
    icon: "◈",
    title: "Veri & Sistem",
    short: "Merkezi Altyapı",
    text: "DDPro ekosistemindeki verileri, kayıtları ve operasyonel sistem altyapısını tek merkezde tut.",
  },
];

const stats = [
  {
    label: "Aktif Projeler",
    value: "12",
    change: "+3 bu ay",
    icon: "▣",
  },
  {
    label: "Bekleyen Araştırma",
    value: "28",
    change: "Sistem aktif",
    icon: "⌕",
  },
  {
    label: "Hazırlanan Teklif",
    value: "9",
    change: "+2 bu hafta",
    icon: "€",
  },
  {
    label: "Sistem Durumu",
    value: "%100",
    change: "Tüm sistemler aktif",
    icon: "●",
  },
];

function App() {
  const [activeModule, setActiveModule] = useState("dashboard");
  const [search, setSearch] = useState("");
  const [notification, setNotification] = useState("");

  const filteredModules = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return modules;
    }

    return modules.filter((module) => {
      return [
        module.title,
        module.short,
        module.text,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [search]);

  const activeModuleData =
    modules.find((module) => module.id === activeModule) || modules[0];

  const handleModuleClick = (module) => {
    setActiveModule(module.id);
    setNotification(`${module.title} modülü seçildi.`);

    window.setTimeout(() => {
      setNotification("");
    }, 2500);
  };

  const handleNewProject = () => {
    setActiveModule("projects");
    setNotification("Yeni proje çalışma alanı açıldı.");

    window.setTimeout(() => {
      setNotification("");
    }, 2500);
  };

  const handleResearch = () => {
    setActiveModule("research");
    setNotification("Tedarik ve araştırma merkezi açıldı.");

    window.setTimeout(() => {
      setNotification("");
    }, 2500);
  };

  const handleSearch = (event) => {
    setSearch(event.target.value);
  };

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="logo">
          <div className="logo-mark">D</div>

          <div className="logo-text">
            <strong>DDPro</strong>
            <span>DOĞRU DİZAYN PRO</span>
          </div>
        </div>

        <nav className="nav">
          {modules.map((module) => (
            <button
              key={module.id}
              type="button"
              className={`nav-item ${
                activeModule === module.id ? "active" : ""
              }`}
              onClick={() => handleModuleClick(module)}
            >
              <span className="nav-icon">{module.icon}</span>
              <span className="nav-label">{module.title}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="user-card">
            <div className="avatar">D</div>

            <div className="user-info">
              <strong>Doğru Dizayn Pro</strong>
              <span>Merkezi Yönetim Sistemi</span>
            </div>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="page-title">
            <h1>{activeModuleData.title}</h1>
            <p>
              DDPro merkezi ekosistemini tek noktadan yönet, takip et ve
              geliştir.
            </p>
          </div>

          <div className="top-actions">
            <div className="search-box">
              <span>⌕</span>

              <input
                type="search"
                value={search}
                onChange={handleSearch}
                placeholder="Sistem içinde ara..."
                aria-label="Sistem içinde ara"
              />
            </div>

            <button
              type="button"
              className="icon-button"
              onClick={() =>
                setNotification("Bildirim merkezi şu anda aktif.")
              }
              aria-label="Bildirimler"
            >
              🔔
            </button>
          </div>
        </header>

        <section className="hero">
          <div className="hero-content">
            <div className="hero-badge">
              ● DDPRO CENTRAL ECOSYSTEM
            </div>

            <h2>
              Doğru sistem.
              <br />
              Doğru çözüm.
              <br />
              Tek merkez.
            </h2>

            <p>
              DDPro; proje yönetimi, teklif, tedarik, araştırma, yapay zekâ
              ve veri altyapısını tek bir merkezi ekosistem altında bir araya
              getirir. Tüm süreçler daha kontrollü, daha hızlı ve daha
              sürdürülebilir şekilde yönetilir.
            </p>

            <div className="hero-actions">
              <button
                type="button"
                className="primary-button"
                onClick={handleNewProject}
              >
                + Yeni Proje Oluştur
              </button>

              <button
                type="button"
                className="secondary-button"
                onClick={handleResearch}
              >
                Araştırma Merkezine Git →
              </button>
            </div>
          </div>
        </section>

        <section className="stats-grid">
          {stats.map((stat) => (
            <article className="stat-card" key={stat.label}>
              <div className="stat-top">
                <span className="stat-label">{stat.label}</span>
                <span className="stat-icon">{stat.icon}</span>
              </div>

              <div className="stat-value">{stat.value}</div>

              <div className="stat-change">● {stat.change}</div>
            </article>
          ))}
        </section>

        <section className="section">
          <div className="section-header">
            <div>
              <h3>DDPro Sistemleri</h3>
              <p>
                Tüm operasyonlarını yöneten 6 merkezi sistem tek bir
                ekosistemde.
              </p>
            </div>
          </div>

          <div className="modules-grid">
            {filteredModules.map((module) => (
              <button
                type="button"
                className="module-card"
                key={module.id}
                onClick={() => handleModuleClick(module)}
              >
                <div className="module-icon">{module.icon}</div>

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
                <h3>Merkezi Operasyon</h3>
                <p>
                  Proje, teklif ve araştırma süreçleri DDPro merkezi üzerinden
                  yönetilmektedir.
                </p>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gap: "14px",
                marginTop: "10px",
              }}
            >
              <div className="user-card">
                <div className="avatar">01</div>

                <div className="user-info">
                  <strong>Proje Yönetimi</strong>
                  <span>Aktif proje süreçleri merkezi olarak takip ediliyor.</span>
                </div>
              </div>

              <div className="user-card">
                <div className="avatar">02</div>

                <div className="user-info">
                  <strong>Tedarik & Araştırma</strong>
                  <span>Ürün, malzeme, fiyat ve tedarikçi verileri işleniyor.</span>
                </div>
              </div>

              <div className="user-card">
                <div className="avatar">03</div>

                <div className="user-info">
                  <strong>DDPro AI</strong>
                  <span>Merkezi yapay zekâ destekli analiz altyapısı hazır.</span>
                </div>
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="section-header">
              <div>
                <h3>Sistem Durumu</h3>
                <p>Merkezi altyapı canlı olarak çalışıyor.</p>
              </div>
            </div>

            <div
              style={{
                marginTop: "18px",
                padding: "18px",
                border: "1px solid rgba(70, 200, 128, 0.18)",
                borderRadius: "15px",
                background: "rgba(70, 200, 128, 0.05)",
              }}
            >
              <div
                style={{
                  fontSize: "12px",
                  color: "#7f92aa",
                }}
              >
                Genel Sistem Sağlığı
              </div>

              <div
                style={{
                  marginTop: "8px",
                  fontSize: "30px",
                  fontWeight: 800,
                  color: "#edf3ff",
                }}
              >
                %100
              </div>

              <div
                style={{
                  marginTop: "8px",
                  fontSize: "12px",
                  color: "#55c68a",
                }}
              >
                ● 6 ana sistem aktif
              </div>
            </div>

            <div
              style={{
                marginTop: "18px",
                color: "#73869f",
                fontSize: "12px",
                lineHeight: 1.7,
              }}
            >
              Veri altyapısı, proje yönetimi ve merkezi operasyon sistemi
              birbirine bağlı şekilde çalışmaktadır.
            </div>
          </div>
        </section>

        {notification && (
          <div
            style={{
              position: "fixed",
              right: "30px",
              bottom: "30px",
              zIndex: 100,
              padding: "14px 18px",
              border: "1px solid rgba(96, 165, 250, 0.25)",
              borderRadius: "14px",
              background: "rgba(12, 24, 41, 0.96)",
              color: "#edf3ff",
              boxShadow: "0 18px 50px rgba(0, 0, 0, 0.3)",
              fontSize: "13px",
              fontWeight: 600,
            }}
          >
            {notification}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
