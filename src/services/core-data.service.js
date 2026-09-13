const DISPLAY_DATE_FORMAT = {
  dateStyle: 'short',
  timeStyle: 'short',
};

export const STORAGE_KEYS = {
  projects: 'ddpro_projects_v1',
  research: 'ddpro_research_v1',
  offers: 'ddpro_offers_v1',
  memory: 'ddpro_memory_v1',
  logs: 'ddpro_system_logs_v1',
  integrations: 'ddpro_integrations_v1',
  products: 'ddpro_products_v1',
  systems: 'ddpro_systems_v1',
  customers: 'ddpro_customers_v1',
  priceAnalyses: 'ddpro_price_analyses_v1',
  materialAnalyses: 'ddpro_material_analyses_v1',
};

export const createLocalId = (prefix = 'ddpro') =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const readCollection = (key, fallback = []) => {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

export const writeCollection = (key, value) => {
  localStorage.setItem(key, JSON.stringify(value));
};

export const formatDisplayDate = (value) => {
  if (!value) {
    return 'Tarih belirtilmedi';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString('tr-TR', DISPLAY_DATE_FORMAT);
};

export const getRecordTimestamp = (record = {}) =>
  record.updatedAt || record.updated_at || record.createdAt || record.created_at || record.date || 0;

export const sortByRecent = (records = []) =>
  [...records].sort((left, right) => {
    const leftDate = new Date(getRecordTimestamp(left)).getTime();
    const rightDate = new Date(getRecordTimestamp(right)).getTime();
    return (Number.isNaN(rightDate) ? 0 : rightDate) - (Number.isNaN(leftDate) ? 0 : leftDate);
  });

export const mergeRecordsById = (apiRecords = [], localRecords = []) => {
  const apiIds = new Set(apiRecords.map((record) => record.id));
  const localOnly = localRecords.filter((record) => record?.id && !apiIds.has(record.id));
  return sortByRecent([...localOnly, ...apiRecords]);
};

export const toNumber = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().replace(/\./g, '').replace(',', '.');
    const amount = Number(normalized);
    return Number.isFinite(amount) ? amount : 0;
  }

  return 0;
};

export const formatCurrency = (value, currency = 'TRY') => {
  const amount = toNumber(value);

  try {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toLocaleString('tr-TR')} ${currency}`;
  }
};

export const calculateOfferItemTotal = (item = {}) =>
  toNumber(item.quantity) * toNumber(item.unitPrice);

export const calculatePriceItemTotal = (item = {}) =>
  toNumber(item.quantity) * toNumber(item.unitPrice) * (toNumber(item.coefficient) || 1);

export const calculateOfferTotals = (items = [], vatRate = 20) => {
  const subtotal = items.reduce((sum, item) => sum + calculateOfferItemTotal(item), 0);
  const tax = subtotal * (toNumber(vatRate) / 100);
  const total = subtotal + tax;

  return { subtotal, tax, total };
};

export const calculatePriceAnalysisTotals = (items = []) => {
  const total = items.reduce((sum, item) => sum + calculatePriceItemTotal(item), 0);
  return { total };
};

export const calculateMaterialItemTotal = (item = {}) =>
  toNumber(item.quantity) * toNumber(item.unitCost);

export const calculateMaterialAnalysisTotals = (items = []) => {
  const total = items.reduce((sum, item) => sum + calculateMaterialItemTotal(item), 0);
  return { total };
};

const groupChildren = (items = [], parentId = null) =>
  items
    .filter((item) => (item.parentId || null) === parentId)
    .map((item) => ({
      ...item,
      totalCost: calculateMaterialItemTotal(item),
      children: groupChildren(items, item.id),
    }));

export const buildMaterialTree = (items = []) => groupChildren(items, null);

export const getSourceLabel = (source) => (source === 'api' ? 'Canlı API' : 'Yerel taslak');

export const defaultIntegrations = [
  {
    id: 'ddpro-core',
    name: 'DDPro Core',
    status: 'Aktif',
    description: 'Merkezi uygulama ve veri yönetim katmanı.',
  },
  {
    id: 'local-storage',
    name: 'Local Storage',
    status: 'Aktif',
    description: 'Backend hazır olmayan akışlar için taslak kayıt katmanı.',
  },
];
