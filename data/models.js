// ============================================================
// DDPRO — VERİ MODELİ
// DOĞRU DİZAYN PRO
// Ana sistem veri modelleri
// ============================================================

// ------------------------------------------------------------
// 1. USER
// ------------------------------------------------------------

export const User = {
  id: "",
  name: "",
  email: "",
  role: "user",
  permissions: [],
  status: "active",
  createdAt: null,
  updatedAt: null
};

// ------------------------------------------------------------
// 2. CUSTOMER
// ------------------------------------------------------------

export const Customer = {
  id: "",
  name: "",
  company: "",
  email: "",
  phone: "",
  address: "",
  notes: "",
  projectIds: [],
  createdAt: null,
  updatedAt: null
};

// ------------------------------------------------------------
// 3. PROJECT
// ------------------------------------------------------------

export const Project = {
  id: "",
  customerId: "",
  name: "",
  description: "",
  status: "draft",
  category: "",
  location: "",
  startDate: null,
  endDate: null,
  budget: 0,
  currency: "EUR",
  teamIds: [],
  quotationIds: [],
  procurementIds: [],
  documentIds: [],
  activityIds: [],
  costIds: [],
  aiRequestIds: [],
  createdBy: "",
  createdAt: null,
  updatedAt: null
};

// ------------------------------------------------------------
// 4. PROJECT USER
// ------------------------------------------------------------

export const ProjectUser = {
  projectId: "",
  userId: "",
  role: "member"
};

// ------------------------------------------------------------
// 5. SUPPLIER
// ------------------------------------------------------------

export const Supplier = {
  id: "",
  name: "",
  company: "",
  email: "",
  phone: "",
  address: "",
  website: "",
  country: "",
  categories: [],
  productIds: [],
  procurementIds: [],
  notes: "",
  createdAt: null,
  updatedAt: null
};

// ------------------------------------------------------------
// 6. MATERIAL
// ------------------------------------------------------------

export const Material = {
  id: "",
  name: "",
  category: "",
  description: "",
  unit: "",
  specifications: {},
  documentIds: [],
  createdAt: null,
  updatedAt: null
};

// ------------------------------------------------------------
// 7. SUPPLIER MATERIAL
// ------------------------------------------------------------

export const SupplierMaterial = {
  supplierId: "",
  materialId: "",
  supplierCode: "",
  unitPrice: 0,
  currency: "EUR",
  minimumOrder: 0,
  availability: "",
  leadTimeDays: 0,
  notes: ""
};

// ------------------------------------------------------------
// 8. PRODUCT
// ------------------------------------------------------------

export const Product = {
  id: "",
  supplierId: "",
  name: "",
  category: "",
  description: "",
  unit: "",
  unitPrice: 0,
  currency: "EUR",
  minimumOrder: 0,
  availability: "",
  specifications: {},
  documentIds: [],
  createdAt: null,
  updatedAt: null
};

// ------------------------------------------------------------
// 9. QUOTE / TEKLİF
// ------------------------------------------------------------

export const Quote = {
  id: "",
  projectId: "",
  supplierId: "",
  quoteNumber: "",
  status: "draft",
  totalAmount: 0,
  currency: "EUR",
  validUntil: null,
  notes: "",
  itemIds: [],
  documentIds: [],
  createdAt: null,
  updatedAt: null
};

// ------------------------------------------------------------
// 10. QUOTE ITEM
// ------------------------------------------------------------

export const QuoteItem = {
  id: "",
  quoteId: "",
  materialId: "",
  productId: "",
  description: "",
  quantity: 0,
  unit: "",
  unitPrice: 0,
  discount: 0,
  taxRate: 0,
  total: 0,
  currency: "EUR",
  createdAt: null,
  updatedAt: null
};

// ------------------------------------------------------------
// 11. QUOTATION
// Uygulama tarafındaki teklif görünümü
// ------------------------------------------------------------

export const Quotation = {
  id: "",
  projectId: "",
  customerId: "",
  title: "",
  status: "draft",
  items: [],
  subtotal: 0,
  tax: 0,
  total: 0,
  currency: "EUR",
  validUntil: null,
  documentIds: [],
  createdAt: null,
  updatedAt: null
};

// ------------------------------------------------------------
// 12. PROCUREMENT / TEDARİK
// ------------------------------------------------------------

export const Procurement = {
  id: "",
  projectId: "",
  productId: "",
  materialId: "",
  supplierId: "",
  quantity: 0,
  unit: "",
  targetPrice: 0,
  offeredPrice: 0,
  currency: "EUR",
  status: "research",
  notes: "",
  createdAt: null,
  updatedAt: null
};

// ------------------------------------------------------------
// 13. PROJECT COST
// ------------------------------------------------------------

export const ProjectCost = {
  id: "",
  projectId: "",
  category: "",
  description: "",
  quantity: 0,
  unit: "",
  unitPrice: 0,
  amount: 0,
  currency: "EUR",
  source: "",
  status: "estimated",
  createdAt: null,
  updatedAt: null
};

// ------------------------------------------------------------
// 14. DOCUMENT
// ------------------------------------------------------------

export const Document = {
  id: "",
  projectId: "",
  customerId: "",
  type: "",
  name: "",
  fileName: "",
  fileUrl: "",
  mimeType: "",
  size: 0,
  version: 1,
  uploadedBy: "",
  createdAt: null,
  updatedAt: null
};

// ------------------------------------------------------------
// 15. ACTIVITY
// ------------------------------------------------------------

export const Activity = {
  id: "",
  projectId: "",
  userId: "",
  type: "",
  title: "",
  description: "",
  metadata: {},
  createdAt: null
};

// ------------------------------------------------------------
// 16. AI CONVERSATION
// ------------------------------------------------------------

export const AIConversation = {
  id: "",
  userId: "",
  projectId: "",
  title: "",
  status: "active",
  metadata: {},
  messageIds: [],
  createdAt: null,
  updatedAt: null
};

// ------------------------------------------------------------
// 17. AI MESSAGE
// ------------------------------------------------------------

export const AIMessage = {
  id: "",
  conversationId: "",
  role: "user",
  content: "",
  metadata: {},
  createdAt: null
};

// ------------------------------------------------------------
// 18. AI REQUEST
// ------------------------------------------------------------

export const AIRequest = {
  id: "",
  userId: "",
  projectId: "",
  type: "",
  prompt: "",
  response: "",
  status: "pending",
  metadata: {},
  createdAt: null,
  updated
