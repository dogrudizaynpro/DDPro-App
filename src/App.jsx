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

  return (
    <div style={styles.app}>
      <header style={styles.header}>
        <div>
          <div style={styles.logo}>DDPro</div>
          <div style={styles.subtitle}>
            DOĞRU DİZAYN PRO • AI TRADE
          </div>
        </div>

        <button style={styles.profileButton}>
          👤
        </button>
      </header>

      <main style={styles.main}>
        <section style={styles.hero}>
          <div style={styles.badge}>DDPRO ECOSYSTEM</div>

          <h1 style={styles.title}>
            Doğru Dizayn.
            <br />
            Doğru Çözüm.
            <br />
            <span style={styles.titleAccent}>Doğru Sistem.</span>
          </h1>

          <p style={styles.description}>
            Yapı, mimari, tasarım, tedarik ve dijital iş süreçlerini
            tek bir akıllı ekosistemde birleştir.
          </p>

          <button
            style={styles.primaryButton}
            onClick={() => setActiveModule(1)}
          >
            Sisteme Başla →
          </button>
        </section>

        <section style={styles.section}>
          <div style={styles.sectionHeader}>
            <div>
              <div style={styles.sectionEyebrow}>DDPRO PLATFORM</div>
              <h2 style={styles.sectionTitle}>Ana Modüller</h2>
            </div>

            <div style={styles.counter}>
              {activeModule + 1} / {modules.length}
            </div>
          </div>

          <div style={styles.moduleGrid}>
            {modules.map((module, index) => (
              <button
                key={module.title}
                onClick={() => setActiveModule(index)}
                style={{
                  ...styles.card,
                  ...(activeModule === index ? styles.activeCard : {})
                }}
              >
                <div style={styles.cardIcon}>{module.icon}</div>

                <h3 style={styles.cardTitle}>
                  {module.title}
                </h3>

                <p style={styles.cardText}>
                  {module.text}
                </p>

                <div style={styles.cardArrow}>→</div>
              </button>
            ))}
          </div>
        </section>

        <section style={styles.selectedPanel}>
          <div style={styles.panelLabel}>
            SEÇİLİ MODÜL
          </div>

          <div style={styles.panelContent}>
            <div>
              <div style={styles.panelIcon}>
                {modules[activeModule].icon}
              </div>

              <h2 style={styles.panelTitle}>
                {modules[activeModule].title}
              </h2>

              <p style={styles.panelText}>
                {modules[activeModule].text}
              </p>
            </div>

            <button style={styles.panelButton}>
              Aç →
            </button>
          </div>
        </section>
      </main>

      <nav style={styles.bottomNav}>
        <button style={styles.navItem}>⌂<span>Ana Sayfa</span></button>
        <button style={styles.navItem}>▣<span>Projeler</span></button>
        <button style={styles.navItem}>⌕<span>Araştır</span></button>
        <button style={styles.navItem}>☰<span>Menü</span></button>
      </nav>
    </div>
  );
}

const styles = {
  app: {
    minHeight: "100vh",
    background: "#07111f",
    color: "#f4f7fb",
    fontFamily:
      "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    paddingBottom: "90px"
  },

  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "24px 20px",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(7,17,31,0.96)",
    position: "sticky",
    top: 0,
    zIndex: 10
  },

  logo: {
    fontSize: "28px",
    fontWeight: "800",
    letterSpacing: "-1px",
    color: "#ffffff"
  },

  subtitle: {
    fontSize: "10px",
    letterSpacing: "1.4px",
    color: "#7f96b4",
    marginTop: "4px"
  },

  profileButton: {
    width: "46px",
    height: "46px",
    borderRadius: "50%",
    border: "1px solid rgba(255,255,255,0.12)",
    background: "#101d2d",
    color: "#fff",
    fontSize: "20px"
  },

  main: {
    width: "100%",
    maxWidth: "900px",
    margin: "0 auto"
  },

  hero: {
    padding: "64px 20px 48px"
  },

  badge: {
    display: "inline-block",
    padding: "8px 12px",
    borderRadius: "999px",
    background: "rgba(73,144,255,0.12)",
    border: "1px solid rgba(73,144,255,0.22)",
    color: "#73a9ff",
    fontSize: "10px",
    fontWeight: "800",
    letterSpacing: "1.4px",
    marginBottom: "24px"
  },

  title: {
    fontSize: "clamp(42px, 10vw, 76px)",
    lineHeight: "1.02",
    letterSpacing: "-2px",
    margin: "0 0 24px",
    fontWeight: "850"
  },

  titleAccent: {
    color: "#4d91ff"
  },

  description: {
    maxWidth: "620px",
    color: "#a7b4c5",
    fontSize: "17px",
    lineHeight: "1.65",
    marginBottom: "30px"
  },

  primaryButton: {
    border: 0,
    borderRadius: "14px",
    padding: "17px 24px",
    background: "#377ff0",
    color: "#fff",
    fontWeight: "800",
    fontSize: "16px",
    boxShadow: "0 14px 35px rgba(55,127,240,0.25)"
  },

  section: {
    padding: "20px"
  },

  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: "20px"
  },

  sectionEyebrow: {
    fontSize: "10px",
    fontWeight: "800",
    letterSpacing: "1.4px",
    color: "#5e7da6",
    marginBottom: "8px"
  },

  sectionTitle: {
    margin: 0,
    fontSize: "28px",
    letterSpacing: "-0.8px"
  },

  counter: {
    color: "#6f8db5",
    fontWeight: "700",
    fontSize: "14px"
  },

  moduleGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
    gap: "12px"
  },

  card: {
    textAlign: "left",
    padding: "22px",
    borderRadius: "20px",
    border: "1px solid rgba(255,255,255,0.08)",
    background: "#0d1928",
    color: "#fff",
    cursor: "pointer",
    minHeight: "230px",
    transition: "0.2s"
  },

  activeCard: {
    border: "1px solid #4d91ff",
    background: "linear-gradient(145deg, #10233d, #0d1928)",
    boxShadow: "0 10px 35px rgba(30,96,200,0.18)"
  },

  cardIcon: {
    fontSize: "32px",
    marginBottom: "22px"
  },

  cardTitle: {
    fontSize: "19px",
    margin: "0 0 10px",
    fontWeight: "750"
  },

  cardText: {
    color: "#91a0b5",
    fontSize: "14px",
    lineHeight: "1.55",
    margin: 0
  },

  cardArrow: {
    marginTop: "24px",
    color: "#65a0ff",
    fontSize: "22px",
    fontWeight: "800"
  },

  selectedPanel: {
    margin: "20px",
    padding: "26px",
    borderRadius: "24px",
    background: "linear-gradient(135deg, #102642, #0b1726)",
    border: "1px solid rgba(77,145,255,0.25)"
  },

  panelLabel: {
    color: "#6898db",
    fontSize: "10px",
    fontWeight: "800",
    letterSpacing: "1.4px",
    marginBottom: "20px"
  },

  panelContent: {
    display: "flex",
    justifyContent: "space-between",
    gap: "20px",
    alignItems: "center"
  },

  panelIcon: {
    fontSize: "36px"
  },

  panelTitle: {
    fontSize: "26px",
    margin: "10px 0"
  },

  panelText: {
    color: "#a8b6c9",
    lineHeight: "1.55",
    margin: 0
  },

  panelButton: {
    border: "1px solid rgba(255,255,255,0.15)",
    background: "#ffffff",
    color: "#0b1726",
    borderRadius: "12px",
    padding: "14px 18px",
    fontWeight: "800",
    whiteSpace: "nowrap"
  },

  bottomNav: {
    position: "fixed",
    bottom: 0,
    left: 0,
    right: 0,
    height: "72px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-around",
    background: "rgba(10,19,31,0.97)",
    borderTop: "1px solid rgba(255,255,255,0.08)",
    zIndex: 20
  },

  navItem: {
    border: 0,
    background: "transparent",
    color: "#9caabd",
    fontSize: "20px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "4px"
  }
};

export default App;
