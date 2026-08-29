import { useEffect, useMemo, useState } from "react";

const STORAGE_KEYS = {
  projects: "ddpro_projects_v1",
  research: "ddpro_research_v1",
  profile: "ddpro_profile_v1"
};

const modules = [
  {
    id: "dashboard",
    icon: "◈",
    title: "Genel Bakış",
    short: "Sistem Merkezi",
    text: "Projeler, teklifler, tedarik, araştırma ve sistem aktivitelerini tek merkezden takip et."
  },
  {
    id: "projects",
    icon: "▦",
    title: "Projeler",
    short: "Proje Yönetimi",
    text: "Aktif projelerini oluştur, yönet, düzenle ve tüm süreçlerini merkezi olarak takip et."
  },
  {
    id: "research",
    icon: "⌕",
    title: "Tedarik & Araştırma",
    short: "Araştırma Merkezi",
    text: "Ürün, malzeme, fiyat ve tedarikçi araştırmalarını kayıt altına al ve karşılaştır."
  },
  {
    id: "ai",
    icon: "✦",
    title: "DDPro AI",
    short: "AI Asistan",
    text: "Proje, araştırma ve operasyon verilerini analiz etmek için merkezi yapay zekâ çalışma alanı."
  }
];

const initialProject = {
  name: "",
  code: "",
  type: "İç Mekân",
  status: "Taslak",
  client: "",
  location: "",
  budget: "",
  area: "",
  note: ""
};

const initialProfile = {
  name: "DDPro Yönetim",
  company: "DOĞRU DİZAYN PRO",
  email: "",
  phone: ""
};

function getStorage(key, fallback) {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch {
    return fallback;
  }
}

function uid(prefix = "DDP") {
  return `${prefix}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 7)
    .toUpperCase()}`;
}

function formatDate(value) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(new Date(value));
}

function formatNumber(value) {
  if (value === "" || value === null || value === undefined) return "0";

  return new Intl.NumberFormat("tr-TR").format(
    Number(String(value).replace(/[^\d.,]/g, "").replace(",", ".")) || 0
  );
}

function Logo() {
  const [imageError, setImageError] = useState(false);

  return (
    <div className="brand">
      {!imageError ? (
        <img
          src="/logo.png"
          alt="DDPro"
          className="brandImage"
          onError={() => setImageError(true)}
        />
      ) : (
        <div className="logoFallback">
          <div className="logoMark">
            <span>D</span>
            <span>D</span>
            <b>P</b>
          </div>
          <div className="logoFallbackText">DDPRO</div>
        </div>
      )}

      <div className="brandWords">
        <strong>DOĞRU DİZAYN PRO</strong>
        <span>AI TRADE • DIGITAL ECOSYSTEM</span>
      </div>
    </div>
  );
}

function App() {
  const [activeModule, setActiveModule] = useState("dashboard");
  const [projects, setProjects] = useState(() =>
    getStorage(STORAGE_KEYS.projects, [])
  );
  const [researches, setResearches] = useState(() =>
    getStorage(STORAGE_KEYS.research, [])
  );
  const [profile, setProfile] = useState(() =>
    getStorage(STORAGE_KEYS.profile, initialProfile)
  );

  const [projectForm, setProjectForm] = useState(initialProject);
  const [editingProjectId, setEditingProjectId] = useState(null);
  const [showProjectForm, setShowProjectForm] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [researchType, setResearchType] = useState("Ürün Araştırması");
  const [researchResult, setResearchResult] = useState(null);

  const [aiInput, setAiInput] = useState("");
  const [aiMessages, setAiMessages] = useState([
    {
      id: "welcome",
      role: "ai",
      text: "DDPro AI hazır. Projeler, tedarik, araştırma ve sistem verileri hakkında bana soru sorabilirsin."
    }
  ]);

  const [showProfile, setShowProfile] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.projects, JSON.stringify(projects));
  }, [projects]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.research, JSON.stringify(researches));
  }, [researches]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.profile, JSON.stringify(profile));
  }, [profile]);

  const stats = useMemo(() => {
    const activeProjects = projects.filter(
      (project) =>
        project.status === "Aktif" ||
        project.status === "Planlama" ||
        project.status === "Teklif Aşaması"
    ).length;

    const totalArea = projects.reduce(
      (sum, project) => sum + Number(project.area || 0),
      0
    );

    const totalBudget = projects.reduce(
      (sum, project) => sum + Number(project.budget || 0),
      0
    );

    return {
      totalProjects: projects.length,
      activeProjects,
      researches: researches.length,
      totalArea,
      totalBudget
    };
  }, [projects, researches]);

  const active = modules.find((module) => module.id === activeModule);

  const showNotice = (message, type = "success") => {
    setNotice({ message, type });

    window.setTimeout(() => {
      setNotice(null);
    }, 3500);
  };

  const selectModule = (id) => {
    setActiveModule(id);
    setShowProjectForm(false);
    setShowProfile(false);
    setShowSettings(false);
  };

  const openNewProject = () => {
    setEditingProjectId(null);
    setProjectForm({
      ...initialProject,
      code: `DDPRO-${String(projects.length + 1).padStart(3, "0")}`
    });
    setShowProjectForm(true);
  };

  const editProject = (project) => {
    setEditingProjectId(project.id);
    setProjectForm({
      name: project.name || "",
      code: project.code || "",
      type: project.type || "İç Mekân",
      status: project.status || "Taslak",
      client: project.client || "",
      location: project.location || "",
      budget: project.budget || "",
      area: project.area || "",
      note: project.note || ""
    });
    setShowProjectForm(true);
  };

  const cancelProjectForm = () => {
    setEditingProjectId(null);
    setProjectForm(initialProject);
    setShowProjectForm(false);
  };

  const saveProject = (event) => {
    event.preventDefault();

    if (!projectForm.name.trim()) {
      showNotice("Proje adı zorunludur.", "error");
      return;
    }

    if (editingProjectId) {
      setProjects((current) =>
        current.map((project) =>
          project.id === editingProjectId
            ? {
                ...project,
                ...projectForm,
                updatedAt: new Date().toISOString()
              }
            : project
        )
      );

      showNotice("Proje başarıyla güncellendi.");
    } else {
      const newProject = {
        id: uid("PROJECT"),
        ...projectForm,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      setProjects((current) => [newProject, ...current]);
      showNotice("Yeni proje DDPro sistemine kaydedildi.");
    }

    cancelProjectForm();
  };

  const deleteProject = (id) => {
    const project = projects.find((item) => item.id === id);

    if (!project) return;

    const confirmed = window.confirm(
      `"${project.name}" projesini silmek istediğine emin misin?`
    );

    if (!confirmed) return;

    setProjects((current) =>
      current.filter((projectItem) => projectItem.id !== id)
    );

    showNotice("Proje sistemden silindi.");
  };

  const handleSearch = () => {
    const query = searchTerm.trim();

    if (!query) {
      showNotice("Araştırmak istediğin ürün, malzeme veya tedarikçi adını gir.", "error");
      return;
    }

    const result = {
      id: uid("RESEARCH"),
      query,
      type: researchType,
      createdAt: new Date().toISOString(),
      status: "Araştırma Kaydı",
      summary: `"${query}" için ${researchType.toLowerCase()} kaydı DDPro Araştırma Merkezi'ne oluşturuldu.`,
      steps: [
        "Ürün / malzeme tanımı oluşturuldu",
        "Tedarikçi karşılaştırma kaydı hazırlandı",
        "Fiyat ve teknik kriter alanları açıldı",
        "Sonuç değerlendirme süreci başlatıldı"
      ]
    };

    setResearches((current) => [result, ...current]);
    setResearchResult(result);
    setSearchTerm("");

    showNotice("Araştırma kaydı oluşturuldu.");
  };

  const deleteResearch = (id) => {
    setResearches((current) =>
      current.filter((research) => research.id !== id)
    );

    if (researchResult?.id === id) {
      setResearchResult(null);
    }

    showNotice("Araştırma kaydı silindi.");
  };

  const askAI = () => {
    const question = aiInput.trim();

    if (!question) return;

    const userMessage = {
      id: uid("USER"),
      role: "user",
      text: question
    };

    const lower = question.toLocaleLowerCase("tr-TR");

    let answer =
      "Bu aşamada DDPro içindeki proje ve araştırma verilerini analiz edebilirim. Bana proje, tedarik, araştırma, toplam metrekare veya sistem durumu hakkında daha net bir soru sor.";

    if (
      lower.includes("kaç proje") ||
      lower.includes("proje say") ||
      lower.includes("projeler")
    ) {
      answer = `DDPro sisteminde şu anda ${stats.totalProjects} kayıtlı proje var. Bunların ${stats.activeProjects} tanesi aktif süreçte görünüyor.`;
    } else if (
      lower.includes("araştırma") ||
      lower.includes("tedarik")
    ) {
      answer = `Araştırma Merkezi'nde şu anda ${stats.researches} kayıt bulunuyor. Son araştırmaları Tedarik & Araştırma modülünden görüntüleyebilirsin.`;
    } else if (
      lower.includes("metrekare") ||
      lower.includes("m2") ||
      lower.includes("alan")
    ) {
      answer = `Kayıtlı projelerin toplam alanı şu anda ${formatNumber(stats.totalArea)} m².`;
    } else if (
      lower.includes("bütçe") ||
      lower.includes("maliyet") ||
      lower.includes("toplam")
    ) {
      answer = `Projelerde kayıtlı toplam bütçe değeri şu anda ${formatNumber(stats.totalBudget)} olarak görünüyor.`;
    } else if (
      lower.includes("durum") ||
      lower.includes("sistem")
    ) {
      answer = `DDPro sistem merkezi aktif. ${stats.totalProjects} proje ve ${stats.researches} araştırma kaydı mevcut.`;
    }

    const aiMessage = {
      id: uid("AI"),
      role: "ai",
      text: answer
    };

    setAiMessages((current) => [...current, userMessage, aiMessage]);
    setAiInput("");
  };

  const updateProfile = (event) => {
    event.preventDefault();
    setShowProfile(false);
    showNotice("Profil bilgileri kaydedildi.");
  };

  const resetSystem = () => {
    const confirmed = window.confirm(
      "Tüm proje ve araştırma kayıtlarını silmek istediğine emin misin? Bu işlem geri alınamaz."
    );

    if (!confirmed) return;

    setProjects([]);
    setResearches([]);
    setResearchResult(null);

    showNotice("DDPro yerel sistem verileri temizlendi.");
  };

  return (
    <>
      <style>{`
        :root {
          --bg: #070a0d;
          --panel: #10151b;
          --panel-2: #151b22;
          --line: rgba(255,255,255,.09);
          --text: #f5f7f8;
          --muted: #94a0aa;
          --soft: #c6ced4;
          --gold: #d6a94b;
          --gold-light: #f0ca78;
          --blue: #5ca6d8;
          --danger: #ed6464;
          --success: #5ac58a;
          --shadow: 0 24px 70px rgba(0,0,0,.35);
        }

        * {
          box-sizing: border-box;
        }

        html {
          background: var(--bg);
        }

        body {
          margin: 0;
          min-width: 320px;
          background:
            radial-gradient(circle at top right, rgba(214,169,75,.10), transparent 28%),
            radial-gradient(circle at top left, rgba(92,166,216,.08), transparent 24%),
            var(--bg);
          color: var(--text);
          font-family:
            Inter,
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            Arial,
            sans-serif;
        }

        button,
        input,
        select,
        textarea {
          font: inherit;
        }

        button {
          cursor: pointer;
        }

        .app {
          min-height: 100vh;
          max-width: 1540px;
          margin: 0 auto;
          padding: 22px;
        }

        .topbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 24px;
          padding: 16px 20px;
          border: 1px solid var(--line);
          background: rgba(16,21,27,.88);
          backdrop-filter: blur(20px);
          border-radius: 22px;
          box-shadow: var(--shadow);
          position: sticky;
          top: 12px;
          z-index: 50;
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 14px;
          min-width: 0;
        }

        .brandImage {
          width: 92px;
          height: 56px;
          object-fit: contain;
          display: block;
        }

        .logoFallback {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .logoMark {
          width: 54px;
          height: 54px;
          border: 1px solid rgba(214,169,75,.75);
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          align-items: center;
          padding: 0 6px;
          transform: skewX(-8deg);
          background:
            linear-gradient(135deg, rgba(214,169,75,.20), transparent 60%),
            #0c1015;
        }

        .logoMark span,
        .logoMark b {
          color: var(--gold-light);
          font-size: 18px;
          font-weight: 900;
          transform: skewX(8deg);
        }

        .logoFallbackText {
          font-size: 21px;
          letter-spacing: .12em;
          font-weight: 900;
        }

        .brandWords {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .brandWords strong {
          letter-spacing: .08em;
          font-size: 12px;
        }

        .brandWords span {
          color: var(--muted);
          font-size: 9px;
          letter-spacing: .13em;
        }

        .topActions {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .iconButton {
          width: 44px;
          height: 44px;
          border-radius: 14px;
          border: 1px solid var(--line);
          color: var(--text);
          background: rgba(255,255,255,.03);
          font-size: 18px;
        }

        .iconButton:hover {
          border-color: rgba(214,169,75,.55);
          color: var(--gold-light);
        }

        .shell {
          display: grid;
          grid-template-columns: 250px minmax(0, 1fr);
          gap: 22px;
          margin-top: 22px;
        }

        .sidebar {
          border: 1px solid var(--line);
          border-radius: 22px;
          background: rgba(16,21,27,.78);
          padding: 14px;
          height: fit-content;
          position: sticky;
          top: 112px;
        }

        .navLabel {
          color: var(--muted);
          font-size: 10px;
          letter-spacing: .15em;
          font-weight: 800;
          padding: 12px 10px 8px;
        }

        .navButton {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px;
          margin: 4px 0;
          border-radius: 14px;
          border: 1px solid transparent;
          background: transparent;
          color: var(--soft);
          text-align: left;
        }

        .navButton:hover {
          background: rgba(255,255,255,.035);
        }

        .navButton.active {
          background:
            linear-gradient(90deg, rgba(214,169,75,.16), rgba(214,169,75,.04));
          border-color: rgba(214,169,75,.22);
          color: var(--gold-light);
        }

        .navIcon {
          width: 26px;
          text-align: center;
          font-size: 19px;
        }

        .navText {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .navText strong {
          font-size: 13px;
        }

        .navText span {
          color: var(--muted);
          font-size: 10px;
        }

        .content {
          min-width: 0;
        }

        .hero {
          min-height: 310px;
          padding: 44px;
          border: 1px solid var(--line);
          border-radius: 28px;
          background:
            linear-gradient(120deg, rgba(10,14,18,.98), rgba(18,24,31,.90)),
            var(--panel);
          position: relative;
          overflow: hidden;
        }

        .hero::after {
          content: "";
          position: absolute;
          width: 420px;
          height: 420px;
          right: -140px;
          top: -200px;
          border-radius: 50%;
          border: 1px solid rgba(214,169,75,.16);
          box-shadow:
            0 0 0 60px rgba(214,169,75,.035),
            0 0 0 120px rgba(214,169,75,.025);
        }

        .eyebrow {
          color: var(--gold);
          font-size: 10px;
          letter-spacing: .18em;
          font-weight: 900;
          margin-bottom: 14px;
        }

        .hero h1 {
          margin: 0;
          max-width: 780px;
          font-size: clamp(34px, 5vw, 70px);
          line-height: .98;
          letter-spacing: -.05em;
          position: relative;
          z-index: 1;
        }

        .hero h1 span {
          color: var(--gold-light);
        }

        .hero p {
          max-width: 650px;
          color: var(--muted);
          line-height: 1.7;
          margin: 24px 0;
          position: relative;
          z-index: 1;
        }

        .primaryButton,
        .secondaryButton,
        .dangerButton {
          min-height: 46px;
          padding: 0 18px;
          border-radius: 13px;
          border: 1px solid transparent;
          font-weight: 800;
        }

        .primaryButton {
          background: linear-gradient(135deg, var(--gold-light), var(--gold));
          color: #171108;
          box-shadow: 0 10px 30px rgba(214,169,75,.15);
        }

        .primaryButton:hover {
          transform: translateY(-1px);
          filter: brightness(1.05);
        }

        .secondaryButton {
          background: rgba(255,255,255,.04);
          border-color: var(--line);
          color: var(--soft);
        }

        .dangerButton {
          background: rgba(237,100,100,.10);
          border-color: rgba(237,100,100,.25);
          color: #ff9999;
        }

        .pageHeader {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 20px;
          margin: 28px 0 18px;
        }

        .pageTitle {
          margin: 0;
          font-size: clamp(26px, 3vw, 40px);
          letter-spacing: -.03em;
        }

        .pageDescription {
          margin: 8px 0 0;
          color: var(--muted);
          line-height: 1.6;
        }

        .statsGrid {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 14px;
        }

        .statCard {
          min-height: 150px;
          padding: 20px;
          border: 1px solid var(--line);
          border-radius: 20px;
          background: var(--panel);
        }

        .statCard span {
          color: var(--muted);
          font-size: 11px;
        }

        .statValue {
          font-size: 30px;
          font-weight: 900;
          margin: 18px 0 6px;
          letter-spacing: -.04em;
        }

        .statAccent {
          color: var(--gold-light);
        }

        .panel {
          border: 1px solid var(--line);
          border-radius: 22px;
          background: var(--panel);
          padding: 24px;
          margin-top: 16px;
        }

        .panelHeader {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 20px;
        }

        .panelHeader h3 {
          margin: 0;
          font-size: 18px;
        }

        .moduleGrid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        .moduleCard {
          border: 1px solid var(--line);
          background: var(--panel-2);
          color: var(--text);
          padding: 22px;
          border-radius: 20px;
          text-align: left;
        }

        .moduleCard:hover {
          border-color: rgba(214,169,75,.45);
          transform: translateY(-2px);
        }

        .moduleCard.active {
          border-color: rgba(214,169,75,.55);
          background:
            linear-gradient(135deg, rgba(214,169,75,.11), transparent 55%),
            var(--panel-2);
        }

        .moduleCardIcon {
          color: var(--gold-light);
          font-size: 26px;
        }

        .moduleCard h3 {
          margin: 18px 0 8px;
        }

        .moduleCard p {
          margin: 0;
          color: var(--muted);
          line-height: 1.6;
          font-size: 13px;
        }

        .tableWrap {
          overflow-x: auto;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          min-width: 850px;
        }

        th,
        td {
          padding: 16px 12px;
          border-bottom: 1px solid var(--line);
          text-align: left;
          font-size: 13px;
        }

        th {
          color: var(--muted);
          font-size: 10px;
          letter-spacing: .08em;
          text-transform: uppercase;
        }

        .projectName {
          font-weight: 800;
        }

        .projectCode {
          display: block;
          margin-top: 4px;
          color: var(--muted);
          font-size: 11px;
        }

        .status {
          display: inline-flex;
          padding: 7px 10px;
          border-radius: 999px;
          background: rgba(92,166,216,.12);
          color: #8dcdf5;
          font-size: 11px;
          font-weight: 800;
        }

        .rowActions {
          display: flex;
          gap: 8px;
        }

        .miniButton {
          border: 1px solid var(--line);
          background: rgba(255,255,255,.03);
          color: var(--soft);
          padding: 8px 10px;
          border-radius: 9px;
          font-size: 11px;
          font-weight: 700;
        }

        .miniButton.delete {
          color: #ff9999;
        }

        .emptyState {
          padding: 60px 20px;
          text-align: center;
          color: var(--muted);
        }

        .emptyIcon {
          font-size: 42px;
          color: var(--gold-light);
          margin-bottom: 14px;
        }

        .emptyState h3 {
          color: var(--text);
          margin: 0 0 10px;
        }

        .formGrid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
        }

        .formGroup {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .formGroup.full {
          grid-column: 1 / -1;
        }

        .formGroup label {
          font-size: 11px;
          color: var(--soft);
          font-weight: 800;
        }

        input,
        select,
        textarea {
          width: 100%;
          background: #0a0e12;
          border: 1px solid var(--line);
          color: var(--text);
          border-radius: 12px;
          padding: 13px 14px;
          outline: none;
        }

        input:focus,
        select:focus,
        textarea:focus {
          border-color: rgba(214,169,75,.65);
          box-shadow: 0 0 0 3px rgba(214,169,75,.08);
        }

        textarea {
          min-height: 120px;
          resize: vertical;
        }

        .formSection {
          padding: 22px 0;
          border-bottom: 1px solid var(--line);
        }

        .formSection:last-of-type {
          border-bottom: 0;
        }

        .formSectionTitle {
          font-weight: 900;
          margin-bottom: 18px;
        }

        .formActions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          padding-top: 22px;
        }

        .searchLayout {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 190px auto;
          gap: 10px;
        }

        .researchResult {
          margin-top: 18px;
          padding: 22px;
          border-radius: 18px;
          border: 1px solid rgba(214,169,75,.25);
          background: rgba(214,169,75,.05);
        }

        .researchResult h4 {
          margin: 0 0 10px;
          color: var(--gold-light);
        }

        .researchSteps {
          padding-left: 20px;
          color: var(--muted);
          line-height: 2;
        }

        .researchItem {
          display: flex;
          justify-content: space-between;
          gap: 20px;
          padding: 18px 0;
          border-bottom: 1px solid var(--line);
        }

        .researchItem:last-child {
          border-bottom: 0;
        }

        .researchItem strong {
          display: block;
        }

        .researchItem span {
          color: var(--muted);
          font-size: 11px;
          display: block;
          margin-top: 5px;
        }

        .aiChat {
          display: flex;
          flex-direction: column;
          gap: 12px;
          min-height: 440px;
          max-height: 620px;
          overflow-y: auto;
          padding-right: 4px;
        }

        .message {
          max-width: 82%;
          padding: 14px 16px;
          border-radius: 16px;
          line-height: 1.6;
          font-size: 13px;
        }

        .message.ai {
          align-self: flex-start;
          background: var(--panel-2);
          border: 1px solid var(--line);
        }

        .message.user {
          align-self: flex-end;
          background: rgba(214,169,75,.14);
          border: 1px solid rgba(214,169,75,.22);
        }

        .aiInput {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 10px;
          margin-top: 18px;
        }

        .modalOverlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,.70);
          backdrop-filter: blur(10px);
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }

        .modal {
          width: min(560px, 100%);
          max-height: calc(100vh - 40px);
          overflow-y: auto;
          padding: 26px;
          border: 1px solid var(--line);
          border-radius: 24px;
          background: #11161c;
          box-shadow: var(--shadow);
        }

        .modalTop {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .modalTop h3 {
          margin: 0;
        }

        .closeModal {
          width: 38px;
          height: 38px;
          border-radius: 12px;
          border: 1px solid var(--line);
          background: transparent;
          color: var(--text);
        }

        .notice {
          position: fixed;
          right: 22px;
          bottom: 22px;
          z-index: 200;
          padding: 15px 18px;
          border-radius: 14px;
          background: #172019;
          border: 1px solid rgba(90,197,138,.35);
          box-shadow: var(--shadow);
          max-width: min(420px, calc(100vw - 44px));
          font-size: 13px;
          font-weight: 700;
        }

        .notice.error {
          background: #251516;
          border-color: rgba(237,100,100,.35);
        }

        .footer {
          margin-top: 28px;
          padding: 22px 6px;
          display: flex;
          justify-content: space-between;
          gap: 20px;
          color: #69737c;
          font-size: 10px;
          letter-spacing: .08em;
        }

        @media (max-width: 1100px) {
          .statsGrid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }

        @media (max-width: 850px) {
          .app {
            padding: 12px;
          }

          .shell {
            grid-template-columns: 1fr;
          }

          .sidebar {
            position: static;
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .navLabel {
            grid-column: 1 / -1;
          }

          .hero {
            padding: 28px;
          }

          .statsGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .searchLayout {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 600px) {
          .topbar {
            padding: 12px;
          }

          .brandWords {
            display: none;
          }

          .brandImage {
            width: 78px;
          }

          .moduleGrid,
          .formGrid {
            grid-template-columns: 1fr;
          }

          .statsGrid {
            grid-template-columns: 1fr 1fr;
          }

          .pageHeader,
          .panelHeader {
            align-items: flex-start;
            flex-direction: column;
          }

          .footer {
            flex-direction: column;
          }

          .formActions {
            flex-direction: column-reverse;
          }

          .formActions button {
            width: 100%;
          }
        }
      `}</style>

      <div className="app">
        <header className="topbar">
          <Logo />

          <div className="topActions">
            <button
              type="button"
              className="iconButton"
              onClick={() => {
                setShowSettings(true);
                setShowProfile(false);
              }}
              title="Sistem Ayarları"
            >
              ⚙
            </button>

            <button
              type="button"
              className="iconButton"
              onClick={() => {
                setShowProfile(true);
                setShowSettings(false);
              }}
              title="Profil"
            >
              ◉
            </button>
          </div>
        </header>

        <div className="shell">
          <aside className="sidebar">
            <div className="navLabel">DDPRO SİSTEM MERKEZİ</div>

            {modules.map((module) => (
              <button
                type="button"
                key={module.id}
                className={`navButton ${
                  activeModule === module.id ? "active" : ""
                }`}
                onClick={() => selectModule(module.id)}
              >
                <div className="navIcon">{module.icon}</div>

                <div className="navText">
                  <strong>{module.title}</strong>
                  <span>{module.short}</span>
                </div>
              </button>
            ))}
          </aside>

          <main className="content">
            {activeModule === "dashboard" && (
              <>
                <section className="hero">
                  <div className="eyebrow">DDPRO • CENTRAL OPERATING SYSTEM</div>

                  <h1>
                    Doğru Dizayn.
                    <br />
                    Doğru Çözüm.
                    <br />
                    <span>Doğru Sistem.</span>
                  </h1>

                  <p>
                    Proje yönetimi, tedarik, araştırma ve operasyon süreçlerini
                    DDPro merkezinde bir araya getir. Tüm sistem tek ekrandan
                    büyüsün, gelişsin ve kayıt altında çalışsın.
                  </p>

                  <button
                    type="button"
                    className="primaryButton"
                    onClick={() => selectModule("projects")}
                  >
                    Projeleri Yönet →
                  </button>
                </section>

                <div className="pageHeader">
                  <div>
                    <div className="eyebrow">CANLI SİSTEM DURUMU</div>
                    <h2 className="pageTitle">Genel Bakış</h2>
                    <p className="pageDescription">
                      DDPro içindeki mevcut kayıtların merkezi özeti.
                    </p>
                  </div>
                </div>

                <section className="statsGrid">
                  <div className="statCard">
                    <span>TOPLAM PROJE</span>
                    <div className="statValue statAccent">
                      {stats.totalProjects}
                    </div>
                    <span>Sistemde kayıtlı proje</span>
                  </div>

                  <div className="statCard">
                    <span>AKTİF SÜREÇ</span>
                    <div className="statValue">{stats.activeProjects}</div>
                    <span>Devam eden proje</span>
                  </div>

                  <div className="statCard">
                    <span>ARAŞTIRMA</span>
                    <div className="statValue">{stats.researches}</div>
                    <span>Kayıtlı araştırma</span>
                  </div>

                  <div className="statCard">
                    <span>TOPLAM ALAN</span>
                    <div className="statValue">
                      {formatNumber(stats.totalArea)}
                    </div>
                    <span>m² kayıtlı alan</span>
                  </div>

                  <div className="statCard">
                    <span>KAYITLI BÜTÇE</span>
                    <div className="statValue">
                      {formatNumber(stats.totalBudget)}
                    </div>
                    <span>Toplam proje bütçesi</span>
                  </div>
                </section>

                <section className="panel">
                  <div className="panelHeader">
                    <h3>Ana Modüller</h3>
                    <span className="eyebrow">4 MODÜL • TEK MERKEZ</span>
                  </div>

                  <div className="moduleGrid">
                    {modules.map((module) => (
                      <button
                        type="button"
                        key={module.id}
                        className={`moduleCard ${
                          activeModule === module.id ? "active" : ""
                        }`}
                        onClick={() => selectModule(module.id)}
                      >
                        <div className="moduleCardIcon">{module.icon}</div>
                        <h3>{module.title}</h3>
                        <p>{module.text}</p>
                      </button>
                    ))}
                  </div>
                </section>
              </>
            )}

            {activeModule === "projects" && (
              <>
                <div className="pageHeader">
                  <div>
                    <div className="eyebrow">DDPRO • PROJECT MANAGEMENT</div>
                    <h2 className="pageTitle">Projeler</h2>
                    <p className="pageDescription">
                      Projelerini oluştur, kaydet, düzenle ve merkezi olarak yönet.
                    </p>
                  </div>

                  {!showProjectForm && (
                    <button
                      type="button"
                      className="primaryButton"
                      onClick={openNewProject}
                    >
                      + Yeni Proje
                    </button>
                  )}
                </div>

                {showProjectForm ? (
                  <section className="panel">
                    <div className="panelHeader">
                      <div>
                        <div className="eyebrow">
                          {editingProjectId
                            ? "PROJE DÜZENLE"
                            : "YENİ PROJE KAYDI"}
                        </div>
                        <h3>
                          {editingProjectId
                            ? "Proje Bilgilerini Güncelle"
                            : "Yeni Proje Oluştur"}
                        </h3>
                      </div>

                      <button
                        type="button"
                        className="secondaryButton"
                        onClick={cancelProjectForm}
                      >
                        ← Projelere Dön
                      </button>
                    </div>

                    <form onSubmit={saveProject}>
                      <div className="formSection">
                        <div className="formSectionTitle">
                          Temel Proje Bilgileri
                        </div>

                        <div className="formGrid">
                          <div className="formGroup">
                            <label>PROJE ADI *</label>
                            <input
                              value={projectForm.name}
                              onChange={(event) =>
                                setProjectForm({
                                  ...projectForm,
                                  name: event.target.value
                                })
                              }
                              placeholder="Proje adını girin"
                            />
                          </div>

                          <div className="formGroup">
                            <label>PROJE KODU</label>
                            <input
                              value={projectForm.code}
                              onChange={(event) =>
                                setProjectForm({
                                  ...projectForm,
                                  code: event.target.value
                                })
                              }
                              placeholder="DDPRO-001"
                            />
                          </div>

                          <div className="formGroup">
                            <label>PROJE TÜRÜ</label>
                            <select
                              value={projectForm.type}
                              onChange={(event) =>
                                setProjectForm({
                                  ...projectForm,
                                  type: event.target.value
                                })
                              }
                            >
                              <option>İç Mekân</option>
                              <option>Dış Cephe</option>
                              <option>Tavan</option>
                              <option>Ofis</option>
                              <option>Mağaza</option>
                              <option>Otel</option>
                              <option>Restoran</option>
                              <option>Konut</option>
                              <option>Diğer</option>
                            </select>
                          </div>

                          <div className="formGroup">
                            <label>PROJE DURUMU</label>
                            <select
                              value={projectForm.status}
                              onChange={(event) =>
                                setProjectForm({
                                  ...projectForm,
                                  status: event.target.value
                                })
                              }
                            >
                              <option>Taslak</option>
                              <option>Teklif Aşaması</option>
                              <option>Planlama</option>
                              <option>Aktif</option>
                              <option>Tamamlandı</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      <div className="formSection">
                        <div className="formSectionTitle">
                          Müşteri ve Lokasyon
                        </div>

                        <div className="formGrid">
                          <div className="formGroup">
                            <label>MÜŞTERİ / FİRMA</label>
                            <input
                              value={projectForm.client}
                              onChange={(event) =>
                                setProjectForm({
                                  ...projectForm,
                                  client: event.target.value
                                })
                              }
                              placeholder="Müşteri veya firma adı"
                            />
                          </div>

                          <div className="formGroup">
                            <label>PROJE LOKASYONU</label>
                            <input
                              value={projectForm.location}
                              onChange={(event) =>
                                setProjectForm({
                                  ...projectForm,
                                  location: event.target.value
                                })
                              }
                              placeholder="İl / İlçe / Ülke"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="formSection">
                        <div className="formSectionTitle">
                          Ölçü ve Bütçe
                        </div>

                        <div className="formGrid">
                          <div className="formGroup">
                            <label>PROJE ALANI (m²)</label>
                            <input
                              type="number"
                              min="0"
                              value={projectForm.area}
                              onChange={(event) =>
                                setProjectForm({
                                  ...projectForm,
                                  area: event.target.value
                                })
                              }
                              placeholder="Örn: 120"
                            />
                          </div>

                          <div className="formGroup">
                            <label>PROJE BÜTÇESİ</label>
                            <input
                              type="number"
                              min="0"
                              value={projectForm.budget}
                              onChange={(event) =>
                                setProjectForm({
                                  ...projectForm,
                                  budget: event.target.value
                                })
                              }
                              placeholder="Toplam bütçe"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="formSection">
                        <div className="formSectionTitle">Proje Notu</div>

                        <div className="formGroup">
                          <label>AÇIKLAMA</label>
                          <textarea
                            value={projectForm.note}
                            onChange={(event) =>
                              setProjectForm({
                                ...projectForm,
                                note: event.target.value
                              })
                            }
                            placeholder="Proje hakkında önemli notlar..."
                          />
                        </div>
                      </div>

                      <div className="formActions">
                        <button
                          type="button"
                          className="secondaryButton"
                          onClick={cancelProjectForm}
                        >
                          İptal
                        </button>

                        <button
                          type="submit"
                          className="primaryButton"
                        >
                          {editingProjectId
                            ? "Değişiklikleri Kaydet →"
                            : "Projeyi Oluştur →"}
                        </button>
                      </div>
                    </form>
                  </section>
                ) : (
                  <section className="panel">
                    {projects.length === 0 ? (
                      <div className="emptyState">
                        <div className="emptyIcon">▦</div>
                        <h3>Henüz proje kaydı yok</h3>
                        <p>
                          İlk projeni oluşturarak DDPro Proje Yönetim
                          Merkezi'ni başlatabilirsin.
                        </p>
                        <button
                          type="button"
                          className="primaryButton"
                          onClick={openNewProject}
                        >
                          + İlk Projeyi Oluştur
                        </button>
                      </div>
                    ) : (
                      <div className="tableWrap">
                        <table>
                          <thead>
                            <tr>
                              <th>Proje</th>
                              <th>Müşteri</th>
                              <th>Lokasyon</th>
                              <th>Alan</th>
                              <th>Durum</th>
                              <th>Tarih</th>
                              <th>İşlem</th>
                            </tr>
                          </thead>

                          <tbody>
                            {projects.map((project) => (
                              <tr key={project.id}>
                                <td>
                                  <span className="projectName">
                                    {project.name}
                                  </span>
                                  <span className="projectCode">
                                    {project.code || "KOD YOK"}
                                  </span>
                                </td>
                                <td>{project.client || "-"}</td>
                                <td>{project.location || "-"}</td>
                                <td>
                                  {project.area
                                    ? `${formatNumber(project.area)} m²`
                                    : "-"}
                                </td>
                                <td>
                                  <span className="status">
                                    {project.status}
                                  </span>
                                </td>
                                <td>{formatDate(project.createdAt)}</td>
                                <td>
                                  <div className="rowActions">
                                    <button
                                      type="button"
                                      className="miniButton"
                                      onClick={() => editProject(project)}
                                    >
                                      Düzenle
                                    </button>

                                    <button
                                      type="button"
                                      className="miniButton delete"
                                      onClick={() =>
                                        deleteProject(project.id)
                                      }
                                    >
                                      Sil
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </section>
                )}
              </>
            )}

            {activeModule === "research" && (
              <>
                <div className="pageHeader">
                  <div>
                    <div className="eyebrow">DDPRO • RESEARCH CENTER</div>
                    <h2 className="pageTitle">Tedarik & Araştırma</h2>
                    <p className="pageDescription">
                      Ürün, malzeme ve tedarikçi araştırmalarını merkezi olarak
                      başlat ve kayıt altında tut.
                    </p>
                  </div>
                </div>

                <section className="panel">
                  <div className="searchLayout">
                    <input
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

                    <select
                      value={researchType}
                      onChange={(event) =>
                        setResearchType(event.target.value)
                      }
                    >
                      <option>Ürün Araştırması</option>
                      <option>Malzeme Araştırması</option>
                      <option>Tedarikçi Araştırması</option>
                      <option>Fiyat Araştırması</option>
                      <option>Teknik Karşılaştırma</option>
                    </select>

                    <button
                      type="button"
                      className="primaryButton"
                      onClick={handleSearch}
                    >
                      Araştır →
                    </button>
                  </div>

                  {researchResult && (
                    <div className="researchResult">
                      <h4>{researchResult.query}</h4>
                      <p>{researchResult.summary}</p>

                      <ul className="researchSteps">
                        {researchResult.steps.map((step) => (
                          <li key={step}>{step}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </section>

                <section className="panel">
                  <div className="panelHeader">
                    <h3>Araştırma Kayıtları</h3>
                    <span className="eyebrow">
                      {researches.length} KAYIT
                    </span>
                  </div>

                  {researches.length === 0 ? (
                    <div className="emptyState">
                      <div className="emptyIcon">⌕</div>
                      <h3>Araştırma Merkezi hazır</h3>
                      <p>
                        İlk ürün, malzeme veya tedarikçi araştırmanı yukarıdaki
                        merkezden başlat.
                      </p>
                    </div>
                  ) : (
                    researches.map((research) => (
                      <div className="researchItem" key={research.id}>
                        <div>
                          <strong>{research.query}</strong>
                          <span>
                            {research.type} •{" "}
                            {formatDate(research.createdAt)}
                          </span>
                        </div>

                        <button
                          type="button"
                          className="miniButton delete"
                          onClick={() => deleteResearch(research.id)}
                        >
                          Sil
                        </button>
                      </div>
                    ))
                  )}
                </section>
              </>
            )}

            {activeModule === "ai" && (
              <>
                <div className="pageHeader">
                  <div>
                    <div className="eyebrow">DDPRO • ARTIFICIAL INTELLIGENCE</div>
                    <h2 className="pageTitle">DDPro AI Asistan</h2>
                    <p className="pageDescription">
                      Sistemdeki proje ve araştırma verileri üzerinden çalışan
                      merkezi analiz asistanı.
                    </p>
                  </div>
                </div>

                <section className="panel">
                  <div className="aiChat">
                    {aiMessages.map((message) => (
                      <div
                        key={message.id}
                        className={`message ${message.role}`}
                      >
                        {message.text}
                      </div>
                    ))}
                  </div>

                  <div className="aiInput">
                    <input
                      value={aiInput}
                      onChange={(event) => setAiInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          askAI();
                        }
                      }}
                      placeholder="DDPro AI'a bir soru sor..."
                    />

                    <button
                      type="button"
                      className="primaryButton"
                      onClick={askAI}
                    >
                      Gönder →
                    </button>
                  </div>
                </section>
              </>
            )}
          </main>
        </div>

        <footer className="footer">
          <div>
            © {new Date().getFullYear()} DDPro — DOĞRU DİZAYN PRO
          </div>

          <div>
            AI TRADE • DIGITAL ECOSYSTEM • CENTRAL OPERATING SYSTEM
          </div>
        </footer>

        {showProfile && (
          <div className="modalOverlay">
            <div className="modal">
              <div className="modalTop">
                <h3>DDPro Profil</h3>
                <button
                  type="button"
                  className="closeModal"
                  onClick={() => setShowProfile(false)}
                >
                  ×
                </button>
              </div>

              <form onSubmit={updateProfile}>
                <div className="formGroup">
                  <label>YÖNETİM ADI</label>
                  <input
                    value={profile.name}
                    onChange={(event) =>
                      setProfile({
                        ...profile,
                        name: event.target.value
                      })
                    }
                  />
                </div>

                <br />

                <div className="formGroup">
                  <label>FİRMA</label>
                  <input
                    value={profile.company}
                    onChange={(event) =>
                      setProfile({
                        ...profile,
                        company: event.target.value
                      })
                    }
                  />
                </div>

                <br />

                <div className="formGroup">
                  <label>E-POSTA</label>
                  <input
                    value={profile.email}
                    onChange={(event) =>
                      setProfile({
                        ...profile,
                        email: event.target.value
                      })
                    }
                  />
                </div>

                <br />

                <div className="formGroup">
                  <label>TELEFON</label>
                  <input
                    value={profile.phone}
                    onChange={(event) =>
                      setProfile({
                        ...profile,
                        phone: event.target.value
                      })
                    }
                  />
                </div>

                <div className="formActions">
                  <button
                    type="button"
                    className="secondaryButton"
                    onClick={() => setShowProfile(false)}
                  >
                    Kapat
                  </button>

                  <button type="submit" className="primaryButton">
                    Kaydet →
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showSettings && (
          <div className="modalOverlay">
            <div className="modal">
              <div className="modalTop">
                <h3>Sistem Ayarları</h3>
                <button
                  type="button"
                  className="closeModal"
                  onClick={() => setShowSettings(false)}
                >
                  ×
                </button>
              </div>

              <p className="pageDescription">
                DDPro bu sürümde proje ve araştırma verilerini cihazın
                tarayıcı hafızasında saklar. GitHub Pages yayın sistemi
                arayüzü çalıştırır.
              </p>

              <section className="panel">
                <div className="eyebrow">SİSTEM VERİLERİ</div>
                <p className="pageDescription">
                  {stats.totalProjects} proje ve {stats.researches} araştırma
                  kaydı mevcut.
                </p>

                <br />

                <button
                  type="button"
                  className="dangerButton"
                  onClick={resetSystem}
                >
                  Tüm Yerel Verileri Temizle
                </button>
              </section>
            </div>
          </div>
        )}

        {notice && (
          <div className={`notice ${notice.type === "error" ? "error" : ""}`}>
            {notice.message}
          </div>
        )}
      </div>
    </>
  );
}

export default App;
