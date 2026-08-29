import { useState } from "react";

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
    <div style={styles.app}>

      <header style={styles.header}>
        <div>
          <div style={styles.logo}>
            DDPro
          </div>

          <div style={styles.subtitle}>
            DOĞRU DİZAYN PRO • AI TRADE
          </div>
        </div>

        <button
          type="button"
          style={styles.profileButton}
          onClick={() => alert("Profil alanı hazırlanıyor.")}
        >
          👤
        </button>
      </header>

      <main style={styles.main}>

        <section style={styles.hero}>

          <div style={styles.badge}>
            DDPRO ECOSYSTEM
          </div>

          <h1 style={styles.title}>
            Doğru Dizayn.
            <br />
            Doğru Çözüm.
            <br />
            <span style={styles.titleAccent}>
              Doğru Sistem.
            </span>
          </h1>

          <p style={styles.description}>
            Yapı, mimari, tasarım, tedarik ve dijital iş süreçlerini
            tek bir akıllı ekosistemde birleştir.
          </p>

          <button
            type="button"
            style={styles.primaryButton}
            onClick={() => {
              setActiveModule(1);
              setOpenModule(1);
              setShowNewProject(false);
            }}
          >
            Sisteme Başla →
          </button>

        </section>

        <section style={styles.section}>

          <div style={styles.sectionHeader}>

            <div>
              <div style={styles.sectionEyebrow}>
                DDPRO PLATFORM
              </div>

              <h2 style={styles.sectionTitle}>
                Ana Modüller
              </h2>
            </div>

            <div style={styles.counter}>
              {activeModule + 1} / {modules.length}
            </div>

          </div>

          <div style={styles.moduleGrid}>

            {modules.map((module, index) => (

              <button
                type="button"
                key={module.title}
                onClick={() => selectModule(index)}
                style={{
                  ...styles.card,
                  ...(activeModule === index
                    ? styles.activeCard
                    : {})
                }}
              >

                <div style={styles.cardIcon}>
                  {module.icon}
                </div>

                <h3 style={styles.cardTitle}>
                  {module.title}
                </h3>

                <p style={styles.cardText}>
                  {module.text}
                </p>

                <div style={styles.cardArrow}>
                  →
                </div>

              </button>

            ))}

          </div>

        </section>

        {openModule === null && (

          <section style={styles.selectedPanel}>

            <div style={styles.panelLabel}>
              SEÇİLİ MODÜL
            </div>

            <div style={styles.panelContent}>

              <div style={styles.panelInfo}>

                <div style={styles.panelIcon}>
                  {active.icon}
                </div>

                <h2 style={styles.panelTitle}>
                  {active.title}
                </h2>

                <p style={styles.panelText}>
                  {active.text}
                </p>

              </div>

              <button
                type="button"
                style={styles.panelButton}
                onClick={openSelectedModule}
              >
                Aç →
              </button>

            </div>

          </section>

        )}

        {openModule !== null && (

          <section style={styles.moduleScreen}>

            <div style={styles.moduleScreenTop}>

              <div style={styles.moduleScreenInfo}>

                <div style={styles.panelLabel}>
                  DDPRO MODÜL
                </div>

                <div style={styles.largeIcon}>
                  {modules[openModule].icon}
                </div>

                <h2 style={styles.moduleScreenTitle}>
                  {modules[openModule].title}
                </h2>

                <p style={styles.moduleScreenText}>
                  {modules[openModule].text}
                </p>

              </div>

              <button
                type="button"
                style={styles.closeButton}
                onClick={closeModule}
              >
                ← Geri
              </button>

            </div>

            {openModule === 0 && (

              <div style={styles.realContent}>

                <div style={styles.contentEyebrow}>
                  DDPRO DASHBOARD
                </div>

                <h3 style={styles.contentTitle}>
                  Genel Bakış
                </h3>

                <div style={styles.dashboardGrid}>

                  <div style={styles.statCard}>
                    <div style={styles.statIcon}>🏗️</div>
                    <div style={styles.statValue}>0</div>
                    <div style={styles.statLabel}>Aktif Proje</div>
                  </div>

                  <div style={styles.statCard}>
                    <div style={styles.statIcon}>📄</div>
                    <div style={styles.statValue}>0</div>
                    <div style={styles.statLabel}>Teklif</div>
                  </div>

                  <div style={styles.statCard}>
                    <div style={styles.statIcon}>📦</div>
                    <div style={styles.statValue}>0</div>
                    <div style={styles.statLabel}>Tedarik</div>
                  </div>

                  <div style={styles.statCard}>
                    <div style={styles.statIcon}>🤖</div>
                    <div style={styles.statValue}>0</div>
                    <div style={styles.statLabel}>AI İşlemi</div>
                  </div>

                </div>

                <div style={styles.overviewPanel}>

                  <div style={styles.contentEyebrow}>
                    SİSTEM DURUMU
                  </div>

                  <div style={styles.statusRow}>
                    <span style={styles.statusDot}>●</span>
                    <span>DDPro ana uygulama arayüzü hazır.</span>
                  </div>

                  <p style={styles.overviewText}>
                    Proje, teklif, tedarik ve AI modülleri
                    merkezi sistem üzerinden yönetilecek.
                  </p>

                </div>

              </div>

            )}

            {openModule === 1 && !showNewProject && (

              <div style={styles.realContent}>

                <div style={styles.contentHeader}>

                  <div>
                    <div style={styles.contentEyebrow}>
                      PROJE YÖNETİMİ
                    </div>

                    <h3 style={styles.contentTitle}>
                      Projeler
                    </h3>
                  </div>

                  <button
                    type="button"
                    style={styles.addButton}
                    onClick={openNewProject}
                  >
                    + Yeni Proje
                  </button>

                </div>

                <div style={styles.emptyState}>

                  <div style={styles.emptyIcon}>🏗️</div>

                  <h3 style={styles.emptyTitle}>
                    Henüz proje yok
                  </h3>

                  <p style={styles.emptyText}>
                    İlk projenizi oluşturarak proje yönetim
                    sistemini başlatabilirsiniz.
                  </p>

                  <button
                    type="button"
                    style={styles.primaryButton}
                    onClick={openNewProject}
                  >
                    + Yeni Proje Oluştur
                  </button>

                </div>

              </div>

            )}

            {openModule === 1 && showNewProject && (

              <div style={styles.realContent}>

                <div style={styles.newProjectHeader}>

                  <div>

                    <div style={styles.contentEyebrow}>
                      PROJE OLUŞTUR
                    </div>

                    <h3 style={styles.contentTitle}>
                      Yeni Proje
                    </h3>

                    <p style={styles.newProjectDescription}>
                      Yeni proje kaydını oluşturarak proje yönetim
                      sürecini başlatın.
                    </p>

                  </div>

                  <button
                    type="button"
                    style={styles.closeButton}
                    onClick={closeNewProject}
                  >
                    ← Projelere Dön
                  </button>

                </div>

                <div style={styles.projectForm}>

                  <div style={styles.formSection}>

                    <div style={styles.formSectionTitle}>
                      Temel Proje Bilgileri
                    </div>

                    <div style={styles.formGrid}>

                      <div style={styles.formGroup}>
                        <label style={styles.formLabel}>
                          Proje Adı
                        </label>

                        <input
                          type="text"
                          style={styles.formInput}
                          placeholder="Proje adını girin"
                        />
                      </div>

                      <div style={styles.formGroup}>
                        <label style={styles.formLabel}>
                          Proje Kodu
                        </label>

                        <input
                          type="text"
                          style={styles.formInput}
                          placeholder="Örn: DDPRO-001"
                        />
                      </div>

                      <div style={styles.formGroup}>
                        <label style={styles.formLabel}>
                          Proje Türü
                        </label>

                        <select style={styles.formInput}>
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

                      <div style={styles.formGroup}>
                        <label style={styles.formLabel}>
                          Proje Durumu
                        </label>

                        <select style={styles.formInput}>
                          <option>Taslak</option>
                          <option>Aktif</option>
                          <option>Teklif Aşaması</option>
                          <option>Planlama</option>
                        </select>
                      </div>

                    </div>

                  </div>

                  <div style={styles.formSection}>

                    <div style={styles.formSectionTitle}>
                      Lokasyon ve Müşteri
                    </div>

                    <div style={styles.formGrid}>

                      <div style={styles.formGroup}>
                        <label style={styles.formLabel}>
                          Müşteri / Firma
                        </label>

                        <input
                          type="text"
                          style={styles.formInput}
                          placeholder="Müşteri veya firma adı"
                        />
                      </div>

                      <div style={styles.formGroup}>
                        <label style={styles.formLabel}>
                          Proje Lokasyonu
                        </label>

                        <input
                          type="text"
                          style={styles.formInput}
                          placeholder="İl / İlçe / Ülke"
                        />
                      </div>

                    </div>

                  </div>

                  <div style={styles.formSection}>

                    <div style={styles.formSectionTitle}>
                      Proje Notu
                    </div>

                    <div style={styles.formGroup}>
                      <label style={styles.formLabel}>
                        Açıklama
                      </label>

                      <textarea
                        style={styles.formTextarea}
                        placeholder="Proje hakkında kısa açıklama girin..."
                      />
                    </div>

                  </div>

                  <div style={styles.formActions}>

                    <button
                      type="button"
                      style={styles.secondaryButton}
                      onClick={closeNewProject}
                    >
                      İptal
                    </button>

                    <button
                      type="button"
                      style={styles.primaryButton}
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

              <div style={styles.realContent}>

                <div style={styles.contentEyebrow}>
                  TEDARİK & ARAŞTIRMA
                </div>

                <h3 style={styles.contentTitle}>
                  Araştırma Merkezi
                </h3>

                <div style={styles.searchBox}>

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
                    style={styles.searchInput}
                    placeholder="Ürün, malzeme veya tedarikçi ara..."
                  />

                  <button
                    type="button"
                    style={styles.searchButton}
                    onClick={handleSearch}
                  >
                    Ara →
                  </button>

                </div>

                <div style={styles.emptyState}>

                  <div style={styles.emptyIcon}>🔎</div>

                  <h3 style={styles.emptyTitle}>
                    Araştırma Merkezi
                  </h3>

                  <p style={styles.emptyText}>
                    Ürün, malzeme, fiyat ve tedarikçi
                    araştırmalarını bu merkez üzerinden
                    karşılaştırabilirsiniz.
                  </p>

                </div>

              </div>

            )}

            {openModule === 3 && (

              <div style={styles.realContent}>

                <div style={styles.contentEyebrow}>
                  YAPAY ZEKÂ
                </div>

                <h3 style={styles.contentTitle}>
                  DDPro AI Asistan
                </h3>

                <div style={styles.aiPanel}>

                  <div style={styles.aiIcon}>🤖</div>

                  <h3 style={styles.emptyTitle}>
                    AI Asistan Hazır
                  </h3>

                  <p style={styles.emptyText}>
                    Araştırma, analiz, tedarik, proje ve
                    operasyon süreçlerinde yapay zekâ
                    desteği burada çalışacak.
                  </p>

                  <button
                    type="button"
                    style={styles.primaryButton}
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

      <footer style={styles.footer}>

        <div>
          © {new Date().getFullYear()} DDPro — DOĞRU DİZAYN PRO
        </div>

        <div style={styles.footerRight}>
          AI TRADE • DIGITAL ECOSYSTEM
        </div>

      </footer>

    </div>
  );
}

const styles = {

  app: {
    minHeight: "100vh",
    background: "#f5f7fa",
    color: "#111827",
    fontFamily:
      "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "22px 32px",
    background: "#111827",
    color: "#ffffff"
  },

  logo: {
    fontSize: "26px",
    fontWeight: "800",
    letterSpacing: "-0.5px"
  },

  subtitle: {
    marginTop: "4px",
    fontSize: "11px",
    letterSpacing: "1.5px",
    opacity: 0.7
  },

  profileButton: {
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(255,255,255,0.08)",
    color: "#ffffff",
    borderRadius: "12px",
    width: "42px",
    height: "42px",
    fontSize: "18px",
    cursor: "pointer"
  },

  main: {
    maxWidth: "1180px",
    margin: "0 auto",
    padding: "50px 24px"
  },

  hero: {
    padding: "56px 40px",
    borderRadius: "28px",
    background: "#ffffff",
    boxShadow: "0 20px 60px rgba(15,23,42,0.08)"
  },

  badge: {
    display: "inline-block",
    padding: "7px 12px",
    borderRadius: "999px",
    background: "#eef2ff",
    color: "#4f46e5",
    fontSize: "11px",
    fontWeight: "700",
    letterSpacing: "1px"
  },

  title: {
    margin: "24px 0 18px",
    fontSize: "clamp(42px, 7vw, 76px)",
    lineHeight: 1.02,
    letterSpacing: "-3px",
    fontWeight: "800"
  },

  titleAccent: {
    color: "#4f46e5"
  },

  description: {
    maxWidth: "650px",
    fontSize: "18px",
    lineHeight: 1.7,
    color: "#64748b"
  },

  primaryButton: {
    marginTop: "24px",
    padding: "14px 22px",
    border: "none",
    borderRadius: "12px",
    background: "#111827",
    color: "#ffffff",
    fontSize: "15px",
    fontWeight: "700",
    cursor: "pointer"
  },

  secondaryButton: {
    marginTop: "24px",
    padding: "14px 22px",
    border: "1px solid #dbe1e8",
    borderRadius: "12px",
    background: "#ffffff",
    color: "#111827",
    fontSize: "15px",
    fontWeight: "700",
    cursor: "pointer"
  },

  section: {
    marginTop: "52px"
  },

  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "end",
    marginBottom: "22px"
  },

  sectionEyebrow: {
    fontSize: "11px",
    fontWeight: "700",
    letterSpacing: "1.5px",
    color: "#64748b"
  },

  sectionTitle: {
    margin: "6px 0 0",
    fontSize: "30px"
  },

  counter: {
    fontSize: "14px",
    fontWeight: "700",
    color: "#64748b"
  },

  moduleGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "16px"
  },

  card: {
    position: "relative",
    textAlign: "left",
    padding: "24px",
    borderRadius: "20px",
    border: "1px solid #e5e7eb",
    background: "#ffffff",
    cursor: "pointer",
    minHeight: "210px"
  },

  activeCard: {
    border: "2px solid #4f46e5",
    boxShadow:
      "0 12px 35px rgba(79,70,229,0.12)"
  },

  cardIcon: {
    fontSize: "28px",
    marginBottom: "18px"
  },

  cardTitle: {
    margin: "0 0 10px",
    fontSize: "19px"
  },

  cardText: {
    margin: 0,
    color: "#64748b",
    lineHeight: 1.6,
    fontSize: "14px"
  },

  cardArrow: {
    position: "absolute",
    right: "20px",
    bottom: "18px",
    fontSize: "20px"
  },

  selectedPanel: {
    marginTop: "28px",
    padding: "28px",
    borderRadius: "22px",
    background: "#111827",
    color: "#ffffff"
  },

  panelLabel: {
    fontSize: "10px",
    fontWeight: "700",
    letterSpacing: "1.5px",
    opacity: 0.6
  },

  panelContent: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "20px",
    marginTop: "18px"
  },

  panelInfo: {
    flex: 1
  },

  panelIcon: {
    fontSize: "30px"
  },

  panelTitle: {
    margin: "8px 0",
    fontSize: "24px"
  },

  panelText: {
    margin: 0,
    color: "#cbd5e1",
    lineHeight: 1.6
  },

  panelButton: {
    padding: "12px 20px",
    border: "none",
    borderRadius: "10px",
    background: "#ffffff",
    color: "#111827",
    fontWeight: "700",
    cursor: "pointer"
  },

  moduleScreen: {
    marginTop: "28px",
    padding: "32px",
    borderRadius: "24px",
    background: "#ffffff",
    boxShadow:
      "0 15px 45px rgba(15,23,42,0.08)"
  },

  moduleScreenTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "24px"
  },

  moduleScreenInfo: {
    flex: 1
  },

  largeIcon: {
    marginTop: "18px",
    fontSize: "42px"
  },

  moduleScreenTitle: {
    margin: "8px 0",
    fontSize: "32px"
  },

  moduleScreenText: {
    color: "#64748b",
    maxWidth: "700px",
    lineHeight: 1.6
  },

  closeButton: {
    height: "42px",
    padding: "0 16px",
    border: "1px solid #e5e7eb",
    borderRadius: "10px",
    background: "#ffffff",
    color: "#111827",
    cursor: "pointer",
    fontWeight: "700"
  },

  realContent: {
    marginTop: "35px",
    paddingTop: "30px",
    borderTop: "1px solid #e5e7eb"
  },

  contentHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "20px"
  },

  contentEyebrow: {
    fontSize: "11px",
    fontWeight: "700",
    letterSpacing: "1.4px",
    color: "#64748b"
  },

  contentTitle: {
    margin: "7px 0 24px",
    fontSize: "26px"
  },

  addButton: {
    padding: "11px 16px",
    border: "none",
    borderRadius: "10px",
    background: "#111827",
    color: "#ffffff",
    fontWeight: "700",
    cursor: "pointer"
  },

  emptyState: {
    marginTop: "24px",
    padding: "50px 24px",
    textAlign: "center",
    border: "1px dashed #cbd5e1",
    borderRadius: "18px"
  },

  emptyIcon: {
    fontSize: "42px"
  },

  emptyTitle: {
    margin: "14px 0 8px",
    fontSize: "21px"
  },

  emptyText: {
    maxWidth: "560px",
    margin: "0 auto",
    color: "#64748b",
    lineHeight: 1.6
  },

  searchBox: {
    display: "flex",
    gap: "10px",
    marginTop: "20px"
  },

  searchInput: {
    flex: 1,
    minWidth: 0,
    padding: "14px 16px",
    border: "1px solid #dbe1e8",
    borderRadius: "11px",
    outline: "none",
    fontSize: "14px",
    boxSizing: "border-box"
  },

  searchButton: {
    padding: "0 20px",
    border: "none",
    borderRadius: "11px",
    background: "#111827",
    color: "#ffffff",
    fontWeight: "700",
    cursor: "pointer"
  },

  aiPanel: {
    padding: "45px 24px",
    textAlign: "center",
    borderRadius: "18px",
    background: "#f8fafc"
  },

  aiIcon: {
    fontSize: "48px"
  },

  dashboardGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "16px"
  },

  statCard: {
    padding: "22px",
    borderRadius: "16px",
    border: "1px solid #e5e7eb",
    background: "#ffffff"
  },

  statIcon: {
    fontSize: "24px"
  },

  statValue: {
    marginTop: "14px",
    fontSize: "30px",
    fontWeight: "800"
  },

  statLabel: {
    marginTop: "4px",
    color: "#64748b",
    fontSize: "13px"
  },

  overviewPanel: {
    marginTop: "20px",
    padding: "22px",
    borderRadius: "16px",
    background: "#f8fafc",
    border: "1px solid #e5e7eb"
  },

  statusRow: {
    display: "flex",
    alignItems: "center",
    gap: "9px",
    marginTop: "12px",
    fontSize: "15px",
    fontWeight: "600"
  },

  statusDot: {
    color: "#16a34a",
    fontSize: "16px"
  },

  overviewText: {
    margin: "10px 0 0",
    color: "#64748b",
    lineHeight: 1.6
  },

  newProjectHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "24px"
  },

  newProjectDescription: {
    margin: "-12px 0 0",
    color: "#64748b",
    lineHeight: 1.6
  },

  projectForm: {
    marginTop: "28px",
    padding: "28px",
    borderRadius: "20px",
    background: "#f8fafc",
    border: "1px solid #e5e7eb"
  },

  formSection: {
    paddingBottom: "28px",
    marginBottom: "28px",
    borderBottom: "1px solid #e5e7eb"
  },

  formSectionTitle: {
    marginBottom: "20px",
    fontSize: "17px",
    fontWeight: "800",
    color: "#111827"
  },

  formGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(240px, 1fr))",
    gap: "18px"
  },

  formGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "8px"
  },

  formLabel: {
    fontSize: "13px",
    fontWeight: "700",
    color: "#334155"
  },

  formInput: {
    width: "100%",
    minHeight: "46px",
    padding: "12px 14px",
    border: "1px solid #dbe1e8",
    borderRadius: "10px",
    background: "#ffffff",
    color: "#111827",
    fontSize: "14px",
    boxSizing: "border-box",
    outline: "none"
  },

  formTextarea: {
    width: "100%",
    minHeight: "130px",
    padding: "14px",
    border: "1px solid #dbe1e8",
    borderRadius: "10px",
    background: "#ffffff",
    color: "#111827",
    fontSize: "14px",
    fontFamily: "inherit",
    lineHeight: 1.6,
    resize: "vertical",
    boxSizing: "border-box",
    outline: "none"
  },

  formActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "12px",
    alignItems: "center"
  },

  footer: {
    display: "flex",
    justifyContent: "space-between",
    gap: "20px",
    padding: "25px 32px",
    borderTop: "1px solid #e5e7eb",
    color: "#64748b",
    fontSize: "12px"
  },

  footerRight: {
    letterSpacing: "1px"
  }

};

export default App;
