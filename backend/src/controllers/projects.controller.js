// ============================================================
// PROJECTS CONTROLLER
// ============================================================
// Business logic and database interactions for projects domain
// ============================================================

import { getIntegrationAdmin } from "../config/integration-admin.js";

const DEFAULT_PROJECT_STATUS = "Aktif";

const optionalProjectText = (value, field, maxLength = 5000) => {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || value.trim().length > maxLength) {
    const error = new Error(`Project ${field} is invalid`);
    error.statusCode = 400;
    throw error;
  }
  return value.trim();
};

const getProjectPayload = (body = {}, preserveMissing = false) => {
  const name =
    typeof body.name === "string"
      ? body.name.trim()
      : typeof body.title === "string"
        ? body.title.trim()
        : "";

  if (!name) {
    const error = new Error("Project name is required");
    error.statusCode = 400;
    throw error;
  }

  const projectType = preserveMissing &&
    Object.hasOwn(body, "project_type") &&
    (body.project_type === null || body.project_type === "")
    ? null
    : typeof body.project_type === "string" && body.project_type.trim()
      ? body.project_type.trim()
      : typeof body.projectType === "string" && body.projectType.trim()
        ? body.projectType.trim()
        : typeof body.type === "string" && body.type.trim()
          ? body.type.trim()
          : "Genel Proje";

  const status =
    typeof body.status === "string" && body.status.trim()
      ? body.status.trim()
      : DEFAULT_PROJECT_STATUS;

  const areaM2 = body.area_m2 === undefined || body.area_m2 === null || body.area_m2 === ""
    ? null
    : Number(body.area_m2);
  if (areaM2 !== null && (!Number.isFinite(areaM2) || areaM2 < 0)) {
    const error = new Error("Project area must be non-negative");
    error.statusCode = 400;
    throw error;
  }
  if (body.systems !== undefined && (
    !Array.isArray(body.systems) ||
    body.systems.length > 100 ||
    body.systems.some((system) => typeof system !== "string" || system.length > 150)
  )) {
    const error = new Error("Project systems are invalid");
    error.statusCode = 400;
    throw error;
  }
  if (body.source_data !== undefined && (
    !body.source_data ||
    typeof body.source_data !== "object" ||
    Array.isArray(body.source_data) ||
    Buffer.byteLength(JSON.stringify(body.source_data)) > 20_000
  )) {
    const error = new Error("Project source data is invalid");
    error.statusCode = 400;
    throw error;
  }

  return {
    name,
    project_type: projectType,
    status,
    ...(body.customer !== undefined ? { customer: optionalProjectText(body.customer, "customer") } : {}),
    ...(body.company !== undefined ? { company: optionalProjectText(body.company, "company") } : {}),
    ...(body.location !== undefined ? { location: optionalProjectText(body.location, "location") } : {}),
    ...(body.product !== undefined ? { product: optionalProjectText(body.product, "product") } : {}),
    ...(body.area_m2 !== undefined ? { area_m2: areaM2 } : {}),
    ...(body.systems !== undefined ? { systems: body.systems.map((system) => system.trim()).filter(Boolean) } : {}),
    ...(body.start_date !== undefined ? { start_date: optionalProjectText(body.start_date, "start date", 100) } : {}),
    ...(body.end_date !== undefined ? { end_date: optionalProjectText(body.end_date, "end date", 100) } : {}),
    ...(body.notes !== undefined ? { notes: optionalProjectText(body.notes, "notes", 20_000) ?? "" } : {}),
    ...(body.source_data !== undefined ? { source_data: body.source_data } : {}),
  };
};

export const getProjectUpdatePayload = (body = {}) => {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    const error = new Error("Project update must be an object");
    error.statusCode = 400;
    throw error;
  }
  const updates = {};
  if (Object.hasOwn(body, "name")) {
    const name = optionalProjectText(body.name, "name", 250);
    if (!name) {
      const error = new Error("Project name is required");
      error.statusCode = 400;
      throw error;
    }
    updates.name = name;
  }
  for (const [field, maxLength] of [
    ["project_type", 500],
    ["customer", 500],
    ["company", 500],
    ["location", 1000],
    ["product", 1000],
    ["start_date", 100],
    ["end_date", 100],
  ]) {
    if (Object.hasOwn(body, field)) {
      updates[field] = optionalProjectText(body[field], field, maxLength);
    }
  }
  if (Object.hasOwn(body, "status")) {
    if (typeof body.status !== "string" || !body.status.trim()) {
      const error = new Error("Project status is invalid");
      error.statusCode = 400;
      throw error;
    }
    updates.status = body.status.trim();
  }
  if (Object.hasOwn(body, "area_m2")) {
    const areaM2 = body.area_m2 === null || body.area_m2 === "" ? null : Number(body.area_m2);
    if (areaM2 !== null && (!Number.isFinite(areaM2) || areaM2 < 0)) {
      const error = new Error("Project area must be non-negative");
      error.statusCode = 400;
      throw error;
    }
    updates.area_m2 = areaM2;
  }
  if (Object.hasOwn(body, "systems")) {
    if (!Array.isArray(body.systems) || body.systems.length > 100 ||
        body.systems.some((item) => typeof item !== "string" || item.length > 150)) {
      const error = new Error("Project systems are invalid");
      error.statusCode = 400;
      throw error;
    }
    updates.systems = body.systems.map((item) => item.trim()).filter(Boolean);
  }
  if (Object.hasOwn(body, "notes")) {
    if (typeof body.notes !== "string" || body.notes.length > 20_000) {
      const error = new Error("Project notes are invalid");
      error.statusCode = 400;
      throw error;
    }
    updates.notes = body.notes.trim();
  }
  if (Object.hasOwn(body, "crm_contact_id")) {
    const id = body.crm_contact_id;
    if (id !== null && id !== "" && (
      typeof id !== "string" || !/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(id)
    )) {
      const error = new Error("CRM contact id is invalid");
      error.statusCode = 400;
      throw error;
    }
    updates.crm_contact_id = id || null;
  }
  if (Object.hasOwn(body, "cover_document_id")) {
    const id = body.cover_document_id;
    if (id !== null && id !== "" && (
      typeof id !== "string" || !/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(id)
    )) {
      const error = new Error("Project cover document id is invalid");
      error.statusCode = 400;
      throw error;
    }
    updates.cover_document_id = id || null;
  }
  return updates;
};

export const createProjectRecord = async (supabase, body, importSourceKey = null) => {
  const payload = getProjectPayload(body, Boolean(importSourceKey));
  if (importSourceKey) payload.import_source_key = importSourceKey;
  const { data, error } = await supabase
    .from("projects")
    .insert(payload)
    .select("*")
    .single();
  if (error) throw error;
  return data;
};

// ============================================================
// GET PROJECTS
// ============================================================
// Read all projects from the "projects" table
// Ordered by created_at descending
// ============================================================

export const getProjects = async (req, res, next) => {
  try {
    const supabase = getIntegrationAdmin();
    if (!supabase) {
      return res.status(503).json({
        status: "error",
        message: "Database service-role configuration is required",
      });
    }

    // Fetch all projects ordered by created_at descending
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching projects:", error.message);
      return next(error);
    }

    res.status(200).json({
      status: "success",
      data: data || [],
    });
  } catch (error) {
    console.error("Unexpected error in getProjects:", error.message);
    next(error);
  }
};

// ============================================================
// GET PROJECT BY ID
// ============================================================
// Read one project using its UUID id
// Returns HTTP 404 if not found
// ============================================================

export const getProjectById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const supabase = getIntegrationAdmin();
    if (!supabase) {
      return res.status(503).json({
        status: "error",
        message: "Database service-role configuration is required",
      });
    }

    // Fetch project by id
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      // Handle "no rows returned" error
      if (error.code === "PGRST116") {
        return res.status(404).json({
          status: "error",
          message: "Project not found",
        });
      }

      console.error("Error fetching project:", error.message);
      return next(error);
    }

    res.status(200).json({
      status: "success",
      data,
    });
  } catch (error) {
    console.error("Unexpected error in getProjectById:", error.message);
    next(error);
  }
};

// ============================================================
// CREATE PROJECT
// ============================================================

export const createProject = async (req, res, next) => {
  try {
    const supabase = getIntegrationAdmin();
    if (!supabase) {
      return res.status(503).json({
        status: "error",
        message: "Database service-role configuration is required",
      });
    }

    const data = await createProjectRecord(supabase, req.body);

    res.status(201).json({
      status: "success",
      data,
    });
  } catch (error) {
    console.error("Unexpected error in createProject:", error.message);
    next(error);
  }
};

export const updateProject = async (req, res, next) => {
  try {
    const supabase = getIntegrationAdmin();
    if (!supabase) {
      return res.status(503).json({
        status: "error",
        message: "Database service-role configuration is required",
      });
    }

    const updates = getProjectUpdatePayload(req.body);
    const coverDocumentId = updates.cover_document_id;
    if (coverDocumentId !== undefined) {
      if (coverDocumentId) {
        const { data: cover, error: coverError } = await supabase
          .from("document_records")
          .select("id,content_type")
          .eq("id", coverDocumentId)
          .eq("project_id", req.params.id)
          .eq("owner_account", req.integrationAccount)
          .maybeSingle();
        if (coverError) return next(coverError);
        if (!cover || !cover.content_type.startsWith("image/")) {
          return res.status(400).json({ status: "error", message: "Choose an image uploaded to this project." });
        }
      }
      updates.cover_document_id = coverDocumentId || null;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ status: "error", message: "No project fields to update." });
    }

    const { data, error } = await supabase
      .from("projects")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", req.params.id)
      .select("*")
      .maybeSingle();

    if (error) return next(error);
    if (!data) return res.status(404).json({ status: "error", message: "Project not found." });

    return res.status(200).json({ status: "success", data });
  } catch (error) {
    return next(error);
  }
};

// ============================================================
// DELETE PROJECT
// ============================================================

export const deleteProject = async (req, res, next) => {
  try {
    const { id } = req.params;

    const supabase = getIntegrationAdmin();
    if (!supabase) {
      return res.status(503).json({
        status: "error",
        message: "Database service-role configuration is required",
      });
    }

    const { data: existingProject, error: lookupError } = await supabase
      .from("projects")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (lookupError) {
      console.error("Error looking up project:", lookupError.message);
      return next(lookupError);
    }

    if (!existingProject) {
      return res.status(404).json({
        status: "error",
        message: "Project not found",
      });
    }

    const { error } = await supabase
      .from("projects")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting project:", error.message);
      return next(error);
    }

    res.status(200).json({
      status: "success",
      data: existingProject,
    });
  } catch (error) {
    console.error("Unexpected error in deleteProject:", error.message);
    next(error);
  }
};
