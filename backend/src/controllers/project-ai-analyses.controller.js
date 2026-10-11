import { randomUUID } from "node:crypto";
import { getIntegrationAdmin } from "../config/integration-admin.js";
import { requestAiCompletion } from "../services/ai.service.js";

const UUID_PATTERN = /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i;
const ANALYSIS_TABLE = "project_ai_analyses";
const PROCESSING_LEASE_MS = 5 * 60_000;

const requestError = (message, statusCode, code) =>
  Object.assign(new Error(message), { statusCode, code, expose: true });

const parseProjectId = (value) =>
  typeof value === "string" && UUID_PATTERN.test(value) ? value : null;

const getProjectContext = (project = {}) => ({
  id: project.id,
  name: project.name,
  type: project.project_type,
  status: project.status,
  customer: project.customer,
  company: project.company,
  location: project.location,
  product: project.product,
  areaM2: project.area_m2,
  systems: project.systems,
  startDate: project.start_date,
  endDate: project.end_date,
  notes: project.notes,
});

const getAnalysisRecord = async (supabase, ownerAccount, requestId) => {
  const { data, error } = await supabase
    .from(ANALYSIS_TABLE)
    .select("*")
    .eq("owner_account", ownerAccount)
    .eq("request_id", requestId)
    .maybeSingle();
  if (error) throw error;
  return data;
};

const claimAnalysis = async (supabase, { ownerAccount, projectId, requestId, command }) => {
  const leaseToken = randomUUID();
  const { data: inserted, error: insertError } = await supabase
    .from(ANALYSIS_TABLE)
    .insert({
      owner_account: ownerAccount,
      project_id: projectId,
      request_id: requestId,
      command,
      status: "processing",
      lease_token: leaseToken,
    })
    .select("*")
    .maybeSingle();

  if (!insertError) return { record: inserted, leaseToken };
  if (insertError.code !== "23505") throw insertError;

  const existing = await getAnalysisRecord(supabase, ownerAccount, requestId);
  if (!existing) throw insertError;
  if (existing.project_id !== projectId || existing.command !== command) {
    throw requestError("The project analysis request ID was already used for another command.", 409, "AI_ANALYSIS_IDEMPOTENCY_CONFLICT");
  }
  if (existing.status === "success") return { record: existing, replayed: true };

  const age = Date.now() - Date.parse(existing.updated_at);
  if (existing.status === "processing" && age < PROCESSING_LEASE_MS) {
    throw requestError("This project analysis is already in progress.", 409, "AI_ANALYSIS_IN_PROGRESS");
  }

  let claim = supabase
    .from(ANALYSIS_TABLE)
    .update({
      command,
      status: "processing",
      result: null,
      failure_code: null,
      lease_token: leaseToken,
      updated_at: new Date().toISOString(),
    })
    .eq("id", existing.id)
    .eq("status", existing.status);
  claim = existing.lease_token === null
    ? claim.is("lease_token", null)
    : claim.eq("lease_token", existing.lease_token);
  const { data, error } = await claim.select("*").maybeSingle();
  if (error) throw error;
  if (data) return { record: data, leaseToken };

  const current = await getAnalysisRecord(supabase, ownerAccount, requestId);
  if (current?.status === "success") return { record: current, replayed: true };
  throw requestError("This project analysis is already in progress.", 409, "AI_ANALYSIS_IN_PROGRESS");
};

export const createProjectAiAnalysesController = ({
  getAdmin = getIntegrationAdmin,
  complete = requestAiCompletion,
} = {}) => ({
listProjectAiAnalyses: async (req, res, next) => {
  const projectId = parseProjectId(req.params.projectId);
  if (!projectId) {
    return res.status(400).json({ status: "error", message: "Project ID is invalid." });
  }
  const supabase = getAdmin();
  if (!supabase) {
    return res.status(503).json({ status: "error", message: "Project analysis storage is unavailable." });
  }

  try {
    const { data, error } = await supabase
      .from(ANALYSIS_TABLE)
      .select("id,project_id,request_id,command,status,result,failure_code,created_at,updated_at")
      .eq("owner_account", req.integrationAccount)
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw error;
    return res.status(200).json({ status: "success", data: data || [] });
  } catch (error) {
    return next(error);
  }
},

createProjectAiAnalysis: async (req, res, next) => {
  const projectId = parseProjectId(req.params.projectId);
  const command = typeof req.body?.command === "string" ? req.body.command.trim() : "";
  const requestId = req.body?.requestId;
  if (!projectId || !UUID_PATTERN.test(requestId || "")) {
    return res.status(400).json({ status: "error", message: "Project ID and request ID must be valid UUIDs." });
  }
  if (!command || command.length > 8_000) {
    return res.status(400).json({ status: "error", message: "Project analysis command must be between 1 and 8000 characters." });
  }

  const supabase = getAdmin();
  if (!supabase) {
    return res.status(503).json({ status: "error", message: "Project analysis storage is unavailable." });
  }

  let claim;
  try {
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .maybeSingle();
    if (projectError) throw projectError;
    if (!project) return res.status(404).json({ status: "error", message: "Project not found." });

    claim = await claimAnalysis(supabase, {
      ownerAccount: req.integrationAccount,
      projectId,
      requestId,
      command,
    });
    if (claim.replayed) {
      return res.status(200).json({ status: "success", data: claim.record, replayed: true });
    }

    const completion = await complete({
      message: command,
      context: { selectedProject: getProjectContext(project) },
      integrationAccount: req.integrationAccount,
      readOnly: true,
    });
    const { data: saved, error: saveError } = await supabase
      .from(ANALYSIS_TABLE)
      .update({
        status: "success",
        result: { answer: completion.answer },
        failure_code: null,
        lease_token: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", claim.record.id)
      .eq("lease_token", claim.leaseToken)
      .select("id,project_id,request_id,command,status,result,failure_code,created_at,updated_at")
      .maybeSingle();
    if (saveError) throw saveError;
    if (!saved) {
      throw requestError("Project analysis ownership changed before its result was saved.", 409, "AI_ANALYSIS_LEASE_LOST");
    }
    return res.status(200).json({ status: "success", data: saved, replayed: false });
  } catch (error) {
    if (claim?.leaseToken && claim.record?.id) {
      await supabase
        .from(ANALYSIS_TABLE)
        .update({
          status: "failed",
          result: null,
          failure_code: /^[A-Z0-9_]{1,80}$/.test(error.code || "") ? error.code : "AI_ANALYSIS_FAILED",
          lease_token: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", claim.record.id)
        .eq("lease_token", claim.leaseToken);
    }
    return next(error);
  }
},
});

const projectAiAnalysesController = createProjectAiAnalysesController();
export const listProjectAiAnalyses = projectAiAnalysesController.listProjectAiAnalyses;
export const createProjectAiAnalysis = projectAiAnalysesController.createProjectAiAnalysis;
