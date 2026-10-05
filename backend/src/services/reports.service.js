import { getIntegrationAdmin } from "../config/integration-admin.js";

const REPORT_TYPES = new Set(["PROJECT", "DAILY_SITE", "OFFER", "COST", "PROCUREMENT"]);
const PROJECT_REQUIRED_TYPES = new Set(["PROJECT", "DAILY_SITE"]);
const UUID_PATTERN = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;

const inputError = (message) => Object.assign(new Error(message), {
  statusCode: 400,
  expose: true,
});

export const normalizeReportRequest = (body = {}) => {
  const type = typeof body.type === "string" ? body.type : "";
  if (!REPORT_TYPES.has(type)) throw inputError("Report type is invalid.");
  const projectId = body.projectId ?? body.project_id ?? null;
  if (PROJECT_REQUIRED_TYPES.has(type) && !projectId) {
    throw inputError("A project is required for this report type.");
  }
  if (projectId && (typeof projectId !== "string" || !UUID_PATTERN.test(projectId))) {
    throw inputError("Project reference must be a valid UUID.");
  }
  const title = typeof body.title === "string" && body.title.trim()
    ? body.title.trim()
    : ({
      PROJECT: "Proje raporu",
      DAILY_SITE: "Günlük saha raporu",
      OFFER: "Teklif raporu",
      COST: "Malzeme maliyet raporu",
      PROCUREMENT: "Tedarik raporu",
    })[type];
  if (title.length > 200) throw inputError("Report title must be at most 200 characters.");

  let reportDate = null;
  let siteReport = null;
  if (type === "DAILY_SITE") {
    reportDate = typeof body.reportDate === "string" ? body.reportDate.trim() : "";
    const date = new Date(`${reportDate}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(reportDate) ||
        Number.isNaN(date.getTime()) ||
        date.toISOString().slice(0, 10) !== reportDate) {
      throw inputError("Daily site report date must be a valid YYYY-MM-DD date.");
    }
    const summary = typeof body.summary === "string" ? body.summary.trim() : "";
    if (!summary || summary.length > 10_000) {
      throw inputError("Daily site report summary is required and must be at most 10000 characters.");
    }
    siteReport = {
      summary,
      workCompleted: typeof body.workCompleted === "string" ? body.workCompleted.trim().slice(0, 10_000) : "",
      issues: typeof body.issues === "string" ? body.issues.trim().slice(0, 10_000) : "",
      nextSteps: typeof body.nextSteps === "string" ? body.nextSteps.trim().slice(0, 10_000) : "",
    };
  }
  return { type, title, projectId, reportDate, siteReport };
};

const getRows = async (client, table, projectId, idColumn = "project_id") => {
  let query = client.from(table).select("*", { count: "exact" }).limit(250);
  if (projectId) query = query.eq(idColumn, projectId);
  const { data, error, count } = await query;
  if (error) throw error;
  const rows = data || [];
  return { records: rows, truncated: Number.isInteger(count) && count > rows.length };
};

export const calculateVerifiedMaterialTotals = (records = []) => {
  const verifiedRows = records.filter((record) => record.verification_status === "VERIFIED");
  return {
    total: verifiedRows.reduce((total, record) => total + Number(record.total_cost || 0), 0),
    unverifiedCount: records.filter((record) => record.verification_status === "UNVERIFIED").length,
    missingCount: records.filter((record) => record.verification_status === "MISSING").length,
  };
};

const loadProject = async (client, projectId) => {
  if (!projectId) return null;
  const { data, error } = await client
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw Object.assign(new Error("Project not found."), { statusCode: 404, expose: true });
  return data;
};

const createSnapshot = async (client, normalized) => {
  const project = await loadProject(client, normalized.projectId);
  const sources = {};
  const truncatedSources = [];
  const tablesByType = {
    PROJECT: ["offers", "crm_contacts", "research_items", "material_analysis"],
    OFFER: ["offers"],
    COST: ["material_analysis"],
    PROCUREMENT: ["research_items"],
  };
  await Promise.all((tablesByType[normalized.type] || []).map(async (table) => {
    const result = await getRows(client, table, normalized.projectId);
    sources[table] = result.records;
    if (result.truncated) truncatedSources.push(table);
  }));
  if (normalized.type === "COST") {
    const totals = calculateVerifiedMaterialTotals(sources.material_analysis || []);
    sources.verifiedMaterialCostTotal = totals.total;
    sources.unverifiedMaterialCount = totals.unverifiedCount;
    sources.missingMaterialCount = totals.missingCount;
    sources.calculationBasis = "Verified material records only; labor, VAT, and transport excluded.";
  }
  return {
    generatedAt: new Date().toISOString(),
    reportType: normalized.type,
    project,
    sources,
    truncatedSources,
    ...(normalized.siteReport ? { siteReport: normalized.siteReport } : {}),
    ...(normalized.reportDate ? { reportDate: normalized.reportDate } : {}),
  };
};

const requireDatabase = () => {
  const client = getIntegrationAdmin();
  if (!client) {
    throw Object.assign(new Error("Reports database service-role configuration is required."), {
      statusCode: 503,
      expose: true,
    });
  }
  return client;
};

export const listReports = async (ownerAccount) => {
  const client = requireDatabase();
  const { data, error } = await client
    .from("report_records")
    .select("*")
    .eq("owner_account", ownerAccount)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return data || [];
};

export const createReport = async (ownerAccount, body) => {
  const client = requireDatabase();
  const normalized = normalizeReportRequest(body);
  const snapshot = await createSnapshot(client, normalized);
  const { data, error } = await client
    .from("report_records")
    .insert({
      owner_account: ownerAccount,
      report_type: normalized.type,
      title: normalized.title,
      project_id: normalized.projectId,
      report_date: normalized.reportDate,
      snapshot,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
};

export const deleteReport = async (ownerAccount, id) => {
  if (!UUID_PATTERN.test(id || "")) throw inputError("Report id must be a valid UUID.");
  const client = requireDatabase();
  const { data, error } = await client
    .from("report_records")
    .delete()
    .eq("id", id)
    .eq("owner_account", ownerAccount)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
};
