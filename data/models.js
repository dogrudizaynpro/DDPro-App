// DDPro — Veri Modeli
// Tüm sistem modüllerinin ortak veri yapısı

export const User = {
  id: "",
  name: "",
  email: "",
  role: "",
  permissions: [],
  status: "active",
  createdAt: null,
  updatedAt: null
};

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
  createdAt: null,
  updatedAt: null
};

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

export const Supplier = {
  id: "",
  name: "",
  company: "",
  email: "",
  phone: "",
  website: "",
  country: "",
  categories: [],
  productIds: [],
  notes: "",
  createdAt: null,
  updatedAt: null
};

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

export const Procurement = {
  id: "",
  projectId: "",
  productId: "",
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
  updatedAt: null
};

// Ortak sistem veri yapısı
export const DDProDataModel = {
  users: [],
  customers: [],
  projects: [],
  quotations: [],
  suppliers: [],
  products: [],
  procurements: [],
  documents: [],
  activities: [],
  aiRequests: []
};

// Modüller arası ilişkiler
export const relations = {
  customerToProjects: "Customer.id -> Project.customerId",
  projectToQuotations: "Project.id -> Quotation.projectId",
  projectToProcurements: "Project.id -> Procurement.projectId",
  supplierToProducts: "Supplier.id -> Product.supplierId",
  productToProcurements: "Product.id -> Procurement.productId",
  supplierToProcurements: "Supplier.id -> Procurement.supplierId",
  projectToDocuments: "Project.id -> Document.projectId",
  projectToActivities: "Project.id -> Activity.projectId",
  projectToAI: "Project.id -> AIRequest.projectId",
  userToActivities: "User.id -> Activity.userId",
  userToDocuments: "User.id -> Document.uploadedBy"
};
