import { useEffect, useMemo, useState } from "react";
import { getOffers } from "./services/offers.service.js";
import { getProjects } from "./services/projects.service.js";
import { getResearchItems } from "./services/research.service.js";
import "./styles.css";

const STORAGE_KEYS = {
  appState: "ddpro_app_state_v2",
  ai: "ddpro_ai_messages_v2",
  logs: "ddpro_system_logs_v2",
  legacyProjects: "ddpro_projects_v1",
  legacyResearch: "ddpro_research_v1",
  legacyOffers: "ddpro_offers_v1",
};

const MODULES = [
  {
    id: "dashboard",
    hash: "#dashboard",
    icon: "◉",
    title: "Dashboard",
    short: "Sistem Merkezi",
    description:
      "DDPro operasyonlarının tamamını yöneten merkezi görünüm, özetler ve hızlı iş akışları.",
  },
  {
    id: "products",
    hash: "#products",
    icon: "▦",
    title: "Ürünler",
    short: "Product",
    description:
      "DDP kodlu ürün havuzu, durum takibi ve sistem bağlantıları.",
  },
  {
    id: "systems",
    hash: "#systems",
    icon: "⚙",
    title: "Sistemler",
    short: "System",
    description:
      "Ürünlerin bağlı olduğu sistem yapıları, birimler ve ilişki yönetimi.",
  },
  {
    id: "price-analysis",
    hash: "#price-analysis",
    icon: "₺",
    title: "Fiyat Analizi",
    short: "PriceAnalysis",
    description:
      "Bağımsız hizmet kalemleri için fiyat, işçilik ve katsayı bazlı analiz kayıtları.",
  },
  {
    id: "material-analysis",
    hash: "#material-analysis",
    icon: "⛁",
    title: "Malzeme Analizi",
    short: "MaterialAnalysis",
    description:
      "Malzeme ağacı, maliyet ve fire katsayısı odaklı bağımsız analiz kayıtları.",
  },
  {
    id: "offers",
    hash: "#offers",
    icon: "€",
    title: "Teklifler",
    short: "Offer",
    description:
      "Teklif hazırlama, durum takibi ve proje / analiz bağlantıları.",
  },
  {
    id: "projects",
    hash: "#projects",
    icon: "▣",
    title: "Projeler",
    short: "Project",
    description:
      "Tekliften projeye geçen işlerin merkezi yönetimi ve sistem eşleşmeleri.",
  },
  {
    id: "crm",
    hash: "#crm",
    icon: "◎",
    title: "CRM",
    short: "Customer",
    description:
      "Müşteri kartları, iletişim kanalları ve proje ilişkileri.",
  },
  {
    id: "research",
    hash: "#research",
    icon: "⌕",
    title: "Araştırma",
    short: "Research",
    description:
      "Pazar, tedarik ve ürün araştırmalarının yönetildiği canlı çalışma alanı.",
  },
  {
    id: "ai",
    hash: "#ai",
    icon: "✦",
    title: "DDPro AI",
    short: "AI Workspace",
    description:
      "Operasyon zinciri için öneri, özet ve sonraki adım üreten AI çalışma alanı.",
  },
];

const ENTITY_MODULES = MODULES.filter(
  (module) => !["dashboard", "ai"].includes(module.id)
).map((module) => module.id);

const STATUS_TONES = {
  aktif: "success",
  onaylandı: "success",
  tamamlandı: "success",
  yayında: "success",
  bağlı: "success",
  hazır: "success",
  gönderildi: "info",
  işleniyor: "info",
  değerlendiriliyor: "info",
  planlandı: "info",
  taslak: "neutral",
  hazırlanıyor: "neutral",
  yeni: "neutral",
  beklemede: "warning",
  eksik: "warning",
  pasif: "warning",
  riskli: "danger",
  reddedildi: "danger",
  iptal: "danger",
};

const REMOTE_MODULES = ["projects", "research", "offers"];

const getStoredData = (key, fallback) => {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

const createId = (prefix = "ddpro") =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const formatDate = (value = new Date()) => {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Tarih belirtilmedi";
  }

  return date.toLocaleString("tr-TR", {
    dateStyle: "short",
    timeStyle: "short",
  });
};

const normalizeText = (value) => String(value || "").trim().toLowerCase();

const formatCurrency = (amount, currency = "TRY") => {
  const number = Number(amount);

  if (!Number.isFinite(number)) {
    return "Tutar belirtilmedi";
  }

  try {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(number);
  } catch {
    return `${number.toLocaleString("tr-TR")} ${currency}`;
  }
};

const parseNumber = (value, fallback = 0) => {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  const normalized = String(value).replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const calculatePriceTotal = (record = {}) => {
  const quantity = parseNumber(record.quantity, 0);
  const coefficients = parseNumber(record.coefficients, 1);
  const labor = parseNumber(record.labor, 0);
  const price = parseNumber(record.price, 0);
  return Number((quantity * coefficients * (labor + price)).toFixed(2));
};

const calculateMaterialTotal = (record = {}) => {
  const quantity = parseNumber(record.quantity, 0);
  const unitCost = parseNumber(record.unitCost, 0);
  const wasteFactor = parseNumber(record.wasteFactor, 0);
  return Number((quantity * unitCost * (1 + wasteFactor / 100)).toFixed(2));
};

const getStatusTone = (status) =>
  STATUS_TONES[normalizeText(status)] || "neutral";

const findModuleByHash = (hash) => {
  const normalizedHash = String(hash || "").trim().toLowerCase();
  return MODULES.find((module) => module.hash === normalizedHash) || MODULES[0];
};

const makePriceItems = (record) => [
  {
    id: `${record.id}-item-1`,
    name: record.itemName || record.title,
    quantity: parseNumber(record.quantity, 0),
    unit: record.unit || "adet",
    coefficients: parseNumber(record.coefficients, 1),
    labor: parseNumber(record.labor, 0),
    price: parseNumber(record.price, 0),
    total: calculatePriceTotal(record),
  },
];

const makeMaterialNodes = (record) => [
  {
    id: `${record.id}-node-1`,
    name: record.materialName || record.title,
    quantity: parseNumber(record.quantity, 0),
    unit: record.unit || "adet",
    unitCost: parseNumber(record.unitCost, 0),
    wasteFactor: parseNumber(record.wasteFactor, 0),
    totalCost: calculateMaterialTotal(record),
    children: [],
  },
];

const normalizeProduct = (record = {}) => ({
  id: record.id || createId("product"),
  ddpCode: record.ddpCode || record.code || "",
  name: record.name || record.title || "Adsız ürün",
  systemId: record.systemId || null,
  unit: record.unit || "adet",
  description: record.description || record.note || "",
  status: record.status || "Aktif",
  source: record.source || "local",
  createdAt: record.createdAt || record.date || new Date().toISOString(),
  updatedAt: record.updatedAt || record.date || new Date().toISOString(),
});

const normalizeSystem = (record = {}) => ({
  id: record.id || createId("system"),
  systemCode: record.systemCode || record.code || "",
  name: record.name || record.systemName || record.title || "Adsız sistem",
  productIds: Array.isArray(record.productIds)
    ? record.productIds
    : Array.isArray(record.products)
      ? record.products
      : [],
  unit: record.unit || "adet",
  description: record.description || record.note || "",
  status: record.status || "Aktif",
  source: record.source || "local",
  createdAt: record.createdAt || record.date || new Date().toISOString(),
  updatedAt: record.updatedAt || record.date || new Date().toISOString(),
});

const normalizePriceAnalysis = (record = {}) => {
  const normalized = {
    id: record.id || createId("price"),
    analysisCode: record.analysisCode || record.code || "",
    title: record.title || record.name || "Adsız fiyat analizi",
    itemName: record.itemName || record.serviceName || record.title || "Hizmet kalemi",
    productId: record.productId || null,
    systemId: record.systemId || null,
    quantity: parseNumber(record.quantity, 1),
    unit: record.unit || "adet",
    coefficients: parseNumber(record.coefficients, 1),
    labor: parseNumber(record.labor, 0),
    price: parseNumber(record.price, 0),
    status: record.status || "Hazırlanıyor",
    notes: record.notes || record.description || "",
    source: record.source || "local",
    createdAt: record.createdAt || record.date || new Date().toISOString(),
    updatedAt: record.updatedAt || record.date || new Date().toISOString(),
  };

  const total =
    record.total !== undefined ? parseNumber(record.total, 0) : calculatePriceTotal(normalized);

  return {
    ...normalized,
    total,
    items: Array.isArray(record.items) && record.items.length > 0 ? record.items : makePriceItems({ ...normalized, total }),
  };
};

const normalizeMaterialAnalysis = (record = {}) => {
  const normalized = {
    id: record.id || createId("material"),
    analysisCode: record.analysisCode || record.code || "",
    title: record.title || record.name || "Adsız malzeme analizi",
    materialName:
      record.materialName || record.nodeName || record.title || "Malzeme kökü",
    productId: record.productId || null,
    systemId: record.systemId || null,
    priceAnalysisId: record.priceAnalysisId || null,
    quantity: parseNumber(record.quantity, 1),
    unit: record.unit || "adet",
    unitCost: parseNumber(record.unitCost, 0),
    wasteFactor: parseNumber(record.wasteFactor, 0),
    status: record.status || "Hazırlanıyor",
    notes: record.notes || record.description || "",
    source: record.source || "local",
    createdAt: record.createdAt || record.date || new Date().toISOString(),
    updatedAt: record.updatedAt || record.date || new Date().toISOString(),
  };

  const totalCost =
    record.totalCost !== undefined
      ? parseNumber(record.totalCost, 0)
      : calculateMaterialTotal(normalized);

  return {
    ...normalized,
    totalCost,
    nodes:
      Array.isArray(record.nodes) && record.nodes.length > 0
        ? record.nodes
        : makeMaterialNodes({ ...normalized, totalCost }),
  };
};

const normalizeOffer = (record = {}) => {
  const amount =
    record.amount !== undefined && record.amount !== null
      ? parseNumber(record.amount, 0)
      : parseNumber(record.amountValue, 0);
  const currency = String(record.currency || "TRY").toUpperCase();

  return {
    id: record.id || createId("offer"),
    offerCode: record.offerCode || record.code || "",
    title: record.title || record.name || "Adsız teklif",
    projectId: record.projectId || record.project_id || null,
    customerId: record.customerId || null,
    priceAnalysisId: record.priceAnalysisId || null,
    materialAnalysisId: record.materialAnalysisId || null,
    amount,
    currency,
    amountDisplay:
      record.amountDisplay || formatCurrency(amount, currency),
    status: record.status || "Hazırlanıyor",
    notes: record.notes || "",
    source: record.source || "local",
    createdAt:
      record.createdAt || record.created_at || record.date || new Date().toISOString(),
    updatedAt: record.updatedAt || record.updated_at || record.date || new Date().toISOString(),
  };
};

const normalizeProject = (record = {}) => ({
  id: record.id || createId("project"),
  projectCode: record.projectCode || record.code || "",
  name: record.name || record.title || "Adsız proje",
  type: record.type || record.projectType || record.project_type || "Genel Proje",
  customerId: record.customerId || null,
  offerId: record.offerId || null,
  systemId: record.systemId || null,
  description: record.description || "",
  status: record.status || "Taslak",
  source: record.source || "local",
  createdAt:
    record.createdAt || record.created_at || record.date || new Date().toISOString(),
  updatedAt: record.updatedAt || record.updated_at || record.date || new Date().toISOString(),
});

const normalizeCustomer = (record = {}) => ({
  id: record.id || createId("customer"),
  customerCode: record.customerCode || record.code || "",
  name: record.name || record.title || "Adsız müşteri",
  sector: record.sector || "Genel",
  contactPerson: record.contactPerson || "",
  phone: record.phone || "",
  email: record.email || "",
  notes: record.notes || record.description || "",
  status: record.status || "Aktif",
  source: record.source || "local",
  createdAt: record.createdAt || record.date || new Date().toISOString(),
  updatedAt: record.updatedAt || record.date || new Date().toISOString(),
});

const normalizeResearch = (record = {}) => ({
  id: record.id || createId("research"),
  title: record.title || record.name || "Adsız araştırma",
  category: record.category || "Pazar",
  supplier: record.supplier || "",
  productId: record.productId || null,
  notes: record.notes || record.note || record.description || "",
  status: record.status || "Değerlendiriliyor",
  source: record.source || "local",
  createdAt:
    record.createdAt || record.created_at || record.date || new Date().toISOString(),
  updatedAt: record.updatedAt || record.updated_at || record.date || new Date().toISOString(),
});

const NORMALIZERS = {
  products: normalizeProduct,
  systems: normalizeSystem,
  "price-analysis": normalizePriceAnalysis,
  "material-analysis": normalizeMaterialAnalysis,
  offers: normalizeOffer,
  projects: normalizeProject,
  crm: normalizeCustomer,
  research: normalizeResearch,
};

const createSeedData = () => ({
  products: [
    normalizeProduct({
      id: "product-001",
      ddpCode: "DDP-1001",
      name: "Alüminyum Cephe Paneli",
      systemId: "system-001",
      unit: "m²",
      description: "DDPro cephe sistemi için ana ürün kaydı.",
      status: "Aktif",
    }),
    normalizeProduct({
      id: "product-002",
      ddpCode: "DDP-2004",
      name: "Yangın Dayanımlı Kapı",
      systemId: "system-002",
      unit: "adet",
      description: "Proje bazlı geçiş sistemleri için ürün.",
      status: "Beklemede",
    }),
  ],
  systems: [
    normalizeSystem({
      id: "system-001",
      systemCode: "SYS-CEPHE",
      name: "Cephe Sistemi",
      productIds: ["product-001"],
      unit: "m²",
      description: "Cephe ürünlerinin toplandığı sistem.",
      status: "Aktif",
    }),
    normalizeSystem({
      id: "system-002",
      systemCode: "SYS-KAPI",
      name: "Kapı Sistemi",
      productIds: ["product-002"],
      unit: "adet",
      description: "Kapı ve giriş bileşenleri sistemi.",
      status: "Aktif",
    }),
  ],
  "price-analysis": [
    normalizePriceAnalysis({
      id: "price-001",
      analysisCode: "FA-001",
      title: "Cephe Montaj Hizmeti",
      itemName: "Montaj",
      productId: "product-001",
      systemId: "system-001",
      quantity: 120,
      unit: "m²",
      coefficients: 1.1,
      labor: 210,
      price: 450,
      status: "Hazırlanıyor",
      notes: "Saha montaj ve ekipman katsayısı dahil.",
    }),
  ],
  "material-analysis": [
    normalizeMaterialAnalysis({
      id: "material-001",
      analysisCode: "MA-001",
      title: "Cephe Panel Ağacı",
      materialName: "Alüminyum Panel",
      productId: "product-001",
      systemId: "system-001",
      priceAnalysisId: "price-001",
      quantity: 120,
      unit: "m²",
      unitCost: 980,
      wasteFactor: 8,
      status: "Hazırlanıyor",
      notes: "Kesim fire oranı dahil edilmiştir.",
    }),
  ],
  offers: [
    normalizeOffer({
      id: "offer-001",
      offerCode: "TK-001",
      title: "Maslak Ofis Cephe Teklifi",
      projectId: "project-001",
      customerId: "customer-001",
      priceAnalysisId: "price-001",
      materialAnalysisId: "material-001",
      amount: 146520,
      currency: "TRY",
      status: "Gönderildi",
      notes: "Fiyat ve malzeme analizi bağlantıları hazır.",
    }),
  ],
  projects: [
    normalizeProject({
      id: "project-001",
      projectCode: "PRJ-001",
      name: "Maslak Ofis Giydirme Cephe",
      type: "Kurumsal",
      customerId: "customer-001",
      offerId: "offer-001",
      systemId: "system-001",
      description: "Tekliften üretime geçen proje kaydı.",
      status: "Aktif",
    }),
  ],
  crm: [
    normalizeCustomer({
      id: "customer-001",
      customerCode: "CRM-001",
      name: "Atlas Yapı A.Ş.",
      sector: "İnşaat",
      contactPerson: "Murat Demir",
      phone: "+90 532 000 00 00",
      email: "murat.demir@atlasyapi.com",
      notes: "Ana karar verici proje müdürü.",
      status: "Aktif",
    }),
  ],
  research: [
    normalizeResearch({
      id: "research-001",
      title: "Cephe Panel Tedarik Araştırması",
      category: "Tedarik",
      supplier: "DD Metal Çözüm",
      productId: "product-001",
      notes: "Teslim süresi 12 gün, alternatif kaplama seçenekleri mevcut.",
      status: "Değerlendiriliyor",
    }),
  ],
});

const buildInitialRecords = () => {
  const storedState = getStoredData(STORAGE_KEYS.appState, null);

  if (storedState) {
    return ENTITY_MODULES.reduce((accumulator, moduleId) => {
      const normalize = NORMALIZERS[moduleId];
      accumulator[moduleId] = Array.isArray(storedState[moduleId])
        ? storedState[moduleId].map((item) => normalize(item))
        : [];
      return accumulator;
    }, {});
  }

  const seed = createSeedData();
  const legacyProjects = getStoredData(STORAGE_KEYS.legacyProjects, []);
  const legacyResearch = getStoredData(STORAGE_KEYS.legacyResearch, []);
  const legacyOffers = getStoredData(STORAGE_KEYS.legacyOffers, []);

  return {
    ...seed,
    projects:
      legacyProjects.length > 0
        ? legacyProjects.map((item) =>
            normalizeProject({
              ...item,
              source: item.source || "local",
            })
          )
        : seed.projects,
    research:
      legacyResearch.length > 0
        ? legacyResearch.map((item) =>
            normalizeResearch({
              ...item,
              source: item.source || "local",
            })
          )
        : seed.research,
    offers:
      legacyOffers.length > 0
        ? legacyOffers.map((item) =>
            normalizeOffer({
              ...item,
              source: item.source || "local",
            })
          )
        : seed.offers,
  };
};

const buildInitialLoadState = () =>
  ENTITY_MODULES.reduce((accumulator, moduleId) => {
    accumulator[moduleId] = {
      loading: REMOTE_MODULES.includes(moduleId),
      error: "",
      lastSync: "",
    };
    return accumulator;
  }, {});

const buildInitialSelectionState = (initialRecords) =>
  ENTITY_MODULES.reduce((accumulator, moduleId) => {
    accumulator[moduleId] = initialRecords[moduleId]?.[0]?.id || null;
    return accumulator;
  }, {});

const sortRecordsByUpdatedAt = (items = []) =>
  [...items].sort(
    (left, right) => new Date(right.updatedAt || right.createdAt) - new Date(left.updatedAt || left.createdAt)
  );

const MODULE_CONFIGS = {
  products: {
    singular: "Ürün",
    plural: "Ürünler",
    statusOptions: ["Aktif", "Beklemede", "Pasif"],
    searchPlaceholder: "DDP kodu veya ürün adı ara",
    emptyTitle: "Henüz ürün kaydı yok",
    emptyDescription: "Yeni ürün oluşturarak gerçek veri girişine başlayabilirsin.",
    fields: [
      { name: "ddpCode", label: "DDP kodu", type: "text", required: true },
      { name: "name", label: "Ürün adı", type: "text", required: true },
      { name: "systemId", label: "Sistem", type: "relation", relation: "systems" },
      { name: "unit", label: "Birim", type: "text", required: true },
      { name: "description", label: "Açıklama", type: "textarea" },
      { name: "status", label: "Durum", type: "select", options: ["Aktif", "Beklemede", "Pasif"] },
    ],
    primaryField: "name",
    secondaryField: "ddpCode",
    summary: (record) => record.description || "Açıklama eklenmedi.",
  },
  systems: {
    singular: "Sistem",
    plural: "Sistemler",
    statusOptions: ["Aktif", "Beklemede", "Pasif"],
    searchPlaceholder: "Sistem kodu veya sistem adı ara",
    emptyTitle: "Henüz sistem kaydı yok",
    emptyDescription: "Ürünleri bağlayabileceğin yeni sistemler oluştur.",
    fields: [
      { name: "systemCode", label: "Sistem kodu", type: "text", required: true },
      { name: "name", label: "Sistem adı", type: "text", required: true },
      {
        name: "productIds",
        label: "Ürün ilişkileri",
        type: "multiselect",
        relation: "products",
      },
      { name: "unit", label: "Birim", type: "text", required: true },
      { name: "description", label: "Açıklama", type: "textarea" },
      { name: "status", label: "Durum", type: "select", options: ["Aktif", "Beklemede", "Pasif"] },
    ],
    primaryField: "name",
    secondaryField: "systemCode",
    summary: (record, lookup) => {
      const count = Array.isArray(record.productIds) ? record.productIds.length : 0;
      return `${count} ürün bağlı · ${lookup.products(record.productIds).join(", ") || "Ürün seçilmedi"}`;
    },
  },
  "price-analysis": {
    singular: "Fiyat analizi",
    plural: "Fiyat analizleri",
    statusOptions: ["Hazırlanıyor", "Beklemede", "Onaylandı"],
    searchPlaceholder: "Analiz kodu veya hizmet kalemi ara",
    emptyTitle: "Henüz fiyat analizi yok",
    emptyDescription: "Bağımsız hizmet kalemleri için fiyat analizi oluştur.",
    fields: [
      { name: "analysisCode", label: "Analiz kodu", type: "text", required: true },
      { name: "title", label: "Analiz adı", type: "text", required: true },
      { name: "itemName", label: "Hizmet kalemi", type: "text", required: true },
      { name: "productId", label: "Ürün", type: "relation", relation: "products" },
      { name: "systemId", label: "Sistem", type: "relation", relation: "systems" },
      { name: "quantity", label: "Miktar", type: "number", required: true },
      { name: "unit", label: "Birim", type: "text", required: true },
      { name: "coefficients", label: "Katsayı", type: "number", required: true },
      { name: "labor", label: "İşçilik", type: "number", required: true },
      { name: "price", label: "Fiyat", type: "number", required: true },
      { name: "notes", label: "Not", type: "textarea" },
      { name: "status", label: "Durum", type: "select", options: ["Hazırlanıyor", "Beklemede", "Onaylandı"] },
    ],
    primaryField: "title",
    secondaryField: "analysisCode",
    summary: (record) => `${record.itemName} · Toplam ${formatCurrency(record.total)}`,
  },
  "material-analysis": {
    singular: "Malzeme analizi",
    plural: "Malzeme analizleri",
    statusOptions: ["Hazırlanıyor", "Beklemede", "Onaylandı"],
    searchPlaceholder: "Analiz kodu veya malzeme adı ara",
    emptyTitle: "Henüz malzeme analizi yok",
    emptyDescription: "Malzeme ağacı ve maliyet kayıtlarını oluşturmaya başla.",
    fields: [
      { name: "analysisCode", label: "Analiz kodu", type: "text", required: true },
      { name: "title", label: "Analiz adı", type: "text", required: true },
      { name: "materialName", label: "Malzeme ağacı kökü", type: "text", required: true },
      { name: "productId", label: "Ürün", type: "relation", relation: "products" },
      { name: "systemId", label: "Sistem", type: "relation", relation: "systems" },
      {
        name: "priceAnalysisId",
        label: "Fiyat analizi bağlantısı",
        type: "relation",
        relation: "price-analysis",
      },
      { name: "quantity", label: "Miktar", type: "number", required: true },
      { name: "unit", label: "Birim", type: "text", required: true },
      { name: "unitCost", label: "Birim maliyet", type: "number", required: true },
      { name: "wasteFactor", label: "Fire / katsayı %", type: "number", required: true },
      { name: "notes", label: "Not", type: "textarea" },
      { name: "status", label: "Durum", type: "select", options: ["Hazırlanıyor", "Beklemede", "Onaylandı"] },
    ],
    primaryField: "title",
    secondaryField: "analysisCode",
    summary: (record) => `${record.materialName} · Toplam ${formatCurrency(record.totalCost)}`,
  },
  offers: {
    singular: "Teklif",
    plural: "Teklifler",
    statusOptions: ["Hazırlanıyor", "Gönderildi", "Onaylandı", "Reddedildi"],
    searchPlaceholder: "Teklif kodu veya teklif adı ara",
    emptyTitle: "Henüz teklif kaydı yok",
    emptyDescription: "Fiyat ve malzeme analizlerini teklife bağlayarak iş akışını ilerlet.",
    fields: [
      { name: "offerCode", label: "Teklif kodu", type: "text", required: true },
      { name: "title", label: "Teklif adı", type: "text", required: true },
      { name: "projectId", label: "Proje", type: "relation", relation: "projects" },
      { name: "customerId", label: "Müşteri", type: "relation", relation: "crm" },
      {
        name: "priceAnalysisId",
        label: "Fiyat analizi",
        type: "relation",
        relation: "price-analysis",
      },
      {
        name: "materialAnalysisId",
        label: "Malzeme analizi",
        type: "relation",
        relation: "material-analysis",
      },
      { name: "amount", label: "Tutar", type: "number", required: true },
      { name: "currency", label: "Para birimi", type: "select", options: ["TRY", "USD", "EUR"] },
      { name: "notes", label: "Not", type: "textarea" },
      { name: "status", label: "Durum", type: "select", options: ["Hazırlanıyor", "Gönderildi", "Onaylandı", "Reddedildi"] },
    ],
    primaryField: "title",
    secondaryField: "offerCode",
    summary: (record) => `${record.amountDisplay} · ${record.status}`,
  },
  projects: {
    singular: "Proje",
    plural: "Projeler",
    statusOptions: ["Taslak", "Aktif", "Beklemede", "Tamamlandı"],
    searchPlaceholder: "Proje kodu veya proje adı ara",
    emptyTitle: "Henüz proje kaydı yok",
    emptyDescription: "Tekliften gelen işleri proje olarak planla.",
    fields: [
      { name: "projectCode", label: "Proje kodu", type: "text", required: true },
      { name: "name", label: "Proje adı", type: "text", required: true },
      { name: "type", label: "Proje tipi", type: "text", required: true },
      { name: "customerId", label: "Müşteri", type: "relation", relation: "crm" },
      { name: "offerId", label: "Teklif", type: "relation", relation: "offers" },
      { name: "systemId", label: "Sistem", type: "relation", relation: "systems" },
      { name: "description", label: "Açıklama", type: "textarea" },
      { name: "status", label: "Durum", type: "select", options: ["Taslak", "Aktif", "Beklemede", "Tamamlandı"] },
    ],
    primaryField: "name",
    secondaryField: "projectCode",
    summary: (record) => `${record.type} · ${record.status}`,
  },
  crm: {
    singular: "Müşteri",
    plural: "Müşteriler",
    statusOptions: ["Aktif", "Beklemede", "Pasif"],
    searchPlaceholder: "Müşteri kodu veya firma adı ara",
    emptyTitle: "Henüz müşteri kaydı yok",
    emptyDescription: "CRM ekranından müşteri ve iletişim bilgilerini ekle.",
    fields: [
      { name: "customerCode", label: "Müşteri kodu", type: "text", required: true },
      { name: "name", label: "Firma adı", type: "text", required: true },
      { name: "sector", label: "Sektör", type: "text", required: true },
      { name: "contactPerson", label: "İlgili kişi", type: "text" },
      { name: "phone", label: "Telefon", type: "tel" },
      { name: "email", label: "E-posta", type: "email" },
      { name: "notes", label: "Not", type: "textarea" },
      { name: "status", label: "Durum", type: "select", options: ["Aktif", "Beklemede", "Pasif"] },
    ],
    primaryField: "name",
    secondaryField: "customerCode",
    summary: (record) => `${record.contactPerson || "Kişi yok"} · ${record.sector}`,
  },
  research: {
    singular: "Araştırma",
    plural: "Araştırmalar",
    statusOptions: ["Değerlendiriliyor", "Hazır", "Beklemede"],
    searchPlaceholder: "Araştırma başlığı veya tedarikçi ara",
    emptyTitle: "Henüz araştırma kaydı yok",
    emptyDescription: "Tedarik ve pazar notlarını merkezi havuza ekle.",
    fields: [
      { name: "title", label: "Araştırma başlığı", type: "text", required: true },
      { name: "category", label: "Kategori", type: "text", required: true },
      { name: "supplier", label: "Tedarikçi", type: "text" },
      { name: "productId", label: "İlgili ürün", type: "relation", relation: "products" },
      { name: "notes", label: "Not", type: "textarea" },
      { name: "status", label: "Durum", type: "select", options: ["Değerlendiriliyor", "Hazır", "Beklemede"] },
    ],
    primaryField: "title",
    secondaryField: "category",
    summary: (record) => `${record.supplier || "Tedarikçi yok"} · ${record.status}`,
  },
};

const getRelationLabel = (moduleId, value, records) => {
  if (!value) {
    return "Bağlı değil";
  }

  const moduleRecords = records[moduleId] || [];
  const record = moduleRecords.find((item) => item.id === value);

  if (!record) {
    return String(value);
  }

  return (
    record.name ||
    record.title ||
    record.ddpCode ||
    record.systemCode ||
    record.analysisCode ||
    record.offerCode ||
    record.projectCode ||
    record.customerCode ||
    record.id
  );
};

const buildLookup = (records) => ({
  products: (value) =>
    (Array.isArray(value) ? value : [value])
      .filter(Boolean)
      .map((id) => getRelationLabel("products", id, records)),
  systems: (value) =>
    (Array.isArray(value) ? value : [value])
      .filter(Boolean)
      .map((id) => getRelationLabel("systems", id, records)),
  offers: (value) =>
    (Array.isArray(value) ? value : [value])
      .filter(Boolean)
      .map((id) => getRelationLabel("offers", id, records)),
  projects: (value) =>
    (Array.isArray(value) ? value : [value])
      .filter(Boolean)
      .map((id) => getRelationLabel("projects", id, records)),
  customers: (value) =>
    (Array.isArray(value) ? value : [value])
      .filter(Boolean)
      .map((id) => getRelationLabel("crm", id, records)),
  analyses: (value) =>
    (Array.isArray(value) ? value : [value])
      .filter(Boolean)
      .map((id) =>
        getRelationLabel("price-analysis", id, records) ||
        getRelationLabel("material-analysis", id, records)
      ),
});

const createDraft = (moduleId, record = null) => {
  const config = MODULE_CONFIGS[moduleId];

  return config.fields.reduce((accumulator, field) => {
    const defaultValue =
      field.type === "multiselect"
        ? []
        : field.options?.[0] ||
          (field.type === "number" ? "" : "");

    accumulator[field.name] =
      record?.[field.name] !== undefined && record?.[field.name] !== null
        ? record[field.name]
        : defaultValue;

    return accumulator;
  }, {});
};

const mergeRemoteRecords = (currentRecords, incomingRecords, moduleId) => {
  const normalize = NORMALIZERS[moduleId];
  const localOnly = currentRecords.filter((record) => record.source !== "api");
  const normalizedIncoming = incomingRecords.map((record) =>
    normalize({
      ...record,
      source: "api",
    })
  );
  const map = new Map();

  [...normalizedIncoming, ...localOnly].forEach((record) => {
    map.set(record.id, record);
  });

  return sortRecordsByUpdatedAt(Array.from(map.values()));
};

const buildModuleRecord = (moduleId, draft, existingRecord) => {
  const baseRecord = {
    id: existingRecord?.id || createId(moduleId),
    source: existingRecord?.source || "local",
    createdAt: existingRecord?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  switch (moduleId) {
    case "products":
      return normalizeProduct({
        ...existingRecord,
        ...baseRecord,
        ddpCode: draft.ddpCode,
        name: draft.name,
        systemId: draft.systemId || null,
        unit: draft.unit,
        description: draft.description,
        status: draft.status,
      });
    case "systems":
      return normalizeSystem({
        ...existingRecord,
        ...baseRecord,
        systemCode: draft.systemCode,
        name: draft.name,
        productIds: draft.productIds || [],
        unit: draft.unit,
        description: draft.description,
        status: draft.status,
      });
    case "price-analysis": {
      const record = normalizePriceAnalysis({
        ...existingRecord,
        ...baseRecord,
        analysisCode: draft.analysisCode,
        title: draft.title,
        itemName: draft.itemName,
        productId: draft.productId || null,
        systemId: draft.systemId || null,
        quantity: draft.quantity,
        unit: draft.unit,
        coefficients: draft.coefficients,
        labor: draft.labor,
        price: draft.price,
        notes: draft.notes,
        status: draft.status,
      });
      return {
        ...record,
        total: calculatePriceTotal(record),
        items: makePriceItems(record),
      };
    }
    case "material-analysis": {
      const record = normalizeMaterialAnalysis({
        ...existingRecord,
        ...baseRecord,
        analysisCode: draft.analysisCode,
        title: draft.title,
        materialName: draft.materialName,
        productId: draft.productId || null,
        systemId: draft.systemId || null,
        priceAnalysisId: draft.priceAnalysisId || null,
        quantity: draft.quantity,
        unit: draft.unit,
        unitCost: draft.unitCost,
        wasteFactor: draft.wasteFactor,
        notes: draft.notes,
        status: draft.status,
      });
      return {
        ...record,
        totalCost: calculateMaterialTotal(record),
        nodes: makeMaterialNodes(record),
      };
    }
    case "offers": {
      const record = normalizeOffer({
        ...existingRecord,
        ...baseRecord,
        offerCode: draft.offerCode,
        title: draft.title,
        projectId: draft.projectId || null,
        customerId: draft.customerId || null,
        priceAnalysisId: draft.priceAnalysisId || null,
        materialAnalysisId: draft.materialAnalysisId || null,
        amount: draft.amount,
        currency: draft.currency,
        notes: draft.notes,
        status: draft.status,
      });
      return {
        ...record,
        amountDisplay: formatCurrency(record.amount, record.currency),
      };
    }
    case "projects":
      return normalizeProject({
        ...existingRecord,
        ...baseRecord,
        projectCode: draft.projectCode,
        name: draft.name,
        type: draft.type,
        customerId: draft.customerId || null,
        offerId: draft.offerId || null,
        systemId: draft.systemId || null,
        description: draft.description,
        status: draft.status,
      });
    case "crm":
      return normalizeCustomer({
        ...existingRecord,
        ...baseRecord,
        customerCode: draft.customerCode,
        name: draft.name,
        sector: draft.sector,
        contactPerson: draft.contactPerson,
        phone: draft.phone,
        email: draft.email,
        notes: draft.notes,
        status: draft.status,
      });
    case "research":
      return normalizeResearch({
        ...existingRecord,
        ...baseRecord,
        title: draft.title,
        category: draft.category,
        supplier: draft.supplier,
        productId: draft.productId || null,
        notes: draft.notes,
        status: draft.status,
      });
    default:
      return existingRecord;
  }
};

const buildWorkflowLinks = (moduleId, record) => {
  switch (moduleId) {
    case "products":
      return [
        { label: "Bağlı sistem", moduleId: "systems", recordId: record.systemId },
        { label: "Fiyat analizi", moduleId: "price-analysis", matchField: "productId", value: record.id },
        { label: "Malzeme analizi", moduleId: "material-analysis", matchField: "productId", value: record.id },
      ];
    case "systems":
      return [
        { label: "Bağlı ürünler", moduleId: "products", matchField: "systemId", value: record.id },
        { label: "Fiyat analizleri", moduleId: "price-analysis", matchField: "systemId", value: record.id },
        { label: "Projeler", moduleId: "projects", matchField: "systemId", value: record.id },
      ];
    case "price-analysis":
      return [
        { label: "Ürün", moduleId: "products", recordId: record.productId },
        { label: "Sistem", moduleId: "systems", recordId: record.systemId },
        { label: "Malzeme analizi", moduleId: "material-analysis", matchField: "priceAnalysisId", value: record.id },
        { label: "Teklif", moduleId: "offers", matchField: "priceAnalysisId", value: record.id },
      ];
    case "material-analysis":
      return [
        { label: "Fiyat analizi", moduleId: "price-analysis", recordId: record.priceAnalysisId },
        { label: "Teklif", moduleId: "offers", matchField: "materialAnalysisId", value: record.id },
      ];
    case "offers":
      return [
        { label: "Proje", moduleId: "projects", recordId: record.projectId },
        { label: "Müşteri", moduleId: "crm", recordId: record.customerId },
        { label: "Fiyat analizi", moduleId: "price-analysis", recordId: record.priceAnalysisId },
        { label: "Malzeme analizi", moduleId: "material-analysis", recordId: record.materialAnalysisId },
      ];
    case "projects":
      return [
        { label: "Teklif", moduleId: "offers", recordId: record.offerId },
        { label: "Müşteri", moduleId: "crm", recordId: record.customerId },
        { label: "Sistem", moduleId: "systems", recordId: record.systemId },
      ];
    case "crm":
      return [
        { label: "Projeler", moduleId: "projects", matchField: "customerId", value: record.id },
        { label: "Teklifler", moduleId: "offers", matchField: "customerId", value: record.id },
      ];
    case "research":
      return [
        { label: "İlgili ürün", moduleId: "products", recordId: record.productId },
      ];
    default:
      return [];
  }
};

const getRelatedRecords = (link, records) => {
  const moduleRecords = records[link.moduleId] || [];

  if (link.recordId) {
    return moduleRecords.filter((record) => record.id === link.recordId);
  }

  if (link.matchField && link.value) {
    return moduleRecords.filter((record) => {
      const fieldValue = record[link.matchField];
      return Array.isArray(fieldValue)
        ? fieldValue.includes(link.value)
        : fieldValue === link.value;
    });
  }

  return [];
};

function App() {
  const initialRecords = useMemo(() => buildInitialRecords(), []);

  const [activeModule, setActiveModule] = useState(() =>
    findModuleByHash(typeof window !== "undefined" ? window.location.hash : "#dashboard").id
  );
  const [records, setRecords] = useState(initialRecords);
  const [loadState, setLoadState] = useState(buildInitialLoadState);
  const [selectedIds, setSelectedIds] = useState(() =>
    buildInitialSelectionState(initialRecords)
  );
  const [filters, setFilters] = useState(() =>
    ENTITY_MODULES.reduce((accumulator, moduleId) => {
      accumulator[moduleId] = { search: "", status: "all" };
      return accumulator;
    }, {})
  );
  const [editorState, setEditorState] = useState({
    moduleId: "",
    mode: "create",
    recordId: null,
    draft: null,
  });
  const [systemLogs, setSystemLogs] = useState(() =>
    getStoredData(STORAGE_KEYS.logs, [
      {
        id: "log-initial",
        message: "DDPro çalışma alanı başlatıldı.",
        moduleId: "dashboard",
        date: formatDate(),
      },
    ])
  );
  const [aiMessages, setAiMessages] = useState(() =>
    getStoredData(STORAGE_KEYS.ai, [
      {
        id: "ai-welcome",
        role: "assistant",
        text:
          "DDPro AI hazır. Ürün → sistem → fiyat analizi → malzeme analizi → teklif → proje → CRM zinciri için yönlendirme üretebilirim.",
        date: formatDate(),
      },
    ])
  );
  const [aiInput, setAiInput] = useState("");

  const appendLog = (message, moduleId = activeModule) => {
    setSystemLogs((currentLogs) => [
      {
        id: createId("log"),
        message,
        moduleId,
        date: formatDate(),
      },
      ...currentLogs,
    ].slice(0, 80));
  };

  useEffect(() => {
    const nextState = ENTITY_MODULES.reduce((accumulator, moduleId) => {
      accumulator[moduleId] = records[moduleId] || [];
      return accumulator;
    }, {});

    window.localStorage.setItem(STORAGE_KEYS.appState, JSON.stringify(nextState));
  }, [records]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.logs, JSON.stringify(systemLogs));
  }, [systemLogs]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.ai, JSON.stringify(aiMessages));
  }, [aiMessages]);

  useEffect(() => {
    const currentHash = window.location.hash || "#dashboard";
    const module = findModuleByHash(currentHash);
    if (module.id !== activeModule) {
      setActiveModule(module.id);
    }

    const onHashChange = () => {
      const nextModule = findModuleByHash(window.location.hash);
      setActiveModule(nextModule.id);
    };

    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [activeModule]);

  useEffect(() => {
    const module = MODULES.find((item) => item.id === activeModule);
    if (module && window.location.hash !== module.hash) {
      window.history.replaceState(null, "", module.hash);
    }
  }, [activeModule]);

  const loadRemoteModule = async (moduleId) => {
    const loaders = {
      projects: getProjects,
      research: getResearchItems,
      offers: getOffers,
    };

    const loader = loaders[moduleId];

    if (!loader) {
      return;
    }

    setLoadState((current) => ({
      ...current,
      [moduleId]: {
        ...current[moduleId],
        loading: true,
        error: "",
      },
    }));

    try {
      const remoteData = await loader();
      setRecords((current) => ({
        ...current,
        [moduleId]: mergeRemoteRecords(current[moduleId] || [], remoteData || [], moduleId),
      }));
      setLoadState((current) => ({
        ...current,
        [moduleId]: {
          loading: false,
          error: "",
          lastSync: formatDate(),
        },
      }));
      appendLog(`${MODULE_CONFIGS[moduleId].plural} API üzerinden yenilendi.`, moduleId);
    } catch (error) {
      setLoadState((current) => ({
        ...current,
        [moduleId]: {
          ...current[moduleId],
          loading: false,
          error: error.message || "Yükleme başarısız oldu.",
        },
      }));
      appendLog(`${MODULE_CONFIGS[moduleId].plural} yüklenemedi: ${error.message}`, moduleId);
    }
  };

  useEffect(() => {
    REMOTE_MODULES.forEach((moduleId) => {
      loadRemoteModule(moduleId);
    });
  }, []);

  useEffect(() => {
    ENTITY_MODULES.forEach((moduleId) => {
      if (!selectedIds[moduleId] && records[moduleId]?.length > 0) {
        setSelectedIds((current) => ({
          ...current,
          [moduleId]: records[moduleId][0].id,
        }));
      }
    });
  }, [records, selectedIds]);

  const lookup = useMemo(() => buildLookup(records), [records]);

  const moduleCounts = useMemo(
    () =>
      ENTITY_MODULES.reduce((accumulator, moduleId) => {
        accumulator[moduleId] = records[moduleId]?.length || 0;
        return accumulator;
      }, {}),
    [records]
  );

  const recentRecords = useMemo(() => {
    return ENTITY_MODULES.flatMap((moduleId) =>
      (records[moduleId] || []).map((record) => ({
        id: `${moduleId}-${record.id}`,
        moduleId,
        recordId: record.id,
        title:
          record.name ||
          record.title ||
          record.itemName ||
          record.materialName ||
          record.ddpCode ||
          record.systemCode ||
          record.offerCode ||
          record.projectCode ||
          record.customerCode,
        status: record.status,
        updatedAt: record.updatedAt || record.createdAt,
      }))
    )
      .sort((left, right) => new Date(right.updatedAt) - new Date(left.updatedAt))
      .slice(0, 8);
  }, [records]);

  const dashboardCards = useMemo(
    () => [
      {
        label: "Toplam Ürün",
        value: moduleCounts.products,
        meta: `${records.products.filter((item) => item.status === "Aktif").length} aktif`,
      },
      {
        label: "Açık Sistem",
        value: moduleCounts.systems,
        meta: `${records["price-analysis"].length} fiyat analizi bağlı`,
      },
      {
        label: "Teklif Hacmi",
        value: records.offers.length,
        meta: `${records.offers.filter((item) => item.status === "Onaylandı").length} onaylı`,
      },
      {
        label: "CRM Kayıtları",
        value: moduleCounts.crm,
        meta: `${records.projects.length} proje bağlı`,
      },
    ],
    [moduleCounts, records]
  );

  const selectedRecord =
    ENTITY_MODULES.includes(activeModule) && selectedIds[activeModule]
      ? records[activeModule]?.find((item) => item.id === selectedIds[activeModule]) || null
      : null;

  const filteredRecords = useMemo(() => {
    return ENTITY_MODULES.reduce((accumulator, moduleId) => {
      const config = MODULE_CONFIGS[moduleId];
      const { search, status } = filters[moduleId];
      accumulator[moduleId] = (records[moduleId] || []).filter((record) => {
        const haystack = config.fields
          .map((field) => record[field.name])
          .flat()
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        const searchMatch = !search || haystack.includes(search.toLowerCase());
        const statusMatch = status === "all" || record.status === status;
        return searchMatch && statusMatch;
      });
      return accumulator;
    }, {});
  }, [filters, records]);

  const openCreateForm = (moduleId) => {
    setActiveModule(moduleId);
    setEditorState({
      moduleId,
      mode: "create",
      recordId: null,
      draft: createDraft(moduleId),
    });
  };

  const openEditForm = (moduleId, record) => {
    setActiveModule(moduleId);
    setEditorState({
      moduleId,
      mode: "edit",
      recordId: record.id,
      draft: createDraft(moduleId, record),
    });
  };

  const closeForm = () => {
    setEditorState({
      moduleId: "",
      mode: "create",
      recordId: null,
      draft: null,
    });
  };

  const updateDraftField = (fieldName, value) => {
    setEditorState((current) => ({
      ...current,
      draft: {
        ...current.draft,
        [fieldName]: value,
      },
    }));
  };

  const sanitizeReferencesAfterDelete = (currentRecords, deletedModuleId, deletedId) => {
    return ENTITY_MODULES.reduce((accumulator, moduleId) => {
      const config = MODULE_CONFIGS[moduleId];
      accumulator[moduleId] = (currentRecords[moduleId] || []).map((record) => {
        const nextRecord = { ...record };

        config.fields.forEach((field) => {
          if (field.relation !== deletedModuleId) {
            return;
          }

          if (field.type === "relation" && nextRecord[field.name] === deletedId) {
            nextRecord[field.name] = null;
          }

          if (field.type === "multiselect" && Array.isArray(nextRecord[field.name])) {
            nextRecord[field.name] = nextRecord[field.name].filter((value) => value !== deletedId);
          }
        });

        return NORMALIZERS[moduleId](nextRecord);
      });
      return accumulator;
    }, {});
  };

  const applyProductSystemSync = (nextRecords, changedModuleId, record) => {
    if (changedModuleId === "products") {
      nextRecords.systems = nextRecords.systems.map((system) => {
        const productIds = new Set(system.productIds || []);

        if (system.id === record.systemId) {
          productIds.add(record.id);
        } else {
          productIds.delete(record.id);
        }

        return normalizeSystem({
          ...system,
          productIds: Array.from(productIds),
          updatedAt: new Date().toISOString(),
        });
      });
    }

    if (changedModuleId === "systems") {
      const selectedProducts = new Set(record.productIds || []);
      nextRecords.products = nextRecords.products.map((product) => {
        if (selectedProducts.has(product.id)) {
          return normalizeProduct({
            ...product,
            systemId: record.id,
            updatedAt: new Date().toISOString(),
          });
        }

        if (product.systemId === record.id) {
          return normalizeProduct({
            ...product,
            systemId: null,
            updatedAt: new Date().toISOString(),
          });
        }

        return product;
      });
    }

    return nextRecords;
  };

  const saveRecord = (event) => {
    event.preventDefault();

    if (!editorState.moduleId || !editorState.draft) {
      return;
    }

    const config = MODULE_CONFIGS[editorState.moduleId];
    const hasMissingRequiredField = config.fields.some(
      (field) => field.required && !String(editorState.draft[field.name] ?? "").trim()
    );

    if (hasMissingRequiredField) {
      appendLog(`${config.singular} kaydı için zorunlu alanlar eksik.`, editorState.moduleId);
      return;
    }

    const existingRecord = (records[editorState.moduleId] || []).find(
      (item) => item.id === editorState.recordId
    );
    const record = buildModuleRecord(editorState.moduleId, editorState.draft, existingRecord);

    setRecords((current) => {
      const nextModuleRecords = existingRecord
        ? current[editorState.moduleId].map((item) =>
            item.id === existingRecord.id ? record : item
          )
        : [record, ...current[editorState.moduleId]];

      const nextRecords = {
        ...current,
        [editorState.moduleId]: sortRecordsByUpdatedAt(nextModuleRecords),
      };

      return applyProductSystemSync(nextRecords, editorState.moduleId, record);
    });

    setSelectedIds((current) => ({
      ...current,
      [editorState.moduleId]: record.id,
    }));

    appendLog(
      existingRecord
        ? `${config.singular} güncellendi: ${record.name || record.title}`
        : `${config.singular} oluşturuldu: ${record.name || record.title}`,
      editorState.moduleId
    );

    closeForm();
  };

  const deleteRecord = (moduleId, recordId) => {
    const record = (records[moduleId] || []).find((item) => item.id === recordId);

    if (!record) {
      return;
    }

    setRecords((current) => {
      const nextRecords = {
        ...current,
        [moduleId]: current[moduleId].filter((item) => item.id !== recordId),
      };

      return sanitizeReferencesAfterDelete(nextRecords, moduleId, recordId);
    });

    const remainingRecords = (records[moduleId] || []).filter((item) => item.id !== recordId);
    setSelectedIds((current) => ({
      ...current,
      [moduleId]: current[moduleId] === recordId ? remainingRecords[0]?.id || null : current[moduleId],
    }));

    appendLog(
      `${MODULE_CONFIGS[moduleId].singular} silindi: ${record.name || record.title}`,
      moduleId
    );

    if (editorState.recordId === recordId) {
      closeForm();
    }
  };

  const openLinkedRecord = (moduleId, recordId) => {
    if (!recordId) {
      return;
    }

    setActiveModule(moduleId);
    setSelectedIds((current) => ({
      ...current,
      [moduleId]: recordId,
    }));
  };

  const handleAiSubmit = (event) => {
    event.preventDefault();
    const message = aiInput.trim();

    if (!message) {
      return;
    }

    const userMessage = {
      id: createId("ai-user"),
      role: "user",
      text: message,
      date: formatDate(),
    };

    const assistantMessage = {
      id: createId("ai-assistant"),
      role: "assistant",
      text:
        `İstek alındı. Şu anda ${records.products.length} ürün, ${records.systems.length} sistem, ` +
        `${records["price-analysis"].length} fiyat analizi, ${records["material-analysis"].length} malzeme analizi, ` +
        `${records.offers.length} teklif, ${records.projects.length} proje ve ${records.crm.length} müşteri kaydı yönetiliyor. ` +
        "Zinciri ilerletmek için eksik ilişki alanlarını doldurabilir veya yeni kayıt açabilirsin.",
      date: formatDate(),
    };

    setAiMessages((current) => [...current, userMessage, assistantMessage]);
    appendLog(`AI çalışma alanına mesaj gönderildi: ${message}`, "ai");
    setAiInput("");
  };

  const renderFormField = (moduleId, field) => {
    const value = editorState.draft?.[field.name];
    const relationOptions = field.relation
      ? (records[field.relation] || []).map((item) => ({
          value: item.id,
          label:
            item.name ||
            item.title ||
            item.ddpCode ||
            item.systemCode ||
            item.analysisCode ||
            item.offerCode ||
            item.projectCode ||
            item.customerCode ||
            item.id,
        }))
      : [];

    if (field.type === "textarea") {
      return (
        <textarea
          id={`${moduleId}-${field.name}`}
          value={value}
          onChange={(event) => updateDraftField(field.name, event.target.value)}
          rows={4}
        />
      );
    }

    if (field.type === "select") {
      return (
        <select
          id={`${moduleId}-${field.name}`}
          value={value}
          onChange={(event) => updateDraftField(field.name, event.target.value)}
        >
          {field.options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      );
    }

    if (field.type === "relation") {
      return (
        <select
          id={`${moduleId}-${field.name}`}
          value={value || ""}
          onChange={(event) => updateDraftField(field.name, event.target.value)}
        >
          <option value="">Bağlı değil</option>
          {relationOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );
    }

    if (field.type === "multiselect") {
      return (
        <select
          id={`${moduleId}-${field.name}`}
          multiple
          value={Array.isArray(value) ? value : []}
          onChange={(event) =>
            updateDraftField(
              field.name,
              Array.from(event.target.selectedOptions, (option) => option.value)
            )
          }
        >
          {relationOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );
    }

    return (
      <input
        id={`${moduleId}-${field.name}`}
        type={field.type}
        value={value}
        onChange={(event) => updateDraftField(field.name, event.target.value)}
      />
    );
  };

  const renderModuleScreen = (moduleId) => {
    const config = MODULE_CONFIGS[moduleId];
    const moduleRecords = filteredRecords[moduleId] || [];
    const state = loadState[moduleId];
    const selected =
      records[moduleId]?.find((item) => item.id === selectedIds[moduleId]) ||
      moduleRecords[0] ||
      null;
    const isEditingModule = editorState.moduleId === moduleId;

    const detailRows = selected
      ? config.fields.map((field) => {
          const rawValue = selected[field.name];
          let displayValue = rawValue;

          if (field.type === "relation") {
            displayValue = getRelationLabel(field.relation, rawValue, records);
          }

          if (field.type === "multiselect") {
            displayValue = (rawValue || [])
              .map((value) => getRelationLabel(field.relation, value, records))
              .join(", ");
          }

          return {
            label: field.label,
            value:
              displayValue === undefined ||
              displayValue === null ||
              displayValue === "" ||
              (Array.isArray(displayValue) && displayValue.length === 0)
                ? "Belirtilmedi"
                : String(displayValue),
          };
        })
      : [];

    const extraRows = [];

    if (moduleId === "price-analysis" && selected) {
      extraRows.push({ label: "Toplam", value: formatCurrency(selected.total) });
      extraRows.push({ label: "PriceAnalysisItem", value: `${selected.items.length} kalem` });
    }

    if (moduleId === "material-analysis" && selected) {
      extraRows.push({ label: "Toplam maliyet", value: formatCurrency(selected.totalCost) });
      extraRows.push({ label: "MaterialNode", value: `${selected.nodes.length} düğüm` });
    }

    if (moduleId === "offers" && selected) {
      extraRows.push({ label: "Tutar görünümü", value: selected.amountDisplay });
    }

    const workflowLinks = selected ? buildWorkflowLinks(moduleId, selected) : [];

    return (
      <div className="module-shell">
        <div className="module-topbar">
          <div className="toolbar-group search-group">
            <input
              type="search"
              value={filters[moduleId].search}
              placeholder={config.searchPlaceholder}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  [moduleId]: {
                    ...current[moduleId],
                    search: event.target.value,
                  },
                }))
              }
            />
            <select
              value={filters[moduleId].status}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  [moduleId]: {
                    ...current[moduleId],
                    status: event.target.value,
                  },
                }))
              }
            >
              <option value="all">Tüm durumlar</option>
              {config.statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>

          <div className="toolbar-group action-group">
            {REMOTE_MODULES.includes(moduleId) && (
              <button
                type="button"
                className="secondary-button"
                onClick={() => loadRemoteModule(moduleId)}
                disabled={state.loading}
              >
                {state.loading ? "Yükleniyor..." : "Yenile"}
              </button>
            )}
            <button type="button" onClick={() => openCreateForm(moduleId)}>
              + Yeni {config.singular}
            </button>
          </div>
        </div>

        {state.error && (
          <div className="status-banner danger">
            {state.error}
          </div>
        )}

        <div className="module-layout-grid">
          <section className="panel records-panel">
            <div className="panel-header">
              <div>
                <h2>{config.plural}</h2>
                <span className="panel-meta">{moduleRecords.length} kayıt</span>
              </div>
              <div className="panel-meta-stack">
                {state.lastSync && <span>Son senkron: {state.lastSync}</span>}
                <span>{config.statusOptions.length} filtre</span>
              </div>
            </div>

            <div className="panel-content list-panel-content">
              {state.loading ? (
                <div className="state-box loading-state">
                  <strong>{config.plural} yükleniyor</strong>
                  <p>Liste ve detay alanı hazırlanıyor.</p>
                </div>
              ) : moduleRecords.length === 0 ? (
                <div className="state-box empty-state-box">
                  <strong>{config.emptyTitle}</strong>
                  <p>{config.emptyDescription}</p>
                </div>
              ) : (
                <div className="record-list">
                  {moduleRecords.map((record) => {
                    const isSelected = selected?.id === record.id;
                    const summary = config.summary(record, lookup);
                    const title = record[config.primaryField] || record.title || record.name;
                    const subtitle = record[config.secondaryField] || formatDate(record.updatedAt);

                    return (
                      <article
                        key={record.id}
                        className={`record-card${isSelected ? " selected" : ""}`}
                        onClick={() =>
                          setSelectedIds((current) => ({
                            ...current,
                            [moduleId]: record.id,
                          }))
                        }
                      >
                        <div className="record-card-top">
                          <div>
                            <h3>{title}</h3>
                            <span>{subtitle}</span>
                          </div>
                          <span className={`status-badge ${getStatusTone(record.status)}`}>
                            {record.status}
                          </span>
                        </div>
                        <p>{summary}</p>
                        <div className="record-card-footer">
                          <span>{formatDate(record.updatedAt)}</span>
                          <span className="source-chip">{record.source === "api" ? "API" : "Taslak"}</span>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          <section className="panel detail-panel">
            <div className="panel-header">
              <div>
                <h2>{isEditingModule ? "Kayıt Formu" : `${config.singular} Detayı`}</h2>
                <span className="panel-meta">
                  {isEditingModule
                    ? editorState.mode === "edit"
                      ? "Düzenleme modu"
                      : "Yeni kayıt modu"
                    : selected
                      ? "Detay görünümü"
                      : "Seçim bekleniyor"}
                </span>
              </div>
              {selected && !isEditingModule && (
                <div className="detail-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => openEditForm(moduleId, selected)}
                  >
                    Düzenle
                  </button>
                  <button type="button" className="danger-button" onClick={() => deleteRecord(moduleId, selected.id)}>
                    Sil
                  </button>
                </div>
              )}
            </div>

            <div className="panel-content detail-panel-content">
              {isEditingModule ? (
                <form className="module-form" onSubmit={saveRecord}>
                  <div className="form-grid">
                    {config.fields.map((field) => (
                      <label key={field.name} className={field.type === "textarea" ? "field full" : "field"}>
                        <span>
                          {field.label}
                          {field.required ? " *" : ""}
                        </span>
                        {renderFormField(moduleId, field)}
                      </label>
                    ))}
                  </div>

                  <div className="form-actions">
                    <button type="button" className="secondary-button" onClick={closeForm}>
                      Vazgeç
                    </button>
                    <button type="submit">
                      {editorState.mode === "edit" ? "Güncelle" : "Kaydet"}
                    </button>
                  </div>
                </form>
              ) : !selected ? (
                <div className="state-box empty-state-box">
                  <strong>Detay bekleniyor</strong>
                  <p>Sol listeden bir kayıt seç veya yeni kayıt oluştur.</p>
                </div>
              ) : (
                <div className="detail-stack">
                  <div className="detail-hero">
                    <div>
                      <h3>{selected[config.primaryField] || selected.title || selected.name}</h3>
                      <p>{config.summary(selected, lookup)}</p>
                    </div>
                    <span className={`status-badge ${getStatusTone(selected.status)}`}>
                      {selected.status}
                    </span>
                  </div>

                  <div className="detail-grid">
                    {[...detailRows, ...extraRows].map((row) => (
                      <div key={row.label} className="detail-item">
                        <span>{row.label}</span>
                        <strong>{row.value}</strong>
                      </div>
                    ))}
                  </div>

                  <div className="workflow-box">
                    <div className="workflow-header">
                      <h3>İş Akışı Bağlantıları</h3>
                      <span>{workflowLinks.length} bağlantı</span>
                    </div>
                    <div className="workflow-links">
                      {workflowLinks.map((link) => {
                        const relatedRecords = getRelatedRecords(link, records);
                        return (
                          <div key={`${link.label}-${link.moduleId}`} className="workflow-link-card">
                            <span>{link.label}</span>
                            {relatedRecords.length === 0 ? (
                              <strong>Bağlantı yok</strong>
                            ) : (
                              <div className="workflow-link-list">
                                {relatedRecords.slice(0, 4).map((relatedRecord) => (
                                  <button
                                    key={relatedRecord.id}
                                    type="button"
                                    className="link-button"
                                    onClick={() => openLinkedRecord(link.moduleId, relatedRecord.id)}
                                  >
                                    {relatedRecord.name ||
                                      relatedRecord.title ||
                                      relatedRecord.ddpCode ||
                                      relatedRecord.systemCode ||
                                      relatedRecord.analysisCode ||
                                      relatedRecord.offerCode ||
                                      relatedRecord.projectCode ||
                                      relatedRecord.customerCode}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    );
  };

  const renderDashboard = () => {
    const pipelineSteps = [
      { key: "products", label: "Ürün", count: records.products.length },
      { key: "systems", label: "Sistem", count: records.systems.length },
      { key: "price-analysis", label: "Fiyat Analizi", count: records["price-analysis"].length },
      { key: "material-analysis", label: "Malzeme Analizi", count: records["material-analysis"].length },
      { key: "offers", label: "Teklif", count: records.offers.length },
      { key: "projects", label: "Proje", count: records.projects.length },
      { key: "crm", label: "CRM", count: records.crm.length },
    ];

    const systemStatus = [
      {
        label: "API Veri Senkronu",
        value: REMOTE_MODULES.every((moduleId) => !loadState[moduleId].error) ? "Hazır" : "Kontrol Gerekli",
        tone: REMOTE_MODULES.every((moduleId) => !loadState[moduleId].error) ? "success" : "warning",
      },
      {
        label: "Yerel Taslak Kaydı",
        value: "Aktif",
        tone: "success",
      },
      {
        label: "GitHub Pages Build",
        value: "Hazır",
        tone: "info",
      },
      {
        label: "Modül Kapsamı",
        value: `${ENTITY_MODULES.length} ekran`,
        tone: "neutral",
      },
    ];

    return (
      <div className="dashboard-stack">
        <section className="hero-panel">
          <div>
            <span className="eyebrow">DDPRO APP</span>
            <h2>Gerçek iş akışı için merkezi kontrol paneli</h2>
            <p>
              Ürün, sistem, fiyat analizi, malzeme analizi, teklif, proje ve CRM
              kayıtlarını tek akışta yönet.
            </p>
          </div>
          <div className="hero-actions">
            <button type="button" onClick={() => openCreateForm("products")}>
              Yeni Ürün
            </button>
            <button type="button" className="secondary-button" onClick={() => setActiveModule("offers")}>
              Tekliflere Git
            </button>
          </div>
        </section>

        <section className="stats-grid">
          {dashboardCards.map((card) => (
            <article key={card.label} className="stat-card">
              <span>{card.label}</span>
              <strong>{card.value}</strong>
              <small>{card.meta}</small>
            </article>
          ))}
        </section>

        <section className="dashboard-grid">
          <div className="panel">
            <div className="panel-header">
              <div>
                <h2>Hızlı İş Akışı</h2>
                <span className="panel-meta">Ürün → CRM zinciri</span>
              </div>
            </div>
            <div className="panel-content">
              <div className="pipeline-grid">
                {pipelineSteps.map((step) => (
                  <button key={step.key} type="button" className="pipeline-card" onClick={() => setActiveModule(step.key)}>
                    <span>{step.label}</span>
                    <strong>{step.count}</strong>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">
              <div>
                <h2>Sistem Durumu</h2>
                <span className="panel-meta">Canlı operasyon özeti</span>
              </div>
            </div>
            <div className="panel-content status-grid">
              {systemStatus.map((item) => (
                <div key={item.label} className="status-card">
                  <span>{item.label}</span>
                  <strong className={`status-text ${item.tone}`}>{item.value}</strong>
                </div>
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">
              <div>
                <h2>Son İşlemler</h2>
                <span className="panel-meta">Güncel kayıt hareketleri</span>
              </div>
            </div>
            <div className="panel-content recent-grid">
              {recentRecords.map((item) => (
                <button key={item.id} type="button" className="recent-card" onClick={() => openLinkedRecord(item.moduleId, item.recordId)}>
                  <span>{MODULES.find((module) => module.id === item.moduleId)?.title}</span>
                  <strong>{item.title}</strong>
                  <small>{item.status} · {formatDate(item.updatedAt)}</small>
                </button>
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">
              <div>
                <h2>Sistem Logları</h2>
                <span className="panel-meta">Son 8 kayıt</span>
              </div>
            </div>
            <div className="panel-content log-list">
              {systemLogs.slice(0, 8).map((log) => (
                <div key={log.id} className="log-item">
                  <strong>{log.message}</strong>
                  <small>{log.date}</small>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    );
  };

  const renderAi = () => {
    const aiInsights = [
      `Ürün / sistem eşleşmeleri: ${records.products.filter((item) => item.systemId).length}/${records.products.length}`,
      `Fiyat ve malzeme analizi ayrımı korunuyor: ${records["price-analysis"].length} / ${records["material-analysis"].length}`,
      `Tekliften projeye dönüşen kayıtlar: ${records.projects.filter((item) => item.offerId).length}`,
    ];

    return (
      <div className="ai-layout">
        <section className="panel ai-chat-panel">
          <div className="panel-header">
            <div>
              <h2>DDPro AI Sohbeti</h2>
              <span className="panel-meta">Operasyon destek alanı</span>
            </div>
          </div>
          <div className="panel-content ai-chat-list">
            {aiMessages.map((message) => (
              <div key={message.id} className={`ai-message ${message.role}`}>
                <strong>{message.role === "assistant" ? "DDPro AI" : "Sen"}</strong>
                <p>{message.text}</p>
                <small>{message.date}</small>
              </div>
            ))}
          </div>
          <form className="ai-form" onSubmit={handleAiSubmit}>
            <textarea
              value={aiInput}
              placeholder="AI çalışma alanına komut veya not gir..."
              onChange={(event) => setAiInput(event.target.value)}
            />
            <button type="submit">Gönder</button>
          </form>
        </section>

        <section className="panel ai-side-panel">
          <div className="panel-header">
            <div>
              <h2>AI İçgörüleri</h2>
              <span className="panel-meta">Anlık veri özeti</span>
            </div>
          </div>
          <div className="panel-content ai-insights">
            {aiInsights.map((insight) => (
              <div key={insight} className="insight-card">
                <strong>{insight}</strong>
              </div>
            ))}
            <div className="insight-card">
              <strong>Önerilen sonraki adım</strong>
              <p>
                Fiyat analizi ve malzeme analizi bağlantısı eksik teklifleri tamamlayıp
                projeye bağla.
              </p>
            </div>
          </div>
        </section>
      </div>
    );
  };

  const currentModule = MODULES.find((module) => module.id === activeModule) || MODULES[0];

  return (
    <div className="ddpro-app-shell">
      <header className="app-header">
        <div className="brand-block">
          <div className="brand-logo">DD</div>
          <div>
            <strong>DOĞRU DİZAYN PRO</strong>
            <span>Gerçek operasyon yönetim arayüzü</span>
          </div>
        </div>
        <div className="top-header-meta">
          <div className="header-chip">
            <span className="status-dot" />
            Sistem aktif
          </div>
          <div className="header-chip subtle">{currentModule.hash}</div>
        </div>
      </header>

      <div className="app-body">
        <aside className="sidebar">
          <div className="sidebar-label">ANA MODÜLLER</div>
          <nav className="sidebar-nav">
            {MODULES.map((module) => (
              <button
                key={module.id}
                type="button"
                className={`nav-item${activeModule === module.id ? " active" : ""}`}
                onClick={() => setActiveModule(module.id)}
              >
                <span className="nav-icon">{module.icon}</span>
                <span className="nav-copy">
                  <strong>{module.title}</strong>
                  <small>{module.short}</small>
                </span>
                {ENTITY_MODULES.includes(module.id) && (
                  <span className="nav-count">{moduleCounts[module.id] || 0}</span>
                )}
              </button>
            ))}
          </nav>
        </aside>

        <main className="main-content">
          <section className="content-header">
            <div>
              <span className="eyebrow">{currentModule.short}</span>
              <h1>{currentModule.title}</h1>
              <p>{currentModule.description}</p>
            </div>
            <div className="content-header-badges">
              <span className="header-chip subtle">Responsive</span>
              <span className="header-chip subtle">Draft + API</span>
            </div>
          </section>

          <section className="content-body">
            {activeModule === "dashboard" && renderDashboard()}
            {activeModule === "ai" && renderAi()}
            {ENTITY_MODULES.includes(activeModule) && renderModuleScreen(activeModule)}
          </section>
        </main>
      </div>
    </div>
  );
}

export default App;
