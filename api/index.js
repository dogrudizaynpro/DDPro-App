// ============================================================
// DDPRO API
// DOĞRU DİZAYN PRO
// Ana API / CRUD katmanı
// ============================================================

const resources = {
  users: {
    table: "users",
    route: "/api/users"
  },

  customers: {
    table: "customers",
    route: "/api/customers"
  },

  projects: {
    table: "projects",
    route: "/api/projects"
  },

  projectUsers: {
    table: "project_users",
    route: "/api/project-users"
  },

  suppliers: {
    table: "suppliers",
    route: "/api/suppliers"
  },

  materials: {
    table: "materials",
    route: "/api/materials"
  },

  supplierMaterials: {
    table: "supplier_materials",
    route: "/api/supplier-materials"
  },

  quotes: {
    table: "quotes",
    route: "/api/quotes"
  },

  quoteItems: {
    table: "quote_items",
    route: "/api/quote-items"
  },

  projectCosts: {
    table: "project_costs",
    route: "/api/project-costs"
  },

  documents: {
    table: "documents",
    route: "/api/documents"
  },

  activities: {
    table: "activities",
    route: "/api/activities"
  },

  aiConversations: {
    table: "ai_conversations",
    route: "/api/ai-conversations"
  },

  aiMessages: {
    table: "ai_messages",
    route: "/api/ai-messages"
  },

  integrations: {
    table: "integrations",
    route: "/api/integrations"
  }
};


// ============================================================
// API DURUMU
// ============================================================

const apiInfo = {
  name: "DDPro API",
  version: "1.0.0",
  status: "ready",
  database: "PostgreSQL",
  architecture: "REST",
  resources
};


// ============================================================
// CRUD İŞLEM TANIMLARI
// ============================================================

const operations = {
  list: "GET",
  get: "GET",
  create: "POST",
  update: "PUT",
  delete: "DELETE"
};


// ============================================================
// ROUTE OLUŞTURUCU
// ============================================================

function createRoutes() {
  const routes = {};

  Object.keys(resources).forEach((name) => {
    const resource = resources[name];

    routes[name] = {
      table: resource.table,
      route: resource.route,

      list: {
        method: operations.list,
        path: resource.route
      },

      get: {
        method: operations.get,
        path: `${resource.route}/:id`
      },

      create: {
        method: operations.create,
        path: resource.route
      },

      update: {
        method: operations.update,
        path: `${resource.route}/:id`
      },

      delete: {
        method: operations.delete,
        path: `${resource.route}/:id`
      }
    };
  });

  return routes;
}


// ============================================================
// CRUD SERVİS ARAYÜZÜ
// ============================================================

function createCrudService(repository) {
  if (!repository) {
    throw new Error("Repository gerekli.");
  }

  return {
    list: (table, filters = {}) =>
      repository.list(table, filters),

    get: (table, id) =>
      repository.get(table, id),

    create: (table, data) =>
      repository.create(table, data),

    update: (table, id, data) =>
      repository.update(table, id, data),

    delete: (table, id) =>
      repository.delete(table, id)
  };
}


// ============================================================
// API SAĞLIK KONTROLÜ
// ============================================================

function healthCheck() {
  return {
    success: true,
    service: "DDPro API",
    status: "ready",
    database: "PostgreSQL",
    timestamp: new Date().toISOString()
  };
}


// ============================================================
// API BİLGİSİ
// ============================================================

function getApiInfo() {
  return {
    ...apiInfo,
    routes: createRoutes()
  };
}


// ============================================================
// EXPORT
// ============================================================

module.exports = {
  resources,
  operations,
  createRoutes,
  createCrudService,
  healthCheck,
  getApiInfo
};
