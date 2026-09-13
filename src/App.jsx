import { useEffect, useMemo, useState } from 'react';
import './styles.css';
import EmptyState from './components/EmptyState.jsx';
import HierarchyItemsEditor from './components/HierarchyItemsEditor.jsx';
import LineItemsEditor from './components/LineItemsEditor.jsx';
import StatusPill from './components/StatusPill.jsx';
import SummaryCard from './components/SummaryCard.jsx';
import { getOffers, mapOfferToViewModel } from './services/offers.service.js';
import { getProjects, mapProjectToViewModel } from './services/projects.service.js';
import { getResearchItems } from './services/research.service.js';
import {
  STORAGE_KEYS,
  buildMaterialTree,
  calculateMaterialAnalysisTotals,
  calculateOfferItemTotal,
  calculateOfferTotals,
  calculatePriceAnalysisTotals,
  calculatePriceItemTotal,
  createLocalId,
  defaultIntegrations,
  formatCurrency,
  formatDisplayDate,
  getSourceLabel,
  mergeRecordsById,
  readCollection,
  sortByRecent,
  toNumber,
  writeCollection,
} from './services/core-data.service.js';

const modules = [
  {
    id: 'dashboard',
    icon: '◉',
    title: 'Genel Bakış',
    short: 'Sistem Merkezi',
    description: 'DDPro operasyonlarının ana görünümü, canlı API kayıtları ve yerel taslak iş akışları.',
  },
  {
    id: 'products',
    icon: '◫',
    title: 'Ürünler',
    short: 'Ürün Yönetimi',
    description: 'Ürün kartları, sistem bağlantıları ve aktif/pasif durumu ile ürün katalog akışı.',
  },
  {
    id: 'systems',
    icon: '⚙',
    title: 'Sistemler',
    short: 'Sistem Yönetimi',
    description: 'Sistem listesi, kategori yönetimi ve bağlı ürün görünümü ile gerçek sistem akışı.',
  },
  {
    id: 'price-analysis',
    icon: '₺',
    title: 'Fiyat Analizi',
    short: 'Hizmet Kalemleri',
    description: 'Bağımsız PriceAnalysis ve PriceAnalysisItem modeli ile fiyat analiz akışları.',
  },
  {
    id: 'material-analysis',
    icon: '▦',
    title: 'Malzeme Analizi',
    short: 'Malzeme Ağacı',
    description: 'Ayrı MaterialAnalysis veri modeli ile malzeme ağacı ve maliyet akışı.',
  },
  {
    id: 'offers',
    icon: '€',
    title: 'Teklifler',
    short: 'Teklif Merkezi',
    description: 'Müşteri, proje, kalem, KDV ve toplamları ile taslak/canlı teklif takibi.',
  },
  {
    id: 'projects',
    icon: '▣',
    title: 'Projeler',
    short: 'Proje Yönetimi',
    description: 'Projeleri müşteri, sistem ve teklif ilişkileriyle yönetmek için proje akışı.',
  },
  {
    id: 'crm',
    icon: '☏',
    title: 'CRM',
    short: 'Müşteriler',
    description: 'Müşteri listesi, firma/iletişim bilgileri ve proje-teklif ilişkileri.',
  },
  {
    id: 'research',
    icon: '⌕',
    title: 'Tedarik & Araştırma',
    short: 'Araştırma Merkezi',
    description: 'Mevcut backend bağlantısını koruyarak araştırma kayıtlarının görünümü.',
  },
  {
    id: 'ai',
    icon: '✦',
    title: 'DDPro AI',
    short: 'Yapay Zeka Sistemi',
    description: 'Kullanıcı notları ve çalışma mesajları için AI çalışma alanı.',
  },
];

const OFFER_STATUS_TONES = {
  Taslak: 'pending',
  Hazırlanıyor: 'pending',
  Gönderildi: 'info',
  Onaylandı: 'success',
  Reddedildi: 'danger',
  Aktif: 'success',
  Pasif: 'neutral',
  Beklemede: 'warning',
  Tamamlandı: 'success',
};

const LOCAL_ONLY_MODULE_NOTE = 'Backend kayıt modeli hazır olana kadar bu modül yerel taslak katmanı ile çalışır.';

const emptyProductForm = () => ({
  id: null,
  name: '',
  code: '',
  unit: '',
  systemId: '',
  status: 'Aktif',
  description: '',
});

const emptySystemForm = () => ({
  id: null,
  name: '',
  code: '',
  category: '',
  status: 'Aktif',
  description: '',
});

const emptyCustomerForm = () => ({
  id: null,
  name: '',
  company: '',
  email: '',
  phone: '',
  contactName: '',
  notes: '',
});

const emptyProjectForm = () => ({
  id: null,
  name: '',
  type: '',
  status: 'Taslak',
  customerId: '',
  location: '',
  description: '',
  systemIds: [],
  offerIds: [],
});

const createOfferItem = () => ({
  id: createLocalId('offer-item'),
  description: '',
  quantity: '1',
  unit: 'adet',
  unitPrice: '0',
});

const emptyOfferForm = () => ({
  id: null,
  title: '',
  customerId: '',
  projectId: '',
  status: 'Taslak',
  vatRate: '20',
  notes: '',
  items: [createOfferItem()],
});

const createPriceItem = () => ({
  id: createLocalId('price-item'),
  description: '',
  quantity: '1',
  unit: 'adet',
  unitPrice: '0',
  coefficient: '1',
});

const emptyPriceAnalysisForm = () => ({
  id: null,
  name: '',
  code: '',
  linkedProductId: '',
  notes: '',
  items: [createPriceItem()],
});

const createMaterialItem = () => ({
  id: createLocalId('material-item'),
  name: '',
  parentId: '',
  quantity: '1',
  unit: 'adet',
  unitCost: '0',
});

const emptyMaterialAnalysisForm = () => ({
  id: null,
  name: '',
  code: '',
  linkedProductId: '',
  notes: '',
  items: [createMaterialItem()],
});

const emptyResearchForm = () => ({
  id: null,
  name: '',
  note: '',
});

const getTone = (value) => OFFER_STATUS_TONES[value] || 'neutral';

const isEmailValid = (value) => !value || /.+@.+\..+/.test(value);

const normalizeProduct = (record = {}) => ({
  id: record.id || createLocalId('product'),
  name: record.name || record.title || 'Adsız ürün',
  code: record.code || '',
  unit: record.unit || '',
  systemId: record.systemId || '',
  status: record.status || 'Aktif',
  description: record.description || '',
  createdAt: record.createdAt || new Date().toISOString(),
  updatedAt: record.updatedAt || record.createdAt || new Date().toISOString(),
  source: 'local',
});

const normalizeSystem = (record = {}) => ({
  id: record.id || createLocalId('system'),
  name: record.name || record.title || 'Adsız sistem',
  code: record.code || '',
  category: record.category || '',
  status: record.status || 'Aktif',
  description: record.description || '',
  createdAt: record.createdAt || new Date().toISOString(),
  updatedAt: record.updatedAt || record.createdAt || new Date().toISOString(),
  source: 'local',
});

const normalizeCustomer = (record = {}) => ({
  id: record.id || createLocalId('customer'),
  name: record.name || 'Adsız müşteri',
  company: record.company || '',
  email: record.email || '',
  phone: record.phone || '',
  contactName: record.contactName || '',
  notes: record.notes || '',
  createdAt: record.createdAt || new Date().toISOString(),
  updatedAt: record.updatedAt || record.createdAt || new Date().toISOString(),
  source: 'local',
});

const normalizeProject = (record = {}) => ({
  id: record.id || createLocalId('project'),
  name: record.name || record.title || 'Adsız proje',
  type: record.type || record.projectType || 'Genel Proje',
  status: record.status || 'Taslak',
  customerId: record.customerId || '',
  location: record.location || '',
  description: record.description || '',
  systemIds: Array.isArray(record.systemIds) ? record.systemIds : [],
  offerIds: Array.isArray(record.offerIds) ? record.offerIds : [],
  createdAt: record.createdAt || record.date || new Date().toISOString(),
  updatedAt: record.updatedAt || record.createdAt || record.date || new Date().toISOString(),
  source: record.source || 'local',
  copiedFromId: record.copiedFromId || null,
});

const normalizeOffer = (record = {}) => {
  const normalizedItems = Array.isArray(record.items) && record.items.length > 0 ? record.items : [];
  const items = normalizedItems.map((item) => ({
    id: item.id || createLocalId('offer-item'),
    description: item.description || '',
    quantity: String(item.quantity ?? '1'),
    unit: item.unit || 'adet',
    unitPrice: String(item.unitPrice ?? '0'),
  }));
  const vatRate = String(record.vatRate ?? '20');
  const explicitTotal = toNumber(record.total ?? record.amount ?? record.amountValue);
  const explicitSubtotal = toNumber(record.subtotal ?? explicitTotal);
  const explicitTax = toNumber(record.tax);
  const calculated = calculateOfferTotals(items, vatRate);
  const subtotal = items.length > 0 ? calculated.subtotal : explicitSubtotal;
  const tax = items.length > 0 ? calculated.tax : explicitTax;
  const total = items.length > 0 ? calculated.total : explicitTotal || explicitSubtotal + explicitTax;

  return {
    id: record.id || createLocalId('offer'),
    title: record.title || record.name || 'Adsız teklif',
    customerId: record.customerId || '',
    projectId: record.projectId || '',
    status: record.status || 'Taslak',
    vatRate,
    notes: record.notes || '',
    items,
    subtotal,
    tax,
    total,
    currency: record.currency || 'TRY',
    createdAt: record.createdAt || record.date || new Date().toISOString(),
    updatedAt: record.updatedAt || record.createdAt || record.date || new Date().toISOString(),
    source: record.source || 'local',
    copiedFromId: record.copiedFromId || null,
    customerInheritedFromProject: Boolean(record.customerInheritedFromProject),
  };
};

const normalizePriceAnalysis = (record = {}) => {
  const items = (record.items || []).map((item) => ({
    id: item.id || createLocalId('price-item'),
    description: item.description || '',
    quantity: String(item.quantity ?? '1'),
    unit: item.unit || 'adet',
    unitPrice: String(item.unitPrice ?? '0'),
    coefficient: String(item.coefficient ?? '1'),
  }));
  const { total } = calculatePriceAnalysisTotals(items);

  return {
    id: record.id || createLocalId('price-analysis'),
    name: record.name || 'Adsız analiz',
    code: record.code || '',
    linkedProductId: record.linkedProductId || '',
    notes: record.notes || '',
    items,
    total,
    createdAt: record.createdAt || new Date().toISOString(),
    updatedAt: record.updatedAt || record.createdAt || new Date().toISOString(),
    source: 'local',
  };
};

const normalizeMaterialAnalysis = (record = {}) => {
  const items = (record.items || []).map((item) => ({
    id: item.id || createLocalId('material-item'),
    name: item.name || '',
    parentId: item.parentId || '',
    quantity: String(item.quantity ?? '1'),
    unit: item.unit || 'adet',
    unitCost: String(item.unitCost ?? '0'),
  }));
  const { total } = calculateMaterialAnalysisTotals(items);

  return {
    id: record.id || createLocalId('material-analysis'),
    name: record.name || 'Adsız malzeme analizi',
    code: record.code || '',
    linkedProductId: record.linkedProductId || '',
    notes: record.notes || '',
    items,
    total,
    createdAt: record.createdAt || new Date().toISOString(),
    updatedAt: record.updatedAt || record.createdAt || new Date().toISOString(),
    source: 'local',
  };
};

const normalizeResearch = (record = {}) => ({
  id: record.id || createLocalId('research'),
  name: record.name || record.title || 'Adsız araştırma',
  note: record.note || record.notes || record.description || 'Not eklenmedi.',
  status: record.status || 'Taslak',
  createdAt: record.createdAt || record.created_at || record.date || new Date().toISOString(),
  updatedAt: record.updatedAt || record.updated_at || record.createdAt || record.created_at || new Date().toISOString(),
  source: record.source || 'local',
});

const renderMaterialTree = (nodes = [], level = 0) =>
  nodes.map((node) => (
    <div key={node.id} className="tree-node" style={{ marginLeft: `${level * 18}px` }}>
      <div>
        <strong>{node.name || 'Adsız malzeme'}</strong>
        <small>
          {node.quantity} {node.unit} · Birim maliyet {formatCurrency(node.unitCost)}
        </small>
      </div>
      <span>{formatCurrency(node.totalCost)}</span>
      {node.children?.length ? renderMaterialTree(node.children, level + 1) : null}
    </div>
  ));

function App() {
  const [activeModule, setActiveModule] = useState('dashboard');

  const [apiProjects, setApiProjects] = useState([]);
  const [projectDrafts, setProjectDrafts] = useState(() =>
    sortByRecent(readCollection(STORAGE_KEYS.projects, []).map(normalizeProject).filter((item) => item.source !== 'api'))
  );
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [projectsError, setProjectsError] = useState('');
  const [projectsFetchState, setProjectsFetchState] = useState('loading');

  const [apiOffers, setApiOffers] = useState([]);
  const [offerDrafts, setOfferDrafts] = useState(() =>
    sortByRecent(readCollection(STORAGE_KEYS.offers, []).map(normalizeOffer).filter((item) => item.source !== 'api'))
  );
  const [offersLoading, setOffersLoading] = useState(true);
  const [offersError, setOffersError] = useState('');
  const [offersFetchState, setOffersFetchState] = useState('loading');

  const [apiResearchItems, setApiResearchItems] = useState([]);
  const [researchDrafts, setResearchDrafts] = useState(() =>
    sortByRecent(readCollection(STORAGE_KEYS.research, []).map(normalizeResearch).filter((item) => item.source !== 'api'))
  );
  const [researchLoading, setResearchLoading] = useState(true);
  const [researchError, setResearchError] = useState('');

  const [products, setProducts] = useState(() => readCollection(STORAGE_KEYS.products, []).map(normalizeProduct));
  const [systems, setSystems] = useState(() => readCollection(STORAGE_KEYS.systems, []).map(normalizeSystem));
  const [customers, setCustomers] = useState(() => readCollection(STORAGE_KEYS.customers, []).map(normalizeCustomer));
  const [priceAnalyses, setPriceAnalyses] = useState(() =>
    readCollection(STORAGE_KEYS.priceAnalyses, []).map(normalizePriceAnalysis)
  );
  const [materialAnalyses, setMaterialAnalyses] = useState(() =>
    readCollection(STORAGE_KEYS.materialAnalyses, []).map(normalizeMaterialAnalysis)
  );

  const [memoryItems, setMemoryItems] = useState(() => readCollection(STORAGE_KEYS.memory, []));
  const [systemLogs, setSystemLogs] = useState(() => readCollection(STORAGE_KEYS.logs, []));
  const [integrations, setIntegrations] = useState(() =>
    readCollection(STORAGE_KEYS.integrations, defaultIntegrations)
  );

  const [productForm, setProductForm] = useState(emptyProductForm());
  const [systemForm, setSystemForm] = useState(emptySystemForm());
  const [customerForm, setCustomerForm] = useState(emptyCustomerForm());
  const [projectForm, setProjectForm] = useState(emptyProjectForm());
  const [offerForm, setOfferForm] = useState(emptyOfferForm());
  const [priceAnalysisForm, setPriceAnalysisForm] = useState(emptyPriceAnalysisForm());
  const [materialAnalysisForm, setMaterialAnalysisForm] = useState(emptyMaterialAnalysisForm());
  const [researchForm, setResearchForm] = useState(emptyResearchForm());

  const [productFormError, setProductFormError] = useState('');
  const [systemFormError, setSystemFormError] = useState('');
  const [customerFormError, setCustomerFormError] = useState('');
  const [projectFormError, setProjectFormError] = useState('');
  const [offerFormError, setOfferFormError] = useState('');
  const [priceAnalysisFormError, setPriceAnalysisFormError] = useState('');
  const [materialAnalysisFormError, setMaterialAnalysisFormError] = useState('');
  const [researchFormError, setResearchFormError] = useState('');

  const [showProductForm, setShowProductForm] = useState(false);
  const [showSystemForm, setShowSystemForm] = useState(false);
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [showOfferForm, setShowOfferForm] = useState(false);
  const [showPriceAnalysisForm, setShowPriceAnalysisForm] = useState(false);
  const [showMaterialAnalysisForm, setShowMaterialAnalysisForm] = useState(false);
  const [showResearchForm, setShowResearchForm] = useState(false);

  const [selectedProductId, setSelectedProductId] = useState(null);
  const [selectedSystemId, setSelectedSystemId] = useState(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [selectedOfferId, setSelectedOfferId] = useState(null);
  const [selectedPriceAnalysisId, setSelectedPriceAnalysisId] = useState(null);
  const [selectedMaterialAnalysisId, setSelectedMaterialAnalysisId] = useState(null);

  const [productSearch, setProductSearch] = useState('');
  const [productStatusFilter, setProductStatusFilter] = useState('Tümü');
  const [systemSearch, setSystemSearch] = useState('');
  const [systemCategoryFilter, setSystemCategoryFilter] = useState('Tümü');
  const [customerSearch, setCustomerSearch] = useState('');
  const [projectSearch, setProjectSearch] = useState('');
  const [offerSearch, setOfferSearch] = useState('');

  const [memoryTitle, setMemoryTitle] = useState('');
  const [memoryContent, setMemoryContent] = useState('');
  const [showMemoryForm, setShowMemoryForm] = useState(false);
  const [aiInput, setAiInput] = useState('');
  const [aiMessages, setAiMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'DDPro AI çalışma alanı hazır. Ürün, sistem, teklif veya analiz akışları için not bırakabilirsin.',
      date: formatDisplayDate(new Date().toISOString()),
    },
  ]);

  const addLog = (message) => {
    const record = {
      id: createLocalId('log'),
      message,
      date: formatDisplayDate(new Date().toISOString()),
    };
    setSystemLogs((current) => [record, ...current].slice(0, 60));
  };

  const projects = useMemo(() => mergeRecordsById(apiProjects, projectDrafts), [apiProjects, projectDrafts]);
  const offers = useMemo(() => mergeRecordsById(apiOffers, offerDrafts), [apiOffers, offerDrafts]);
  const researchItems = useMemo(() => mergeRecordsById(apiResearchItems, researchDrafts), [apiResearchItems, researchDrafts]);

  const productMap = useMemo(() => new Map(products.map((item) => [item.id, item])), [products]);
  const systemMap = useMemo(() => new Map(systems.map((item) => [item.id, item])), [systems]);
  const customerMap = useMemo(() => new Map(customers.map((item) => [item.id, item])), [customers]);
  const offerMap = useMemo(() => new Map(offers.map((item) => [item.id, item])), [offers]);

  const selectedProduct = products.find((item) => item.id === selectedProductId) || null;
  const selectedSystem = systems.find((item) => item.id === selectedSystemId) || null;
  const selectedCustomer = customers.find((item) => item.id === selectedCustomerId) || null;
  const selectedProject = projects.find((item) => item.id === selectedProjectId) || null;
  const selectedOffer = offers.find((item) => item.id === selectedOfferId) || null;
  const selectedPriceAnalysis = priceAnalyses.find((item) => item.id === selectedPriceAnalysisId) || null;
  const selectedMaterialAnalysis = materialAnalyses.find((item) => item.id === selectedMaterialAnalysisId) || null;

  useEffect(() => {
    writeCollection(STORAGE_KEYS.products, products);
  }, [products]);

  useEffect(() => {
    writeCollection(STORAGE_KEYS.systems, systems);
  }, [systems]);

  useEffect(() => {
    writeCollection(STORAGE_KEYS.customers, customers);
  }, [customers]);

  useEffect(() => {
    writeCollection(STORAGE_KEYS.priceAnalyses, priceAnalyses);
  }, [priceAnalyses]);

  useEffect(() => {
    writeCollection(STORAGE_KEYS.materialAnalyses, materialAnalyses);
  }, [materialAnalyses]);

  useEffect(() => {
    writeCollection(STORAGE_KEYS.projects, projectDrafts);
  }, [projectDrafts]);

  useEffect(() => {
    writeCollection(STORAGE_KEYS.offers, offerDrafts);
  }, [offerDrafts]);

  useEffect(() => {
    writeCollection(STORAGE_KEYS.research, researchDrafts);
  }, [researchDrafts]);

  useEffect(() => {
    writeCollection(STORAGE_KEYS.memory, memoryItems);
  }, [memoryItems]);

  useEffect(() => {
    writeCollection(STORAGE_KEYS.logs, systemLogs);
  }, [systemLogs]);

  useEffect(() => {
    writeCollection(STORAGE_KEYS.integrations, integrations);
  }, [integrations]);

  useEffect(() => {
    let cancelled = false;

    const loadProjects = async () => {
      setProjectsLoading(true);
      setProjectsError('');
      setProjectsFetchState('loading');

      try {
        const records = await getProjects();
        if (cancelled) return;
        const normalized = sortByRecent(
          records.map((record) =>
            normalizeProject({
              ...mapProjectToViewModel(record.raw || record),
              id: record.id,
              name: record.name,
              type: record.type,
              status: record.status,
              createdAt: record.createdAt,
              updatedAt: record.updatedAt,
              source: 'api',
            })
          )
        );
        setApiProjects(normalized);
        setProjectsFetchState(normalized.length > 0 ? 'success' : 'empty');
      } catch (error) {
        if (cancelled) return;
        setApiProjects([]);
        setProjectsFetchState('error');
        setProjectsError(error.message || 'Projeler alınamadı.');
      } finally {
        if (!cancelled) {
          setProjectsLoading(false);
        }
      }
    };

    loadProjects();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadOffers = async () => {
      setOffersLoading(true);
      setOffersError('');
      setOffersFetchState('loading');

      try {
        const records = await getOffers();
        if (cancelled) return;
        const normalized = sortByRecent(
          records.map((record) =>
            normalizeOffer({
              ...mapOfferToViewModel(record.raw || record),
              id: record.id,
              title: record.title,
              projectId: record.projectId,
              status: record.status,
              currency: record.currency || 'TRY',
              createdAt: record.createdAt,
              updatedAt: record.updatedAt,
              source: 'api',
              notes: record.notes || '',
            })
          )
        );
        setApiOffers(normalized);
        setOffersFetchState(normalized.length > 0 ? 'success' : 'empty');
      } catch (error) {
        if (cancelled) return;
        setApiOffers([]);
        setOffersFetchState('error');
        setOffersError(error.message || 'Teklifler alınamadı.');
      } finally {
        if (!cancelled) {
          setOffersLoading(false);
        }
      }
    };

    loadOffers();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadResearch = async () => {
      setResearchLoading(true);
      setResearchError('');

      try {
        const records = await getResearchItems();
        if (cancelled) return;
        setApiResearchItems(sortByRecent(records.map((record) => normalizeResearch({ ...record, source: 'api' }))));
      } catch (error) {
        if (!cancelled) {
          setApiResearchItems([]);
          setResearchError(error.message || 'Araştırma kayıtları alınamadı.');
        }
      } finally {
        if (!cancelled) {
          setResearchLoading(false);
        }
      }
    };

    loadResearch();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (products.length === 0) {
      setSelectedProductId(null);
      return;
    }

    if (!selectedProductId || !products.some((item) => item.id === selectedProductId)) {
      setSelectedProductId(products[0].id);
    }
  }, [products, selectedProductId]);

  useEffect(() => {
    if (systems.length === 0) {
      setSelectedSystemId(null);
      return;
    }

    if (!selectedSystemId || !systems.some((item) => item.id === selectedSystemId)) {
      setSelectedSystemId(systems[0].id);
    }
  }, [systems, selectedSystemId]);

  useEffect(() => {
    if (customers.length === 0) {
      setSelectedCustomerId(null);
      return;
    }

    if (!selectedCustomerId || !customers.some((item) => item.id === selectedCustomerId)) {
      setSelectedCustomerId(customers[0].id);
    }
  }, [customers, selectedCustomerId]);

  useEffect(() => {
    if (projects.length === 0) {
      setSelectedProjectId(null);
      return;
    }

    if (!selectedProjectId || !projects.some((item) => item.id === selectedProjectId)) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  useEffect(() => {
    if (offers.length === 0) {
      setSelectedOfferId(null);
      return;
    }

    if (!selectedOfferId || !offers.some((item) => item.id === selectedOfferId)) {
      setSelectedOfferId(offers[0].id);
    }
  }, [offers, selectedOfferId]);

  useEffect(() => {
    if (priceAnalyses.length === 0) {
      setSelectedPriceAnalysisId(null);
      return;
    }

    if (!selectedPriceAnalysisId || !priceAnalyses.some((item) => item.id === selectedPriceAnalysisId)) {
      setSelectedPriceAnalysisId(priceAnalyses[0].id);
    }
  }, [priceAnalyses, selectedPriceAnalysisId]);

  useEffect(() => {
    if (materialAnalyses.length === 0) {
      setSelectedMaterialAnalysisId(null);
      return;
    }

    if (!selectedMaterialAnalysisId || !materialAnalyses.some((item) => item.id === selectedMaterialAnalysisId)) {
      setSelectedMaterialAnalysisId(materialAnalyses[0].id);
    }
  }, [materialAnalyses, selectedMaterialAnalysisId]);

  const dashboardStats = useMemo(
    () => [
      { label: 'Ürünler', value: products.length, caption: `${products.filter((item) => item.status === 'Aktif').length} aktif` },
      { label: 'Sistemler', value: systems.length, caption: `${systems.filter((item) => item.status === 'Aktif').length} aktif` },
      { label: 'Teklifler', value: offers.length, caption: `${offers.filter((item) => item.source === 'local').length} taslak` },
      { label: 'Projeler', value: projects.length, caption: `${projects.filter((item) => item.source === 'api').length} API` },
      { label: 'Fiyat Analizi', value: priceAnalyses.length, caption: 'hizmet kalemi bazlı' },
      { label: 'Malzeme Analizi', value: materialAnalyses.length, caption: 'malzeme ağacı bazlı' },
      { label: 'Müşteriler', value: customers.length, caption: 'CRM ilişkileri hazır' },
      { label: 'Sistem Logları', value: systemLogs.length, caption: 'son 60 işlem' },
    ],
    [customers.length, materialAnalyses.length, offers, priceAnalyses.length, products, projects, systemLogs.length, systems]
  );

  const filteredProducts = useMemo(
    () =>
      products.filter((item) => {
        const matchesSearch = [item.name, item.code, item.description]
          .join(' ')
          .toLowerCase()
          .includes(productSearch.toLowerCase());
        const matchesStatus = productStatusFilter === 'Tümü' || item.status === productStatusFilter;
        return matchesSearch && matchesStatus;
      }),
    [productSearch, productStatusFilter, products]
  );

  const filteredSystems = useMemo(
    () =>
      systems.filter((item) => {
        const matchesSearch = [item.name, item.code, item.category]
          .join(' ')
          .toLowerCase()
          .includes(systemSearch.toLowerCase());
        const matchesCategory = systemCategoryFilter === 'Tümü' || item.category === systemCategoryFilter;
        return matchesSearch && matchesCategory;
      }),
    [systemCategoryFilter, systemSearch, systems]
  );

  const filteredCustomers = useMemo(
    () =>
      customers.filter((item) =>
        [item.name, item.company, item.email, item.phone]
          .join(' ')
          .toLowerCase()
          .includes(customerSearch.toLowerCase())
      ),
    [customerSearch, customers]
  );

  const filteredProjects = useMemo(
    () =>
      projects.filter((item) =>
        [item.name, item.type, item.description, customerMap.get(item.customerId)?.company || '']
          .join(' ')
          .toLowerCase()
          .includes(projectSearch.toLowerCase())
      ),
    [customerMap, projectSearch, projects]
  );

  const filteredOffers = useMemo(
    () =>
      offers.filter((item) =>
        [item.title, item.notes, customerMap.get(item.customerId)?.company || '']
          .join(' ')
          .toLowerCase()
          .includes(offerSearch.toLowerCase())
      ),
    [customerMap, offerSearch, offers]
  );

  const uniqueSystemCategories = useMemo(
    () => ['Tümü', ...new Set(systems.map((item) => item.category).filter(Boolean))],
    [systems]
  );

  const toggleMultiSelectValue = (values, nextValue) =>
    values.includes(nextValue) ? values.filter((value) => value !== nextValue) : [...values, nextValue];

  const syncProjectDetailRelations = (systemIdToRemove, offerIdToRemove) => {
    setProjectDrafts((current) =>
      current.map((project) => ({
        ...project,
        systemIds: systemIdToRemove ? project.systemIds.filter((id) => id !== systemIdToRemove) : project.systemIds,
        offerIds: offerIdToRemove ? project.offerIds.filter((id) => id !== offerIdToRemove) : project.offerIds,
      }))
    );
  };

  const handleSaveProduct = (event) => {
    event.preventDefault();
    setProductFormError('');

    if (!productForm.name.trim() || !productForm.code.trim() || !productForm.unit.trim()) {
      setProductFormError('Ürün adı, ürün kodu ve birim alanları zorunludur.');
      return;
    }

    const now = new Date().toISOString();
    const nextRecord = normalizeProduct({
      ...productForm,
      id: productForm.id || createLocalId('product'),
      createdAt: productForm.id ? products.find((item) => item.id === productForm.id)?.createdAt : now,
      updatedAt: now,
    });

    setProducts((current) =>
      sortByRecent(
        productForm.id ? current.map((item) => (item.id === nextRecord.id ? nextRecord : item)) : [nextRecord, ...current]
      )
    );
    setSelectedProductId(nextRecord.id);
    setShowProductForm(false);
    setProductForm(emptyProductForm());
    addLog(`Ürün ${productForm.id ? 'güncellendi' : 'oluşturuldu'}: ${nextRecord.name}`);
  };

  const handleSaveSystem = (event) => {
    event.preventDefault();
    setSystemFormError('');

    if (!systemForm.name.trim() || !systemForm.code.trim() || !systemForm.category.trim()) {
      setSystemFormError('Sistem adı, sistem kodu ve kategori alanları zorunludur.');
      return;
    }

    const now = new Date().toISOString();
    const nextRecord = normalizeSystem({
      ...systemForm,
      id: systemForm.id || createLocalId('system'),
      createdAt: systemForm.id ? systems.find((item) => item.id === systemForm.id)?.createdAt : now,
      updatedAt: now,
    });

    setSystems((current) =>
      sortByRecent(systemForm.id ? current.map((item) => (item.id === nextRecord.id ? nextRecord : item)) : [nextRecord, ...current])
    );
    setSelectedSystemId(nextRecord.id);
    setShowSystemForm(false);
    setSystemForm(emptySystemForm());
    addLog(`Sistem ${systemForm.id ? 'güncellendi' : 'oluşturuldu'}: ${nextRecord.name}`);
  };

  const handleSaveCustomer = (event) => {
    event.preventDefault();
    setCustomerFormError('');

    if (!customerForm.name.trim() || !customerForm.company.trim()) {
      setCustomerFormError('Müşteri adı ve firma bilgisi zorunludur.');
      return;
    }

    if (!isEmailValid(customerForm.email)) {
      setCustomerFormError('Geçerli bir e-posta adresi girin.');
      return;
    }

    const now = new Date().toISOString();
    const nextRecord = normalizeCustomer({
      ...customerForm,
      id: customerForm.id || createLocalId('customer'),
      createdAt: customerForm.id ? customers.find((item) => item.id === customerForm.id)?.createdAt : now,
      updatedAt: now,
    });

    setCustomers((current) =>
      sortByRecent(customerForm.id ? current.map((item) => (item.id === nextRecord.id ? nextRecord : item)) : [nextRecord, ...current])
    );
    setSelectedCustomerId(nextRecord.id);
    setShowCustomerForm(false);
    setCustomerForm(emptyCustomerForm());
    addLog(`Müşteri ${customerForm.id ? 'güncellendi' : 'oluşturuldu'}: ${nextRecord.company}`);
  };

  const handleSaveProject = (event) => {
    event.preventDefault();
    setProjectFormError('');

    if (!projectForm.name.trim()) {
      setProjectFormError('Proje adı zorunludur.');
      return;
    }

    const conflictingOffer = offerDrafts.find(
      (offer) => projectForm.offerIds.includes(offer.id) && offer.projectId && offer.projectId !== projectForm.id
    );

    if (conflictingOffer) {
      setProjectFormError('Seçilen teklif başka bir projeye bağlı. Önce teklif bağlantısını kaldırın.');
      return;
    }

    const now = new Date().toISOString();
    const previousProject = projectDrafts.find((item) => item.id === projectForm.id);
    const nextRecord = normalizeProject({
      ...projectForm,
      id: projectForm.id || createLocalId('project'),
      createdAt: projectForm.id ? previousProject?.createdAt : now,
      updatedAt: now,
      source: 'local',
    });

    setProjectDrafts((current) =>
      sortByRecent(projectForm.id ? current.map((item) => (item.id === nextRecord.id ? nextRecord : item)) : [nextRecord, ...current])
    );
    setOfferDrafts((current) =>
      current.map((offer) => {
        if (nextRecord.offerIds.includes(offer.id)) {
          const shouldInheritCustomer = Boolean(nextRecord.customerId) && (!offer.customerId || offer.customerInheritedFromProject);

          return normalizeOffer({
            ...offer,
            projectId: nextRecord.id,
            customerId: shouldInheritCustomer ? nextRecord.customerId : offer.customerId,
            customerInheritedFromProject: shouldInheritCustomer,
          });
        }

        if (offer.projectId === nextRecord.id) {
          return normalizeOffer({
            ...offer,
            projectId: '',
            customerId: offer.customerInheritedFromProject ? '' : offer.customerId,
            customerInheritedFromProject: false,
          });
        }

        return offer;
      })
    );
    setSelectedProjectId(nextRecord.id);
    setShowProjectForm(false);
    setProjectForm(emptyProjectForm());
    addLog(`Proje ${projectForm.id ? 'güncellendi' : 'taslak olarak kaydedildi'}: ${nextRecord.name}`);
  };

  const handleSaveOffer = (event) => {
    event.preventDefault();
    setOfferFormError('');

    const validItems = offerForm.items.filter((item) => item.description.trim());
    const selectedProjectRecord = projects.find((item) => item.id === offerForm.projectId);
    const derivedCustomerId = offerForm.customerId || selectedProjectRecord?.customerId || '';
    const customerInheritedFromProject = Boolean(selectedProjectRecord?.customerId && !offerForm.customerId);

    if (offerForm.projectId && selectedProjectRecord?.customerId && offerForm.customerId && offerForm.customerId !== selectedProjectRecord.customerId) {
      setOfferFormError('Seçilen proje ile müşteri kaydı eşleşmiyor. Aynı müşteriyi seçin veya proje bağlantısını kaldırın.');
      return;
    }

    if (!offerForm.title.trim()) {
      setOfferFormError('Teklif adı zorunludur.');
      return;
    }

    if (validItems.length === 0) {
      setOfferFormError('En az bir teklif kalemi ekleyin.');
      return;
    }

    const now = new Date().toISOString();
    const nextRecord = normalizeOffer({
      ...offerForm,
      customerId: derivedCustomerId,
      customerInheritedFromProject,
      items: validItems,
      id: offerForm.id || createLocalId('offer'),
      createdAt: offerForm.id ? offerDrafts.find((item) => item.id === offerForm.id)?.createdAt : now,
      updatedAt: now,
      source: 'local',
    });

    setOfferDrafts((current) =>
      sortByRecent(offerForm.id ? current.map((item) => (item.id === nextRecord.id ? nextRecord : item)) : [nextRecord, ...current])
    );
    setSelectedOfferId(nextRecord.id);
    setShowOfferForm(false);
    setOfferForm(emptyOfferForm());
    addLog(`Teklif ${offerForm.id ? 'güncellendi' : 'taslak olarak kaydedildi'}: ${nextRecord.title}`);
  };

  const handleSavePriceAnalysis = (event) => {
    event.preventDefault();
    setPriceAnalysisFormError('');

    const validItems = priceAnalysisForm.items.filter((item) => item.description.trim());

    if (!priceAnalysisForm.name.trim() || !priceAnalysisForm.code.trim()) {
      setPriceAnalysisFormError('Analiz adı ve analiz kodu zorunludur.');
      return;
    }

    if (validItems.length === 0) {
      setPriceAnalysisFormError('En az bir analiz kalemi ekleyin.');
      return;
    }

    const now = new Date().toISOString();
    const nextRecord = normalizePriceAnalysis({
      ...priceAnalysisForm,
      items: validItems,
      id: priceAnalysisForm.id || createLocalId('price-analysis'),
      createdAt: priceAnalysisForm.id ? priceAnalyses.find((item) => item.id === priceAnalysisForm.id)?.createdAt : now,
      updatedAt: now,
    });

    setPriceAnalyses((current) =>
      sortByRecent(
        priceAnalysisForm.id ? current.map((item) => (item.id === nextRecord.id ? nextRecord : item)) : [nextRecord, ...current]
      )
    );
    setSelectedPriceAnalysisId(nextRecord.id);
    setShowPriceAnalysisForm(false);
    setPriceAnalysisForm(emptyPriceAnalysisForm());
    addLog(`Fiyat analizi ${priceAnalysisForm.id ? 'güncellendi' : 'kaydedildi'}: ${nextRecord.name}`);
  };

  const handleSaveMaterialAnalysis = (event) => {
    event.preventDefault();
    setMaterialAnalysisFormError('');

    const validItems = materialAnalysisForm.items.filter((item) => item.name.trim());

    if (!materialAnalysisForm.name.trim() || !materialAnalysisForm.code.trim()) {
      setMaterialAnalysisFormError('Analiz adı ve analiz kodu zorunludur.');
      return;
    }

    if (validItems.length === 0) {
      setMaterialAnalysisFormError('En az bir malzeme kaydı ekleyin.');
      return;
    }

    const now = new Date().toISOString();
    const nextRecord = normalizeMaterialAnalysis({
      ...materialAnalysisForm,
      items: validItems,
      id: materialAnalysisForm.id || createLocalId('material-analysis'),
      createdAt: materialAnalysisForm.id ? materialAnalyses.find((item) => item.id === materialAnalysisForm.id)?.createdAt : now,
      updatedAt: now,
    });

    setMaterialAnalyses((current) =>
      sortByRecent(
        materialAnalysisForm.id ? current.map((item) => (item.id === nextRecord.id ? nextRecord : item)) : [nextRecord, ...current]
      )
    );
    setSelectedMaterialAnalysisId(nextRecord.id);
    setShowMaterialAnalysisForm(false);
    setMaterialAnalysisForm(emptyMaterialAnalysisForm());
    addLog(`Malzeme analizi ${materialAnalysisForm.id ? 'güncellendi' : 'kaydedildi'}: ${nextRecord.name}`);
  };

  const handleSaveResearch = (event) => {
    event.preventDefault();
    setResearchFormError('');

    if (!researchForm.name.trim()) {
      setResearchFormError('Araştırma başlığı zorunludur.');
      return;
    }

    const now = new Date().toISOString();
    const nextRecord = normalizeResearch({
      ...researchForm,
      id: researchForm.id || createLocalId('research'),
      createdAt: researchForm.id ? researchDrafts.find((item) => item.id === researchForm.id)?.createdAt : now,
      updatedAt: now,
      source: 'local',
    });

    setResearchDrafts((current) =>
      sortByRecent(researchForm.id ? current.map((item) => (item.id === nextRecord.id ? nextRecord : item)) : [nextRecord, ...current])
    );
    setShowResearchForm(false);
    setResearchForm(emptyResearchForm());
    addLog(`Araştırma ${researchForm.id ? 'güncellendi' : 'taslak olarak kaydedildi'}: ${nextRecord.name}`);
  };

  const handleDeleteProduct = (id) => {
    const current = productMap.get(id);
    if (!current) return;
    setProducts((items) => items.filter((item) => item.id !== id));
    setPriceAnalyses((items) =>
      items.map((item) => (item.linkedProductId === id ? normalizePriceAnalysis({ ...item, linkedProductId: '' }) : item))
    );
    setMaterialAnalyses((items) =>
      items.map((item) => (item.linkedProductId === id ? normalizeMaterialAnalysis({ ...item, linkedProductId: '' }) : item))
    );
    if (selectedProductId === id) setSelectedProductId(null);
    addLog(`Ürün silindi: ${current.name}`);
  };

  const handleDeleteSystem = (id) => {
    const current = systemMap.get(id);
    if (!current) return;
    setSystems((items) => items.filter((item) => item.id !== id));
    setProducts((items) => items.map((item) => (item.systemId === id ? normalizeProduct({ ...item, systemId: '' }) : item)));
    syncProjectDetailRelations(id, null);
    if (selectedSystemId === id) setSelectedSystemId(null);
    addLog(`Sistem silindi: ${current.name}`);
  };

  const handleDeleteCustomer = (id) => {
    const current = customerMap.get(id);
    if (!current) return;

    const hasRelations = projects.some((item) => item.customerId === id) || offers.some((item) => item.customerId === id);

    if (hasRelations) {
      setCustomerFormError('Bu müşteri proje veya teklif kayıtlarında kullanıldığı için silinemez. Önce ilişkileri kaldırın.');
      setSelectedCustomerId(id);
      return;
    }

    setCustomers((items) => items.filter((item) => item.id !== id));
    if (selectedCustomerId === id) setSelectedCustomerId(null);
    addLog(`Müşteri silindi: ${current.company}`);
  };

  const handleDeleteProject = (id) => {
    const current = projectDrafts.find((item) => item.id === id);
    if (!current) return;

    const linkedOfferIds = offerDrafts.filter((item) => item.projectId === id).map((item) => item.id);

    setProjectDrafts((items) =>
      items
        .filter((item) => item.id !== id)
        .map((item) =>
          linkedOfferIds.length > 0
            ? normalizeProject({ ...item, offerIds: item.offerIds.filter((offerId) => !linkedOfferIds.includes(offerId)) })
            : item
        )
    );
    setOfferDrafts((items) =>
      items.map((item) =>
        item.projectId === id
          ? normalizeOffer({
              ...item,
              projectId: '',
              customerId: item.customerInheritedFromProject ? '' : item.customerId,
              customerInheritedFromProject: false,
            })
          : item
      )
    );
    if (selectedProjectId === id) setSelectedProjectId(null);
    addLog(`Proje taslağı silindi: ${current.name}`);
  };

  const handleDeleteOffer = (id) => {
    const current = offerDrafts.find((item) => item.id === id);
    if (!current) return;
    setOfferDrafts((items) => items.filter((item) => item.id !== id));
    syncProjectDetailRelations(null, id);
    if (selectedOfferId === id) setSelectedOfferId(null);
    addLog(`Teklif taslağı silindi: ${current.title}`);
  };

  const handleDeletePriceAnalysis = (id) => {
    const current = priceAnalyses.find((item) => item.id === id);
    if (!current) return;
    setPriceAnalyses((items) => items.filter((item) => item.id !== id));
    if (selectedPriceAnalysisId === id) setSelectedPriceAnalysisId(null);
    addLog(`Fiyat analizi silindi: ${current.name}`);
  };

  const handleDeleteMaterialAnalysis = (id) => {
    const current = materialAnalyses.find((item) => item.id === id);
    if (!current) return;
    setMaterialAnalyses((items) => items.filter((item) => item.id !== id));
    if (selectedMaterialAnalysisId === id) setSelectedMaterialAnalysisId(null);
    addLog(`Malzeme analizi silindi: ${current.name}`);
  };

  const handleDeleteResearch = (id) => {
    const current = researchDrafts.find((item) => item.id === id);
    if (!current) return;
    setResearchDrafts((items) => items.filter((item) => item.id !== id));
    addLog(`Araştırma taslağı silindi: ${current.name}`);
  };

  const startProductEdit = (record) => {
    setProductForm({
      id: record.id,
      name: record.name,
      code: record.code,
      unit: record.unit,
      systemId: record.systemId,
      status: record.status,
      description: record.description,
    });
    setShowProductForm(true);
  };

  const startSystemEdit = (record) => {
    setSystemForm({
      id: record.id,
      name: record.name,
      code: record.code,
      category: record.category,
      status: record.status,
      description: record.description,
    });
    setShowSystemForm(true);
  };

  const startCustomerEdit = (record) => {
    setCustomerForm({
      id: record.id,
      name: record.name,
      company: record.company,
      email: record.email,
      phone: record.phone,
      contactName: record.contactName,
      notes: record.notes,
    });
    setShowCustomerForm(true);
  };

  const startProjectEdit = (record) => {
    setProjectForm({
      id: record.id,
      name: record.name,
      type: record.type,
      status: record.status,
      customerId: record.customerId,
      location: record.location,
      description: record.description,
      systemIds: record.systemIds,
      offerIds: record.offerIds,
    });
    setShowProjectForm(true);
  };

  const startOfferEdit = (record) => {
    setOfferForm({
      id: record.id,
      title: record.title,
      customerId: record.customerId,
      projectId: record.projectId,
      status: record.status,
      vatRate: String(record.vatRate),
      notes: record.notes,
      items: record.items.length ? record.items : [createOfferItem()],
    });
    setShowOfferForm(true);
  };

  const startPriceAnalysisEdit = (record) => {
    setPriceAnalysisForm({
      id: record.id,
      name: record.name,
      code: record.code,
      linkedProductId: record.linkedProductId,
      notes: record.notes,
      items: record.items.length ? record.items : [createPriceItem()],
    });
    setShowPriceAnalysisForm(true);
  };

  const startMaterialAnalysisEdit = (record) => {
    setMaterialAnalysisForm({
      id: record.id,
      name: record.name,
      code: record.code,
      linkedProductId: record.linkedProductId,
      notes: record.notes,
      items: record.items.length ? record.items : [createMaterialItem()],
    });
    setShowMaterialAnalysisForm(true);
  };

  const startResearchEdit = (record) => {
    setResearchForm({
      id: record.id,
      name: record.name,
      note: record.note,
    });
    setShowResearchForm(true);
  };

  const createLocalProjectCopy = (record) => {
    const nextRecord = normalizeProject({
      ...record,
      id: createLocalId('project'),
      source: 'local',
      copiedFromId: record.id,
      status: 'Taslak',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    setProjectDrafts((current) => sortByRecent([nextRecord, ...current]));
    setSelectedProjectId(nextRecord.id);
    addLog(`API projesinden yerel çalışma kopyası oluşturuldu: ${record.name}`);
  };

  const createLocalOfferCopy = (record) => {
    const nextRecord = normalizeOffer({
      ...record,
      id: createLocalId('offer'),
      source: 'local',
      copiedFromId: record.id,
      projectId: '',
      status: 'Taslak',
      items: record.items.length ? record.items : [createOfferItem()],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    setOfferDrafts((current) => sortByRecent([nextRecord, ...current]));
    setSelectedOfferId(nextRecord.id);
    addLog(`API teklifinden yerel taslak oluşturuldu: ${record.title}`);
  };

  const updateOfferItem = (itemId, field, value) => {
    setOfferForm((current) => ({
      ...current,
      items: current.items.map((item) => (item.id === itemId ? { ...item, [field]: value } : item)),
    }));
  };

  const updatePriceItem = (itemId, field, value) => {
    setPriceAnalysisForm((current) => ({
      ...current,
      items: current.items.map((item) => (item.id === itemId ? { ...item, [field]: value } : item)),
    }));
  };

  const updateMaterialItem = (itemId, field, value) => {
    setMaterialAnalysisForm((current) => ({
      ...current,
      items: current.items.map((item) => (item.id === itemId ? { ...item, [field]: value } : item)),
    }));
  };

  const createMemory = (event) => {
    event.preventDefault();
    if (!memoryTitle.trim()) return;
    const record = {
      id: createLocalId('memory'),
      title: memoryTitle.trim(),
      content: memoryContent.trim() || 'İçerik eklenmedi.',
      date: formatDisplayDate(new Date().toISOString()),
    };
    setMemoryItems((current) => [record, ...current]);
    setMemoryTitle('');
    setMemoryContent('');
    setShowMemoryForm(false);
    addLog(`Merkezi hafızaya kayıt eklendi: ${record.title}`);
  };

  const toggleIntegration = (id) => {
    const target = integrations.find((item) => item.id === id);
    if (!target) return;
    const nextStatus = target.status === 'Aktif' ? 'Pasif' : 'Aktif';
    setIntegrations((current) =>
      current.map((item) => (item.id === id ? { ...item, status: nextStatus } : item))
    );
    addLog(`${target.name} entegrasyon durumu değiştirildi: ${nextStatus}`);
  };

  const sendAiMessage = (event) => {
    event.preventDefault();
    if (!aiInput.trim()) return;
    const now = formatDisplayDate(new Date().toISOString());
    const message = aiInput.trim();
    setAiMessages((current) => [
      ...current,
      { id: createLocalId('ai-user'), role: 'user', text: message, date: now },
      {
        id: createLocalId('ai-assistant'),
        role: 'assistant',
        text: `Mesaj kaydedildi: "${message}". Bu alan sonraki backend/AI entegrasyonuna hazır şekilde yerel çalışma notu üretir.`,
        date: now,
      },
    ]);
    setAiInput('');
    addLog(`DDPro AI mesajı kaydedildi: ${message}`);
  };

  const renderToolbar = (leftContent, rightContent) => (
    <div className="module-toolbar module-toolbar-split">
      <div className="toolbar-block">{leftContent}</div>
      <div className="toolbar-block toolbar-actions">{rightContent}</div>
    </div>
  );

  const renderDashboard = () => (
    <div className="dashboard-module">
      <div className="workflow-summary-grid">
        {dashboardStats.map((stat) => (
          <SummaryCard key={stat.label} label={stat.label} value={stat.value} caption={stat.caption} />
        ))}
      </div>

      <div className="dashboard-grid">
        <div className="panel">
          <div className="panel-header">
            <h2>Canlı / Taslak Durumu</h2>
          </div>
          <div className="panel-content quick-status-list">
            <div className="quick-status-card">
              <strong>{projectsFetchState === 'success' ? 'Projeler API bağlı' : 'Projeler taslak destekli'}</strong>
              <span>{projectsError || 'Yerel proje düzenleme akışı aktif.'}</span>
            </div>
            <div className="quick-status-card">
              <strong>{offersFetchState === 'success' ? 'Teklifler API okunuyor' : 'Teklifler taslak katmanda'}</strong>
              <span>{offersError || 'Kalem, KDV ve toplamlar yerel taslakta yönetiliyor.'}</span>
            </div>
            <div className="quick-status-card">
              <strong>Ürün / Sistem modülleri kullanılabilir</strong>
              <span>Sistem bağlantısı, aktif/pasif yönetimi ve detay ekranları hazır.</span>
            </div>
            <div className="quick-status-card">
              <strong>Analiz modülleri ayrıldı</strong>
              <span>PriceAnalysis ve MaterialAnalysis ayrı veri modeli ile tutuluyor.</span>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <h2>Son İşlemler</h2>
          </div>
          <div className="panel-content">
            {systemLogs.length === 0 ? (
              <EmptyState>Henüz sistem kaydı bulunmuyor.</EmptyState>
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

  const renderProducts = () => {
    const linkedSystem = selectedProduct ? systemMap.get(selectedProduct.systemId) : null;

    return (
      <div className="module-page">
        {renderToolbar(
          <div className="toolbar-search-grid">
            <input
              type="search"
              placeholder="Ürün ara"
              value={productSearch}
              onChange={(event) => setProductSearch(event.target.value)}
            />
            <select value={productStatusFilter} onChange={(event) => setProductStatusFilter(event.target.value)}>
              <option>Tümü</option>
              <option>Aktif</option>
              <option>Pasif</option>
            </select>
          </div>,
          <>
            <StatusPill tone="info">{LOCAL_ONLY_MODULE_NOTE}</StatusPill>
            <button type="button" onClick={() => { setShowProductForm((value) => !value); setProductForm(emptyProductForm()); }}>
              {showProductForm ? 'Formu Kapat' : '+ Yeni Ürün'}
            </button>
          </>
        )}

        {showProductForm && (
          <form className="data-form" onSubmit={handleSaveProduct}>
            <input type="text" placeholder="Ürün adı" value={productForm.name} onChange={(event) => setProductForm((current) => ({ ...current, name: event.target.value }))} />
            <input type="text" placeholder="Ürün kodu" value={productForm.code} onChange={(event) => setProductForm((current) => ({ ...current, code: event.target.value }))} />
            <input type="text" placeholder="Birim" value={productForm.unit} onChange={(event) => setProductForm((current) => ({ ...current, unit: event.target.value }))} />
            <select value={productForm.systemId} onChange={(event) => setProductForm((current) => ({ ...current, systemId: event.target.value }))}>
              <option value="">Sistem bağlantısı yok</option>
              {systems.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
            <select value={productForm.status} onChange={(event) => setProductForm((current) => ({ ...current, status: event.target.value }))}>
              <option>Aktif</option>
              <option>Pasif</option>
            </select>
            <textarea placeholder="Ürün açıklaması" value={productForm.description} onChange={(event) => setProductForm((current) => ({ ...current, description: event.target.value }))} />
            {productFormError ? <p className="form-error">{productFormError}</p> : null}
            <button type="submit">{productForm.id ? 'Ürünü Güncelle' : 'Ürünü Kaydet'}</button>
          </form>
        )}

        <div className="split-layout">
          <div className="panel">
            <div className="panel-header">
              <h2>Ürün Listesi</h2>
              <span className="panel-meta">{filteredProducts.length} kayıt</span>
            </div>
            <div className="panel-content">
              {filteredProducts.length === 0 ? (
                <EmptyState>Arama kriterine uygun ürün bulunamadı.</EmptyState>
              ) : (
                <div className="entity-list">
                  {filteredProducts.map((item) => (
                    <button key={item.id} type="button" className={`entity-list-card ${selectedProductId === item.id ? 'selected' : ''}`} onClick={() => setSelectedProductId(item.id)}>
                      <div>
                        <strong>{item.name}</strong>
                        <span>{item.code} · {item.unit}</span>
                      </div>
                      <StatusPill tone={getTone(item.status)}>{item.status}</StatusPill>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">
              <h2>Ürün Detayı</h2>
              {selectedProduct ? <StatusPill tone="info">{getSourceLabel(selectedProduct.source)}</StatusPill> : null}
            </div>
            <div className="panel-content">
              {!selectedProduct ? (
                <EmptyState>Detay için bir ürün seçin.</EmptyState>
              ) : (
                <div className="detail-stack">
                  <div className="detail-grid">
                    <div><span>Ürün Kodu</span><strong>{selectedProduct.code}</strong></div>
                    <div><span>Birim</span><strong>{selectedProduct.unit}</strong></div>
                    <div><span>Sistem</span><strong>{linkedSystem?.name || 'Bağlı değil'}</strong></div>
                    <div><span>Durum</span><strong>{selectedProduct.status}</strong></div>
                  </div>
                  <div className="detail-note">
                    <strong>Açıklama</strong>
                    <p>{selectedProduct.description || 'Açıklama girilmedi.'}</p>
                  </div>
                  <div className="detail-actions">
                    <button type="button" onClick={() => startProductEdit(selectedProduct)}>Düzenle</button>
                    <button type="button" className="danger-button" onClick={() => handleDeleteProduct(selectedProduct.id)}>Sil</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderSystems = () => {
    const linkedProducts = selectedSystem ? products.filter((item) => item.systemId === selectedSystem.id) : [];

    return (
      <div className="module-page">
        {renderToolbar(
          <div className="toolbar-search-grid">
            <input type="search" placeholder="Sistem ara" value={systemSearch} onChange={(event) => setSystemSearch(event.target.value)} />
            <select value={systemCategoryFilter} onChange={(event) => setSystemCategoryFilter(event.target.value)}>
              {uniqueSystemCategories.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </select>
          </div>,
          <>
            <StatusPill tone="info">{LOCAL_ONLY_MODULE_NOTE}</StatusPill>
            <button type="button" onClick={() => { setShowSystemForm((value) => !value); setSystemForm(emptySystemForm()); }}>
              {showSystemForm ? 'Formu Kapat' : '+ Yeni Sistem'}
            </button>
          </>
        )}

        {showSystemForm && (
          <form className="data-form" onSubmit={handleSaveSystem}>
            <input type="text" placeholder="Sistem adı" value={systemForm.name} onChange={(event) => setSystemForm((current) => ({ ...current, name: event.target.value }))} />
            <input type="text" placeholder="Sistem kodu" value={systemForm.code} onChange={(event) => setSystemForm((current) => ({ ...current, code: event.target.value }))} />
            <input type="text" placeholder="Kategori" value={systemForm.category} onChange={(event) => setSystemForm((current) => ({ ...current, category: event.target.value }))} />
            <select value={systemForm.status} onChange={(event) => setSystemForm((current) => ({ ...current, status: event.target.value }))}>
              <option>Aktif</option>
              <option>Pasif</option>
            </select>
            <textarea placeholder="Sistem açıklaması" value={systemForm.description} onChange={(event) => setSystemForm((current) => ({ ...current, description: event.target.value }))} />
            {systemFormError ? <p className="form-error">{systemFormError}</p> : null}
            <button type="submit">{systemForm.id ? 'Sistemi Güncelle' : 'Sistemi Kaydet'}</button>
          </form>
        )}

        <div className="split-layout">
          <div className="panel">
            <div className="panel-header">
              <h2>Sistem Listesi</h2>
              <span className="panel-meta">{filteredSystems.length} kayıt</span>
            </div>
            <div className="panel-content">
              {filteredSystems.length === 0 ? (
                <EmptyState>Arama kriterine uygun sistem bulunamadı.</EmptyState>
              ) : (
                <div className="entity-list">
                  {filteredSystems.map((item) => (
                    <button key={item.id} type="button" className={`entity-list-card ${selectedSystemId === item.id ? 'selected' : ''}`} onClick={() => setSelectedSystemId(item.id)}>
                      <div>
                        <strong>{item.name}</strong>
                        <span>{item.code} · {item.category}</span>
                      </div>
                      <StatusPill tone={getTone(item.status)}>{item.status}</StatusPill>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">
              <h2>Sistem Detayı</h2>
              {selectedSystem ? <StatusPill tone="info">{linkedProducts.length} bağlı ürün</StatusPill> : null}
            </div>
            <div className="panel-content">
              {!selectedSystem ? (
                <EmptyState>Detay için bir sistem seçin.</EmptyState>
              ) : (
                <div className="detail-stack">
                  <div className="detail-grid">
                    <div><span>Sistem Kodu</span><strong>{selectedSystem.code}</strong></div>
                    <div><span>Kategori</span><strong>{selectedSystem.category}</strong></div>
                    <div><span>Durum</span><strong>{selectedSystem.status}</strong></div>
                    <div><span>Son Güncelleme</span><strong>{formatDisplayDate(selectedSystem.updatedAt)}</strong></div>
                  </div>
                  <div className="detail-note">
                    <strong>Açıklama</strong>
                    <p>{selectedSystem.description || 'Açıklama girilmedi.'}</p>
                  </div>
                  <div className="linked-block">
                    <strong>Sisteme Bağlı Ürünler</strong>
                    {linkedProducts.length === 0 ? <EmptyState>Bu sisteme henüz ürün bağlanmadı.</EmptyState> : (
                      <div className="chip-row">{linkedProducts.map((item) => <span className="detail-chip" key={item.id}>{item.name}</span>)}</div>
                    )}
                  </div>
                  <div className="detail-actions">
                    <button type="button" onClick={() => startSystemEdit(selectedSystem)}>Düzenle</button>
                    <button type="button" className="danger-button" onClick={() => handleDeleteSystem(selectedSystem.id)}>Sil</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="systems-bottom-grid">
          <div className="panel memory-panel">
            <div className="panel-header">
              <h2>Merkezi Hafıza</h2>
              <button type="button" onClick={() => setShowMemoryForm((value) => !value)}>{showMemoryForm ? 'Kapat' : '+ Yeni Kayıt'}</button>
            </div>
            {showMemoryForm && (
              <form className="data-form compact-form" onSubmit={createMemory}>
                <input type="text" placeholder="Hafıza başlığı" value={memoryTitle} onChange={(event) => setMemoryTitle(event.target.value)} />
                <textarea placeholder="Hafıza içeriği" value={memoryContent} onChange={(event) => setMemoryContent(event.target.value)} />
                <button type="submit">Hafızaya Kaydet</button>
              </form>
            )}
            <div className="panel-content">
              {memoryItems.length === 0 ? <EmptyState>Merkezi hafızada henüz kayıt bulunmuyor.</EmptyState> : (
                <div className="data-list">{memoryItems.map((item) => <div className="data-card" key={item.id}><div><h3>{item.title}</h3><p>{item.content}</p><small>{item.date}</small></div></div>)}</div>
              )}
            </div>
          </div>

          <div className="panel">
            <div className="panel-header"><h2>Entegrasyonlar</h2></div>
            <div className="panel-content data-list">
              {integrations.map((item) => (
                <div className="data-card" key={item.id}>
                  <div>
                    <h3>{item.name}</h3>
                    <p>{item.description}</p>
                    <small>Durum: {item.status}</small>
                  </div>
                  <button type="button" onClick={() => toggleIntegration(item.id)}>{item.status === 'Aktif' ? 'Pasifleştir' : 'Aktifleştir'}</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderPriceAnalyses = () => (
    <div className="module-page">
      {renderToolbar(
        <StatusPill tone="info">{LOCAL_ONLY_MODULE_NOTE}</StatusPill>,
        <button type="button" onClick={() => { setShowPriceAnalysisForm((value) => !value); setPriceAnalysisForm(emptyPriceAnalysisForm()); }}>
          {showPriceAnalysisForm ? 'Formu Kapat' : '+ Yeni Analiz'}
        </button>
      )}

      {showPriceAnalysisForm && (
        <form className="workflow-form" onSubmit={handleSavePriceAnalysis}>
          <div className="form-grid two-columns">
            <input type="text" placeholder="Analiz adı" value={priceAnalysisForm.name} onChange={(event) => setPriceAnalysisForm((current) => ({ ...current, name: event.target.value }))} />
            <input type="text" placeholder="Analiz kodu" value={priceAnalysisForm.code} onChange={(event) => setPriceAnalysisForm((current) => ({ ...current, code: event.target.value }))} />
            <select value={priceAnalysisForm.linkedProductId} onChange={(event) => setPriceAnalysisForm((current) => ({ ...current, linkedProductId: event.target.value }))}>
              <option value="">Bağlı ürün yok</option>
              {products.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <textarea placeholder="Analiz notları" value={priceAnalysisForm.notes} onChange={(event) => setPriceAnalysisForm((current) => ({ ...current, notes: event.target.value }))} />
          </div>
          <LineItemsEditor
            variant="price"
            items={priceAnalysisForm.items}
            onAddItem={() => setPriceAnalysisForm((current) => ({ ...current, items: [...current.items, createPriceItem()] }))}
            onRemoveItem={(itemId) => setPriceAnalysisForm((current) => ({ ...current, items: current.items.filter((item) => item.id !== itemId) }))}
            onItemChange={updatePriceItem}
          />
          {priceAnalysisFormError ? <p className="form-error">{priceAnalysisFormError}</p> : null}
          <button type="submit">{priceAnalysisForm.id ? 'Analizi Güncelle' : 'Analizi Kaydet'}</button>
        </form>
      )}

      <div className="split-layout">
        <div className="panel">
          <div className="panel-header"><h2>Fiyat Analizleri</h2><span className="panel-meta">{priceAnalyses.length} kayıt</span></div>
          <div className="panel-content">
            {priceAnalyses.length === 0 ? <EmptyState>Henüz fiyat analizi bulunmuyor.</EmptyState> : (
              <div className="entity-list">
                {priceAnalyses.map((item) => (
                  <button key={item.id} type="button" className={`entity-list-card ${selectedPriceAnalysisId === item.id ? 'selected' : ''}`} onClick={() => setSelectedPriceAnalysisId(item.id)}>
                    <div>
                      <strong>{item.name}</strong>
                      <span>{item.code} · {item.items.length} kalem</span>
                    </div>
                    <StatusPill tone="info">{formatCurrency(item.total)}</StatusPill>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="panel">
          <div className="panel-header"><h2>Analiz Detayı</h2></div>
          <div className="panel-content">
            {!selectedPriceAnalysis ? <EmptyState>Detay için bir fiyat analizi seçin.</EmptyState> : (
              <div className="detail-stack">
                <div className="detail-grid">
                  <div><span>Analiz Kodu</span><strong>{selectedPriceAnalysis.code}</strong></div>
                  <div><span>Bağlı Ürün</span><strong>{productMap.get(selectedPriceAnalysis.linkedProductId)?.name || 'Bağlı değil'}</strong></div>
                  <div><span>Kalem Sayısı</span><strong>{selectedPriceAnalysis.items.length}</strong></div>
                  <div><span>Genel Toplam</span><strong>{formatCurrency(selectedPriceAnalysis.total)}</strong></div>
                </div>
                <div className="detail-note"><strong>Notlar</strong><p>{selectedPriceAnalysis.notes || 'Not girilmedi.'}</p></div>
                <div className="detail-table">
                  {selectedPriceAnalysis.items.map((item) => (
                    <div className="detail-table-row" key={item.id}>
                      <span>{item.description}</span>
                      <small>{item.quantity} {item.unit} × {formatCurrency(item.unitPrice)} × {item.coefficient}</small>
                      <strong>{formatCurrency(calculatePriceItemTotal(item))}</strong>
                    </div>
                  ))}
                </div>
                <div className="detail-actions">
                  <button type="button" onClick={() => startPriceAnalysisEdit(selectedPriceAnalysis)}>Düzenle</button>
                  <button type="button" className="danger-button" onClick={() => handleDeletePriceAnalysis(selectedPriceAnalysis.id)}>Sil</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const renderMaterialAnalyses = () => {
    const tree = selectedMaterialAnalysis ? buildMaterialTree(selectedMaterialAnalysis.items) : [];

    return (
      <div className="module-page">
        {renderToolbar(
          <StatusPill tone="info">{LOCAL_ONLY_MODULE_NOTE}</StatusPill>,
          <button type="button" onClick={() => { setShowMaterialAnalysisForm((value) => !value); setMaterialAnalysisForm(emptyMaterialAnalysisForm()); }}>
            {showMaterialAnalysisForm ? 'Formu Kapat' : '+ Yeni Analiz'}
          </button>
        )}

        {showMaterialAnalysisForm && (
          <form className="workflow-form" onSubmit={handleSaveMaterialAnalysis}>
            <div className="form-grid two-columns">
              <input type="text" placeholder="Analiz adı" value={materialAnalysisForm.name} onChange={(event) => setMaterialAnalysisForm((current) => ({ ...current, name: event.target.value }))} />
              <input type="text" placeholder="Analiz kodu" value={materialAnalysisForm.code} onChange={(event) => setMaterialAnalysisForm((current) => ({ ...current, code: event.target.value }))} />
              <select value={materialAnalysisForm.linkedProductId} onChange={(event) => setMaterialAnalysisForm((current) => ({ ...current, linkedProductId: event.target.value }))}>
                <option value="">Bağlı ürün yok</option>
                {products.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
              <textarea placeholder="Analiz notları" value={materialAnalysisForm.notes} onChange={(event) => setMaterialAnalysisForm((current) => ({ ...current, notes: event.target.value }))} />
            </div>
            <HierarchyItemsEditor
              items={materialAnalysisForm.items}
              onAddItem={() => setMaterialAnalysisForm((current) => ({ ...current, items: [...current.items, createMaterialItem()] }))}
              onRemoveItem={(itemId) => setMaterialAnalysisForm((current) => ({ ...current, items: current.items.filter((item) => item.id !== itemId) }))}
              onItemChange={updateMaterialItem}
            />
            {materialAnalysisFormError ? <p className="form-error">{materialAnalysisFormError}</p> : null}
            <button type="submit">{materialAnalysisForm.id ? 'Analizi Güncelle' : 'Analizi Kaydet'}</button>
          </form>
        )}

        <div className="split-layout">
          <div className="panel">
            <div className="panel-header"><h2>Malzeme Analizleri</h2><span className="panel-meta">{materialAnalyses.length} kayıt</span></div>
            <div className="panel-content">
              {materialAnalyses.length === 0 ? <EmptyState>Henüz malzeme analizi bulunmuyor.</EmptyState> : (
                <div className="entity-list">
                  {materialAnalyses.map((item) => (
                    <button key={item.id} type="button" className={`entity-list-card ${selectedMaterialAnalysisId === item.id ? 'selected' : ''}`} onClick={() => setSelectedMaterialAnalysisId(item.id)}>
                      <div>
                        <strong>{item.name}</strong>
                        <span>{item.code} · {item.items.length} malzeme</span>
                      </div>
                      <StatusPill tone="info">{formatCurrency(item.total)}</StatusPill>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="panel">
            <div className="panel-header"><h2>Malzeme Ağacı</h2></div>
            <div className="panel-content">
              {!selectedMaterialAnalysis ? <EmptyState>Detay için bir malzeme analizi seçin.</EmptyState> : (
                <div className="detail-stack">
                  <div className="detail-grid">
                    <div><span>Analiz Kodu</span><strong>{selectedMaterialAnalysis.code}</strong></div>
                    <div><span>Bağlı Ürün</span><strong>{productMap.get(selectedMaterialAnalysis.linkedProductId)?.name || 'Bağlı değil'}</strong></div>
                    <div><span>Malzeme Sayısı</span><strong>{selectedMaterialAnalysis.items.length}</strong></div>
                    <div><span>Toplam Maliyet</span><strong>{formatCurrency(selectedMaterialAnalysis.total)}</strong></div>
                  </div>
                  <div className="detail-note"><strong>Notlar</strong><p>{selectedMaterialAnalysis.notes || 'Not girilmedi.'}</p></div>
                  <div className="tree-wrapper">
                    {tree.length === 0 ? <EmptyState>Malzeme ağacı boş.</EmptyState> : renderMaterialTree(tree)}
                  </div>
                  <div className="detail-actions">
                    <button type="button" onClick={() => startMaterialAnalysisEdit(selectedMaterialAnalysis)}>Düzenle</button>
                    <button type="button" className="danger-button" onClick={() => handleDeleteMaterialAnalysis(selectedMaterialAnalysis.id)}>Sil</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderOffers = () => {
    const offerTotals = calculateOfferTotals(offerForm.items, offerForm.vatRate);

    return (
      <div className="module-page">
        {renderToolbar(
          <div className="toolbar-search-grid">
            <input type="search" placeholder="Teklif ara" value={offerSearch} onChange={(event) => setOfferSearch(event.target.value)} />
            <StatusPill live tone={offersFetchState === 'success' ? 'success' : offersFetchState === 'loading' ? 'info' : offersFetchState === 'empty' ? 'neutral' : 'warning'}>
              {offersFetchState === 'success' ? 'API bağlı' : offersFetchState === 'loading' ? 'API yükleniyor' : offersFetchState === 'empty' ? 'API boş veri' : 'API hatası'}
            </StatusPill>
          </div>,
          <button type="button" onClick={() => { setShowOfferForm((value) => !value); setOfferForm(emptyOfferForm()); }}>
            {showOfferForm ? 'Formu Kapat' : '+ Yeni Teklif'}
          </button>
        )}

        {offersError ? <p className="status-banner warning">⚠ {offersError}</p> : null}

        {showOfferForm && (
          <form className="workflow-form" onSubmit={handleSaveOffer}>
            <div className="form-grid two-columns">
              <label className="field-group"><span>Teklif adı</span><input type="text" placeholder="Teklif adı" value={offerForm.title} onChange={(event) => setOfferForm((current) => ({ ...current, title: event.target.value }))} /></label>
              <label className="field-group"><span>Müşteri</span><select value={offerForm.customerId} onChange={(event) => setOfferForm((current) => ({ ...current, customerId: event.target.value }))}>
                <option value="">Müşteri seçin</option>
                {customers.map((item) => <option key={item.id} value={item.id}>{item.company}</option>)}
              </select></label>
              <label className="field-group"><span>Proje</span><select value={offerForm.projectId} onChange={(event) => setOfferForm((current) => ({ ...current, projectId: event.target.value }))}>
                <option value="">Proje seçin</option>
                {projects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select></label>
              <label className="field-group"><span>Durum</span><select value={offerForm.status} onChange={(event) => setOfferForm((current) => ({ ...current, status: event.target.value }))}>
                <option>Taslak</option>
                <option>Gönderildi</option>
                <option>Onaylandı</option>
                <option>Reddedildi</option>
              </select></label>
              <label className="field-group"><span>KDV (%)</span><input type="number" min="0" step="1" placeholder="KDV %" value={offerForm.vatRate} onChange={(event) => setOfferForm((current) => ({ ...current, vatRate: event.target.value }))} /></label>
              <label className="field-group field-group-full"><span>Teklif notları</span><textarea placeholder="Teklif notları" value={offerForm.notes} onChange={(event) => setOfferForm((current) => ({ ...current, notes: event.target.value }))} /></label>
            </div>
            <LineItemsEditor
              items={offerForm.items}
              onAddItem={() => setOfferForm((current) => ({ ...current, items: [...current.items, createOfferItem()] }))}
              onRemoveItem={(itemId) => setOfferForm((current) => ({ ...current, items: current.items.filter((item) => item.id !== itemId) }))}
              onItemChange={updateOfferItem}
            />
            <div className="totals-row">
              <span>Ara Toplam: <strong>{formatCurrency(offerTotals.subtotal)}</strong></span>
              <span>KDV: <strong>{formatCurrency(offerTotals.tax)}</strong></span>
              <span>Genel Toplam: <strong>{formatCurrency(offerTotals.total)}</strong></span>
            </div>
            {offerFormError ? <p className="form-error">{offerFormError}</p> : null}
            <p className="form-hint">Kalemli teklifler backend tam desteklenene kadar yerel taslak olarak saklanır.</p>
            <button type="submit">{offerForm.id ? 'Teklifi Güncelle' : 'Teklifi Kaydet'}</button>
          </form>
        )}

        <div className="workflow-summary-grid compact">
          <SummaryCard label="Toplam Teklif" value={offers.length} caption="liste görünümü" />
          <SummaryCard label="Yerel Taslak" value={offers.filter((item) => item.source === 'local').length} caption="tam düzenlenebilir" />
          <SummaryCard label="Onaylanan" value={offers.filter((item) => item.status === 'Onaylandı').length} caption="karar aşaması" />
          <SummaryCard label="Genel Hacim" value={formatCurrency(offers.reduce((sum, item) => sum + toNumber(item.total), 0))} caption="taslak + API" />
        </div>

        <div className="split-layout">
          <div className="panel">
            <div className="panel-header"><h2>Teklif Listesi</h2><span className="panel-meta">{filteredOffers.length} kayıt</span></div>
            <div className="panel-content">
              {offersLoading ? <EmptyState>Teklifler yükleniyor…</EmptyState> : filteredOffers.length === 0 ? <EmptyState>Kayıt bulunamadı.</EmptyState> : (
                <div className="entity-list">
                  {filteredOffers.map((item) => (
                    <button key={item.id} type="button" className={`entity-list-card ${selectedOfferId === item.id ? 'selected' : ''}`} onClick={() => setSelectedOfferId(item.id)}>
                      <div>
                        <strong>{item.title}</strong>
                        <span>{customerMap.get(item.customerId)?.company || 'Müşteri atanmadı'} · {formatCurrency(item.total)}</span>
                      </div>
                      <StatusPill tone={getTone(item.status)}>{item.status}</StatusPill>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="panel">
            <div className="panel-header"><h2>Teklif Detayı</h2>{selectedOffer ? <StatusPill tone="info">{getSourceLabel(selectedOffer.source)}</StatusPill> : null}</div>
            <div className="panel-content">
              {!selectedOffer ? <EmptyState>Detay için bir teklif seçin.</EmptyState> : (
                <div className="detail-stack">
                  <div className="detail-grid">
                    <div><span>Müşteri</span><strong>{customerMap.get(selectedOffer.customerId)?.company || 'Atanmadı'}</strong></div>
                    <div><span>Proje</span><strong>{projects.find((item) => item.id === selectedOffer.projectId)?.name || 'Atanmadı'}</strong></div>
                    <div><span>Durum</span><strong>{selectedOffer.status}</strong></div>
                    <div><span>Genel Toplam</span><strong>{formatCurrency(selectedOffer.total)}</strong></div>
                  </div>
                  <div className="totals-row stacked">
                    <span>Ara Toplam <strong>{formatCurrency(selectedOffer.subtotal)}</strong></span>
                    <span>KDV <strong>{formatCurrency(selectedOffer.tax)}</strong></span>
                    <span>Toplam <strong>{formatCurrency(selectedOffer.total)}</strong></span>
                  </div>
                  <div className="detail-table">
                    {selectedOffer.items.length === 0 ? <EmptyState>Bu teklif için kalem detayı API tarafında hazır değil.</EmptyState> : selectedOffer.items.map((item) => (
                      <div className="detail-table-row" key={item.id}>
                        <span>{item.description}</span>
                        <small>{item.quantity} {item.unit} × {formatCurrency(item.unitPrice)}</small>
                        <strong>{formatCurrency(calculateOfferItemTotal(item))}</strong>
                      </div>
                    ))}
                  </div>
                  <div className="detail-note"><strong>Notlar</strong><p>{selectedOffer.notes || 'Not girilmedi.'}</p></div>
                  <div className="detail-actions">
                    {selectedOffer.source === 'local' ? (
                      <>
                        <button type="button" onClick={() => startOfferEdit(selectedOffer)}>Düzenle</button>
                        <button type="button" className="danger-button" onClick={() => handleDeleteOffer(selectedOffer.id)}>Sil</button>
                      </>
                    ) : (
                      <button type="button" onClick={() => createLocalOfferCopy(selectedOffer)}>Yerel Taslağa Kopyala</button>
                    )}
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
    const relatedSystems = selectedProject ? selectedProject.systemIds.map((id) => systemMap.get(id)).filter(Boolean) : [];
    const relatedOffers = selectedProject ? selectedProject.offerIds.map((id) => offerMap.get(id)).filter(Boolean) : [];
    const readOnlyOfferIds = projectForm.offerIds.filter((id) => !offerDrafts.some((offer) => offer.id === id));
    const assignableLocalOffers = offers.filter(
      (item) => item.source === 'local' && (!item.projectId || item.projectId === projectForm.id)
    );

    return (
      <div className="module-page">
        {renderToolbar(
          <div className="toolbar-search-grid">
            <input type="search" placeholder="Proje ara" value={projectSearch} onChange={(event) => setProjectSearch(event.target.value)} />
            <StatusPill live tone={projectsFetchState === 'success' ? 'success' : projectsFetchState === 'loading' ? 'info' : projectsFetchState === 'empty' ? 'neutral' : 'warning'}>
              {projectsFetchState === 'success' ? 'API proje listesi hazır' : projectsFetchState === 'loading' ? 'API yükleniyor' : projectsFetchState === 'empty' ? 'API boş veri' : 'API hatası'}
            </StatusPill>
          </div>,
          <button type="button" onClick={() => { setShowProjectForm((value) => !value); setProjectForm(emptyProjectForm()); }}>
            {showProjectForm ? 'Formu Kapat' : '+ Yeni Proje'}
          </button>
        )}

        {projectsError ? <p className="status-banner warning">⚠ {projectsError}</p> : null}

        {showProjectForm && (
          <form className="workflow-form" onSubmit={handleSaveProject}>
            <div className="form-grid two-columns">
              <label className="field-group"><span>Proje adı</span><input type="text" placeholder="Proje adı" value={projectForm.name} onChange={(event) => setProjectForm((current) => ({ ...current, name: event.target.value }))} /></label>
              <label className="field-group"><span>Proje türü</span><input type="text" placeholder="Proje türü" value={projectForm.type} onChange={(event) => setProjectForm((current) => ({ ...current, type: event.target.value }))} /></label>
              <label className="field-group"><span>Durum</span><select value={projectForm.status} onChange={(event) => setProjectForm((current) => ({ ...current, status: event.target.value }))}>
                <option>Taslak</option>
                <option>Aktif</option>
                <option>Beklemede</option>
                <option>Tamamlandı</option>
              </select></label>
              <label className="field-group"><span>Müşteri</span><select value={projectForm.customerId} onChange={(event) => setProjectForm((current) => ({ ...current, customerId: event.target.value }))}>
                <option value="">Müşteri seçin</option>
                {customers.map((item) => <option key={item.id} value={item.id}>{item.company}</option>)}
              </select></label>
              <label className="field-group"><span>Lokasyon</span><input type="text" placeholder="Lokasyon" value={projectForm.location} onChange={(event) => setProjectForm((current) => ({ ...current, location: event.target.value }))} /></label>
              <label className="field-group field-group-full"><span>Proje açıklaması</span><textarea placeholder="Proje açıklaması" value={projectForm.description} onChange={(event) => setProjectForm((current) => ({ ...current, description: event.target.value }))} /></label>
            </div>
            <div className="multi-select-grid">
              <div>
                <strong>Projeye Sistem Ekle</strong>
                <div className="checkbox-list">
                  {systems.map((item) => (
                    <label key={item.id}><input type="checkbox" checked={projectForm.systemIds.includes(item.id)} onChange={() => setProjectForm((current) => ({ ...current, systemIds: toggleMultiSelectValue(current.systemIds, item.id) }))} />{item.name}</label>
                  ))}
                </div>
              </div>
              <div>
                <strong>Projeye Teklif Bağla</strong>
                <div className="checkbox-list">
                  {assignableLocalOffers.map((item) => (
                    <label key={item.id}><input type="checkbox" checked={projectForm.offerIds.includes(item.id)} onChange={() => setProjectForm((current) => ({ ...current, offerIds: toggleMultiSelectValue(current.offerIds, item.id) }))} />{item.title}</label>
                  ))}
                  {readOnlyOfferIds.map((offerId) => (
                    <label key={offerId} className="checkbox-disabled"><input type="checkbox" checked disabled readOnly />{offerMap.get(offerId)?.title || `API teklif bağlantısı (${offerId})`}</label>
                  ))}
                </div>
              </div>
            </div>
            {projectFormError ? <p className="form-error">{projectFormError}</p> : null}
            <p className="form-hint">Yeni proje kayıtları, backend yazma uçları hazır olana kadar taslak olarak saklanır.</p>
            <button type="submit">{projectForm.id ? 'Projeyi Güncelle' : 'Projeyi Kaydet'}</button>
          </form>
        )}

        <div className="split-layout">
          <div className="panel">
            <div className="panel-header"><h2>Proje Listesi</h2><span className="panel-meta">{filteredProjects.length} kayıt</span></div>
            <div className="panel-content">
              {projectsLoading ? <EmptyState>Projeler yükleniyor…</EmptyState> : filteredProjects.length === 0 ? <EmptyState>Kayıt bulunamadı.</EmptyState> : (
                <div className="entity-list">
                  {filteredProjects.map((item) => (
                    <button key={item.id} type="button" className={`entity-list-card ${selectedProjectId === item.id ? 'selected' : ''}`} onClick={() => setSelectedProjectId(item.id)}>
                      <div>
                        <strong>{item.name}</strong>
                        <span>{item.type} · {customerMap.get(item.customerId)?.company || 'Müşteri yok'}</span>
                      </div>
                      <StatusPill tone={item.source === 'api' ? 'success' : 'info'}>{getSourceLabel(item.source)}</StatusPill>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="panel">
            <div className="panel-header"><h2>Proje Detayı</h2>{selectedProject ? <StatusPill tone={getTone(selectedProject.status)}>{selectedProject.status}</StatusPill> : null}</div>
            <div className="panel-content">
              {!selectedProject ? <EmptyState>Detay için bir proje seçin.</EmptyState> : (
                <div className="detail-stack">
                  <div className="detail-grid">
                    <div><span>Müşteri</span><strong>{customerMap.get(selectedProject.customerId)?.company || 'Atanmadı'}</strong></div>
                    <div><span>Lokasyon</span><strong>{selectedProject.location || 'Belirtilmedi'}</strong></div>
                    <div><span>Sistem Sayısı</span><strong>{relatedSystems.length}</strong></div>
                    <div><span>Teklif Sayısı</span><strong>{relatedOffers.length}</strong></div>
                  </div>
                  <div className="detail-note"><strong>Açıklama</strong><p>{selectedProject.description || 'Açıklama girilmedi.'}</p></div>
                  <div className="linked-block"><strong>Bağlı Sistemler</strong>{relatedSystems.length === 0 ? <EmptyState>Bağlı sistem yok.</EmptyState> : <div className="chip-row">{relatedSystems.map((item) => <span key={item.id} className="detail-chip">{item.name}</span>)}</div>}</div>
                  <div className="linked-block"><strong>Bağlı Teklifler</strong>{relatedOffers.length === 0 ? <EmptyState>Bağlı teklif yok.</EmptyState> : <div className="chip-row">{relatedOffers.map((item) => <span key={item.id} className="detail-chip">{item.title}</span>)}</div>}</div>
                  <div className="detail-actions">
                    {selectedProject.source === 'local' ? (
                      <>
                        <button type="button" onClick={() => startProjectEdit(selectedProject)}>Düzenle</button>
                        <button type="button" className="danger-button" onClick={() => handleDeleteProject(selectedProject.id)}>Sil</button>
                      </>
                    ) : (
                      <button type="button" onClick={() => createLocalProjectCopy(selectedProject)}>Yerel Çalışma Kopyası</button>
                    )}
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
    const relatedProjects = selectedCustomer ? projects.filter((item) => item.customerId === selectedCustomer.id) : [];
    const relatedCustomerOffers = selectedCustomer ? offers.filter((item) => item.customerId === selectedCustomer.id) : [];

    return (
      <div className="module-page">
        {renderToolbar(
          <div className="toolbar-search-grid">
            <input type="search" placeholder="Müşteri ara" value={customerSearch} onChange={(event) => setCustomerSearch(event.target.value)} />
            <StatusPill tone="info">{LOCAL_ONLY_MODULE_NOTE}</StatusPill>
          </div>,
          <button type="button" onClick={() => { setShowCustomerForm((value) => !value); setCustomerForm(emptyCustomerForm()); }}>
            {showCustomerForm ? 'Formu Kapat' : '+ Yeni Müşteri'}
          </button>
        )}

        {showCustomerForm && (
          <form className="data-form" onSubmit={handleSaveCustomer}>
            <input type="text" placeholder="Müşteri adı" value={customerForm.name} onChange={(event) => setCustomerForm((current) => ({ ...current, name: event.target.value }))} />
            <input type="text" placeholder="Firma adı" value={customerForm.company} onChange={(event) => setCustomerForm((current) => ({ ...current, company: event.target.value }))} />
            <input type="email" placeholder="E-posta" value={customerForm.email} onChange={(event) => setCustomerForm((current) => ({ ...current, email: event.target.value }))} />
            <input type="text" placeholder="Telefon" value={customerForm.phone} onChange={(event) => setCustomerForm((current) => ({ ...current, phone: event.target.value }))} />
            <input type="text" placeholder="İlgili kişi" value={customerForm.contactName} onChange={(event) => setCustomerForm((current) => ({ ...current, contactName: event.target.value }))} />
            <textarea placeholder="Notlar" value={customerForm.notes} onChange={(event) => setCustomerForm((current) => ({ ...current, notes: event.target.value }))} />
            {customerFormError ? <p className="form-error">{customerFormError}</p> : null}
            <button type="submit">{customerForm.id ? 'Müşteriyi Güncelle' : 'Müşteriyi Kaydet'}</button>
          </form>
        )}

        <div className="split-layout">
          <div className="panel">
            <div className="panel-header"><h2>Müşteri Listesi</h2><span className="panel-meta">{filteredCustomers.length} kayıt</span></div>
            <div className="panel-content">
              {filteredCustomers.length === 0 ? <EmptyState>Kayıt bulunamadı.</EmptyState> : (
                <div className="entity-list">
                  {filteredCustomers.map((item) => (
                    <button key={item.id} type="button" className={`entity-list-card ${selectedCustomerId === item.id ? 'selected' : ''}`} onClick={() => setSelectedCustomerId(item.id)}>
                      <div>
                        <strong>{item.company}</strong>
                        <span>{item.contactName || item.name} · {item.phone || 'Telefon yok'}</span>
                      </div>
                      <StatusPill tone="info">CRM</StatusPill>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="panel">
            <div className="panel-header"><h2>Müşteri Detayı</h2></div>
            <div className="panel-content">
              {!selectedCustomer ? <EmptyState>Detay için bir müşteri seçin.</EmptyState> : (
                <div className="detail-stack">
                  <div className="detail-grid">
                    <div><span>Firma</span><strong>{selectedCustomer.company}</strong></div>
                    <div><span>İlgili Kişi</span><strong>{selectedCustomer.contactName || selectedCustomer.name}</strong></div>
                    <div><span>E-posta</span><strong>{selectedCustomer.email || 'Belirtilmedi'}</strong></div>
                    <div><span>Telefon</span><strong>{selectedCustomer.phone || 'Belirtilmedi'}</strong></div>
                  </div>
                  <div className="linked-block"><strong>İlişkili Projeler</strong>{relatedProjects.length === 0 ? <EmptyState>Bu müşteriyle ilişkili proje yok.</EmptyState> : <div className="chip-row">{relatedProjects.map((item) => <span className="detail-chip" key={item.id}>{item.name}</span>)}</div>}</div>
                  <div className="linked-block"><strong>İlişkili Teklifler</strong>{relatedCustomerOffers.length === 0 ? <EmptyState>Bu müşteriyle ilişkili teklif yok.</EmptyState> : <div className="chip-row">{relatedCustomerOffers.map((item) => <span className="detail-chip" key={item.id}>{item.title}</span>)}</div>}</div>
                  <div className="detail-note"><strong>Notlar</strong><p>{selectedCustomer.notes || 'Not girilmedi.'}</p></div>
                  <div className="detail-actions">
                    <button type="button" onClick={() => startCustomerEdit(selectedCustomer)}>Düzenle</button>
                    <button type="button" className="danger-button" onClick={() => handleDeleteCustomer(selectedCustomer.id)}>Sil</button>
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
      {renderToolbar(
        <StatusPill live tone={researchError ? 'warning' : 'info'}>{researchError ? 'API hatası, yerel kayıtlar gösteriliyor' : 'Araştırma kayıtları senkronize ediliyor'}</StatusPill>,
        <button type="button" onClick={() => { setShowResearchForm((value) => !value); setResearchForm(emptyResearchForm()); }}>
          {showResearchForm ? 'Formu Kapat' : '+ Yeni Araştırma'}
        </button>
      )}

      {showResearchForm && (
        <form className="data-form" onSubmit={handleSaveResearch}>
          <input type="text" placeholder="Araştırma başlığı" value={researchForm.name} onChange={(event) => setResearchForm((current) => ({ ...current, name: event.target.value }))} />
          <textarea placeholder="Araştırma notu" value={researchForm.note} onChange={(event) => setResearchForm((current) => ({ ...current, note: event.target.value }))} />
          {researchFormError ? <p className="form-error">{researchFormError}</p> : null}
          <button type="submit">{researchForm.id ? 'Araştırmayı Güncelle' : 'Araştırmayı Kaydet'}</button>
        </form>
      )}

      <div className="panel">
        <div className="panel-header"><h2>Araştırma Listesi</h2><span className="panel-meta">{researchItems.length} kayıt</span></div>
        <div className="panel-content">
          {researchLoading ? <EmptyState>Araştırmalar yükleniyor…</EmptyState> : researchItems.length === 0 ? <EmptyState>Araştırma kaydı bulunmuyor.</EmptyState> : (
            <div className="data-list">
              {researchItems.map((item) => (
                <div className="data-card" key={item.id}>
                  <div>
                    <h3>{item.name}</h3>
                    <p>{item.note}</p>
                    <small>{formatDisplayDate(item.updatedAt)}</small>
                  </div>
                  {item.source === 'local' ? (
                    <div className="card-action-stack">
                      <button type="button" onClick={() => startResearchEdit(item)}>Düzenle</button>
                      <button type="button" className="danger-button" onClick={() => handleDeleteResearch(item.id)}>Sil</button>
                    </div>
                  ) : (
                    <StatusPill tone="success">Canlı API</StatusPill>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderAI = () => (
    <div className="module-page ai-module">
      <div className="panel">
        <div className="panel-header"><h2>DDPro AI Çalışma Alanı</h2></div>
        <div className="panel-content">
          <div className="ai-chat">
            {aiMessages.map((message) => (
              <div key={message.id} className={`ai-message ${message.role}`}>
                <strong>{message.role === 'assistant' ? 'DDPro AI' : 'Sen'}</strong>
                <p>{message.text}</p>
                <small>{message.date}</small>
              </div>
            ))}
          </div>
          <form className="ai-form" onSubmit={sendAiMessage}>
            <textarea placeholder="DDPro AI için çalışma notu yaz…" value={aiInput} onChange={(event) => setAiInput(event.target.value)} />
            <button type="submit">Gönder</button>
          </form>
        </div>
      </div>
    </div>
  );

  const renderModule = () => {
    switch (activeModule) {
      case 'products':
        return renderProducts();
      case 'systems':
        return renderSystems();
      case 'price-analysis':
        return renderPriceAnalyses();
      case 'material-analysis':
        return renderMaterialAnalyses();
      case 'offers':
        return renderOffers();
      case 'projects':
        return renderProjects();
      case 'crm':
        return renderCRM();
      case 'research':
        return renderResearch();
      case 'ai':
        return renderAI();
      case 'dashboard':
      default:
        return renderDashboard();
    }
  };

  const currentModule = modules.find((module) => module.id === activeModule) || modules[0];

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
          Çekirdek iş akışları aktif
        </div>
      </header>

      <div className="app-layout">
        <aside className="sidebar">
          <div className="sidebar-title">ANA MODÜLLER</div>
          <nav className="module-nav">
            {modules.map((module) => (
              <button key={module.id} type="button" className={`module-button ${activeModule === module.id ? 'active' : ''}`} onClick={() => setActiveModule(module.id)}>
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
              DDPro Core Workflow v2
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
