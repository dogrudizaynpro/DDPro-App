import { useEffect, useMemo, useRef, useState } from "react";
import "./styles.css";
import {
  createOffer as createOfferRequest,
  deleteOffer as deleteOfferRequest,
  getOfferById,
  mapOfferToViewModel,
} from "./services/offers.service.js";
import {
  createProject as createProjectRequest,
  deleteProjectById,
  mapProjectToViewModel,
} from "./services/projects.service.js";
import {
  createResearchItem as createResearchItemRequest,
  deleteResearchItemById,
  mapResearchItemToViewModel,
} from "./services/research.service.js";
import {
  appendMemoryRecord,
  appendSystemLog,
  buildIntegrations,
  createAiMessageRecord,
  createId,
  getApiFailureReason,
  getModuleStateLabel,
  isUuid,
  loadCoreData,
  saveCoreData,
  syncCoreData,
} from "./services/ddpro-core.service.js";

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

const OFFER_STATUS_TONES = {
  Hazırlanıyor: "pending",
  Gönderildi: "info",
  Onaylandı: "success",
  Reddedildi: "danger",
};

const getOfferStatusTone = (status) => OFFER_STATUS_TONES[status] || "neutral";

const getOfferFetchState = (apiState, offerCount, loading) => {
  if (loading) return "loading";
  if (apiState === "aktif") return offerCount > 0 ? "success" : "empty";
  if (apiState === "fallback" || apiState === "hata") return "error";
  return "empty";
};

function App() {
  const [activeModule, setActiveModule] = useState("dashboard");
  const [coreData, setCoreData] = useState(() => loadCoreData());

  const [projectsLoading, setProjectsLoading] = useState(true);
  const [researchLoading, setResearchLoading] = useState(true);
  const [offersLoading, setOffersLoading] = useState(true);

  const [researchError, setResearchError] = useState(null);
  const [offersError, setOffersError] = useState(null);
  const [offersReloadKey, setOffersReloadKey] = useState(0);
  const [selectedOfferId, setSelectedOfferId] = useState(null);
  const [selectedOfferDetail, setSelectedOfferDetail] = useState(null);
  const [offerDetailLoading, setOfferDetailLoading] = useState(false);
  const [offerDetailError, setOfferDetailError] = useState(null);

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
  const [researchProduct, setResearchProduct] = useState("");
  const [researchMaterial, setResearchMaterial] = useState("");
  const [researchSupplier, setResearchSupplier] = useState("");
  const [researchPrice, setResearchPrice] = useState("");

  const [offerName, setOfferName] = useState("");
  const [offerAmount, setOfferAmount] = useState("");
  const [offerStatus, setOfferStatus] = useState("Hazırlanıyor");
  const [offerProjectId, setOfferProjectId] = useState("");

  const [memoryTitle, setMemoryTitle] = useState("");
  const [memoryContent, setMemoryContent] = useState("");
  const [memoryCategory, setMemoryCategory] = useState("genel");
  const [memoryProjectId, setMemoryProjectId] = useState("");

  const [aiInput, setAiInput] = useState("");
  const [aiProjectId, setAiProjectId] = useState("");

  const coreDataRef = useRef(coreData);

  useEffect(() => {
    coreDataRef.current = coreData;
    saveCoreData(coreData);
  }, [coreData]);

  const projects = coreData.projects;
  const researchItems = coreData.researchItems;
  const offers = coreData.offers;
  const memoryItems = coreData.memoryItems;
  const systemLogs = coreData.systemLogs;
  const aiMessages = coreData.aiMessages;
  const apiStatus = coreData.apiStatus;

  const integrations = useMemo(() => buildIntegrations(apiStatus), [apiStatus]);

  const addLog = (message, options = {}) => {
    setCoreData((currentData) => ({
      ...currentData,
      systemLogs: appendSystemLog(currentData.systemLogs, message, options),
    }));
  };

  useEffect(() => {
    let cancelled = false;

    const syncData = async () => {
      setProjectsLoading(true);
      setResearchLoading(true);
      setOffersLoading(true);
      setResearchError(null);
      setOffersError(null);

      try {
        const { data, report } = await syncCoreData(coreDataRef.current);

        if (cancelled) return;

        setCoreData((currentData) => {
          let logs = currentData.systemLogs;

          if (report.projects.state === "aktif") {
            logs = appendSystemLog(logs, "Projeler API bağlantısı başarılı.", {
              module: "projects",
              state: "aktif",
            });
          } else {
            logs = appendSystemLog(
              logs,
              `Projelerde API bağlantı hatası: ${report.projects.reason}. Fallback kullanıldı.`,
              { module: "projects", state: "fallback", level: "warning" }
            );
          }

          if (report.research.state === "aktif") {
            logs = appendSystemLog(logs, "Araştırmalar API bağlantısı başarılı.", {
              module: "research",
              state: "aktif",
            });
          } else {
            logs = appendSystemLog(
              logs,
              `Araştırmalarda API bağlantı hatası: ${report.research.reason}. Fallback kullanıldı.`,
              { module: "research", state: "fallback", level: "warning" }
            );
          }

          if (report.offers.state === "aktif") {
            logs = appendSystemLog(logs, "Teklifler API bağlantısı başarılı.", {
              module: "offers",
              state: "aktif",
            });
          } else {
            logs = appendSystemLog(
              logs,
              `Tekliflerde API bağlantı hatası: ${report.offers.reason}. Fallback kullanıldı.`,
              { module: "offers", state: "fallback", level: "warning" }
            );
          }

          if (report.health.state === "aktif") {
            logs = appendSystemLog(logs, "Merkezi API sağlık kontrolü başarılı.", {
              module: "core",
              state: "aktif",
            });
          } else {
            logs = appendSystemLog(
              logs,
              `Merkezi API sağlık kontrolü başarısız: ${report.health.reason}`,
              { module: "core", state: "hata", level: "warning" }
            );
          }

          return {
            ...data,
            aiMessages: data.aiMessages?.length ? data.aiMessages : currentData.aiMessages,
            systemLogs: logs,
          };
        });

        if (report.research.state !== "aktif") {
          setResearchError(
            `Araştırma API erişimi başarısız (${report.research.reason}). Güvenli fallback verisi gösteriliyor.`
          );
        }

        if (report.offers.state !== "aktif") {
          setOffersError(
            `Teklif API erişimi başarısız (${report.offers.reason}). Güvenli fallback verisi gösteriliyor.`
          );
        }
      } catch (error) {
        if (cancelled) return;

        const reason = getApiFailureReason(error);
        setResearchError(`Veri senkronizasyonu başarısız (${reason}).`);
        setOffersError(`Veri senkronizasyonu başarısız (${reason}).`);
        addLog(`DDPro Core merkezi senkronizasyon hatası: ${reason}`, {
          module: "core",
          state: "hata",
          level: "warning",
        });
      } finally {
        if (!cancelled) {
          setProjectsLoading(false);
          setResearchLoading(false);
          setOffersLoading(false);
        }
      }
    };

    syncData();

    return () => {
      cancelled = true;
    };
  }, [offersReloadKey]);

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

    if (selectedOffer.source !== "api") {
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
          setOfferDetailError("Teklif detayları şu anda API üzerinden alınamadı.");
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
  }, [offers, selectedOfferId]);

  const dashboardStats = useMemo(
    () => [
      {
        label: "AKTİF PROJELER",
        value: projects.filter((project) => project.status === "Aktif").length,
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

  const createProject = async (event) => {
    event.preventDefault();

    if (!projectName.trim()) return;

    const timestamp = new Date().toISOString();

    const localProject = mapProjectToViewModel({
      id: createId(),
      name: projectName.trim(),
      projectType: projectType.trim() || "Genel Proje",
      status: projectStatus,
      createdAt: timestamp,
      updatedAt: timestamp,
      source: "local",
    });

    try {
      const createdProject = await createProjectRequest(localProject);
      const nextProject = createdProject || localProject;

      setCoreData((currentData) => ({
        ...currentData,
        projects: [nextProject, ...currentData.projects],
        memoryItems: appendMemoryRecord(currentData.memoryItems, {
          title: `Proje kaydı: ${nextProject.name}`,
          content: `Proje oluşturuldu ve merkezi veri katmanına kaydedildi. Durum: ${nextProject.status}.`,
          category: "proje",
          sourceModule: "projects",
          projectId: nextProject.id,
        }),
        systemLogs: appendSystemLog(
          currentData.systemLogs,
          `Yeni proje oluşturuldu: ${nextProject.name}`,
          { module: "projects", state: "aktif" }
        ),
      }));
    } catch (error) {
      const reason = getApiFailureReason(error);

      setCoreData((currentData) => ({
        ...currentData,
        projects: [localProject, ...currentData.projects],
        memoryItems: appendMemoryRecord(currentData.memoryItems, {
          title: `Proje fallback kaydı: ${localProject.name}`,
          content: `API bağlantısı başarısız olduğu için proje fallback olarak yerel güvenli kayda alındı. Sebep: ${reason}`,
          category: "proje",
          sourceModule: "projects",
          projectId: localProject.id,
        }),
        systemLogs: appendSystemLog(
          currentData.systemLogs,
          `Proje API bağlantısı başarısız (${reason}), fallback kayıt oluşturuldu: ${localProject.name}`,
          { module: "projects", state: "fallback", level: "warning" }
        ),
      }));
    }

    setProjectName("");
    setProjectType("");
    setProjectStatus("Aktif");
    setShowProjectForm(false);
  };

  const deleteProject = async (id) => {
    const project = projects.find((item) => item.id === id);

    if (!project) return;

    if (!isUuid(id)) {
      setCoreData((currentData) => ({
        ...currentData,
        projects: currentData.projects.filter((item) => item.id !== id),
        systemLogs: appendSystemLog(currentData.systemLogs, `Yerel proje silindi: ${project.name}`, {
          module: "projects",
          state: "fallback",
        }),
      }));
      return;
    }

    try {
      await deleteProjectById(id);

      setCoreData((currentData) => ({
        ...currentData,
        projects: currentData.projects.filter((item) => item.id !== id),
        systemLogs: appendSystemLog(currentData.systemLogs, `Proje silindi: ${project.name}`, {
          module: "projects",
          state: "aktif",
        }),
      }));
    } catch (error) {
      const reason = getApiFailureReason(error);
      setCoreData((currentData) => ({
        ...currentData,
        projects: currentData.projects.filter((item) => item.id !== id),
        systemLogs: appendSystemLog(
          currentData.systemLogs,
          `Proje silme API hatası (${reason}), kayıt merkezi listeden kaldırıldı: ${project.name}`,
          { module: "projects", state: "fallback", level: "warning" }
        ),
      }));
    }
  };

  const createResearch = async (event) => {
    event.preventDefault();

    if (!researchName.trim()) return;

    const timestamp = new Date().toISOString();

    const localResearch = mapResearchItemToViewModel({
      id: createId(),
      name: researchName.trim(),
      note: researchNote.trim() || "Not eklenmedi.",
      status: "Kaydedildi",
      projectId: researchProjectId || null,
      product: researchProduct.trim(),
      material: researchMaterial.trim(),
      supplier: researchSupplier.trim(),
      price: researchPrice.trim(),
      createdAt: timestamp,
      updatedAt: timestamp,
      source: "local",
    });

    try {
      const createdResearch = await createResearchItemRequest(localResearch);
      const nextResearch = createdResearch || localResearch;

      setCoreData((currentData) => ({
        ...currentData,
        researchItems: [nextResearch, ...currentData.researchItems],
        memoryItems: appendMemoryRecord(currentData.memoryItems, {
          title: `Araştırma kaydı: ${nextResearch.name}`,
          content: `Araştırma merkezi veri katmanına işlendi. Ürün: ${localResearch.product || "-"}, Malzeme: ${localResearch.material || "-"}, Tedarikçi: ${localResearch.supplier || "-"}, Fiyat: ${localResearch.price || "-"}.`,
          category: "araştırma",
          sourceModule: "research",
          projectId: nextResearch.projectId || null,
        }),
        systemLogs: appendSystemLog(
          currentData.systemLogs,
          `Araştırma kaydedildi: ${nextResearch.name}`,
          { module: "research", state: "aktif" }
        ),
      }));
    } catch (error) {
      const reason = getApiFailureReason(error);

      setCoreData((currentData) => ({
        ...currentData,
        researchItems: [localResearch, ...currentData.researchItems],
        memoryItems: appendMemoryRecord(currentData.memoryItems, {
          title: `Araştırma fallback kaydı: ${localResearch.name}`,
          content: `Araştırma API erişimi başarısız olduğu için kayıt fallback ile saklandı. Sebep: ${reason}`,
          category: "araştırma",
          sourceModule: "research",
          projectId: localResearch.projectId || null,
        }),
        systemLogs: appendSystemLog(
          currentData.systemLogs,
          `Araştırma API bağlantı hatası (${reason}), fallback kayıt oluşturuldu: ${localResearch.name}`,
          { module: "research", state: "fallback", level: "warning" }
        ),
      }));
    }

    setResearchName("");
    setResearchNote("");
    setResearchProjectId("");
    setResearchProduct("");
    setResearchMaterial("");
    setResearchSupplier("");
    setResearchPrice("");
    setShowResearchForm(false);
  };

  const deleteResearch = async (id) => {
    const item = researchItems.find((research) => research.id === id);

    if (!item) return;

    if (!isUuid(id)) {
      setCoreData((currentData) => ({
        ...currentData,
        researchItems: currentData.researchItems.filter((research) => research.id !== id),
        systemLogs: appendSystemLog(currentData.systemLogs, `Yerel araştırma silindi: ${item.name}`, {
          module: "research",
          state: "fallback",
        }),
      }));
      return;
    }

    try {
      await deleteResearchItemById(id);
      setCoreData((currentData) => ({
        ...currentData,
        researchItems: currentData.researchItems.filter((research) => research.id !== id),
        systemLogs: appendSystemLog(currentData.systemLogs, `Araştırma silindi: ${item.name}`, {
          module: "research",
          state: "aktif",
        }),
      }));
    } catch (error) {
      const reason = getApiFailureReason(error);
      setCoreData((currentData) => ({
        ...currentData,
        researchItems: currentData.researchItems.filter((research) => research.id !== id),
        systemLogs: appendSystemLog(
          currentData.systemLogs,
          `Araştırma silme API hatası (${reason}), kayıt merkezden kaldırıldı: ${item.name}`,
          { module: "research", state: "fallback", level: "warning" }
        ),
      }));
    }
  };

  const createOffer = async (event) => {
    event.preventDefault();

    if (!offerName.trim()) return;

    const localOffer = mapOfferToViewModel({
      id: createId(),
      title: offerName.trim(),
      amount: offerAmount.trim() || "Tutar belirtilmedi",
      status: offerStatus,
      statusRaw: offerStatus,
      projectId: offerProjectId || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      source: "local",
    });

    setOffersError(null);

    try {
      const createdOffer = await createOfferRequest(localOffer);
      const nextOffer = createdOffer || localOffer;

      setCoreData((currentData) => ({
        ...currentData,
        offers: [nextOffer, ...currentData.offers],
        memoryItems: appendMemoryRecord(currentData.memoryItems, {
          title: `Teklif kaydı: ${nextOffer.title}`,
          content: `Teklif merkezi kaydı oluşturuldu. Durum: ${nextOffer.status}. Tutar: ${nextOffer.amountDisplay}.`,
          category: "teklif",
          sourceModule: "offers",
          projectId: nextOffer.projectId || null,
        }),
        systemLogs: appendSystemLog(currentData.systemLogs, `Yeni teklif oluşturuldu: ${nextOffer.title}`, {
          module: "offers",
          state: "aktif",
        }),
      }));
      setSelectedOfferId(nextOffer.id);
    } catch (error) {
      const reason = getApiFailureReason(error);

      setCoreData((currentData) => ({
        ...currentData,
        offers: [localOffer, ...currentData.offers],
        memoryItems: appendMemoryRecord(currentData.memoryItems, {
          title: `Teklif fallback kaydı: ${localOffer.title}`,
          content: `Teklif API'ye kaydedilemedi. Güvenli fallback aktif edildi. Sebep: ${reason}`,
          category: "teklif",
          sourceModule: "offers",
          projectId: localOffer.projectId || null,
        }),
        systemLogs: appendSystemLog(
          currentData.systemLogs,
          `Teklif API kaydı başarısız (${reason}), fallback kayıt oluşturuldu: ${localOffer.title}`,
          { module: "offers", state: "fallback", level: "warning" }
        ),
      }));

      setSelectedOfferId(localOffer.id);
      setOffersError("Teklif API'ye kaydedilemedi. Güvenli fallback kaydı oluşturuldu.");
    }

    setOfferName("");
    setOfferAmount("");
    setOfferStatus("Hazırlanıyor");
    setOfferProjectId("");
    setShowOfferForm(false);
  };

  const deleteOffer = async (id) => {
    const offer = offers.find((item) => item.id === id);

    if (!offer) return;

    if (!isUuid(id)) {
      setOffersError(null);
      setCoreData((currentData) => ({
        ...currentData,
        offers: currentData.offers.filter((item) => item.id !== id),
        systemLogs: appendSystemLog(
          currentData.systemLogs,
          `Yerel teklif silindi: ${offer.title || offer.name}`,
          {
            module: "offers",
            state: "fallback",
          }
        ),
      }));

      if (selectedOfferId === id) {
        setSelectedOfferId(null);
      }
      setSelectedOfferDetail(null);
      return;
    }

    try {
      await deleteOfferRequest(id);
      setOffersError(null);

      setCoreData((currentData) => ({
        ...currentData,
        offers: currentData.offers.filter((item) => item.id !== id),
        systemLogs: appendSystemLog(
          currentData.systemLogs,
          `Teklif API üzerinden silindi: ${offer.title || offer.name}`,
          { module: "offers", state: "aktif" }
        ),
      }));

      if (selectedOfferId === id) {
        setSelectedOfferId(null);
      }
      setSelectedOfferDetail(null);
    } catch (error) {
      const reason = getApiFailureReason(error);
      setOffersError("Teklif silme işlemi API üzerinde tamamlanamadı.");

      setCoreData((currentData) => ({
        ...currentData,
        systemLogs: appendSystemLog(
          currentData.systemLogs,
          `Teklif silme hatası (${reason}): ${offer.title || offer.name}`,
          {
            module: "offers",
            state: "hata",
            level: "warning",
          }
        ),
      }));
    }
  };

  const createMemory = (event) => {
    event.preventDefault();

    if (!memoryTitle.trim()) return;

    const newMemoryPayload = {
      id: createId(),
      title: memoryTitle.trim(),
      content: memoryContent.trim() || "İçerik eklenmedi.",
      category: memoryCategory || "genel",
      sourceModule: "systems",
      projectId: memoryProjectId || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setCoreData((currentData) => ({
      ...currentData,
      memoryItems: appendMemoryRecord(currentData.memoryItems, newMemoryPayload),
      systemLogs: appendSystemLog(
        currentData.systemLogs,
        `Merkezi hafızaya kayıt eklendi: ${newMemoryPayload.title}`,
        { module: "memory", state: "aktif" }
      ),
    }));

    setMemoryTitle("");
    setMemoryContent("");
    setMemoryCategory("genel");
    setMemoryProjectId("");
    setShowMemoryForm(false);
  };

  const deleteMemory = (id) => {
    const memory = memoryItems.find((item) => item.id === id);

    setCoreData((currentData) => ({
      ...currentData,
      memoryItems: currentData.memoryItems.filter((item) => item.id !== id),
      systemLogs: memory
        ? appendSystemLog(currentData.systemLogs, `Hafıza kaydı silindi: ${memory.title}`, {
            module: "memory",
            state: "aktif",
          })
        : currentData.systemLogs,
    }));
  };

  const sendAiMessage = (event) => {
    event.preventDefault();

    const message = aiInput.trim();

    if (!message) return;

    const selectedProject = projects.find((project) => project.id === aiProjectId);

    const userMessage = createAiMessageRecord({
      role: "user",
      text: message,
      projectId: aiProjectId || null,
      source: "local",
    });

    const assistantMessage = createAiMessageRecord({
      role: "assistant",
      projectId: aiProjectId || null,
      source: "local",
      text:
        `Mesaj alındı: "${message}". ` +
        `Merkezi bağlam: ${projects.length} proje, ${researchItems.length} araştırma, ${offers.length} teklif, ${memoryItems.length} hafıza kaydı. ` +
        `${selectedProject ? `Seçili proje: ${selectedProject.name}. ` : ""}` +
        "Gerçek AI endpoint hazır olduğunda aynı servis katmanına bağlanacak şekilde kayıt oluşturuldu.",
    });

    setCoreData((currentData) => ({
      ...currentData,
      aiMessages: [...currentData.aiMessages, userMessage, assistantMessage],
      memoryItems: appendMemoryRecord(currentData.memoryItems, {
        title: `AI konuşma kaydı: ${message.slice(0, 48)}`,
        content: `DDPro AI konuşması merkezi kayda alındı.`,
        category: "ai",
        sourceModule: "ai",
        projectId: aiProjectId || null,
      }),
      systemLogs: appendSystemLog(currentData.systemLogs, `DDPro AI mesajı kaydedildi.`, {
        module: "ai",
        state: "aktif",
      }),
    }));

    setAiInput("");
  };

  const offersFetchState = getOfferFetchState(apiStatus.offers, offers.length, offersLoading);

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
              <p className="empty-state">Henüz sistem kaydı bulunmuyor.</p>
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
              <strong>{getModuleStateLabel(apiStatus.projects)}</strong>
            </div>
            <div className="quick-status">
              <span>Araştırma Sistemi</span>
              <strong>{getModuleStateLabel(apiStatus.research)}</strong>
            </div>
            <div className="quick-status">
              <span>Teklif Sistemi</span>
              <strong>{getModuleStateLabel(apiStatus.offers)}</strong>
            </div>
            <div className="quick-status">
              <span>Merkezi Hafıza</span>
              <strong>{memoryItems.length > 0 ? "Aktif" : "Pasif"}</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderProjects = () => (
    <div className="module-page">
      <div className="module-toolbar">
        <button type="button" onClick={() => setShowProjectForm((value) => !value)}>
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

          <select value={projectStatus} onChange={(event) => setProjectStatus(event.target.value)}>
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

              <button type="button" onClick={() => deleteProject(project.id)}>
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
        <button type="button" onClick={() => setShowResearchForm((value) => !value)}>
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

          <select
            value={researchProjectId}
            onChange={(event) => setResearchProjectId(event.target.value)}
          >
            <option value="">Projeye bağla (opsiyonel)</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>

          <input
            type="text"
            placeholder="Ürün"
            value={researchProduct}
            onChange={(event) => setResearchProduct(event.target.value)}
          />

          <input
            type="text"
            placeholder="Malzeme"
            value={researchMaterial}
            onChange={(event) => setResearchMaterial(event.target.value)}
          />

          <input
            type="text"
            placeholder="Tedarikçi"
            value={researchSupplier}
            onChange={(event) => setResearchSupplier(event.target.value)}
          />

          <input
            type="text"
            placeholder="Fiyat"
            value={researchPrice}
            onChange={(event) => setResearchPrice(event.target.value)}
          />

          <textarea
            placeholder="Araştırma notu"
            value={researchNote}
            onChange={(event) => setResearchNote(event.target.value)}
          />

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
          <p className="empty-state">Henüz araştırma kaydı bulunmuyor.</p>
        ) : (
          researchItems.map((item) => (
            <div className="data-card" key={item.id}>
              <div>
                <h3>{item.name}</h3>
                <p>{item.note}</p>
                <small>
                  {item.date}
                  {item.projectId ? ` · Proje: ${item.projectId}` : ""}
                </small>
              </div>

              <button type="button" onClick={() => deleteResearch(item.id)}>
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
      <div className="module-toolbar" style={{ marginBottom: 0 }}>
        <select value={aiProjectId} onChange={(event) => setAiProjectId(event.target.value)}>
          <option value="">AI bağlam projesi (opsiyonel)</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      </div>

      <div className="ai-chat">
        {aiMessages.map((message) => (
          <div key={message.id} className={`ai-message ${message.role}`}>
            <strong>{message.role === "assistant" ? "DDPro AI" : "Sen"}</strong>
            <p>{message.text}</p>
            <small>
              {message.date}
              {message.projectId ? ` · Proje: ${message.projectId}` : ""}
            </small>
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
          </span>

          <button
            type="button"
            className="secondary-button"
            disabled={offersLoading}
            onClick={() => setOffersReloadKey((value) => value + 1)}
          >
            {offersLoading ? "Yenileniyor..." : "Yenile"}
          </button>

          <button type="button" onClick={() => setShowOfferForm((value) => !value)}>
            {showOfferForm ? "Formu Kapat" : "+ Yeni Teklif"}
          </button>
        </div>
      </div>

      {offersError && <p className="status-banner warning">⚠ {offersError}</p>}

      {!offersError && offersFetchState === "empty" && (
        <p className="status-banner info">ℹ API üzerinde henüz teklif bulunmuyor.</p>
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

          <select value={offerStatus} onChange={(event) => setOfferStatus(event.target.value)}>
            <option>Hazırlanıyor</option>
            <option>Gönderildi</option>
            <option>Onaylandı</option>
            <option>Reddedildi</option>
          </select>

          <select value={offerProjectId} onChange={(event) => setOfferProjectId(event.target.value)}>
            <option value="">Projeye bağla (opsiyonel)</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>

          <button type="submit">Teklifi Kaydet</button>
        </form>
      )}

      <div className="offers-summary-grid">
        <div className="offer-summary-card">
          <span>Toplam Teklif</span>
          <strong>{offers.length}</strong>
        </div>

        <div className="offer-summary-card">
          <span>API Kayıtları</span>
          <strong>{offers.filter((offer) => offer.source === "api").length}</strong>
        </div>

        <div className="offer-summary-card">
          <span>Onaylanan</span>
          <strong>{offers.filter((offer) => offer.status === "Onaylandı").length}</strong>
        </div>

        <div className="offer-summary-card">
          <span>Fallback Kayıt</span>
          <strong>{offers.filter((offer) => offer.source === "local").length}</strong>
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
                    className={`offer-card${offer.id === selectedOfferId ? " selected" : ""}`}
                    key={offer.id}
                  >
                    <div className="offer-card-top">
                      <div>
                        <h3>{offer.title}</h3>
                        <p className="offer-amount">{offer.amountDisplay}</p>
                      </div>

                      <span className={`offer-status-badge ${getOfferStatusTone(offer.status)}`}>
                        {offer.status}
                      </span>
                    </div>

                    <div className="offer-meta-row">
                      <span>{offer.date}</span>
                      <span>{offer.source === "api" ? "Canlı API" : "Fallback kayıt"}</span>
                    </div>

                    <div className="offer-card-actions">
                      <button
                        type="button"
                        className="offer-secondary-button"
                        onClick={() => setSelectedOfferId(offer.id)}
                      >
                        Detay
                      </button>

                      <button type="button" onClick={() => deleteOffer(offer.id)}>
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
                {selectedOfferDetail.source === "api" ? "API detayı" : "Fallback detay"}
              </span>
            )}
          </div>

          <div className="panel-content">
            {offersLoading ? (
              <p className="empty-state">Detay alanı hazırlanıyor…</p>
            ) : !selectedOfferDetail ? (
              <p className="empty-state">Detayları görmek için bir teklif seç.</p>
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
                    className={`offer-status-badge ${getOfferStatusTone(selectedOfferDetail.status)}`}
                  >
                    {selectedOfferDetail.status}
                  </span>
                </div>

                {offerDetailError && <p className="status-banner warning">{offerDetailError}</p>}

                <div className="offer-detail-grid">
                  <div className="offer-detail-item">
                    <span>Kaynak</span>
                    <strong>
                      {selectedOfferDetail.source === "api" ? "Teklifler API" : "Fallback kayıt"}
                    </strong>
                  </div>

                  <div className="offer-detail-item">
                    <span>Teklif Tarihi</span>
                    <strong>{selectedOfferDetail.date}</strong>
                  </div>

                  <div className="offer-detail-item">
                    <span>Para Birimi</span>
                    <strong>{selectedOfferDetail.currency || "Belirtilmedi"}</strong>
                  </div>

                  <div className="offer-detail-item">
                    <span>Proje Bağlantısı</span>
                    <strong>{selectedOfferDetail.projectId || "Atanmadı"}</strong>
                  </div>
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

          <button type="button" onClick={() => setShowMemoryForm((value) => !value)}>
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

            <select
              value={memoryCategory}
              onChange={(event) => setMemoryCategory(event.target.value)}
            >
              <option value="genel">Genel</option>
              <option value="proje">Proje</option>
              <option value="araştırma">Araştırma</option>
              <option value="teklif">Teklif</option>
              <option value="ai">AI</option>
            </select>

            <select
              value={memoryProjectId}
              onChange={(event) => setMemoryProjectId(event.target.value)}
            >
              <option value="">Projeye bağla (opsiyonel)</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>

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
            <p className="empty-state">Merkezi hafızada henüz kayıt bulunmuyor.</p>
          ) : (
            memoryItems.map((item) => (
              <div className="data-card" key={item.id}>
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.content}</p>
                  <small>
                    {item.date} · {item.category}
                    {item.projectId ? ` · Proje: ${item.projectId}` : ""}
                  </small>
                </div>

                <button type="button" onClick={() => deleteMemory(item.id)}>
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

          <button
            type="button"
            className="secondary-button"
            onClick={() => setOffersReloadKey((value) => value + 1)}
          >
            Durumu Yenile
          </button>
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

  const currentModule = modules.find((module) => module.id === activeModule) || modules[0];
  const coreStatus = integrations.find((item) => item.id === "ddpro-core")?.status || "pasif";

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
          Sistem {getModuleStateLabel(coreStatus)}
        </div>
      </header>

      <div className="app-layout">
        <aside className="sidebar">
          <div className="sidebar-title">ANA MODÜLLER</div>

          <nav className="module-nav">
            {modules.map((module) => (
              <button
                key={module.id}
                type="button"
                className={`module-button ${activeModule === module.id ? "active" : ""}`}
                onClick={() => setActiveModule(module.id)}
              >
                <span className="module-icon">{module.icon}</span>

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
              DDPro Core v1.0 · {getModuleStateLabel(coreStatus)}
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

          <section className="content-body">{renderModule()}</section>
        </main>
      </div>
    </div>
  );
}

export default App;
