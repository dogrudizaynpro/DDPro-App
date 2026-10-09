// ============================================================
// PROJECTS SERVICE
// ============================================================
// Projects module API service layer
// Read-only operations for fetching projects data
// ============================================================

import { fetchAPI } from "./api.js";
import { formatDateTime } from "../utils/date-time.js";

const PROJECT_STATUS_LABELS = {
  active: "Aktif",
  aktif: "Aktif",
  pending: "Beklemede",
  beklemede: "Beklemede",
  completed: "Tamamlandı",
  tamamlandı: "Tamamlandı",
  done: "Tamamlandı",
  draft: "Taslak",
};

const formatProjectDate = (value) => {
  if (!value) {
    return "Tarih belirtilmedi";
  }

  return formatDateTime(value);
};

const toProjectStatusLabel = (value) => {
  if (!value) {
    return "Taslak";
  }

  const normalizedValue = String(value).trim();
  const lookupKey = normalizedValue.toLowerCase();

  return PROJECT_STATUS_LABELS[lookupKey] || normalizedValue;
};

export const mapProjectToViewModel = (project = {}) => {
  const name =
    typeof project.name === "string" && project.name.trim()
      ? project.name.trim()
      : typeof project.title === "string" && project.title.trim()
        ? project.title.trim()
        : "Adsız proje";
  const type =
    typeof project.project_type === "string" && project.project_type.trim()
      ? project.project_type.trim()
      : typeof project.projectType === "string" && project.projectType.trim()
        ? project.projectType.trim()
        : typeof project.type === "string" && project.type.trim()
          ? project.type.trim()
          : "Genel Proje";
  const createdAt = project.created_at || project.createdAt || project.date;
  const updatedAt = project.updated_at || project.updatedAt || null;

  return {
    id: project.id,
    name,
    type,
    status: toProjectStatusLabel(project.status),
    areaM2: project.area_m2 ?? project.areaM2 ?? "",
    systems: Array.isArray(project.systems) ? project.systems : [],
    notes: project.notes || "",
    crmContactId: project.crm_contact_id || project.crmContactId || "",
    date: formatProjectDate(createdAt),
    createdAt,
    updatedAt,
    source: "api",
    raw: project,
  };
};

export const mapProjectsToViewModel = (projects = []) =>
  projects.filter(Boolean).map((project) => mapProjectToViewModel(project));

// ============================================================
// GET ALL PROJECTS
// ============================================================
// Fetch all projects from the backend
// Returns array of projects ordered by created_at descending

export const getProjects = async () => {
  try {
    const data = await fetchAPI("/api/projects");
    return mapProjectsToViewModel(data.data || []);
  } catch (error) {
    console.warn("Projects API unavailable:", error.message);
    throw error;
  }
};

// ============================================================
// GET PROJECT BY ID
// ============================================================
// Fetch a single project by its UUID id
// Returns the project object or null if not found

export const getProjectById = async (id) => {
  if (!id) {
    throw new Error("Project ID is required");
  }

  try {
    const data = await fetchAPI(`/api/projects/${id}`);
    return data.data ? mapProjectToViewModel(data.data) : null;
  } catch (error) {
    // Handle 404 errors gracefully
    if (error.status === 404) {
      console.warn(`Project not found: ${id}`);
      return null;
    }
    console.warn("Project API unavailable:", error.message);
    throw error;
  }
};

const toProjectPayload = (project = {}) => {
  const name =
    typeof project?.name === "string" && project.name.trim()
      ? project.name.trim()
      : typeof project?.title === "string" && project.title.trim()
        ? project.title.trim()
        : "";

  if (!name) {
    throw new Error("Project name is required");
  }

  return {
    name,
    project_type:
      typeof project?.type === "string" && project.type.trim()
        ? project.type.trim()
        : typeof project?.projectType === "string" && project.projectType.trim()
          ? project.projectType.trim()
          : "Genel Proje",
    status:
      typeof project?.status === "string" && project.status.trim()
        ? project.status.trim()
        : "Aktif",
  };
};

export const createProject = async (project) => {
  const payload = toProjectPayload(project);

  try {
    const data = await fetchAPI("/api/projects", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    return data.data ? mapProjectToViewModel(data.data) : null;
  } catch (error) {
    console.warn("Project creation API unavailable:", error.message);
    throw error;
  }
};

export const importAiFileProjects = async ({ sourceFingerprint, headers, rows }) => {
  const response = await fetchAPI("/api/projects/import/ai-file", {
    method: "POST",
    body: JSON.stringify({ sourceFingerprint, headers, rows }),
  });
  return response.data;
};

export const previewAiFileProjectImport = async ({ sourceFingerprint, headers, rows }) => {
  const response = await fetchAPI("/api/projects/import/ai-file/preview", {
    method: "POST",
    body: JSON.stringify({ sourceFingerprint, headers, rows }),
  });
  return response.data;
};

export const updateProject = async (id, project) => {
  if (!id) throw new Error("Project ID is required");
  const payload = {
    status: project.status,
    area_m2: project.areaM2 === "" ? null : Number(project.areaM2),
    systems: Array.isArray(project.systems) ? project.systems : [],
    notes: typeof project.notes === "string" ? project.notes.trim() : "",
    crm_contact_id: project.crmContactId || null,
  };
  if (payload.area_m2 !== null && (!Number.isFinite(payload.area_m2) || payload.area_m2 < 0)) {
    throw new Error("Project area must be a non-negative number");
  }
  const data = await fetchAPI(`/api/projects/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  return data.data ? mapProjectToViewModel(data.data) : null;
};

export const deleteProject = async (id) => {
  if (!id) {
    throw new Error("Project ID is required");
  }

  try {
    const data = await fetchAPI(`/api/projects/${id}`, {
      method: "DELETE",
    });

    return data.data ? mapProjectToViewModel(data.data) : null;
  } catch (error) {
    console.warn("Project deletion API unavailable:", error.message);
    throw error;
  }
};
