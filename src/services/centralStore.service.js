const CENTRAL_STORE_KEY = "ddpro_central_store_v2";

const LEGACY_STORAGE_KEYS = {
  projects: "ddpro_projects_v1",
  researchItems: "ddpro_research_v1",
  offers: "ddpro_offers_v1",
  memoryItems: "ddpro_memory_v1",
  systemLogs: "ddpro_system_logs_v1",
  aiMessages: "ddpro_ai_messages_v1",
};

const createIsoTimestamp = () => new Date().toISOString();
const createDisplayDate = () =>
  new Date().toLocaleString("tr-TR", {
    dateStyle: "short",
    timeStyle: "short",
  });

const createWelcomeMessage = () => ({
  id: "welcome",
  role: "assistant",
  text:
    "DDPro AI çalışma alanı hazır. Proje, teklif, araştırma veya sistem analiziyle ilgili bir çalışma başlatabilirsin.",
  createdAt: createIsoTimestamp(),
  date: createDisplayDate(),
});

const cloneArray = (value) => (Array.isArray(value) ? value.filter(Boolean) : []);

const getEmptyState = () => ({
  version: 2,
  projects: [],
  researchItems: [],
  offers: [],
  memoryItems: [],
  systemLogs: [],
  aiMessages: [createWelcomeMessage()],
  metadata: {
    createdAt: createIsoTimestamp(),
    updatedAt: createIsoTimestamp(),
  },
});

const canUseStorage = () => typeof window !== "undefined" && !!window.localStorage;

const readJson = (key) => {
  if (!canUseStorage()) {
    return null;
  }

  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
};

const normalizeState = (state = {}) => {
  const baseState = getEmptyState();

  return {
    ...baseState,
    ...state,
    projects: cloneArray(state.projects),
    researchItems: cloneArray(state.researchItems),
    offers: cloneArray(state.offers),
    memoryItems: cloneArray(state.memoryItems),
    systemLogs: cloneArray(state.systemLogs),
    aiMessages: cloneArray(state.aiMessages).length
      ? cloneArray(state.aiMessages)
      : [createWelcomeMessage()],
    metadata: {
      ...baseState.metadata,
      ...(state.metadata || {}),
      updatedAt: createIsoTimestamp(),
    },
  };
};

const readLegacyState = () => ({
  version: 2,
  projects: cloneArray(readJson(LEGACY_STORAGE_KEYS.projects)),
  researchItems: cloneArray(readJson(LEGACY_STORAGE_KEYS.researchItems)),
  offers: cloneArray(readJson(LEGACY_STORAGE_KEYS.offers)),
  memoryItems: cloneArray(readJson(LEGACY_STORAGE_KEYS.memoryItems)),
  systemLogs: cloneArray(readJson(LEGACY_STORAGE_KEYS.systemLogs)),
  aiMessages: cloneArray(readJson(LEGACY_STORAGE_KEYS.aiMessages)),
});

export const isPersistentStorageAvailable = () => {
  if (!canUseStorage()) {
    return false;
  }

  try {
    const probeKey = "__ddpro_storage_probe__";
    window.localStorage.setItem(probeKey, "1");
    window.localStorage.removeItem(probeKey);
    return true;
  } catch {
    return false;
  }
};

export const getInitialAppState = () => {
  const storedState = readJson(CENTRAL_STORE_KEY);

  if (storedState) {
    return normalizeState(storedState);
  }

  const migratedState = normalizeState(readLegacyState());
  persistAppState(migratedState);
  return migratedState;
};

export const persistAppState = (state) => {
  const normalizedState = normalizeState(state);

  if (!canUseStorage()) {
    return normalizedState;
  }

  try {
    window.localStorage.setItem(
      CENTRAL_STORE_KEY,
      JSON.stringify(normalizedState)
    );
  } catch {
    return normalizedState;
  }

  return normalizedState;
};

export const getCentralStoreKey = () => CENTRAL_STORE_KEY;
