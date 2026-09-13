import { useEffect, useMemo, useRef, useState } from "react";
import { MODULES, MODULE_ROUTE_MAP, getModuleIdFromHash } from "./module-config.js";
import { getProjects, mapProjectToViewModel } from "./services/projects.service.js";
import { getResearchItems } from "./services/research.service.js";
import {
  deleteOffer as deleteOfferRequest,
  getOffers,
  mapOfferToViewModel,
} from "./services/offers.service.js";
import "./styles.css";

const STORAGE_KEYS = {
  projects: "ddpro_projects_v2",
  research: "ddpro_research_v1",
  offers: "ddpro_offers_v2",
  memory: "ddpro_memory_v1",
  logs: "ddpro_system_logs_v1",
  integrations: "ddpro_integrations_v1",
  products: "ddpro_products_v1",
  systems: "ddpro_systems_v1",
  priceAnalyses: "ddpro_price_analyses_v1",
  materialAnalyses: "ddpro_material_analyses_v1",
  customers: "ddpro_customers_v1",
};

const STATUS_TONES = {
  Aktif: "success",
  Uygun: "success",
  Hazır: "success",
  Onaylandı: "success",
  Gönderildi: "info",
  Taslak: "pending",
  Hazırlanıyor: "pending",
  Beklemede: "pending",
  Pasif: "neutral",
  Arşiv: "neutral",
  Reddedildi: "danger",
  İptal: "danger",
};

const PRODUCT_STATUS_OPTIONS = ["Aktif", "Pasif", "Arşiv"];
const PROJECT_STATUS_OPTIONS = ["Aktif", "Beklemede", "Tamamlandı", "Taslak"];
const OFFER_STATUS_OPTIONS = ["Hazırlanıyor", "Gönderildi", "Onaylandı", "Reddedildi"];
const SYSTEM_CATEGORY_OPTIONS = ["Yangın", "Mekanik", "Elektrik", "Güvenlik", "Altyapı"];
const UNIT_OPTIONS = ["adet", "set", "m", "m²", "m³", "kg", "lt"];
const DEFAULT_VAT_RATE = 20;

const createId = (prefix = "item") =>
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

const formatCurrency = (value, currency = "TRY") => {
  const amount = Number(value || 0);

  try {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(Number.isFinite(amount) ? amount : 0);
  } catch {
    return `${amount.toLocaleString("tr-TR")} ${currency}`;
  }
};

const parseNumber = (value, fallback = 0) => {
  const normalized = String(value ?? "")
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : fallback;
};

const getStoredData = (key, fallback) => {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

const getApiFailureReason = (error) => {
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

  return error.message || "Bilinmeyen hata";
};

const toStatusTone = (status) => STATUS_TONES[status] || "neutral";

const createSystemRecord = (system = {}) => ({
  id: system.id || createId("system"),
  name: system.name || "Adsız sistem",
  code: system.code || `SYS-${String(Math.floor(Math.random() * 900) + 100)}`,
  category: system.category || "Genel",
  description: system.description || "Sistem açıklaması eklenmedi.",
  productIds: Array.isArray(system.productIds) ? system.productIds : [],
  status: system.status || "Aktif",
  date: system.date || formatDate(),
  source: system.source || "local",
});

const createProductRecord = (product = {}) => ({
  id: product.id || createId("product"),
  name: product.name || "Adsız ürün",
  code: product.code || `UR-${String(Math.floor(Math.random() * 9000) + 1000)}`,
  systemId: product.systemId || null,
  unit: product.unit || "adet",
  status: product.status || "Aktif",
  description: product.description || "Ürün açıklaması eklenmedi.",
  date: product.date || formatDate(),
  source: product.source || "local",
});

const createCustomerRecord = (customer = {}) => ({
  id: customer.id || createId("customer"),
  companyName: customer.companyName || "Yeni müşteri",
  contactName: customer.contactName || "Yetkili belirtilmedi",
  email: customer.email || "-",
  phone: customer.phone || "-",
  city: customer.city || "İstanbul",
  notes: customer.notes || "CRM notu eklenmedi.",
  date: customer.date || formatDate(),
  source: customer.source || "local",
});

const createProjectRecord = (project = {}) => {
  const mappedProject = mapProjectToViewModel({
    id: project.id,
    name: project.name || project.title,
    projectType: project.type,
    type: project.type,
    status: project.status,
    createdAt: project.createdAt,
    date: project.date,
  });

  return {
    ...mappedProject,
    id: project.id || mappedProject.id || createId("project"),
    source: project.source || mappedProject.source || "local",
    customerId: project.customerId || null,
    systemIds: Array.isArray(project.systemIds) ? project.systemIds : [],
    summary: project.summary || "Proje özeti eklenmedi.",
  };
};

const calculatePriceItemTotal = (item = {}) => {
  const quantity = parseNumber(item.quantity, 0);
  const unitPrice = parseNumber(item.unitPrice, 0);
  const coefficient = parseNumber(item.coefficient, 1);
  return Number((quantity * unitPrice * coefficient).toFixed(2));
};

const createPriceAnalysisItem = (item = {}) => ({
  id: item.id || createId("service-item"),
  serviceCode: item.serviceCode || `SRV-${String(Math.floor(Math.random() * 900) + 100)}`,
  title: item.title || "Yeni hizmet kalemi",
  unit: item.unit || "adet",
  quantity: String(item.quantity ?? 1),
  unitPrice: String(item.unitPrice ?? 0),
  coefficient: String(item.coefficient ?? 1),
  rule: item.rule || "Standart saha katsayısı",
  total: Number(item.total ?? calculatePriceItemTotal(item)),
});

const createPriceAnalysisRecord = (analysis = {}) => {
  const items = Array.isArray(analysis.items) && analysis.items.length > 0
    ? analysis.items.map((item) => createPriceAnalysisItem(item))
    : [
        createPriceAnalysisItem({
          title: "Keşif ve montaj hizmeti",
          unit: "adet",
          quantity: 1,
          unitPrice: 1250,
          coefficient: 1,
          rule: "Merkezi fiyatlandırma iskeleti",
        }),
      ];

  return {
    id: analysis.id || createId("price-analysis"),
    name: analysis.name || "Yeni fiyat analizi",
    code: analysis.code || `FA-${String(Math.floor(Math.random() * 900) + 100)}`,
    status: analysis.status || "Taslak",
    notes: analysis.notes || "Analiz sonucu notu eklenmedi.",
    items,
    source: analysis.source || "local",
    date: analysis.date || formatDate(),
    lastSavedAt: analysis.lastSavedAt || null,
  };
};

const calculateMaterialItemTotal = (item = {}) => {
  const quantity = parseNumber(item.quantity, 0);
  const unitCost = parseNumber(item.unitCost, 0);
  return Number((quantity * unitCost).toFixed(2));
};

const createMaterialNode = (item = {}) => ({
  id: item.id || createId("material-node"),
  parentId: item.parentId || null,
  level: Number(item.level ?? 0),
  title: item.title || "Yeni malzeme",
  quantity: String(item.quantity ?? 1),
  unit: item.unit || "adet",
  unitCost: String(item.unitCost ?? 0),
  totalCost: Number(item.totalCost ?? calculateMaterialItemTotal(item)),
});

const createMaterialAnalysisRecord = (analysis = {}) => {
  const items = Array.isArray(analysis.items) && analysis.items.length > 0
    ? analysis.items.map((item) => createMaterialNode(item))
    : [
        createMaterialNode({
          title: "Ana malzeme grubu",
          quantity: 1,
          unit: "set",
          unitCost: 980,
        }),
      ];

  return {
    id: analysis.id || createId("material-analysis"),
    name: analysis.name || "Yeni malzeme analizi",
    code: analysis.code || `MA-${String(Math.floor(Math.random() * 900) + 100)}`,
    status: analysis.status || "Taslak",
    notes: analysis.notes || "Malzeme ağacı notu eklenmedi.",
    items,
    source: analysis.source || "local",
    date: analysis.date || formatDate(),
    lastSavedAt: analysis.lastSavedAt || null,
  };
};

const createOfferRecord = (offer = {}) => {
  const baseOffer = mapOfferToViewModel({
    id: offer.id,
    title: offer.title || offer.name,
    amount: offer.totalAmount ?? offer.amount ?? 0,
    currency: offer.currency || "TRY",
    status: offer.status,
    createdAt: offer.createdAt,
    date: offer.date,
    projectId: offer.projectId,
    source: offer.source,
    notes: offer.notes,
  });

  return {
    ...baseOffer,
    id: offer.id || baseOffer.id || createId("offer"),
    title: offer.title || baseOffer.title,
    customerId: offer.customerId || null,
    projectId: offer.projectId || baseOffer.projectId || null,
    analysisIds: Array.isArray(offer.analysisIds) ? offer.analysisIds : [],
    lineItems: Array.isArray(offer.lineItems) ? offer.lineItems : [],
    subtotal: Number(offer.subtotal ?? parseNumber(baseOffer.amountValue, 0)),
    vatRate: Number(offer.vatRate ?? DEFAULT_VAT_RATE),
    vatAmount: Number(offer.vatAmount ?? 0),
    totalAmount: Number(offer.totalAmount ?? parseNumber(baseOffer.amountValue, 0)),
    currency: offer.currency || baseOffer.currency || "TRY",
    notes: offer.notes || baseOffer.notes || "",
    source: offer.source || baseOffer.source || "local",
  };
};

const mergeApiWithLocal = (apiItems = [], localItems = []) => {
  const apiIds = new Set(apiItems.map((item) => item.id));
  const localOnlyItems = localItems.filter(
    (item) => item.source !== "api" && !apiIds.has(item.id)
  );
  return [...apiItems, ...localOnlyItems];
};

const INITIAL_SYSTEMS = [
  createSystemRecord({
    id: "system-fire",
    name: "Yangın Söndürme Sistemi",
    code: "SYS-FIRE-001",
    category: "Yangın",
    description: "Bağımsız yangın altyapısı için ürün bağlantıları ve sistem kuralları.",
  }),
  createSystemRecord({
    id: "system-mech",
    name: "Mekanik Tesisat Sistemi",
    code: "SYS-MECH-002",
    category: "Mekanik",
    description: "Mekanik ekipman ve saha montaj ürünlerinin ayrı veri yapısı.",
  }),
  createSystemRecord({
    id: "system-security",
    name: "Güvenlik ve Zayıf Akım",
    code: "SYS-SEC-003",
    category: "Güvenlik",
    description: "Kamera, algılama ve haberleşme bileşenlerini tutan bağımsız sistem kümesi.",
  }),
];

const INITIAL_PRODUCTS = [
  createProductRecord({
    id: "product-valve",
    name: "Sprinkler Vana Seti",
    code: "UR-FIRE-101",
    systemId: "system-fire",
    unit: "set",
    description: "Yangın sistemi ana vana seti.",
  }),
  createProductRecord({
    id: "product-pipe",
    name: "Galvaniz Boru Hattı",
    code: "UR-MECH-204",
    systemId: "system-mech",
    unit: "m",
    description: "Mekanik tesisat boru hattı ürünü.",
  }),
  createProductRecord({
    id: "product-panel",
    name: "Adresli Yangın Paneli",
    code: "UR-FIRE-305",
    systemId: "system-fire",
    unit: "adet",
    description: "Adresli yangın algılama paneli.",
  }),
  createProductRecord({
    id: "product-camera",
    name: "IP Dome Kamera",
    code: "UR-SEC-410",
    systemId: "system-security",
    unit: "adet",
    description: "Güvenlik sistemi için sabit dome kamera.",
  }),
];

const INITIAL_CUSTOMERS = [
  createCustomerRecord({
    id: "customer-nova",
    companyName: "Nova Yapı A.Ş.",
    contactName: "Ayşe Demir",
    email: "teklif@novayapi.com",
    phone: "+90 212 555 10 10",
    city: "İstanbul",
    notes: "Mekanik ve yangın projelerinde hızlı teklif beklentisi var.",
  }),
  createCustomerRecord({
    id: "customer-zenith",
    companyName: "Zenith Endüstri",
    contactName: "Murat Akın",
    email: "satinalma@zenith.com",
    phone: "+90 312 555 20 20",
    city: "Ankara",
    notes: "Sistem bazlı keşif ve revizyon süreçleri düzenli takip ediliyor.",
  }),
];

const INITIAL_PROJECTS = [
  createProjectRecord({
    id: "project-atrium",
    name: "Atrium Residence Altyapı",
    type: "Konut Projesi",
    status: "Aktif",
    customerId: "customer-nova",
    systemIds: ["system-fire", "system-mech"],
    summary: "Yangın ve mekanik sistem kurulumuna ait teklif ön hazırlığı.",
    source: "local",
  }),
  createProjectRecord({
    id: "project-factory",
    name: "Zenith Fabrika Genişleme",
    type: "Endüstriyel",
    status: "Beklemede",
    customerId: "customer-zenith",
    systemIds: ["system-security"],
    summary: "Güvenlik ve izleme sistemlerinin kapsam çalışması.",
    source: "local",
  }),
];

const INITIAL_PRICE_ANALYSES = [
  createPriceAnalysisRecord({
    id: "price-analysis-1",
    name: "Yangın Pompa Odası Hizmet Analizi",
    code: "FA-201",
    notes: "Pompa odası iş kalemleri ayrı hizmet kalemleri olarak tutulur.",
    items: [
      {
        id: "pa-1-item-1",
        serviceCode: "SRV-510",
        title: "Pompa montaj hizmeti",
        unit: "adet",
        quantity: 2,
        unitPrice: 3500,
        coefficient: 1.1,
        rule: "Kapalı hacim saha katsayısı",
      },
      {
        id: "pa-1-item-2",
        serviceCode: "SRV-511",
        title: "Devreye alma ve test",
        unit: "set",
        quantity: 1,
        unitPrice: 2200,
        coefficient: 1,
        rule: "Standart kabul testi",
      },
    ],
  }),
  createPriceAnalysisRecord({
    id: "price-analysis-2",
    name: "Güvenlik Kamera Devreye Alma",
    code: "FA-202",
    notes: "Ürün kataloğundan bağımsız hizmet kalemi fiyatlandırması.",
    items: [
      {
        id: "pa-2-item-1",
        serviceCode: "SRV-610",
        title: "Kamera montaj hizmeti",
        unit: "adet",
        quantity: 12,
        unitPrice: 420,
        coefficient: 1,
        rule: "Saha standart işçilik",
      },
    ],
  }),
];

const INITIAL_MATERIAL_ANALYSES = [
  createMaterialAnalysisRecord({
    id: "material-analysis-1",
    name: "Pompa Odası Malzeme Ağacı",
    code: "MA-301",
    notes: "Malzeme ağacı fiyat analizinden ayrı modellenir.",
    items: [
      {
        id: "ma-1-root",
        title: "Pompa odası ana grup",
        quantity: 1,
        unit: "set",
        unitCost: 3400,
        level: 0,
      },
      {
        id: "ma-1-child-1",
        parentId: "ma-1-root",
        title: "Kelebek vana",
        quantity: 2,
        unit: "adet",
        unitCost: 780,
        level: 1,
      },
    ],
  }),
  createMaterialAnalysisRecord({
    id: "material-analysis-2",
    name: "Kamera Altyapı Malzeme Ağacı",
    code: "MA-302",
    notes: "Kablo, rack ve montaj aksesuarları ayrı malzeme modeli içinde tutulur.",
    items: [
      {
        id: "ma-2-root",
        title: "Kamera altyapı seti",
        quantity: 1,
        unit: "set",
        unitCost: 2150,
        level: 0,
      },
      {
        id: "ma-2-child-1",
        parentId: "ma-2-root",
        title: "CAT6 kablo",
        quantity: 250,
        unit: "m",
        unitCost: 16,
        level: 1,
      },
    ],
  }),
];

const INITIAL_OFFERS = [
  createOfferRecord({
    id: "offer-local-1",
    title: "Atrium Yangın Ön Teklifi",
    customerId: "customer-nova",
    projectId: "project-atrium",
    status: "Hazırlanıyor",
    analysisIds: ["price-analysis-1"],
    lineItems: [
      {
        analysisId: "price-analysis-1",
        title: "Yangın Pompa Odası Hizmet Analizi",
        total: 9900,
      },
    ],
    subtotal: 9900,
    vatRate: 20,
    vatAmount: 1980,
    totalAmount: 11880,
    currency: "TRY",
    notes: "Yerel teklif taslağıdır; backend kaydı değildir.",
    source: "local",
  }),
];

const INITIAL_MEMORY = [
  {
    id: "memory-1",
    title: "Modül Ayrımı",
    content: "Ürün, sistem, fiyat analizi ve malzeme analizi bağımsız veri modelleriyle tutulur.",
    date: formatDate(),
  },
];

const INITIAL_INTEGRATIONS = [
  {
    id: "ddpro-core",
    name: "DDPro Core",
    status: "Aktif",
    description: "Merkezi uygulama ve veri yönetim katmanı.",
  },
  {
    id: "local-storage",
    name: "Local Storage",
    status: "Aktif",
    description: "Backend karşılığı olmayan taslak kayıtlar burada saklanır.",
  },
  {
    id: "backend-api",
    name: "Backend API",
    status: "Aktif",
    description: "Projeler, araştırma ve teklifler için mevcut API okuma bağlantıları korunur.",
  },
];

function App() {
  const [activeModule, setActiveModule] = useState(() =>
    typeof window === "undefined" ? "dashboard" : getModuleIdFromHash(window.location.hash)
  );

  const [products, setProducts] = useState(() =>
    getStoredData(STORAGE_KEYS.products, INITIAL_PRODUCTS)
  );
  const [systems, setSystems] = useState(() =>
    getStoredData(STORAGE_KEYS.systems, INITIAL_SYSTEMS)
  );
  const [customers, setCustomers] = useState(() =>
    getStoredData(STORAGE_KEYS.customers, INITIAL_CUSTOMERS)
  );
  const [priceAnalyses, setPriceAnalyses] = useState(() =>
    getStoredData(STORAGE_KEYS.priceAnalyses, INITIAL_PRICE_ANALYSES)
  );
  const [materialAnalyses, setMaterialAnalyses] = useState(() =>
    getStoredData(STORAGE_KEYS.materialAnalyses, INITIAL_MATERIAL_ANALYSES)
  );
  const [projects, setProjects] = useState(() =>
    getStoredData(STORAGE_KEYS.projects, INITIAL_PROJECTS)
  );
  const [researchItems, setResearchItems] = useState(() =>
    getStoredData(STORAGE_KEYS.research, [])
  );
  const [offers, setOffers] = useState(() =>
    getStoredData(STORAGE_KEYS.offers, INITIAL_OFFERS).map((offer) => createOfferRecord(offer))
  );
  const [memoryItems, setMemoryItems] = useState(() =>
    getStoredData(STORAGE_KEYS.memory, INITIAL_MEMORY)
  );
  const [systemLogs, setSystemLogs] = useState(() =>
    getStoredData(STORAGE_KEYS.logs, [])
  );
  const [integrations, setIntegrations] = useState(() =>
    getStoredData(STORAGE_KEYS.integrations, INITIAL_INTEGRATIONS)
  );

  const [projectsLoading, setProjectsLoading] = useState(true);
  const [projectsError, setProjectsError] = useState(null);
  const [researchLoading, setResearchLoading] = useState(true);
  const [researchError, setResearchError] = useState(null);
  const [offersLoading, setOffersLoading] = useState(true);
  const [offersError, setOffersError] = useState(null);
  const [offersFetchState, setOffersFetchState] = useState("loading");

  const [productSearch, setProductSearch] = useState("");
  const [productStatusFilter, setProductStatusFilter] = useState("Tümü");
  const [productSystemFilter, setProductSystemFilter] = useState("Tümü");
  const [systemSearch, setSystemSearch] = useState("");
  const [systemCategoryFilter, setSystemCategoryFilter] = useState("Tümü");
  const [crmSearch, setCrmSearch] = useState("");
  const [projectSearch, setProjectSearch] = useState("");
  const [offerSearch, setOfferSearch] = useState("");

  const [selectedProductId, setSelectedProductId] = useState(null);
  const [selectedSystemId, setSelectedSystemId] = useState(null);
  const [selectedPriceAnalysisId, setSelectedPriceAnalysisId] = useState(null);
  const [selectedMaterialAnalysisId, setSelectedMaterialAnalysisId] = useState(null);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [selectedOfferId, setSelectedOfferId] = useState(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);

  const [showProductForm, setShowProductForm] = useState(false);
  const [showSystemForm, setShowSystemForm] = useState(false);
  const [showPriceAnalysisForm, setShowPriceAnalysisForm] = useState(false);
  const [showMaterialAnalysisForm, setShowMaterialAnalysisForm] = useState(false);
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [showOfferForm, setShowOfferForm] = useState(false);
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [showResearchForm, setShowResearchForm] = useState(false);
  const [showMemoryForm, setShowMemoryForm] = useState(false);

  const [productForm, setProductForm] = useState({
    name: "",
    code: "",
    systemId: INITIAL_SYSTEMS[0]?.id || "",
    unit: UNIT_OPTIONS[0],
    status: PRODUCT_STATUS_OPTIONS[0],
    description: "",
  });
  const [systemForm, setSystemForm] = useState({
    name: "",
    code: "",
    category: SYSTEM_CATEGORY_OPTIONS[0],
    description: "",
  });
  const [priceAnalysisForm, setPriceAnalysisForm] = useState({
    name: "",
    code: "",
    notes: "",
  });
  const [materialAnalysisForm, setMaterialAnalysisForm] = useState({
    name: "",
    code: "",
    notes: "",
  });
  const [projectForm, setProjectForm] = useState({
    name: "",
    type: "",
    status: PROJECT_STATUS_OPTIONS[0],
    customerId: INITIAL_CUSTOMERS[0]?.id || "",
    systemIds: [INITIAL_SYSTEMS[0]?.id].filter(Boolean),
    summary: "",
  });
  const [offerForm, setOfferForm] = useState({
    title: "",
    customerId: INITIAL_CUSTOMERS[0]?.id || "",
    projectId: INITIAL_PROJECTS[0]?.id || "",
    status: OFFER_STATUS_OPTIONS[0],
    vatRate: DEFAULT_VAT_RATE,
    analysisIds: INITIAL_PRICE_ANALYSES[0] ? [INITIAL_PRICE_ANALYSES[0].id] : [],
    notes: "",
  });
  const [customerForm, setCustomerForm] = useState({
    companyName: "",
    contactName: "",
    email: "",
    phone: "",
    city: "",
    notes: "",
  });
  const [researchForm, setResearchForm] = useState({ name: "", note: "" });
  const [memoryForm, setMemoryForm] = useState({ title: "", content: "" });
  const [aiInput, setAiInput] = useState("");
  const [aiMessages, setAiMessages] = useState([
    {
      id: "welcome",
      role: "assistant",
      text:
        "DDPro AI çalışma alanı hazır. Ürün, sistem, fiyat analizi veya teklif modülleri üzerinden gelen iş akışlarını burada notlayabilirsin.",
      date: formatDate(),
    },
  ]);

  const projectsTouchedRef = useRef(false);
  const researchTouchedRef = useRef(false);
  const offersTouchedRef = useRef(false);

  const addLog = (message) => {
    const newLog = {
      id: createId("log"),
      message,
      date: formatDate(),
    };

    setSystemLogs((currentLogs) => [newLog, ...currentLogs].slice(0, 60));
  };

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const handleHashChange = () => {
      setActiveModule(getModuleIdFromHash(window.location.hash));
    };

    handleHashChange();
    window.addEventListener("hashchange", handleHashChange);

    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const nextHash = MODULE_ROUTE_MAP[activeModule] || "#/dashboard";

    if (window.location.hash !== nextHash) {
      window.history.replaceState(null, "", nextHash);
    }
  }, [activeModule]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.products, JSON.stringify(products));
  }, [products]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.systems, JSON.stringify(systems));
  }, [systems]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.customers, JSON.stringify(customers));
  }, [customers]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.priceAnalyses, JSON.stringify(priceAnalyses));
  }, [priceAnalyses]);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEYS.materialAnalyses,
      JSON.stringify(materialAnalyses)
    );
  }, [materialAnalyses]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.projects, JSON.stringify(projects));
  }, [projects]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.offers, JSON.stringify(offers));
  }, [offers]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.research, JSON.stringify(researchItems));
  }, [researchItems]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.memory, JSON.stringify(memoryItems));
  }, [memoryItems]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.logs, JSON.stringify(systemLogs));
  }, [systemLogs]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.integrations, JSON.stringify(integrations));
  }, [integrations]);

  useEffect(() => {
    let cancelled = false;

    const fetchProjectsFromApi = async () => {
      const localProjects = getStoredData(STORAGE_KEYS.projects, INITIAL_PROJECTS).map((project) =>
        createProjectRecord(project)
      );
      setProjectsLoading(true);
      setProjectsError(null);

      try {
        const apiProjects = await getProjects();

        if (cancelled) {
          return;
        }

        const normalizedApiProjects = apiProjects.map((project) =>
          createProjectRecord({
            ...project,
            source: "api",
            customerId: project.customerId || null,
            systemIds: project.systemIds || [],
            summary: project.summary || "Canlı proje verisi yüklendi.",
          })
        );

        if (projectsTouchedRef.current) {
          addLog("Projelerde yerel değişiklik algılandı, API yanıtı üzerine yazmadı.");
        } else if (normalizedApiProjects.length > 0) {
          setProjects(mergeApiWithLocal(normalizedApiProjects, localProjects));
          addLog("Projeler API üzerinden yüklendi.");
        } else {
          setProjects(localProjects);
          addLog("Projeler API boş döndü, yerel modül verileri korundu.");
        }
      } catch (error) {
        if (!cancelled) {
          const reason = getApiFailureReason(error);
          setProjects(localProjects);
          setProjectsError(
            `Projeler API erişimi başarısız (${reason}). Yerel taslak veriler gösteriliyor.`
          );
          addLog(`Projelerde API bağlantı hatası: ${reason}. Yerel veriler kullanıldı.`);
        }
      } finally {
        if (!cancelled) {
          setProjectsLoading(false);
        }
      }
    };

    fetchProjectsFromApi();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const fetchResearchFromApi = async () => {
      const localResearch = getStoredData(STORAGE_KEYS.research, []);
      setResearchLoading(true);
      setResearchError(null);

      try {
        const apiResearchItems = await getResearchItems();

        if (cancelled) {
          return;
        }

        if (researchTouchedRef.current) {
          addLog("Araştırmalarda yerel değişiklik algılandı, API yanıtı üzerine yazmadı.");
        } else if (apiResearchItems.length > 0) {
          setResearchItems(apiResearchItems);
          addLog("Araştırmalar API üzerinden yüklendi.");
        } else {
          setResearchItems(localResearch);
          addLog("Araştırmalar API boş döndü, yerel veriler korundu.");
        }
      } catch (error) {
        if (!cancelled) {
          const reason = getApiFailureReason(error);
          setResearchItems(localResearch);
          setResearchError(
            `Araştırma API erişimi başarısız (${reason}). Yerel araştırma verileri gösteriliyor.`
          );
          addLog(`Araştırmalar API bağlantı hatası: ${reason}. Yerel veriler kullanıldı.`);
        }
      } finally {
        if (!cancelled) {
          setResearchLoading(false);
        }
      }
    };

    fetchResearchFromApi();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const fetchOffersFromApi = async () => {
      const localOffers = getStoredData(STORAGE_KEYS.offers, INITIAL_OFFERS).map((offer) =>
        createOfferRecord(offer)
      );
      setOffersLoading(true);
      setOffersError(null);
      setOffersFetchState("loading");

      try {
        const apiOffers = await getOffers();

        if (cancelled) {
          return;
        }

        const normalizedApiOffers = apiOffers.map((offer) =>
          createOfferRecord({
            ...offer,
            source: "api",
            vatRate: DEFAULT_VAT_RATE,
            subtotal: parseNumber(offer.amountValue ?? offer.amount, 0),
            totalAmount: parseNumber(offer.amountValue ?? offer.amount, 0),
          })
        );

        if (offersTouchedRef.current) {
          addLog("Tekliflerde yerel değişiklik algılandı, API yanıtı üzerine yazmadı.");
          setOffersFetchState(normalizedApiOffers.length > 0 ? "success" : "empty");
        } else if (normalizedApiOffers.length > 0) {
          setOffers(mergeApiWithLocal(normalizedApiOffers, localOffers));
          setOffersFetchState("success");
          addLog("Teklifler API üzerinden yüklendi.");
        } else {
          setOffers(localOffers.filter((offer) => offer.source !== "api"));
          setOffersFetchState("empty");
          addLog("Teklif API boş döndü, yerel teklif taslakları gösteriliyor.");
        }
      } catch (error) {
        if (!cancelled) {
          const reason = getApiFailureReason(error);
          setOffers(localOffers);
          setOffersFetchState("error");
          setOffersError(
            localOffers.length > 0
              ? `Teklif API’sine ulaşılamadı (${reason}). Yerel taslaklar gösteriliyor.`
              : `Teklif API’sine ulaşılamadı (${reason}).`
          );
          addLog(`Tekliflerde API bağlantı hatası: ${reason}. Yerel veriler kullanıldı.`);
        }
      } finally {
        if (!cancelled) {
          setOffersLoading(false);
        }
      }
    };

    fetchOffersFromApi();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (products.length > 0 && !products.some((item) => item.id === selectedProductId)) {
      setSelectedProductId(products[0].id);
    }
  }, [products, selectedProductId]);

  useEffect(() => {
    if (systems.length > 0 && !systems.some((item) => item.id === selectedSystemId)) {
      setSelectedSystemId(systems[0].id);
    }
  }, [systems, selectedSystemId]);

  useEffect(() => {
    if (
      priceAnalyses.length > 0 &&
      !priceAnalyses.some((item) => item.id === selectedPriceAnalysisId)
    ) {
      setSelectedPriceAnalysisId(priceAnalyses[0].id);
    }
  }, [priceAnalyses, selectedPriceAnalysisId]);

  useEffect(() => {
    if (
      materialAnalyses.length > 0 &&
      !materialAnalyses.some((item) => item.id === selectedMaterialAnalysisId)
    ) {
      setSelectedMaterialAnalysisId(materialAnalyses[0].id);
    }
  }, [materialAnalyses, selectedMaterialAnalysisId]);

  useEffect(() => {
    if (projects.length > 0 && !projects.some((item) => item.id === selectedProjectId)) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  useEffect(() => {
    if (offers.length > 0 && !offers.some((item) => item.id === selectedOfferId)) {
      setSelectedOfferId(offers[0].id);
    }
  }, [offers, selectedOfferId]);

  useEffect(() => {
    if (customers.length > 0 && !customers.some((item) => item.id === selectedCustomerId)) {
      setSelectedCustomerId(customers[0].id);
    }
  }, [customers, selectedCustomerId]);

  const priceAnalysesWithTotals = useMemo(
    () =>
      priceAnalyses.map((analysis) => ({
        ...analysis,
        items: analysis.items.map((item) => ({
          ...item,
          total: calculatePriceItemTotal(item),
        })),
      })),
    [priceAnalyses]
  );

  const materialAnalysesWithTotals = useMemo(
    () =>
      materialAnalyses.map((analysis) => ({
        ...analysis,
        items: analysis.items.map((item) => ({
          ...item,
          totalCost: calculateMaterialItemTotal(item),
        })),
      })),
    [materialAnalyses]
  );

  const productsBySystem = useMemo(() => {
    const mapping = {};
    products.forEach((product) => {
      const systemId = product.systemId || "unassigned";
      if (!mapping[systemId]) {
        mapping[systemId] = [];
      }
      mapping[systemId].push(product);
    });
    return mapping;
  }, [products]);

  const filteredProducts = useMemo(() => {
    const query = productSearch.trim().toLowerCase();
    return products.filter((product) => {
      const matchesQuery =
        !query ||
        [product.name, product.code, product.description]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));
      const matchesStatus =
        productStatusFilter === "Tümü" || product.status === productStatusFilter;
      const matchesSystem =
        productSystemFilter === "Tümü" || product.systemId === productSystemFilter;

      return matchesQuery && matchesStatus && matchesSystem;
    });
  }, [productSearch, productStatusFilter, productSystemFilter, products]);

  const filteredSystems = useMemo(() => {
    const query = systemSearch.trim().toLowerCase();
    return systems.filter((system) => {
      const matchesQuery =
        !query ||
        [system.name, system.code, system.description]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));
      const matchesCategory =
        systemCategoryFilter === "Tümü" || system.category === systemCategoryFilter;

      return matchesQuery && matchesCategory;
    });
  }, [systemSearch, systemCategoryFilter, systems]);

  const filteredCustomers = useMemo(() => {
    const query = crmSearch.trim().toLowerCase();
    return customers.filter((customer) =>
      [customer.companyName, customer.contactName, customer.email, customer.phone, customer.city]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [crmSearch, customers]);

  const filteredProjects = useMemo(() => {
    const query = projectSearch.trim().toLowerCase();
    return projects.filter((project) =>
      [project.name, project.type, project.summary]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [projectSearch, projects]);

  const filteredOffers = useMemo(() => {
    const query = offerSearch.trim().toLowerCase();
    return offers.filter((offer) =>
      [offer.title, offer.status, offer.notes]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [offerSearch, offers]);

  const dashboardStats = useMemo(
    () => [
      { label: "Ürünler", value: products.length },
      { label: "Sistemler", value: systems.length },
      { label: "Fiyat Analizleri", value: priceAnalyses.length },
      { label: "Malzeme Analizleri", value: materialAnalyses.length },
      { label: "Teklifler", value: offers.length },
      { label: "Müşteriler", value: customers.length },
    ],
    [products, systems, priceAnalyses.length, materialAnalyses.length, offers.length, customers.length]
  );

  const selectedProduct = products.find((product) => product.id === selectedProductId) || null;
  const selectedSystem = systems.find((system) => system.id === selectedSystemId) || null;
  const selectedPriceAnalysis =
    priceAnalysesWithTotals.find((analysis) => analysis.id === selectedPriceAnalysisId) || null;
  const selectedMaterialAnalysis =
    materialAnalysesWithTotals.find((analysis) => analysis.id === selectedMaterialAnalysisId) || null;
  const selectedProject = projects.find((project) => project.id === selectedProjectId) || null;
  const selectedOffer = offers.find((offer) => offer.id === selectedOfferId) || null;
  const selectedCustomer = customers.find((customer) => customer.id === selectedCustomerId) || null;

  const selectedOfferAnalysisDrafts = useMemo(
    () =>
      priceAnalysesWithTotals.filter((analysis) => offerForm.analysisIds.includes(analysis.id)),
    [offerForm.analysisIds, priceAnalysesWithTotals]
  );

  const offerDraftSubtotal = useMemo(
    () =>
      selectedOfferAnalysisDrafts.reduce(
        (sum, analysis) =>
          sum + analysis.items.reduce((analysisSum, item) => analysisSum + item.total, 0),
        0
      ),
    [selectedOfferAnalysisDrafts]
  );

  const offerDraftVatAmount = useMemo(
    () => Number((offerDraftSubtotal * (Number(offerForm.vatRate) || 0) / 100).toFixed(2)),
    [offerDraftSubtotal, offerForm.vatRate]
  );

  const currentModule = MODULES.find((module) => module.id === activeModule) || MODULES[0];

  const getSystemName = (systemId) => systems.find((system) => system.id === systemId)?.name || "Atanmadı";
  const getCustomerName = (customerId) =>
    customers.find((customer) => customer.id === customerId)?.companyName || "Müşteri seçilmedi";
  const getProjectName = (projectId) =>
    projects.find((project) => project.id === projectId)?.name || "Proje seçilmedi";

  const createProduct = (event) => {
    event.preventDefault();

    if (!productForm.name.trim()) {
      return;
    }

    const newProduct = createProductRecord({
      ...productForm,
      name: productForm.name.trim(),
      code: productForm.code.trim(),
      description: productForm.description.trim(),
    });

    setProducts((currentProducts) => [newProduct, ...currentProducts]);
    setSelectedProductId(newProduct.id);
    setShowProductForm(false);
    setProductForm({
      name: "",
      code: "",
      systemId: systems[0]?.id || "",
      unit: UNIT_OPTIONS[0],
      status: PRODUCT_STATUS_OPTIONS[0],
      description: "",
    });
    addLog(`Yeni ürün taslağı oluşturuldu: ${newProduct.name}`);
  };

  const createSystem = (event) => {
    event.preventDefault();

    if (!systemForm.name.trim()) {
      return;
    }

    const newSystem = createSystemRecord({
      ...systemForm,
      name: systemForm.name.trim(),
      code: systemForm.code.trim(),
      description: systemForm.description.trim(),
    });

    setSystems((currentSystems) => [newSystem, ...currentSystems]);
    setSelectedSystemId(newSystem.id);
    setShowSystemForm(false);
    setSystemForm({
      name: "",
      code: "",
      category: SYSTEM_CATEGORY_OPTIONS[0],
      description: "",
    });
    addLog(`Yeni sistem taslağı oluşturuldu: ${newSystem.name}`);
  };

  const createPriceAnalysis = (event) => {
    event.preventDefault();

    if (!priceAnalysisForm.name.trim()) {
      return;
    }

    const newAnalysis = createPriceAnalysisRecord({
      name: priceAnalysisForm.name.trim(),
      code: priceAnalysisForm.code.trim(),
      notes: priceAnalysisForm.notes.trim(),
    });

    setPriceAnalyses((currentItems) => [newAnalysis, ...currentItems]);
    setSelectedPriceAnalysisId(newAnalysis.id);
    setShowPriceAnalysisForm(false);
    setPriceAnalysisForm({ name: "", code: "", notes: "" });
    addLog(`Yeni fiyat analizi oluşturuldu: ${newAnalysis.name}`);
  };

  const createMaterialAnalysis = (event) => {
    event.preventDefault();

    if (!materialAnalysisForm.name.trim()) {
      return;
    }

    const newAnalysis = createMaterialAnalysisRecord({
      name: materialAnalysisForm.name.trim(),
      code: materialAnalysisForm.code.trim(),
      notes: materialAnalysisForm.notes.trim(),
    });

    setMaterialAnalyses((currentItems) => [newAnalysis, ...currentItems]);
    setSelectedMaterialAnalysisId(newAnalysis.id);
    setShowMaterialAnalysisForm(false);
    setMaterialAnalysisForm({ name: "", code: "", notes: "" });
    addLog(`Yeni malzeme analizi oluşturuldu: ${newAnalysis.name}`);
  };

  const createProject = (event) => {
    event.preventDefault();

    if (!projectForm.name.trim()) {
      return;
    }

    projectsTouchedRef.current = true;

    const newProject = createProjectRecord({
      name: projectForm.name.trim(),
      type: projectForm.type.trim() || "Genel Proje",
      status: projectForm.status,
      customerId: projectForm.customerId || null,
      systemIds: projectForm.systemIds,
      summary: projectForm.summary.trim() || "Proje özeti eklenmedi.",
      source: "local",
    });

    setProjects((currentProjects) => [newProject, ...currentProjects]);
    setSelectedProjectId(newProject.id);
    setShowProjectForm(false);
    setProjectForm({
      name: "",
      type: "",
      status: PROJECT_STATUS_OPTIONS[0],
      customerId: customers[0]?.id || "",
      systemIds: [systems[0]?.id].filter(Boolean),
      summary: "",
    });
    addLog(`Yeni proje taslağı oluşturuldu: ${newProject.name}`);
  };

  const createOffer = (event) => {
    event.preventDefault();

    if (!offerForm.title.trim()) {
      return;
    }

    offersTouchedRef.current = true;

    const subtotal = offerDraftSubtotal;
    const vatAmount = offerDraftVatAmount;
    const totalAmount = subtotal + vatAmount;

    const newOffer = createOfferRecord({
      title: offerForm.title.trim(),
      customerId: offerForm.customerId || null,
      projectId: offerForm.projectId || null,
      status: offerForm.status,
      analysisIds: offerForm.analysisIds,
      lineItems: selectedOfferAnalysisDrafts.map((analysis) => ({
        analysisId: analysis.id,
        title: analysis.name,
        total: analysis.items.reduce((sum, item) => sum + item.total, 0),
      })),
      subtotal,
      vatRate: Number(offerForm.vatRate) || 0,
      vatAmount,
      totalAmount,
      currency: "TRY",
      notes:
        offerForm.notes.trim() ||
        "Bu kayıt yerel teklif taslağıdır; backend üzerinde gerçek teklif kaydı oluşturmaz.",
      source: "local",
    });

    setOffers((currentOffers) => [newOffer, ...currentOffers]);
    setSelectedOfferId(newOffer.id);
    setShowOfferForm(false);
    setOffersError(null);
    setOfferForm({
      title: "",
      customerId: customers[0]?.id || "",
      projectId: projects[0]?.id || "",
      status: OFFER_STATUS_OPTIONS[0],
      vatRate: DEFAULT_VAT_RATE,
      analysisIds: priceAnalysesWithTotals[0] ? [priceAnalysesWithTotals[0].id] : [],
      notes: "",
    });
    addLog(`Yeni teklif taslağı oluşturuldu: ${newOffer.title}`);
  };

  const createCustomer = (event) => {
    event.preventDefault();

    if (!customerForm.companyName.trim()) {
      return;
    }

    const newCustomer = createCustomerRecord({
      ...customerForm,
      companyName: customerForm.companyName.trim(),
      contactName: customerForm.contactName.trim(),
      notes: customerForm.notes.trim(),
    });

    setCustomers((currentCustomers) => [newCustomer, ...currentCustomers]);
    setSelectedCustomerId(newCustomer.id);
    setShowCustomerForm(false);
    setCustomerForm({
      companyName: "",
      contactName: "",
      email: "",
      phone: "",
      city: "",
      notes: "",
    });
    addLog(`Yeni müşteri kaydı oluşturuldu: ${newCustomer.companyName}`);
  };

  const createResearch = (event) => {
    event.preventDefault();

    if (!researchForm.name.trim()) {
      return;
    }

    researchTouchedRef.current = true;
    const newResearch = {
      id: createId("research"),
      name: researchForm.name.trim(),
      note: researchForm.note.trim() || "Not eklenmedi.",
      date: formatDate(),
      source: "local",
    };

    setResearchItems((currentItems) => [newResearch, ...currentItems]);
    setResearchForm({ name: "", note: "" });
    setShowResearchForm(false);
    addLog(`Yeni araştırma kaydı oluşturuldu: ${newResearch.name}`);
  };

  const createMemory = (event) => {
    event.preventDefault();

    if (!memoryForm.title.trim()) {
      return;
    }

    const newMemory = {
      id: createId("memory"),
      title: memoryForm.title.trim(),
      content: memoryForm.content.trim() || "İçerik eklenmedi.",
      date: formatDate(),
    };

    setMemoryItems((currentItems) => [newMemory, ...currentItems]);
    setMemoryForm({ title: "", content: "" });
    setShowMemoryForm(false);
    addLog(`Merkezi hafızaya kayıt eklendi: ${newMemory.title}`);
  };

  const deleteOffer = async (id) => {
    const offer = offers.find((item) => item.id === id);
    offersTouchedRef.current = true;

    if (!offer) {
      return;
    }

    if (offer.source === "api") {
      try {
        await deleteOfferRequest(id);
        addLog(`Teklif API üzerinden silindi: ${offer.title}`);
      } catch (error) {
        if (error.status !== 404) {
          setOffersError("Teklif silme işlemi API üzerinde tamamlanamadı.");
          addLog(`Teklif silme hatası: ${offer.title}`);
          return;
        }
      }
    }

    setOffers((currentOffers) => currentOffers.filter((item) => item.id !== id));
    setSelectedOfferId((currentId) => (currentId === id ? null : currentId));
    setOffersError(null);
    addLog(`${offer.source === "api" ? "Teklif" : "Yerel teklif"} listeden kaldırıldı: ${offer.title}`);
  };

  const deleteSimpleRecord = (setter, items, id, label) => {
    const record = items.find((item) => item.id === id);
    setter((currentItems) => currentItems.filter((item) => item.id !== id));
    if (record) {
      addLog(`${label} silindi: ${record.name || record.title || record.companyName}`);
    }
  };

  const updatePriceAnalysisItem = (analysisId, itemId, field, value) => {
    setPriceAnalyses((currentItems) =>
      currentItems.map((analysis) => {
        if (analysis.id !== analysisId) {
          return analysis;
        }

        return {
          ...analysis,
          items: analysis.items.map((item) =>
            item.id === itemId ? { ...item, [field]: value } : item
          ),
        };
      })
    );
  };

  const addPriceAnalysisItem = (analysisId) => {
    setPriceAnalyses((currentItems) =>
      currentItems.map((analysis) =>
        analysis.id === analysisId
          ? { ...analysis, items: [...analysis.items, createPriceAnalysisItem()] }
          : analysis
      )
    );
    addLog("Fiyat analizine yeni hizmet kalemi eklendi.");
  };

  const removePriceAnalysisItem = (analysisId, itemId) => {
    setPriceAnalyses((currentItems) =>
      currentItems.map((analysis) =>
        analysis.id === analysisId
          ? {
              ...analysis,
              items: analysis.items.filter((item) => item.id !== itemId),
            }
          : analysis
      )
    );
    addLog("Fiyat analizinden hizmet kalemi kaldırıldı.");
  };

  const savePriceAnalysisDraft = (analysisId) => {
    setPriceAnalyses((currentItems) =>
      currentItems.map((analysis) =>
        analysis.id === analysisId
          ? {
              ...analysis,
              lastSavedAt: formatDate(),
              status: "Hazırlanıyor",
            }
          : analysis
      )
    );
    addLog("Fiyat analizi taslağı yerel olarak güncellendi.");
  };

  const updateMaterialNode = (analysisId, itemId, field, value) => {
    setMaterialAnalyses((currentItems) =>
      currentItems.map((analysis) => {
        if (analysis.id !== analysisId) {
          return analysis;
        }

        return {
          ...analysis,
          items: analysis.items.map((item) =>
            item.id === itemId ? { ...item, [field]: value } : item
          ),
        };
      })
    );
  };

  const addMaterialNode = (analysisId, parentNode = null) => {
    const level = parentNode ? Number(parentNode.level || 0) + 1 : 0;

    setMaterialAnalyses((currentItems) =>
      currentItems.map((analysis) =>
        analysis.id === analysisId
          ? {
              ...analysis,
              items: [
                ...analysis.items,
                createMaterialNode({
                  parentId: parentNode?.id || null,
                  level,
                  title: parentNode ? "Alt malzeme" : "Yeni kök malzeme",
                }),
              ],
            }
          : analysis
      )
    );
    addLog(parentNode ? "Malzeme ağacına alt düğüm eklendi." : "Malzeme ağacına kök düğüm eklendi.");
  };

  const removeMaterialNode = (analysisId, itemId) => {
    setMaterialAnalyses((currentItems) =>
      currentItems.map((analysis) => {
        if (analysis.id !== analysisId) {
          return analysis;
        }

        const removedIds = new Set([itemId]);
        let changed = true;

        while (changed) {
          changed = false;
          analysis.items.forEach((item) => {
            if (item.parentId && removedIds.has(item.parentId) && !removedIds.has(item.id)) {
              removedIds.add(item.id);
              changed = true;
            }
          });
        }

        return {
          ...analysis,
          items: analysis.items.filter((item) => !removedIds.has(item.id)),
        };
      })
    );
    addLog("Malzeme analizinden düğüm kaldırıldı.");
  };

  const saveMaterialAnalysisDraft = (analysisId) => {
    setMaterialAnalyses((currentItems) =>
      currentItems.map((analysis) =>
        analysis.id === analysisId
          ? {
              ...analysis,
              lastSavedAt: formatDate(),
              status: "Hazırlanıyor",
            }
          : analysis
      )
    );
    addLog("Malzeme analizi taslağı yerel olarak güncellendi.");
  };

  const toggleProjectSystemSelection = (systemId) => {
    setProjectForm((current) => ({
      ...current,
      systemIds: current.systemIds.includes(systemId)
        ? current.systemIds.filter((item) => item !== systemId)
        : [...current.systemIds, systemId],
    }));
  };

  const toggleOfferAnalysisSelection = (analysisId) => {
    setOfferForm((current) => ({
      ...current,
      analysisIds: current.analysisIds.includes(analysisId)
        ? current.analysisIds.filter((item) => item !== analysisId)
        : [...current.analysisIds, analysisId],
    }));
  };

  const toggleIntegration = (id) => {
    setIntegrations((currentItems) =>
      currentItems.map((item) =>
        item.id === id
          ? {
              ...item,
              status: item.status === "Aktif" ? "Pasif" : "Aktif",
            }
          : item
      )
    );
    addLog("Entegrasyon durumu güncellendi.");
  };

  const sendAiMessage = (event) => {
    event.preventDefault();

    const message = aiInput.trim();

    if (!message) {
      return;
    }

    const userMessage = {
      id: createId("ai"),
      role: "user",
      text: message,
      date: formatDate(),
    };

    const assistantMessage = {
      id: createId("ai"),
      role: "assistant",
      text:
        `Mesaj alındı: "${message}". ` +
        "Bu alan DDPro modüllerindeki ürün, sistem, analiz ve teklif iş akışları için not tutma iskeleti olarak çalışır.",
      date: formatDate(),
    };

    setAiMessages((currentMessages) => [...currentMessages, userMessage, assistantMessage]);
    setAiInput("");
    addLog(`DDPro AI mesajı gönderildi: ${message}`);
  };

  const renderStatusBadge = (label) => (
    <span className={`offer-status-badge ${toStatusTone(label)}`}>{label}</span>
  );

  const renderSummaryCards = (items) => (
    <div className="offers-summary-grid module-summary-grid">
      {items.map((item) => (
        <div className="offer-summary-card" key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
        </div>
      ))}
    </div>
  );

  const renderDashboard = () => (
    <div className="dashboard-module">
      <div className="route-strip">
        {MODULES.map((module) => (
          <button
            key={module.id}
            type="button"
            className={`route-chip ${activeModule === module.id ? "active" : ""}`}
            onClick={() => setActiveModule(module.id)}
          >
            {module.route}
          </button>
        ))}
      </div>

      <div className="stats-grid stats-grid-large">
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
            <h2>Çekirdek İş Akışları</h2>
          </div>
          <div className="panel-content card-grid two-column-grid">
            <div className="system-card compact-card">
              <h3>Ürün → Sistem</h3>
              <p>Ürün kodu, sistem ilişkisi ve birim bilgisi ile katalog iskeleti hazır.</p>
            </div>
            <div className="system-card compact-card">
              <h3>Fiyat Analizi → Teklif</h3>
              <p>Bağımsız hizmet kalemleri analizden teklife bağlanır, backend olmayan kayıtlar taslak kalır.</p>
            </div>
            <div className="system-card compact-card">
              <h3>Malzeme Analizi</h3>
              <p>Malzeme ağacı fiyat analizinden ayrı veri modeli ile yönetilir.</p>
            </div>
            <div className="system-card compact-card">
              <h3>CRM → Proje → Teklif</h3>
              <p>Müşteri kayıtları proje ve teklif detaylarında ilişki görünümü sunar.</p>
            </div>
          </div>
        </div>

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
      </div>
    </div>
  );

  const renderProducts = () => (
    <div className="module-page">
      <div className="module-toolbar module-toolbar-split">
        <div className="toolbar-filters three-up-filters">
          <input
            type="search"
            placeholder="Ürün ara"
            value={productSearch}
            onChange={(event) => setProductSearch(event.target.value)}
          />
          <select
            value={productStatusFilter}
            onChange={(event) => setProductStatusFilter(event.target.value)}
          >
            <option>Tümü</option>
            {PRODUCT_STATUS_OPTIONS.map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
          <select
            value={productSystemFilter}
            onChange={(event) => setProductSystemFilter(event.target.value)}
          >
            <option>Tümü</option>
            {systems.map((system) => (
              <option key={system.id} value={system.id}>
                {system.name}
              </option>
            ))}
          </select>
        </div>
        <button type="button" onClick={() => setShowProductForm((value) => !value)}>
          {showProductForm ? "Formu Kapat" : "+ Yeni Ürün"}
        </button>
      </div>

      {showProductForm && (
        <form className="data-form" onSubmit={createProduct}>
          <input
            type="text"
            placeholder="Ürün adı"
            value={productForm.name}
            onChange={(event) => setProductForm((current) => ({ ...current, name: event.target.value }))}
          />
          <input
            type="text"
            placeholder="Ürün kodu"
            value={productForm.code}
            onChange={(event) => setProductForm((current) => ({ ...current, code: event.target.value }))}
          />
          <select
            value={productForm.systemId}
            onChange={(event) => setProductForm((current) => ({ ...current, systemId: event.target.value }))}
          >
            {systems.map((system) => (
              <option key={system.id} value={system.id}>
                {system.name}
              </option>
            ))}
          </select>
          <select
            value={productForm.unit}
            onChange={(event) => setProductForm((current) => ({ ...current, unit: event.target.value }))}
          >
            {UNIT_OPTIONS.map((unit) => (
              <option key={unit}>{unit}</option>
            ))}
          </select>
          <select
            value={productForm.status}
            onChange={(event) => setProductForm((current) => ({ ...current, status: event.target.value }))}
          >
            {PRODUCT_STATUS_OPTIONS.map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
          <textarea
            placeholder="Ürün açıklaması"
            value={productForm.description}
            onChange={(event) =>
              setProductForm((current) => ({ ...current, description: event.target.value }))
            }
          />
          <button type="submit">Ürün Taslağını Kaydet</button>
          <p className="form-hint">Ürünler yerel katalog iskeleti olarak saklanır.</p>
        </form>
      )}

      {renderSummaryCards([
        { label: "Toplam Ürün", value: products.length },
        { label: "Filtrelenen", value: filteredProducts.length },
        { label: "Aktif", value: products.filter((item) => item.status === "Aktif").length },
        { label: "Bağlı Sistem", value: Object.keys(productsBySystem).length },
      ])}

      <div className="split-layout">
        <div className="panel">
          <div className="panel-header">
            <h2>Ürün Listesi</h2>
            <span className="panel-meta">{filteredProducts.length} kayıt</span>
          </div>
          <div className="panel-content">
            {filteredProducts.length === 0 ? (
              <p className="empty-state">Arama ve filtre sonuçlarına uygun ürün bulunamadı.</p>
            ) : (
              <div className="data-list">
                {filteredProducts.map((product) => (
                  <article className="data-card selectable-card" key={product.id}>
                    <div>
                      <h3>{product.name}</h3>
                      <p>{product.code} · {getSystemName(product.systemId)}</p>
                      <small>{product.unit} · {product.date}</small>
                    </div>
                    <div className="inline-actions">
                      {renderStatusBadge(product.status)}
                      <button type="button" className="offer-secondary-button" onClick={() => setSelectedProductId(product.id)}>
                        Detay
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="panel detail-panel">
          <div className="panel-header">
            <h2>Ürün Detayı</h2>
            {selectedProduct && <span className="panel-meta">{selectedProduct.code}</span>}
          </div>
          <div className="panel-content">
            {!selectedProduct ? (
              <p className="empty-state">Detayları görmek için bir ürün seç.</p>
            ) : (
              <div className="offer-detail-content">
                <div className="offer-detail-header">
                  <div>
                    <h3>{selectedProduct.name}</h3>
                    <p>{getSystemName(selectedProduct.systemId)}</p>
                  </div>
                  {renderStatusBadge(selectedProduct.status)}
                </div>
                <div className="offer-detail-grid">
                  <div className="offer-detail-item">
                    <span>Ürün Kodu</span>
                    <strong>{selectedProduct.code}</strong>
                  </div>
                  <div className="offer-detail-item">
                    <span>Birim</span>
                    <strong>{selectedProduct.unit}</strong>
                  </div>
                  <div className="offer-detail-item">
                    <span>Sistem</span>
                    <strong>{getSystemName(selectedProduct.systemId)}</strong>
                  </div>
                  <div className="offer-detail-item">
                    <span>Kaynak</span>
                    <strong>{selectedProduct.source === "api" ? "Canlı veri" : "Yerel katalog"}</strong>
                  </div>
                </div>
                <div className="offer-detail-note">
                  <strong>Durum</strong>
                  <p>{selectedProduct.description}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const renderSystems = () => {
    const selectedSystemProducts = selectedSystem ? productsBySystem[selectedSystem.id] || [] : [];

    return (
      <div className="module-page">
        <div className="module-toolbar module-toolbar-split">
          <div className="toolbar-filters two-up-filters">
            <input
              type="search"
              placeholder="Sistem ara"
              value={systemSearch}
              onChange={(event) => setSystemSearch(event.target.value)}
            />
            <select
              value={systemCategoryFilter}
              onChange={(event) => setSystemCategoryFilter(event.target.value)}
            >
              <option>Tümü</option>
              {SYSTEM_CATEGORY_OPTIONS.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </select>
          </div>
          <button type="button" onClick={() => setShowSystemForm((value) => !value)}>
            {showSystemForm ? "Formu Kapat" : "+ Yeni Sistem"}
          </button>
        </div>

        {showSystemForm && (
          <form className="data-form" onSubmit={createSystem}>
            <input
              type="text"
              placeholder="Sistem adı"
              value={systemForm.name}
              onChange={(event) => setSystemForm((current) => ({ ...current, name: event.target.value }))}
            />
            <input
              type="text"
              placeholder="Sistem kodu"
              value={systemForm.code}
              onChange={(event) => setSystemForm((current) => ({ ...current, code: event.target.value }))}
            />
            <select
              value={systemForm.category}
              onChange={(event) => setSystemForm((current) => ({ ...current, category: event.target.value }))}
            >
              {SYSTEM_CATEGORY_OPTIONS.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </select>
            <textarea
              placeholder="Sistem açıklaması"
              value={systemForm.description}
              onChange={(event) =>
                setSystemForm((current) => ({ ...current, description: event.target.value }))
              }
            />
            <button type="submit">Sistem Taslağını Kaydet</button>
            <p className="form-hint">Sistemler ürün verisinden bağımsız tutulur, sadece ilişki kurar.</p>
          </form>
        )}

        {renderSummaryCards([
          { label: "Toplam Sistem", value: systems.length },
          { label: "Filtrelenen", value: filteredSystems.length },
          { label: "Bağlı Ürün", value: selectedSystemProducts.length },
          { label: "Kategori", value: new Set(systems.map((item) => item.category)).size },
        ])}

        <div className="split-layout">
          <div className="panel">
            <div className="panel-header">
              <h2>Sistem Listesi</h2>
              <span className="panel-meta">{filteredSystems.length} kayıt</span>
            </div>
            <div className="panel-content">
              {filteredSystems.length === 0 ? (
                <p className="empty-state">Arama ve filtre sonuçlarına uygun sistem bulunamadı.</p>
              ) : (
                <div className="data-list">
                  {filteredSystems.map((system) => (
                    <article className="data-card selectable-card" key={system.id}>
                      <div>
                        <h3>{system.name}</h3>
                        <p>{system.code} · {system.category}</p>
                        <small>{(productsBySystem[system.id] || []).length} bağlı ürün</small>
                      </div>
                      <div className="inline-actions">
                        {renderStatusBadge(system.status)}
                        <button type="button" className="offer-secondary-button" onClick={() => setSelectedSystemId(system.id)}>
                          Detay
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="panel detail-panel">
            <div className="panel-header">
              <h2>Sistem Detayı</h2>
              {selectedSystem && <span className="panel-meta">{selectedSystem.code}</span>}
            </div>
            <div className="panel-content">
              {!selectedSystem ? (
                <p className="empty-state">Detayları görmek için bir sistem seç.</p>
              ) : (
                <div className="offer-detail-content">
                  <div className="offer-detail-header">
                    <div>
                      <h3>{selectedSystem.name}</h3>
                      <p>{selectedSystem.category}</p>
                    </div>
                    {renderStatusBadge(selectedSystem.status)}
                  </div>
                  <div className="offer-detail-grid">
                    <div className="offer-detail-item">
                      <span>Sistem Kodu</span>
                      <strong>{selectedSystem.code}</strong>
                    </div>
                    <div className="offer-detail-item">
                      <span>Kategori</span>
                      <strong>{selectedSystem.category}</strong>
                    </div>
                    <div className="offer-detail-item">
                      <span>Bağlı Ürünler</span>
                      <strong>{selectedSystemProducts.length}</strong>
                    </div>
                    <div className="offer-detail-item">
                      <span>Veri Yapısı</span>
                      <strong>Bağımsız sistem kaydı</strong>
                    </div>
                  </div>
                  <div className="offer-detail-note">
                    <strong>Sisteme bağlı ürünler</strong>
                    {selectedSystemProducts.length === 0 ? (
                      <p>Bu sisteme bağlı ürün bulunmuyor.</p>
                    ) : (
                      <div className="tag-list">
                        {selectedSystemProducts.map((product) => (
                          <span key={product.id} className="tag-chip">
                            {product.code} · {product.name}
                          </span>
                        ))}
                      </div>
                    )}
                    <p>{selectedSystem.description}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
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
                value={memoryForm.title}
                onChange={(event) => setMemoryForm((current) => ({ ...current, title: event.target.value }))}
              />
              <textarea
                placeholder="Hafıza içeriği"
                value={memoryForm.content}
                onChange={(event) => setMemoryForm((current) => ({ ...current, content: event.target.value }))}
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
                    <small>{item.date}</small>
                  </div>
                  <button type="button" onClick={() => deleteSimpleRecord(setMemoryItems, memoryItems, item.id, "Hafıza kaydı")}>
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
          </div>
          <div className="data-list">
            {integrations.map((item) => (
              <div className="data-card" key={item.id}>
                <div>
                  <h3>{item.name}</h3>
                  <p>{item.description}</p>
                  <small>Durum: {item.status}</small>
                </div>
                <button type="button" className="offer-secondary-button" onClick={() => toggleIntegration(item.id)}>
                  {item.status === "Aktif" ? "Pasifleştir" : "Aktifleştir"}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderPriceAnalysis = () => {
    const selectedAnalysisTotal = selectedPriceAnalysis
      ? selectedPriceAnalysis.items.reduce((sum, item) => sum + item.total, 0)
      : 0;

    return (
      <div className="module-page">
        <div className="module-toolbar module-toolbar-split">
          <div className="module-context-note">
            Hizmet kalemleri ürün ve sistem kayıtlarından bağımsız tutulur.
          </div>
          <button type="button" onClick={() => setShowPriceAnalysisForm((value) => !value)}>
            {showPriceAnalysisForm ? "Formu Kapat" : "+ Yeni Fiyat Analizi"}
          </button>
        </div>

        {showPriceAnalysisForm && (
          <form className="data-form" onSubmit={createPriceAnalysis}>
            <input
              type="text"
              placeholder="Analiz adı"
              value={priceAnalysisForm.name}
              onChange={(event) =>
                setPriceAnalysisForm((current) => ({ ...current, name: event.target.value }))
              }
            />
            <input
              type="text"
              placeholder="Analiz kodu"
              value={priceAnalysisForm.code}
              onChange={(event) =>
                setPriceAnalysisForm((current) => ({ ...current, code: event.target.value }))
              }
            />
            <textarea
              placeholder="Analiz sonucu / not"
              value={priceAnalysisForm.notes}
              onChange={(event) =>
                setPriceAnalysisForm((current) => ({ ...current, notes: event.target.value }))
              }
            />
            <button type="submit">Analizi Oluştur</button>
            <p className="form-hint">Kaydetme işlemi yerel taslak iskeleti olarak çalışır.</p>
          </form>
        )}

        {renderSummaryCards([
          { label: "Toplam Analiz", value: priceAnalysesWithTotals.length },
          { label: "Toplam Kalem", value: priceAnalysesWithTotals.reduce((sum, analysis) => sum + analysis.items.length, 0) },
          { label: "Seçili Toplam", value: formatCurrency(selectedAnalysisTotal) },
          { label: "Taslak Kayıt", value: priceAnalysesWithTotals.filter((item) => item.source === "local").length },
        ])}

        <div className="split-layout">
          <div className="panel">
            <div className="panel-header">
              <h2>Fiyat Analizi Listesi</h2>
              <span className="panel-meta">{priceAnalysesWithTotals.length} kayıt</span>
            </div>
            <div className="panel-content">
              <div className="data-list">
                {priceAnalysesWithTotals.map((analysis) => (
                  <article className="data-card selectable-card" key={analysis.id}>
                    <div>
                      <h3>{analysis.name}</h3>
                      <p>{analysis.code}</p>
                      <small>{analysis.items.length} kalem · {formatCurrency(analysis.items.reduce((sum, item) => sum + item.total, 0))}</small>
                    </div>
                    <div className="inline-actions">
                      {renderStatusBadge(analysis.status)}
                      <button type="button" className="offer-secondary-button" onClick={() => setSelectedPriceAnalysisId(analysis.id)}>
                        Düzenle
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>

          <div className="panel detail-panel wide-detail-panel">
            <div className="panel-header">
              <h2>Fiyat Analizi Detayı</h2>
              <div className="inline-actions">
                {selectedPriceAnalysis && <span className="panel-meta">{selectedPriceAnalysis.code}</span>}
                {selectedPriceAnalysis && (
                  <button type="button" className="offer-secondary-button" onClick={() => addPriceAnalysisItem(selectedPriceAnalysis.id)}>
                    + Kalem Ekle
                  </button>
                )}
              </div>
            </div>
            <div className="panel-content">
              {!selectedPriceAnalysis ? (
                <p className="empty-state">Düzenlemek için bir fiyat analizi seç.</p>
              ) : (
                <div className="offer-detail-content">
                  <p className="status-banner info">
                    ℹ Fiyat analizi kaydetme işlemi bu aşamada yalnızca yerel taslak güncellemesi yapar.
                  </p>
                  <div className="analysis-table">
                    <div className="analysis-table-head">
                      <span>Hizmet Kalemi</span>
                      <span>Birim</span>
                      <span>Miktar</span>
                      <span>Birim Fiyat</span>
                      <span>Katsayı</span>
                      <span>Toplam</span>
                      <span></span>
                    </div>
                    {selectedPriceAnalysis.items.length === 0 ? (
                      <p className="empty-state">Bu analizde henüz kalem bulunmuyor.</p>
                    ) : (
                      selectedPriceAnalysis.items.map((item) => (
                        <div className="analysis-table-row" key={item.id}>
                          <div className="stacked-field">
                            <input
                              type="text"
                              value={item.title}
                              onChange={(event) =>
                                updatePriceAnalysisItem(selectedPriceAnalysis.id, item.id, "title", event.target.value)
                              }
                            />
                            <small>{item.serviceCode}</small>
                          </div>
                          <select
                            value={item.unit}
                            onChange={(event) =>
                              updatePriceAnalysisItem(selectedPriceAnalysis.id, item.id, "unit", event.target.value)
                            }
                          >
                            {UNIT_OPTIONS.map((unit) => (
                              <option key={unit}>{unit}</option>
                            ))}
                          </select>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.quantity}
                            onChange={(event) =>
                              updatePriceAnalysisItem(selectedPriceAnalysis.id, item.id, "quantity", event.target.value)
                            }
                          />
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.unitPrice}
                            onChange={(event) =>
                              updatePriceAnalysisItem(selectedPriceAnalysis.id, item.id, "unitPrice", event.target.value)
                            }
                          />
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.coefficient}
                            onChange={(event) =>
                              updatePriceAnalysisItem(selectedPriceAnalysis.id, item.id, "coefficient", event.target.value)
                            }
                          />
                          <strong>{formatCurrency(item.total)}</strong>
                          <button type="button" onClick={() => removePriceAnalysisItem(selectedPriceAnalysis.id, item.id)}>
                            Sil
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="offer-detail-grid">
                    <div className="offer-detail-item">
                      <span>Analiz Sonucu</span>
                      <strong>{formatCurrency(selectedAnalysisTotal)}</strong>
                    </div>
                    <div className="offer-detail-item">
                      <span>Kaydetme İskeleti</span>
                      <strong>{selectedPriceAnalysis.lastSavedAt || "Henüz kaydedilmedi"}</strong>
                    </div>
                  </div>
                  <div className="offer-detail-note">
                    <strong>Analiz notu</strong>
                    <p>{selectedPriceAnalysis.notes}</p>
                  </div>
                  <button type="button" onClick={() => savePriceAnalysisDraft(selectedPriceAnalysis.id)}>
                    Taslağı Yerel Olarak Kaydet
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderMaterialAnalysis = () => {
    const selectedMaterialTotal = selectedMaterialAnalysis
      ? selectedMaterialAnalysis.items.reduce((sum, item) => sum + item.totalCost, 0)
      : 0;

    return (
      <div className="module-page">
        <div className="module-toolbar module-toolbar-split">
          <div className="module-context-note">
            Malzeme analizi fiyat analizinden ayrı veri modeli ve maliyet ağacıyla tutulur.
          </div>
          <button type="button" onClick={() => setShowMaterialAnalysisForm((value) => !value)}>
            {showMaterialAnalysisForm ? "Formu Kapat" : "+ Yeni Malzeme Analizi"}
          </button>
        </div>

        {showMaterialAnalysisForm && (
          <form className="data-form" onSubmit={createMaterialAnalysis}>
            <input
              type="text"
              placeholder="Malzeme analizi adı"
              value={materialAnalysisForm.name}
              onChange={(event) =>
                setMaterialAnalysisForm((current) => ({ ...current, name: event.target.value }))
              }
            />
            <input
              type="text"
              placeholder="Analiz kodu"
              value={materialAnalysisForm.code}
              onChange={(event) =>
                setMaterialAnalysisForm((current) => ({ ...current, code: event.target.value }))
              }
            />
            <textarea
              placeholder="Malzeme notu"
              value={materialAnalysisForm.notes}
              onChange={(event) =>
                setMaterialAnalysisForm((current) => ({ ...current, notes: event.target.value }))
              }
            />
            <button type="submit">Analizi Oluştur</button>
            <p className="form-hint">Kaydetme işlemi yerel taslak iskeleti olarak çalışır.</p>
          </form>
        )}

        {renderSummaryCards([
          { label: "Toplam Analiz", value: materialAnalysesWithTotals.length },
          { label: "Toplam Düğüm", value: materialAnalysesWithTotals.reduce((sum, analysis) => sum + analysis.items.length, 0) },
          { label: "Malzeme Toplamı", value: formatCurrency(selectedMaterialTotal) },
          { label: "Taslak Kayıt", value: materialAnalysesWithTotals.filter((item) => item.source === "local").length },
        ])}

        <div className="split-layout">
          <div className="panel">
            <div className="panel-header">
              <h2>Malzeme Analizi Listesi</h2>
              <span className="panel-meta">{materialAnalysesWithTotals.length} kayıt</span>
            </div>
            <div className="panel-content">
              <div className="data-list">
                {materialAnalysesWithTotals.map((analysis) => (
                  <article className="data-card selectable-card" key={analysis.id}>
                    <div>
                      <h3>{analysis.name}</h3>
                      <p>{analysis.code}</p>
                      <small>{analysis.items.length} düğüm · {formatCurrency(analysis.items.reduce((sum, item) => sum + item.totalCost, 0))}</small>
                    </div>
                    <div className="inline-actions">
                      {renderStatusBadge(analysis.status)}
                      <button type="button" className="offer-secondary-button" onClick={() => setSelectedMaterialAnalysisId(analysis.id)}>
                        Düzenle
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>

          <div className="panel detail-panel wide-detail-panel">
            <div className="panel-header">
              <h2>Malzeme Ağacı</h2>
              <div className="inline-actions">
                {selectedMaterialAnalysis && <span className="panel-meta">{selectedMaterialAnalysis.code}</span>}
                {selectedMaterialAnalysis && (
                  <button type="button" className="offer-secondary-button" onClick={() => addMaterialNode(selectedMaterialAnalysis.id)}>
                    + Kök Malzeme
                  </button>
                )}
              </div>
            </div>
            <div className="panel-content">
              {!selectedMaterialAnalysis ? (
                <p className="empty-state">Düzenlemek için bir malzeme analizi seç.</p>
              ) : (
                <div className="offer-detail-content">
                  <p className="status-banner info">
                    ℹ Malzeme analizi kaydetme işlemi bu aşamada yalnızca yerel taslak güncellemesi yapar.
                  </p>
                  <div className="analysis-table material-tree">
                    <div className="analysis-table-head material-head">
                      <span>Malzeme Ağacı</span>
                      <span>Miktar</span>
                      <span>Birim</span>
                      <span>Birim Maliyet</span>
                      <span>Toplam</span>
                      <span></span>
                    </div>
                    {selectedMaterialAnalysis.items.length === 0 ? (
                      <p className="empty-state">Bu analizde henüz malzeme bulunmuyor.</p>
                    ) : (
                      selectedMaterialAnalysis.items.map((item) => (
                        <div className="analysis-table-row material-row" key={item.id}>
                          <div className="tree-cell" style={{ paddingLeft: `${item.level * 20}px` }}>
                            <input
                              type="text"
                              value={item.title}
                              onChange={(event) =>
                                updateMaterialNode(selectedMaterialAnalysis.id, item.id, "title", event.target.value)
                              }
                            />
                          </div>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.quantity}
                            onChange={(event) =>
                              updateMaterialNode(selectedMaterialAnalysis.id, item.id, "quantity", event.target.value)
                            }
                          />
                          <select
                            value={item.unit}
                            onChange={(event) =>
                              updateMaterialNode(selectedMaterialAnalysis.id, item.id, "unit", event.target.value)
                            }
                          >
                            {UNIT_OPTIONS.map((unit) => (
                              <option key={unit}>{unit}</option>
                            ))}
                          </select>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.unitCost}
                            onChange={(event) =>
                              updateMaterialNode(selectedMaterialAnalysis.id, item.id, "unitCost", event.target.value)
                            }
                          />
                          <strong>{formatCurrency(item.totalCost)}</strong>
                          <div className="inline-actions compact-inline-actions">
                            <button type="button" className="offer-secondary-button" onClick={() => addMaterialNode(selectedMaterialAnalysis.id, item)}>
                              Alt
                            </button>
                            <button type="button" onClick={() => removeMaterialNode(selectedMaterialAnalysis.id, item.id)}>
                              Sil
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="offer-detail-grid">
                    <div className="offer-detail-item">
                      <span>Toplam Malzeme Maliyeti</span>
                      <strong>{formatCurrency(selectedMaterialTotal)}</strong>
                    </div>
                    <div className="offer-detail-item">
                      <span>Kaydetme İskeleti</span>
                      <strong>{selectedMaterialAnalysis.lastSavedAt || "Henüz kaydedilmedi"}</strong>
                    </div>
                  </div>
                  <div className="offer-detail-note">
                    <strong>Analiz notu</strong>
                    <p>{selectedMaterialAnalysis.notes}</p>
                  </div>
                  <button type="button" onClick={() => saveMaterialAnalysisDraft(selectedMaterialAnalysis.id)}>
                    Taslağı Yerel Olarak Kaydet
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderOffers = () => {
    const selectedOfferCustomer = selectedOffer ? getCustomerName(selectedOffer.customerId) : "-";
    const selectedOfferProject = selectedOffer ? getProjectName(selectedOffer.projectId) : "-";

    return (
      <div className="module-page">
        <div className="module-toolbar module-toolbar-split">
          <div className="toolbar-filters single-filter">
            <input
              type="search"
              placeholder="Teklif ara"
              value={offerSearch}
              onChange={(event) => setOfferSearch(event.target.value)}
            />
          </div>
          <div className="offers-toolbar-actions">
            <span className={`offers-status-pill ${offersFetchState}`}>
              {offersFetchState === "loading" && "API yükleniyor"}
              {offersFetchState === "success" && "API bağlı"}
              {offersFetchState === "empty" && "API boş veri döndü"}
              {offersFetchState === "error" && "API bağlantı hatası"}
            </span>
            <button type="button" onClick={() => setShowOfferForm((value) => !value)}>
              {showOfferForm ? "Formu Kapat" : "+ Yeni Teklif"}
            </button>
          </div>
        </div>

        {offersError && <p className="status-banner warning">⚠ {offersError}</p>}

        {showOfferForm && (
          <form className="data-form" onSubmit={createOffer}>
            <input
              type="text"
              placeholder="Teklif adı"
              value={offerForm.title}
              onChange={(event) => setOfferForm((current) => ({ ...current, title: event.target.value }))}
            />
            <select
              value={offerForm.customerId}
              onChange={(event) => setOfferForm((current) => ({ ...current, customerId: event.target.value }))}
            >
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.companyName}
                </option>
              ))}
            </select>
            <select
              value={offerForm.projectId}
              onChange={(event) => setOfferForm((current) => ({ ...current, projectId: event.target.value }))}
            >
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
            <select
              value={offerForm.status}
              onChange={(event) => setOfferForm((current) => ({ ...current, status: event.target.value }))}
            >
              {OFFER_STATUS_OPTIONS.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
            <input
              type="number"
              min="0"
              step="1"
              placeholder="KDV"
              value={offerForm.vatRate}
              onChange={(event) => setOfferForm((current) => ({ ...current, vatRate: event.target.value }))}
            />
            <textarea
              placeholder="Teklif notu"
              value={offerForm.notes}
              onChange={(event) => setOfferForm((current) => ({ ...current, notes: event.target.value }))}
            />
            <div className="selection-block">
              <strong>Analiz Kalemleri</strong>
              <div className="selection-list">
                {priceAnalysesWithTotals.map((analysis) => (
                  <label key={analysis.id} className="selection-item">
                    <input
                      type="checkbox"
                      checked={offerForm.analysisIds.includes(analysis.id)}
                      onChange={() => toggleOfferAnalysisSelection(analysis.id)}
                    />
                    <span>
                      {analysis.name} · {formatCurrency(analysis.items.reduce((sum, item) => sum + item.total, 0))}
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <div className="offer-draft-total-grid">
              <div className="offer-detail-item">
                <span>Ara Toplam</span>
                <strong>{formatCurrency(offerDraftSubtotal)}</strong>
              </div>
              <div className="offer-detail-item">
                <span>KDV</span>
                <strong>{formatCurrency(offerDraftVatAmount)}</strong>
              </div>
              <div className="offer-detail-item">
                <span>Genel Toplam</span>
                <strong>{formatCurrency(offerDraftSubtotal + offerDraftVatAmount)}</strong>
              </div>
            </div>
            <button type="submit">Teklif Taslağını Kaydet</button>
            <p className="form-hint">Bu form backend kaydı oluşturmaz; yalnızca yerel teklif taslağı üretir.</p>
          </form>
        )}

        {renderSummaryCards([
          { label: "Toplam Teklif", value: offers.length },
          { label: "API Kayıtları", value: offers.filter((offer) => offer.source === "api").length },
          { label: "Yerel Taslak", value: offers.filter((offer) => offer.source !== "api").length },
          { label: "Onaylanan", value: offers.filter((offer) => offer.status === "Onaylandı").length },
        ])}

        <div className="split-layout">
          <div className="panel">
            <div className="panel-header">
              <h2>Teklif Listesi</h2>
              <span className="panel-meta">{filteredOffers.length} kayıt</span>
            </div>
            <div className="panel-content">
              {offersLoading ? (
                <p className="empty-state">Teklifler yükleniyor…</p>
              ) : filteredOffers.length === 0 ? (
                <p className="empty-state">Arama sonucuna uygun teklif bulunamadı.</p>
              ) : (
                <div className="offers-list">
                  {filteredOffers.map((offer) => (
                    <article className={`offer-card${offer.id === selectedOfferId ? " selected" : ""}`} key={offer.id}>
                      <div className="offer-card-top">
                        <div>
                          <h3>{offer.title}</h3>
                          <p className="offer-amount">{formatCurrency(offer.totalAmount || offer.subtotal || offer.amountValue || 0, offer.currency || "TRY")}</p>
                        </div>
                        {renderStatusBadge(offer.status)}
                      </div>
                      <div className="offer-meta-row">
                        <span>{offer.date}</span>
                        <span>{offer.source === "api" ? "Canlı API" : "Yerel taslak"}</span>
                      </div>
                      <div className="offer-card-actions">
                        <button type="button" className="offer-secondary-button" onClick={() => setSelectedOfferId(offer.id)}>
                          Detay
                        </button>
                        <button type="button" onClick={() => deleteOffer(offer.id)}>
                          {offer.source === "api" ? "Listeden Kaldır" : "Sil"}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="panel detail-panel">
            <div className="panel-header">
              <h2>Teklif Detayı</h2>
              {selectedOffer && <span className="panel-meta">{selectedOffer.source === "api" ? "API" : "Taslak"}</span>}
            </div>
            <div className="panel-content">
              {!selectedOffer ? (
                <p className="empty-state">Detayları görmek için bir teklif seç.</p>
              ) : (
                <div className="offer-detail-content">
                  {selectedOffer.source !== "api" && (
                    <p className="status-banner info">
                      ℹ Bu teklif yerel taslaktır; backend üzerinde gerçek kayıt yapılmış gibi gösterilmez.
                    </p>
                  )}
                  <div className="offer-detail-header">
                    <div>
                      <h3>{selectedOffer.title}</h3>
                      <p>{formatCurrency(selectedOffer.totalAmount || selectedOffer.subtotal || selectedOffer.amountValue || 0, selectedOffer.currency || "TRY")}</p>
                    </div>
                    {renderStatusBadge(selectedOffer.status)}
                  </div>
                  <div className="offer-detail-grid">
                    <div className="offer-detail-item">
                      <span>Müşteri</span>
                      <strong>{selectedOfferCustomer}</strong>
                    </div>
                    <div className="offer-detail-item">
                      <span>Proje</span>
                      <strong>{selectedOfferProject}</strong>
                    </div>
                    <div className="offer-detail-item">
                      <span>Ara Toplam</span>
                      <strong>{formatCurrency(selectedOffer.subtotal || 0, selectedOffer.currency || "TRY")}</strong>
                    </div>
                    <div className="offer-detail-item">
                      <span>KDV / Genel Toplam</span>
                      <strong>
                        {formatCurrency(selectedOffer.vatAmount || 0, selectedOffer.currency || "TRY")} · {formatCurrency(selectedOffer.totalAmount || selectedOffer.amountValue || 0, selectedOffer.currency || "TRY")}
                      </strong>
                    </div>
                  </div>
                  <div className="offer-detail-note">
                    <strong>Analiz kalemleri</strong>
                    {selectedOffer.lineItems?.length ? (
                      <div className="tag-list">
                        {selectedOffer.lineItems.map((item) => (
                          <span className="tag-chip" key={`${selectedOffer.id}-${item.analysisId || item.title}`}>
                            {item.title} · {formatCurrency(item.total || 0, selectedOffer.currency || "TRY")}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p>Bu kayıtta bağlı analiz kalemi bilgisi bulunmuyor.</p>
                    )}
                    <p>{selectedOffer.notes || "Ek not bulunmuyor."}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderProjects = () => {
    const selectedProjectOffers = selectedProject
      ? offers.filter((offer) => offer.projectId === selectedProject.id)
      : [];
    const selectedProjectSystems = selectedProject
      ? systems.filter((system) => selectedProject.systemIds?.includes(system.id))
      : [];

    return (
      <div className="module-page">
        <div className="module-toolbar module-toolbar-split">
          <div className="toolbar-filters single-filter">
            <input
              type="search"
              placeholder="Proje ara"
              value={projectSearch}
              onChange={(event) => setProjectSearch(event.target.value)}
            />
          </div>
          <button type="button" onClick={() => setShowProjectForm((value) => !value)}>
            {showProjectForm ? "Formu Kapat" : "+ Yeni Proje"}
          </button>
        </div>

        {projectsError && <p className="status-banner warning">⚠ {projectsError}</p>}

        {showProjectForm && (
          <form className="data-form" onSubmit={createProject}>
            <input
              type="text"
              placeholder="Proje adı"
              value={projectForm.name}
              onChange={(event) => setProjectForm((current) => ({ ...current, name: event.target.value }))}
            />
            <input
              type="text"
              placeholder="Proje türü"
              value={projectForm.type}
              onChange={(event) => setProjectForm((current) => ({ ...current, type: event.target.value }))}
            />
            <select
              value={projectForm.status}
              onChange={(event) => setProjectForm((current) => ({ ...current, status: event.target.value }))}
            >
              {PROJECT_STATUS_OPTIONS.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
            <select
              value={projectForm.customerId}
              onChange={(event) => setProjectForm((current) => ({ ...current, customerId: event.target.value }))}
            >
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.companyName}
                </option>
              ))}
            </select>
            <div className="selection-block">
              <strong>Projeye bağlı sistemler</strong>
              <div className="selection-list">
                {systems.map((system) => (
                  <label key={system.id} className="selection-item">
                    <input
                      type="checkbox"
                      checked={projectForm.systemIds.includes(system.id)}
                      onChange={() => toggleProjectSystemSelection(system.id)}
                    />
                    <span>{system.name}</span>
                  </label>
                ))}
              </div>
            </div>
            <textarea
              placeholder="Proje özeti"
              value={projectForm.summary}
              onChange={(event) => setProjectForm((current) => ({ ...current, summary: event.target.value }))}
            />
            <button type="submit">Projeyi Taslak Olarak Kaydet</button>
          </form>
        )}

        {renderSummaryCards([
          { label: "Toplam Proje", value: projects.length },
          { label: "Aktif", value: projects.filter((item) => item.status === "Aktif").length },
          { label: "API Kayıtları", value: projects.filter((item) => item.source === "api").length },
          { label: "Yerel Taslak", value: projects.filter((item) => item.source !== "api").length },
        ])}

        <div className="split-layout">
          <div className="panel">
            <div className="panel-header">
              <h2>Proje Listesi</h2>
              <span className="panel-meta">{filteredProjects.length} kayıt</span>
            </div>
            <div className="panel-content">
              {projectsLoading ? (
                <p className="empty-state">Projeler yükleniyor…</p>
              ) : filteredProjects.length === 0 ? (
                <p className="empty-state">Arama sonucuna uygun proje bulunamadı.</p>
              ) : (
                <div className="data-list">
                  {filteredProjects.map((project) => (
                    <article className="data-card selectable-card" key={project.id}>
                      <div>
                        <h3>{project.name}</h3>
                        <p>{project.type}</p>
                        <small>{getCustomerName(project.customerId)} · {project.date}</small>
                      </div>
                      <div className="inline-actions">
                        {renderStatusBadge(project.status)}
                        <button type="button" className="offer-secondary-button" onClick={() => setSelectedProjectId(project.id)}>
                          Detay
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="panel detail-panel">
            <div className="panel-header">
              <h2>Proje Detayı</h2>
              {selectedProject && <span className="panel-meta">{selectedProject.type}</span>}
            </div>
            <div className="panel-content">
              {!selectedProject ? (
                <p className="empty-state">Detayları görmek için bir proje seç.</p>
              ) : (
                <div className="offer-detail-content">
                  <div className="offer-detail-header">
                    <div>
                      <h3>{selectedProject.name}</h3>
                      <p>{getCustomerName(selectedProject.customerId)}</p>
                    </div>
                    {renderStatusBadge(selectedProject.status)}
                  </div>
                  <div className="offer-detail-grid">
                    <div className="offer-detail-item">
                      <span>Bağlı Sistemler</span>
                      <strong>{selectedProjectSystems.length}</strong>
                    </div>
                    <div className="offer-detail-item">
                      <span>Bağlı Teklifler</span>
                      <strong>{selectedProjectOffers.length}</strong>
                    </div>
                  </div>
                  <div className="offer-detail-note">
                    <strong>Projeye bağlı sistemler</strong>
                    <div className="tag-list">
                      {selectedProjectSystems.length === 0 ? (
                        <span className="tag-chip muted">Sistem ilişkisi yok</span>
                      ) : (
                        selectedProjectSystems.map((system) => (
                          <span className="tag-chip" key={system.id}>{system.name}</span>
                        ))
                      )}
                    </div>
                    <strong>Projeye bağlı teklifler</strong>
                    <div className="tag-list">
                      {selectedProjectOffers.length === 0 ? (
                        <span className="tag-chip muted">Teklif ilişkisi yok</span>
                      ) : (
                        selectedProjectOffers.map((offer) => (
                          <span className="tag-chip" key={offer.id}>{offer.title}</span>
                        ))
                      )}
                    </div>
                    <p>{selectedProject.summary}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderCRM = () => {
    const selectedCustomerProjects = selectedCustomer
      ? projects.filter((project) => project.customerId === selectedCustomer.id)
      : [];
    const selectedCustomerOffers = selectedCustomer
      ? offers.filter((offer) => offer.customerId === selectedCustomer.id)
      : [];

    return (
      <div className="module-page">
        <div className="module-toolbar module-toolbar-split">
          <div className="toolbar-filters single-filter">
            <input
              type="search"
              placeholder="Müşteri ara"
              value={crmSearch}
              onChange={(event) => setCrmSearch(event.target.value)}
            />
          </div>
          <button type="button" onClick={() => setShowCustomerForm((value) => !value)}>
            {showCustomerForm ? "Formu Kapat" : "+ Yeni Müşteri"}
          </button>
        </div>

        {showCustomerForm && (
          <form className="data-form" onSubmit={createCustomer}>
            <input
              type="text"
              placeholder="Firma adı"
              value={customerForm.companyName}
              onChange={(event) => setCustomerForm((current) => ({ ...current, companyName: event.target.value }))}
            />
            <input
              type="text"
              placeholder="İlgili kişi"
              value={customerForm.contactName}
              onChange={(event) => setCustomerForm((current) => ({ ...current, contactName: event.target.value }))}
            />
            <input
              type="email"
              placeholder="E-posta"
              value={customerForm.email}
              onChange={(event) => setCustomerForm((current) => ({ ...current, email: event.target.value }))}
            />
            <input
              type="text"
              placeholder="Telefon"
              value={customerForm.phone}
              onChange={(event) => setCustomerForm((current) => ({ ...current, phone: event.target.value }))}
            />
            <input
              type="text"
              placeholder="Şehir"
              value={customerForm.city}
              onChange={(event) => setCustomerForm((current) => ({ ...current, city: event.target.value }))}
            />
            <textarea
              placeholder="CRM notu"
              value={customerForm.notes}
              onChange={(event) => setCustomerForm((current) => ({ ...current, notes: event.target.value }))}
            />
            <button type="submit">Müşteriyi Kaydet</button>
          </form>
        )}

        {renderSummaryCards([
          { label: "Toplam Müşteri", value: customers.length },
          { label: "Filtrelenen", value: filteredCustomers.length },
          { label: "Bağlı Proje", value: selectedCustomerProjects.length },
          { label: "Bağlı Teklif", value: selectedCustomerOffers.length },
        ])}

        <div className="split-layout">
          <div className="panel">
            <div className="panel-header">
              <h2>Müşteri Listesi</h2>
              <span className="panel-meta">{filteredCustomers.length} kayıt</span>
            </div>
            <div className="panel-content">
              {filteredCustomers.length === 0 ? (
                <p className="empty-state">Arama sonucuna uygun müşteri bulunamadı.</p>
              ) : (
                <div className="data-list">
                  {filteredCustomers.map((customer) => (
                    <article className="data-card selectable-card" key={customer.id}>
                      <div>
                        <h3>{customer.companyName}</h3>
                        <p>{customer.contactName}</p>
                        <small>{customer.email} · {customer.phone}</small>
                      </div>
                      <div className="inline-actions">
                        {renderStatusBadge("Aktif")}
                        <button type="button" className="offer-secondary-button" onClick={() => setSelectedCustomerId(customer.id)}>
                          Detay
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="panel detail-panel">
            <div className="panel-header">
              <h2>Müşteri Detayı</h2>
              {selectedCustomer && <span className="panel-meta">{selectedCustomer.city}</span>}
            </div>
            <div className="panel-content">
              {!selectedCustomer ? (
                <p className="empty-state">Detayları görmek için bir müşteri seç.</p>
              ) : (
                <div className="offer-detail-content">
                  <div className="offer-detail-header">
                    <div>
                      <h3>{selectedCustomer.companyName}</h3>
                      <p>{selectedCustomer.contactName}</p>
                    </div>
                    {renderStatusBadge("Aktif")}
                  </div>
                  <div className="offer-detail-grid">
                    <div className="offer-detail-item">
                      <span>Firma Bilgileri</span>
                      <strong>{selectedCustomer.city}</strong>
                    </div>
                    <div className="offer-detail-item">
                      <span>İletişim</span>
                      <strong>{selectedCustomer.email} · {selectedCustomer.phone}</strong>
                    </div>
                    <div className="offer-detail-item">
                      <span>Proje İlişkisi</span>
                      <strong>{selectedCustomerProjects.length} proje</strong>
                    </div>
                    <div className="offer-detail-item">
                      <span>Teklif İlişkisi</span>
                      <strong>{selectedCustomerOffers.length} teklif</strong>
                    </div>
                  </div>
                  <div className="offer-detail-note">
                    <strong>CRM ilişkileri</strong>
                    <div className="tag-list">
                      {selectedCustomerProjects.map((project) => (
                        <span className="tag-chip" key={project.id}>{project.name}</span>
                      ))}
                      {selectedCustomerOffers.map((offer) => (
                        <span className="tag-chip" key={offer.id}>{offer.title}</span>
                      ))}
                    </div>
                    <p>{selectedCustomer.notes}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

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
            value={researchForm.name}
            onChange={(event) => setResearchForm((current) => ({ ...current, name: event.target.value }))}
          />
          <textarea
            placeholder="Araştırma notu"
            value={researchForm.note}
            onChange={(event) => setResearchForm((current) => ({ ...current, note: event.target.value }))}
          />
          <button type="submit">Araştırmayı Kaydet</button>
        </form>
      )}

      {researchError && <p className="status-banner warning">⚠ {researchError}</p>}

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
                <small>{item.date}</small>
              </div>
              <button type="button" onClick={() => deleteSimpleRecord(setResearchItems, researchItems, item.id, "Araştırma kaydı")}>
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
      <div className="ai-chat">
        {aiMessages.map((message) => (
          <div key={message.id} className={`ai-message ${message.role}`}>
            <strong>{message.role === "assistant" ? "DDPro AI" : "Sen"}</strong>
            <p>{message.text}</p>
            <small>{message.date}</small>
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

  const renderModule = () => {
    switch (activeModule) {
      case "products":
        return renderProducts();
      case "systems":
        return renderSystems();
      case "price-analysis":
        return renderPriceAnalysis();
      case "material-analysis":
        return renderMaterialAnalysis();
      case "offers":
        return renderOffers();
      case "projects":
        return renderProjects();
      case "crm":
        return renderCRM();
      case "research":
        return renderResearch();
      case "ai":
        return renderAI();
      case "dashboard":
      default:
        return renderDashboard();
    }
  };

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
          Sistem Aktif
        </div>
      </header>

      <div className="app-layout">
        <aside className="sidebar">
          <div className="sidebar-title">ANA MODÜLLER</div>

          <nav className="module-nav">
            {MODULES.map((module) => (
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
              {MODULE_ROUTE_MAP[activeModule]}
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
