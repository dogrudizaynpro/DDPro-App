// DDPro API
// Veri modeli ile uygulama arasındaki API katmanı

const routes = {
  users: "/api/users",
  customers: "/api/customers",
  projects: "/api/projects",
  suppliers: "/api/suppliers",
  materials: "/api/materials",
  quotes: "/api/quotes",
  documents: "/api/documents",
  activities: "/api/activities"
};

function apiInfo() {
  return {
    name: "DDPro API",
    version: "1.0.0",
    status: "ready",
    routes
  };
}

module.exports = {
  routes,
  apiInfo
};
