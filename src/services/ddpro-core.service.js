import { fetchAPI } from "./api.js";
import {
  getProjects,
  mapProjectToViewModel,
} from "./projects.service.js";
import {
  getResearchItems,
  mapResearchItemToViewModel,
} from "./research.service.js";
import { getOffers, mapOfferToViewModel, mapOffersToViewModel } from "./offers.service.js";

const CORE_STORAGE_KEY = "ddpro_core_state_v2";

const LEGACY_STORAGE_KEYS = {
  projects: "ddpro_projects_v1",
  research: "ddpro_research_v1",
  offers: "ddpro_offers_v1",
  memory: "ddpro_memory_v1",
  logs: "ddpro_system_logs_v1",
  integrations: "ddpro_integrations_v1",
};

const defaultAiMessages = [
  {
    id: "welcome",
    role: "assistant",
    text:
      "DDPro AI çalışma alanı hazır. Proje, teklif, araştırma veya sistem analiziyle ilgili bir çalışma başlatabilirsin.",
    projectId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    date: formatDisplayDate(new Date().toISOString()),
    source: "local",
  },
];

const defaultApiStatus = {
  projects: "pasif",
  research: "pasif",
  offers: "pasif",
  health: "pasif",
  lastCheckAt: null,
  lastError: "",
};

const defaultCoreData = {
  projects: [],
  researchItems: [],
  offers: [],
  memoryItems: [],
  systemLogs: [],
  aiMessages: defaultAiMessages,
  apiStatus: defaultApiStatus,
};

const isObject = (value) => value && typeof value === "object" && !Array.isArray(value);

const safeReadArray = (value) => (Array.isArray(value) ? value : []);

const safeReadStorage = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const nowIso = () => new Date().toISOString();

export const createId = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export const isUuid = (value) =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );

export const formatDisplayDate = (value = nowIso()) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString("tr-TR", {
    dateStyle: "short",
    timeStyle: "short",
  });
};

export const getApiFailureReason = (error) => {
  if (!error) {
    return "Bilinmeyen hata";
  }

  if (error.code === "API_CONFIGURATION_ERROR") {
    return error.message;
  }

  if (error.status === 503) {
    return "Backend veritabanı yapılandırması eksik veya servis hazır değil (HTTP 503)";
  }

  if (error.status === 404) {
    return "İstenen API rotası bulunamadı (HTTP 404)";
  }

  if (error.message) {
    return error.message;
  }

  return "Bilinmeyen hata";
};

const normalizeProject = (project = {}) => {
  if (project.source === "api") {
    return mapProjectToViewModel(project);
  }

  const createdAt = project.createdAt || project.created_at || nowIso();
  const updatedAt = project.updatedAt || project.updated_at || createdAt;

  return {
    id: project.id || createId(),
    name: project.name || "Adsız proje",
    type: project.type || project.project_type || "Genel Proje",
    status: project.status || "Taslak",
    date: project.date || formatDisplayDate(createdAt),
    createdAt,
    updatedAt,
    source: project.source || "local",
    raw: project.raw || project,
  };
};

const normalizeResearch = (item = {}) => {
  if (item.source === "api") {
    return mapResearchItemToViewModel(item);
  }

  const createdAt = item.createdAt || item.created_at || nowIso();
  const updatedAt = item.updatedAt || item.updated_at || createdAt;

  return {
    id: item.id || createId(),
    name: item.name || "Adsız araştırma",
    note: item.note || "Not eklenmedi.",
    status: item.status || "Taslak",
    date: item.date || formatDisplayDate(createdAt),
    createdAt,
    updatedAt,
    projectId: item.projectId || item.project_id || null,
    product: item.product || "",
    material: item.material || "",
    supplier: item.supplier || "",
    price: item.price || "",
    source: item.source || "local",
    raw: item.raw || item,
  };
};

const normalizeOffer = (offer = {}) => mapOfferToViewModel(offer);

const normalizeMemory = (item = {}) => {
  const createdAt = item.createdAt || item.created_at || nowIso();
  const updatedAt = item.updatedAt || item.updated_at || createdAt;

  return {
    id: item.id || createId(),
    title: item.title || "Başlıksız kayıt",
    content: item.content || "İçerik eklenmedi.",
    category: item.category || "genel",
    sourceModule: item.sourceModule || "systems",
    projectId: item.projectId || null,
    createdAt,
    updatedAt,
    date: item.date || formatDisplayDate(createdAt),
  };
};

const normalizeLog = (log = {}) => {
  const createdAt = log.createdAt || log.created_at || nowIso();

  return {
    id: log.id || createId(),
    message: log.message || "Sistem olayı",
    level: log.level || "info",
    module: log.module || "core",
    state: log.state || "aktif",
    createdAt,
    date: log.date || formatDisplayDate(createdAt),
  };
};

const normalizeAiMessage = (message = {}) => {
  const createdAt = message.createdAt || message.created_at || nowIso();
  const updatedAt = message.updatedAt || message.updated_at || createdAt;

  return {
    id: message.id || createId(),
    role: message.role === "assistant" ? "assistant" : "user",
    text: message.text || "",
    projectId: message.projectId || null,
    source: message.source || "local",
    createdAt,
    updatedAt,
    date: message.date || formatDisplayDate(createdAt),
  };
};

const migrateLegacyData = () => {
  const projects = safeReadArray(safeReadStorage(LEGACY_STORAGE_KEYS.projects, []));
  const researchItems = safeReadArray(safeReadStorage(LEGACY_STORAGE_KEYS.research, []));
  const offers = safeReadArray(safeReadStorage(LEGACY_STORAGE_KEYS.offers, []));
  const memoryItems = safeReadArray(safeReadStorage(LEGACY_STORAGE_KEYS.memory, []));
  const systemLogs = safeReadArray(safeReadStorage(LEGACY_STORAGE_KEYS.logs, []));

  const hasLegacyData =
    projects.length > 0 ||
    researchItems.length > 0 ||
    offers.length > 0 ||
    memoryItems.length > 0 ||
    systemLogs.length > 0;

  if (!hasLegacyData) {
    return null;
  }

  return {
    projects: projects.map((project) => normalizeProject(project)),
    researchItems: researchItems.map((item) => normalizeResearch(item)),
    offers: mapOffersToViewModel(offers),
    memoryItems: memoryItems.map((item) => normalizeMemory(item)),
    systemLogs: systemLogs.map((log) => normalizeLog(log)),
    aiMessages: defaultAiMessages,
    apiStatus: defaultApiStatus,
  };
};

export const loadCoreData = () => {
  const stored = safeReadStorage(CORE_STORAGE_KEY, null);

  if (isObject(stored)) {
    const aiMessages = safeReadArray(stored.aiMessages).map((message) =>
      normalizeAiMessage(message)
    );

    return {
      projects: safeReadArray(stored.projects).map((project) =>
        normalizeProject(project)
      ),
      researchItems: safeReadArray(stored.researchItems).map((item) =>
        normalizeResearch(item)
      ),
      offers: safeReadArray(stored.offers).map((offer) => normalizeOffer(offer)),
      memoryItems: safeReadArray(stored.memoryItems).map((item) =>
        normalizeMemory(item)
      ),
      systemLogs: safeReadArray(stored.systemLogs).map((log) => normalizeLog(log)),
      aiMessages: aiMessages.length > 0 ? aiMessages : defaultAiMessages,
      apiStatus: {
        ...defaultApiStatus,
        ...(isObject(stored.apiStatus) ? stored.apiStatus : {}),
      },
    };
  }

  const migrated = migrateLegacyData();

  if (migrated) {
    saveCoreData(migrated);
    return migrated;
  }

  return {
    ...defaultCoreData,
    aiMessages: [...defaultAiMessages],
  };
};

export const saveCoreData = (data = defaultCoreData) => {
  const payload = {
    ...defaultCoreData,
    ...data,
  };

  localStorage.setItem(CORE_STORAGE_KEY, JSON.stringify(payload));
};

export const createSystemLog = (message, options = {}) =>
  normalizeLog({
    id: createId(),
    message,
    level: options.level || "info",
    module: options.module || "core",
    state: options.state || "aktif",
    createdAt: options.createdAt || nowIso(),
  });

export const appendSystemLog = (logs = [], message, options = {}) =>
  [createSystemLog(message, options), ...safeReadArray(logs)].slice(0, 100);

export const createMemoryRecord = (payload = {}) =>
  normalizeMemory({
    id: payload.id || createId(),
    title: payload.title,
    content: payload.content,
    category: payload.category,
    sourceModule: payload.sourceModule,
    projectId: payload.projectId || null,
    createdAt: payload.createdAt || nowIso(),
    updatedAt: payload.updatedAt || nowIso(),
  });

export const appendMemoryRecord = (items = [], payload = {}) =>
  [createMemoryRecord(payload), ...safeReadArray(items)].slice(0, 200);

export const createAiMessageRecord = (payload = {}) =>
  normalizeAiMessage({
    id: payload.id || createId(),
    role: payload.role,
    text: payload.text,
    projectId: payload.projectId || null,
    source: payload.source || "local",
    createdAt: payload.createdAt || nowIso(),
    updatedAt: payload.updatedAt || nowIso(),
  });

const mergeModuleData = (apiItems = [], localItems = []) => {
  const apiIds = new Set(apiItems.map((item) => item.id));
  const localOnly = localItems.filter(
    (item) => item?.source !== "api" && !apiIds.has(item.id)
  );

  return [...apiItems, ...localOnly];
};

export const syncCoreData = async (currentData = defaultCoreData) => {
  const [projectsResult, researchResult, offersResult, healthResult] =
    await Promise.allSettled([
      getProjects(),
      getResearchItems(),
      getOffers(),
      fetchAPI("/health"),
    ]);

  const nextData = {
    ...currentData,
    projects: [...currentData.projects],
    researchItems: [...currentData.researchItems],
    offers: [...currentData.offers],
    apiStatus: {
      ...defaultApiStatus,
      ...(currentData.apiStatus || {}),
      lastCheckAt: nowIso(),
    },
  };

  const syncReport = {
    projects: { state: "pasif", reason: "", fallback: false },
    research: { state: "pasif", reason: "", fallback: false },
    offers: { state: "pasif", reason: "", fallback: false },
    health: { state: "pasif", reason: "", fallback: false },
  };

  if (projectsResult.status === "fulfilled") {
    const apiItems = safeReadArray(projectsResult.value);
    nextData.projects = mergeModuleData(apiItems, nextData.projects);
    syncReport.projects.state = "aktif";
  } else {
    const reason = getApiFailureReason(projectsResult.reason);
    syncReport.projects = { state: "fallback", reason, fallback: true };
  }

  if (researchResult.status === "fulfilled") {
    const apiItems = safeReadArray(researchResult.value);
    nextData.researchItems = mergeModuleData(apiItems, nextData.researchItems);
    syncReport.research.state = "aktif";
  } else {
    const reason = getApiFailureReason(researchResult.reason);
    syncReport.research = { state: "fallback", reason, fallback: true };
  }

  if (offersResult.status === "fulfilled") {
    const apiItems = safeReadArray(offersResult.value);
    nextData.offers = mergeModuleData(apiItems, nextData.offers);
    syncReport.offers.state = "aktif";
  } else {
    const reason = getApiFailureReason(offersResult.reason);
    syncReport.offers = { state: "fallback", reason, fallback: true };
  }

  if (healthResult.status === "fulfilled") {
    syncReport.health.state = "aktif";
  } else {
    syncReport.health = {
      state: "hata",
      reason: getApiFailureReason(healthResult.reason),
      fallback: false,
    };
  }

  nextData.apiStatus = {
    projects: syncReport.projects.state,
    research: syncReport.research.state,
    offers: syncReport.offers.state,
    health: syncReport.health.state,
    lastCheckAt: nowIso(),
    lastError:
      syncReport.projects.reason ||
      syncReport.research.reason ||
      syncReport.offers.reason ||
      syncReport.health.reason ||
      "",
  };

  return {
    data: nextData,
    report: syncReport,
  };
};

const toDisplayIntegrationState = (state) => {
  if (state === "aktif") return "aktif";
  if (state === "fallback") return "fallback";
  if (state === "hata") return "hata";
  return "pasif";
};

const resolveCoreState = (apiStatus = defaultApiStatus) => {
  const states = [apiStatus.projects, apiStatus.research, apiStatus.offers, apiStatus.health];

  if (states.every((state) => state === "aktif")) {
    return "aktif";
  }

  if (states.some((state) => state === "hata")) {
    return "hata";
  }

  if (states.some((state) => state === "fallback")) {
    return "fallback";
  }

  return "pasif";
};

export const buildIntegrations = (apiStatus = defaultApiStatus) => [
  {
    id: "ddpro-core",
    name: "DDPro Core",
    status: toDisplayIntegrationState(resolveCoreState(apiStatus)),
    description: "Merkezi uygulama, ilişki ve kayıt yönetim katmanı.",
  },
  {
    id: "api-layer",
    name: "Merkezi API / Veri Katmanı",
    status: toDisplayIntegrationState(apiStatus.health),
    description: "Gerçek API erişimi ve modül veri senkronizasyon katmanı.",
  },
  {
    id: "local-storage",
    name: "Local Storage",
    status:
      apiStatus.projects === "fallback" ||
      apiStatus.research === "fallback" ||
      apiStatus.offers === "fallback"
        ? "fallback"
        : "aktif",
    description: "Kalıcı yerel fallback ve çevrimdışı güvenli kayıt sistemi.",
  },
];

export const getModuleStateLabel = (state) => {
  if (state === "aktif") return "Aktif";
  if (state === "fallback") return "Fallback";
  if (state === "hata") return "Hata";
  return "Pasif";
};
