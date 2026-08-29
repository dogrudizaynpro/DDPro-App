import { useState } from "react";
import "./styles.css";

const modules = [
  {
    icon: "📊",
    title: "Genel Bakış",
    text: "Projeler, teklifler, tedarik ve sistem aktivitelerini tek ekranda takip et."
  },
  {
    icon: "🏗️",
    title: "Projeler",
    text: "Aktif projelerini oluştur, yönet ve tüm süreçlerini merkezi olarak takip et."
  },
  {
    icon: "🔎",
    title: "Tedarik & Araştırma",
    text: "Ürün, malzeme, fiyat ve tedarikçi araştırmalarını karşılaştır."
  },
  {
    icon: "🤖",
    title: "AI Asistan",
    text: "Araştırma, analiz ve operasyon süreçlerinde yapay zekâ desteği al."
  }
];

function App() {
  const [activeModule, setActiveModule] = useState(0);
  const [openModule, setOpenModule] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showNewProject, setShowNewProject] = useState(false);

  const selectModule = (index) => {
    setActiveModule(index);
    setOpenModule(null);
    setShowNewProject(false);
  };

  const openSelectedModule = () => {
    setOpenModule(activeModule);
    setShowNewProject(false);
  };

  const closeModule = () => {
    setOpenModule(null);
    setShowNewProject(false);
  };

  const openNewProject = () => {
    setShowNewProject(true);
  };

  const closeNewProject = () => {
    setShowNewProject(false);
  };

  const handleSearch = () => {
    if (!searchTerm.trim()) {
      alert("Lütfen ürün, malzeme veya tedarikçi adı girin.");
      return;
    }

    alert(
      `"${searchTerm.trim()}" için araştırma sistemi bir sonraki aşamada aktif edilecek.`
    );
  };

  const active = modules[activeModule];

  return (
    <div className="app">
      <header className="header">
        <div>
          <div className="logo">DDPro</div>
          <div className="subtitle">DOĞRU DİZAYN PRO • AI TRADE</div>
        </div>

        <button
          type="button"
          className="profileButton"
          onClick={() => alert("Profil alanı hazırlanıyor.")}
        >
          👤
        </button>
      </header>

      <main className="main">
        <section className="hero">
          <div className="badge">DDPRO ECOSYSTEM</div>

          <h1 className="title">
            Doğru Dizayn.
            <br />
            Doğru Çözüm.
            <br />
            <span>Doğru Sistem.</span>
          </h1>

          <p className="description">
            Yapı, mimari, tasarım, tedarik ve dijital iş süreçlerini
            tek bir akıllı ekosistemde birleştir.
          </p>

          <button
            type="button"
            className="primaryButton"
            onClick={() => {
              setActiveModule(1);
              setOpenModule(1);
              setShowNewProject(false);
            }}
          >
            Sisteme Başla →
          </button>
        </section>

        <section className="section">
          <div className="sectionHeader">
            <div>
              <div className="sectionEyebrow">DDPRO PLATFORM</div>
              <h2 className="sectionTitle">Ana Modüller</h2>
            </div>

            <div className="counter">
              {activeModule + 1} / {modules.length}
            </div>
          </div>

          <div className="moduleGrid">
            {modules.map((module, index) => (
              <button
                type="button"
                key={module.title}
                onClick={() => selectModule(index)}
                className={`card ${
                  activeModule === index ? "activeCard" : ""
                }`}
              >
                <div className="cardIcon">{module.icon}</div>
                <h3 className="cardTitle">{module.title}</h3>
                <p className="cardText">{module.text}</p>
                <div className="cardArrow">→</div>
              </button>
            ))}
          </div>
        </section>

        {openModule === null && (
          <section className="selectedPanel">
            <div className="panelLabel">SEÇİLİ MODÜL</div>

            <div className="panelContent">
              <div className="panelInfo">
                <div className="panelIcon">{active.icon}</div>
                <h2 className="panelTitle">{active.title}</h2>
                <p className="panelText">{active.text}</p>
              </div>

              <button
                type="button"
                className="panelButton"
                onClick={openSelectedModule}
              >
                Aç →
              </button>
            </div>
          </section>
        )}

        {openModule !== null && (
          <section className="moduleScreen">
            <div className="moduleScreenTop">
              <div className="moduleScreenInfo">
                <div className="panelLabel">DDPRO MODÜL</div>
                <div className="largeIcon">
                  {modules[openModule].icon}
                </div>
                <h2 className="moduleScreenTitle">
                  {modules[openModule].title}
                </h2>
                <p className="moduleScreenText">
                  {modules[openModule].text}
                </p>
              </div>

              <button
                type="button"
                className="closeButton"
                onClick={closeModule}
              >
                ← Geri
              </button>
            </div>

            {openModule === 0 && (
              <div className="realContent">
                <div className="contentEyebrow">DDPRO DASHBOARD</div>
                <h3 className="contentTitle">Genel Bakış</h3>

                <div className="dashboardGrid">
                  <div className="statCard">
                    <div className="statIcon">🏗️</div>
                    <div className="statValue">0</div>
                    <div className="statLabel">Aktif Proje</div>
                  </div>

                  <div className="statCard">
                    <div className="statIcon">📄</div>
                    <div className="statValue">0</div>
                    <div className="statLabel">Teklif</div>
                  </div>

                  <div className="statCard">
                    <div className="statIcon">📦</div>
                    <div className="statValue">0</div>
                    <div className="statLabel">Tedarik</div>
                  </div>

                  <div className="statCard">
                    <div className="statIcon">🤖</div>
                    <div className="statValue">0</div>
                    <div className="statLabel">AI İşlemi</div>
                  </div>
                </div>
              </div>
            )}

            {openModule === 1 && !showNewProject && (
              <div className="realContent">
                <div className="contentHeader">
                  <div>
                    <div className="contentEyebrow">PROJE YÖNETİMİ</div>
                    <h3 className="contentTitle">Projeler</h3>
                  </div>

                  <button
                    type="button"
                    className="addButton"
                    onClick={openNewProject}
                  >
                    + Yeni Proje
                  </button>
                </div>

                <div className="emptyState">
                  <div className="emptyIcon">🏗️</div>
                  <h3 className="emptyTitle">Henüz proje yok</h3>
                  <p className="emptyText">
                    İlk projenizi oluşturarak proje yönetim sistemini
                    başlatabilirsiniz.
                  </p>

                  <button
                    type="button"
                    className="primaryButton"
                    onClick={openNewProject}
                  >
                    + Yeni Proje Oluştur
                  </button>
                </div>
              </div>
            )}

            {openModule === 1 && showNewProject && (
              <div className="realContent">
                <div className="newProjectHeader">
                  <div>
                    <div className="contentEyebrow">PROJE OLUŞTUR</div>
                    <h3 className="contentTitle">Yeni Proje</h3>
                    <p className="newProjectDescription">
                      Yeni proje kaydını oluşturarak proje yönetim sürecini
                      başlatın.
                    </p>
                  </div>

                  <button
                    type="button"
                    className="closeButton"
                    onClick={closeNewProject}
                  >
                    ← Projelere Dön
                  </button>
                </div>

                <div className="projectForm">
                  <div className="formSection">
                    <div className="formSectionTitle">
                      Temel Proje Bilgileri
                    </div>

                    <div className="formGrid">
                      <div className="formGroup">
                        <label>Proje Adı</label>
                        <input
                          type="text"
                          placeholder="Proje adını girin"
                        />
                      </div>

                      <div className="formGroup">
                        <label>Proje Kodu</label>
                        <input
                          type="text"
                          placeholder="Örn: DDPRO-001"
                        />
                      </div>

                      <div className="formGroup">
                        <label>Proje Türü</label>
                        <select>
                          <option>Proje türü seçin</option>
                          <option>İç Mekân</option>
                          <option>Dış Cephe</option>
                          <option>Tavan</option>
                          <option>Ofis</option>
                          <option>Mağaza</option>
                          <option>Otel</option>
                          <option>Restoran</option>
                          <option>Diğer</option>
                        </select>
                      </div>

                      <div className="formGroup">
                        <label>Proje Durumu</label>
                        <select>
                          <option>Taslak</option>
                          <option>Aktif</option>
                          <option>Teklif Aşaması</option>
                          <option>Planlama</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="formSection">
                    <div className="formSectionTitle">
                      Lokasyon ve Müşteri
                    </div>

                    <div className="formGrid">
                      <div className="formGroup">
                        <label>Müşteri / Firma</label>
                        <input
                          type="text"
                          placeholder="Müşteri veya firma adı"
                        />
                      </div>

                      <div className="formGroup">
                        <label>Proje Lokasyonu</label>
                        <input
                          type="text"
                          placeholder="İl / İlçe / Ülke"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="formSection">
                    <div className="formSectionTitle">Proje Notu</div>

                    <div className="formGroup">
                      <label>Açıklama</label>
                      <textarea placeholder="Proje hakkında kısa açıklama girin..." />
                    </div>
                  </div>

                  <div className="formActions">
                    <button
                      type="button"
                      className="secondaryButton"
                      onClick={closeNewProject}
                    >
                      İptal
                    </button>

                    <button
                      type="button"
                      className="primaryButton"
                      onClick={() =>
                        alert(
                          "Proje kayıt sistemi bir sonraki aşamada aktif edilecek."
                        )
                      }
                    >
                      Projeyi Oluştur →
                    </button>
                  </div>
                </div>
              </div>
            )}

            {openModule === 2 && (
              <div className="realContent">
                <div className="contentEyebrow">TEDARİK & ARAŞTIRMA</div>
                <h3 className="contentTitle">Araştırma Merkezi</h3>

                <div className="searchBox">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(event) =>
                      setSearchTerm(event.target.value)
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        handleSearch();
                      }
                    }}
                    placeholder="Ürün, malzeme veya tedarikçi ara..."
                  />

                  <button
                    type="button"
                    className="searchButton"
                    onClick={handleSearch}
                  >
                    Ara →
                  </button>
                </div>

                <div className="emptyState">
                  <div className="emptyIcon">🔎</div>
                  <h3 className="emptyTitle">Araştırma Merkezi</h3>
                  <p className="emptyText">
                    Ürün, malzeme, fiyat ve tedarikçi araştırmalarını bu
                    merkez üzerinden karşılaştırabilirsiniz.
                  </p>
                </div>
              </div>
            )}

            {openModule === 3 && (
              <div className="realContent">
                <div className="contentEyebrow">YAPAY ZEKÂ</div>
                <h3 className="contentTitle">DDPro AI Asistan</h3>

                <div className="aiPanel">
                  <div className="aiIcon">🤖</div>
                  <h3 className="emptyTitle">AI Asistan Hazır</h3>
                  <p className="emptyText">
                    Araştırma, analiz, tedarik, proje ve operasyon
                    süreçlerinde yapay zekâ desteği burada çalışacak.
                  </p>

                  <button
                    type="button"
                    className="primaryButton"
                    onClick={() =>
                      alert(
                        "AI Asistan bir sonraki aşamada aktif edilecek."
                      )
                    }
                  >
                    AI Asistanı Aç →
                  </button>
                </div>
              </div>
            )}
          </section>
        )}
      </main>

      <footer className="footer">
        <div>
          © {new Date().getFullYear()} DDPro — DOĞRU DİZAYN PRO
        </div>

        <div className="footerRight">
          AI TRADE • DIGITAL ECOSYSTEM
        </div>
      </footer>
    </div>
  );
}

export default App;
