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
  getCalendarEventById,
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
  read: controller.read || controller.list,
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
    readOne: getCalendarEventById,
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
  if (filters.id !== undefined && (
    typeof filters.id !== "string" ||
    (resource === "calendar"
      ? !/^[A-Za-z0-9_-]{5,1024}$/.test(filters.id)
      : !UUID_PATTERN.test(filters.id))
  )) {
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
  if (resource !== "price-analysis") {
    const selected = filters.id ? records[0] || null : records.slice(0, 50);
    return selected;
  }
  const verified = records.filter((record) =>
    record.verification_status === "VERIFIED" &&
    Number.isFinite(Number(record.unit_price)) &&
    Number(record.unit_price) > 0 &&
    typeof record.unit === "string" &&
    /^[A-Z]{3}$/.test(record.currency) &&
    record.source &&
    record.verified_at
  );
  return filters.id ? verified[0] || null : verified.slice(0, 50);
};

const readWriteTarget = async (integrationAccount, resource, id) => {
  if (resource !== "price-analysis") {
    return readOperationalRecords(integrationAccount, { resource, filters: { id } });
  }
  const records = await invokeController(
    CONTROLLERS[resource].read,
    integrationAccount
  );
  return (records || []).find((record) => record.id === id) || null;
};

const getRecordLabel = (record, resource) =>
  [record?.name, record?.title, record?.summary].find(
    (value) => typeof value === "string" && value.trim()
  ) || RESOURCE_LABELS[resource];

const sortJson = (value) => {
  if (Array.isArray(value)) return value.map(sortJson);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value).sort().map((key) => [key, sortJson(value[key])])
  );
};

export const isRecordSnapshotCurrent = (currentRecord, expectedSnapshot) =>
  Boolean(currentRecord) &&
  JSON.stringify(sortJson(currentRecord)) === JSON.stringify(sortJson(expectedSnapshot));

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
  if (operation !== "create" && (
    typeof id !== "string" ||
    (resource === "calendar"
      ? !/^[A-Za-z0-9_-]{5,1024}$/.test(id)
      : !UUID_PATTERN.test(id))
  )) {
    throw Object.assign(new Error("The requested record ID is invalid."), {
      statusCode: 400,
      expose: true,
    });
  }

  const currentRecord = operation === "create"
    ? null
    : await readWriteTarget(integrationAccount, resource, id);
  if (operation !== "create" && !currentRecord) {
    throw Object.assign(new Error("The AI action target could not be found."), {
      statusCode: 404,
      expose: true,
    });
  }

  const admin = getAdmin();
  const confirmationId = randomUUID();
  const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString();
  const { error: cleanupError } = await admin
    .from("ai_tool_confirmations")
    .delete()
    .lt("expires_at", new Date().toISOString());
  if (cleanupError) throw cleanupError;
  const { error } = await admin.from("ai_tool_confirmations").insert({
    id: confirmationId,
    owner_account: integrationAccount,
    resource,
    operation,
    record_id: id || null,
    record_payload: operation === "delete" ? {} : record,
    record_snapshot: currentRecord,
    expires_at: expiresAt,
  });
  if (error) throw error;

  const actionName = { create: "oluştur", update: "güncelle", delete: "sil" }[operation];
  const labelRecord = operation === "delete" ? currentRecord : record;
  return {
    id: confirmationId,
    resource,
    operation,
    summary: `${getRecordLabel(labelRecord, resource)} ${actionName} işlemini onaylıyor musunuz?`,
    preview: {
      current: currentRecord,
      proposed: operation === "delete" ? null : record,
      targetId: id || null,
    },
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
  const action = await consumeOperationalConfirmation(
    admin,
    integrationAccount,
    confirmationId,
    now
  );
  if (!action) {
    throw Object.assign(new Error("The AI action confirmation is invalid, expired, or already used."), {
      statusCode: 404,
      expose: true,
    });
  }

  if (action.operation !== "create") {
    const currentRecord = await readWriteTarget(
      integrationAccount,
      action.resource,
      action.record_id
    );
    if (!isRecordSnapshotCurrent(currentRecord, action.record_snapshot)) {
      throw Object.assign(new Error("The target record changed after review. Prepare the action again."), {
        statusCode: 409,
        expose: true,
      });
    }
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

export const consumeOperationalConfirmation = async (
  admin,
  integrationAccount,
  confirmationId,
  now = new Date().toISOString()
) => {
  const { data, error } = await admin
    .from("ai_tool_confirmations")
    .update({ confirmed_at: now })
    .eq("id", confirmationId)
    .eq("owner_account", integrationAccount)
    .is("confirmed_at", null)
    .gt("expires_at", now)
    .select("resource, operation, record_id, record_payload, record_snapshot")
    .maybeSingle();
  if (error) throw error;
  return data;
};
