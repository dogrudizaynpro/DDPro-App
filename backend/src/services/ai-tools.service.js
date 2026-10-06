import { randomUUID } from "node:crypto";
import { getIntegrationAdmin } from "../config/integration-admin.js";
import {
  createProject,
  deleteProject,
  getProjectById,
  getProjects,
  updateProject,
} from "../controllers/projects.controller.js";
import {
  getCrmContacts,
  patchCrmContact,
  postCrmContact,
  removeCrmContact,
} from "../controllers/crm.controller.js";
import { createCatalogController } from "../controllers/catalog.controller.js";
import {
  createResearchItem,
  deleteResearchItem,
  getResearchItemById,
  getResearchItems,
  updateResearchItem,
} from "../controllers/research.controller.js";
import {
  createOffer,
  deleteOffer,
  getOfferById,
  getOffers,
  updateOffer,
} from "../controllers/offers.controller.js";
import {
  getCalendarEvents,
  postCalendarEvent,
  patchCalendarEvent,
  deleteCalendarEvent,
} from "../controllers/integration-workspace.controller.js";
import { getReports, postReport, removeReport } from "../controllers/reports.controller.js";

const UUID_PATTERN =
  /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
const RESOURCE_LABELS = {
  projects: "proje",
  customers: "müşteri kaydı",
  products: "ürün",
  systems: "sistem",
  "price-analysis": "fiyat analizi kaydı",
  "material-analysis": "malzeme analizi kaydı",
  offers: "teklif",
  procurement: "tedarik kaydı",
  reports: "rapor",
  calendar: "takvim etkinliği",
};

const catalogControllers = {
  products: createCatalogController("products"),
  systems: createCatalogController("systems"),
  "price-analysis": createCatalogController("price-analysis"),
  "material-analysis": createCatalogController("material-analysis"),
};
const asResourceController = (controller) => ({
  ...controller,
  delete: controller.delete || controller.remove,
});

const CONTROLLERS = {
  projects: {
    read: getProjects,
    readOne: getProjectById,
    create: createProject,
    update: updateProject,
    delete: deleteProject,
  },
  customers: {
    read: getCrmContacts,
    create: postCrmContact,
    update: patchCrmContact,
    delete: removeCrmContact,
  },
  products: asResourceController(catalogControllers.products),
  systems: asResourceController(catalogControllers.systems),
  "price-analysis": asResourceController(catalogControllers["price-analysis"]),
  "material-analysis": asResourceController(catalogControllers["material-analysis"]),
  procurement: {
    read: getResearchItems,
    readOne: getResearchItemById,
    create: createResearchItem,
    update: updateResearchItem,
    delete: deleteResearchItem,
  },
  offers: {
    read: getOffers,
    readOne: getOfferById,
    create: createOffer,
    update: updateOffer,
    delete: deleteOffer,
  },
  reports: {
    read: getReports,
    create: postReport,
    delete: removeReport,
  },
  calendar: {
    read: getCalendarEvents,
    create: postCalendarEvent,
    update: patchCalendarEvent,
    delete: deleteCalendarEvent,
  },
};

const getAdmin = () => {
  const admin = getIntegrationAdmin();
  if (!admin) {
    throw Object.assign(new Error("AI operational tools require configured database access."), {
      statusCode: 503,
      expose: true,
    });
  }
  return admin;
};

const invokeController = async (controller, integrationAccount, { id, record, filters } = {}) =>
  new Promise((resolve, reject) => {
    let statusCode = 200;
    const response = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(body) {
        if (statusCode >= 400) {
          return reject(Object.assign(new Error(body?.message || "AI tool request failed."), {
            statusCode,
            expose: true,
          }));
        }
        return resolve(body?.data);
      },
    };
    const request = {
      body: record || {},
      integrationAccount,
      params: id ? { id } : {},
      query: filters || {},
    };
    Promise.resolve(controller(request, response, reject)).catch(reject);
  });

const assertResource = (resource) => {
  if (!Object.hasOwn(CONTROLLERS, resource)) {
    throw Object.assign(new Error("This AI data tool is not available."), {
      statusCode: 400,
      expose: true,
    });
  }
};

export const readOperationalRecords = async (integrationAccount, { resource, filters = {} }) => {
  assertResource(resource);
  if (!filters || typeof filters !== "object" || Array.isArray(filters)) {
    throw Object.assign(new Error("AI tool filters must be an object."), {
      statusCode: 400,
      expose: true,
    });
  }
  const controller = CONTROLLERS[resource];
  if (filters.id !== undefined && (typeof filters.id !== "string" || !UUID_PATTERN.test(filters.id))) {
    throw Object.assign(new Error("The requested record ID is invalid."), {
      statusCode: 400,
      expose: true,
    });
  }
  const data = await invokeController(
    filters.id ? controller.readOne || controller.read : controller.read,
    integrationAccount,
    { id: filters.id, filters }
  );
  let records = Array.isArray(data) ? data : data ? [data] : [];
  if (filters.id && !controller.readOne) {
    records = records.filter((record) => record.id === filters.id);
  }
  if (resource !== "price-analysis") return filters.id ? records[0] || null : records;
  return records.filter((record) =>
    record.verification_status === "VERIFIED" &&
    record.unit_price !== null &&
    record.unit_price !== undefined &&
    record.source &&
    record.verified_at
  );
};

const getRecordLabel = (record, resource) =>
  [record?.name, record?.title, record?.summary].find(
    (value) => typeof value === "string" && value.trim()
  ) || RESOURCE_LABELS[resource];

export const prepareOperationalWrite = async (
  integrationAccount,
  { resource, operation, id, record = {} }
) => {
  assertResource(resource);
  if (!["create", "update", "delete"].includes(operation)) {
    throw Object.assign(new Error("The requested AI write operation is invalid."), {
      statusCode: 400,
      expose: true,
    });
  }
  const controller = CONTROLLERS[resource];
  if (typeof controller[operation] !== "function") {
    throw Object.assign(new Error("This write operation is not available for the selected data."), {
      statusCode: 400,
      expose: true,
    });
  }
  if (!record || typeof record !== "object" || Array.isArray(record) ||
      Buffer.byteLength(JSON.stringify(record)) > 12_000) {
    throw Object.assign(new Error("The proposed record is invalid or too large."), {
      statusCode: 400,
      expose: true,
    });
  }
  if (operation === "create" && id !== undefined) {
    throw Object.assign(new Error("New records cannot specify an ID."), {
      statusCode: 400,
      expose: true,
    });
  }
  if (operation !== "create" && (typeof id !== "string" || !UUID_PATTERN.test(id))) {
    throw Object.assign(new Error("The requested record ID is invalid."), {
      statusCode: 400,
      expose: true,
    });
  }

  const admin = getAdmin();
  const confirmationId = randomUUID();
  const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString();
  const { error } = await admin.from("ai_tool_confirmations").insert({
    id: confirmationId,
    owner_account: integrationAccount,
    resource,
    operation,
    record_id: id || null,
    record_payload: operation === "delete" ? {} : record,
    expires_at: expiresAt,
  });
  if (error) throw error;

  const actionName = { create: "oluştur", update: "güncelle", delete: "sil" }[operation];
  return {
    id: confirmationId,
    resource,
    operation,
    summary: `${getRecordLabel(record, resource)} ${actionName} işlemini onaylıyor musunuz?`,
    expiresAt,
  };
};

export const confirmOperationalWrite = async (integrationAccount, confirmationId) => {
  if (typeof confirmationId !== "string" || !UUID_PATTERN.test(confirmationId)) {
    throw Object.assign(new Error("The AI action confirmation is invalid or expired."), {
      statusCode: 404,
      expose: true,
    });
  }
  const admin = getAdmin();
  const now = new Date().toISOString();
  const { data: action, error } = await admin
    .from("ai_tool_confirmations")
    .update({ confirmed_at: now })
    .eq("id", confirmationId)
    .eq("owner_account", integrationAccount)
    .is("confirmed_at", null)
    .gt("expires_at", now)
    .select("resource, operation, record_id, record_payload")
    .maybeSingle();
  if (error) throw error;
  if (!action) {
    throw Object.assign(new Error("The AI action confirmation is invalid, expired, or already used."), {
      statusCode: 404,
      expose: true,
    });
  }

  const controller = CONTROLLERS[action.resource];
  if (!controller || typeof controller[action.operation] !== "function") {
    throw Object.assign(new Error("The confirmed AI action is no longer available."), {
      statusCode: 409,
      expose: true,
    });
  }
  return invokeController(controller[action.operation], integrationAccount, {
    id: action.record_id || undefined,
    record: action.record_payload || {},
  });
};
