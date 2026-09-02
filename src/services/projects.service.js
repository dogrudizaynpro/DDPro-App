// ============================================================
// PROJECTS SERVICE
// ============================================================
// Projects module API service layer
// Read-only operations for fetching projects data
// ============================================================

import { fetchAPI } from "./api.js";

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

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString("tr-TR", {
    dateStyle: "short",
    timeStyle: "short",
  });
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
  const source =
    project.source ||
    (project.created_at || project.updated_at ? "api" : "local");

  return {
    id: project.id,
    name,
    type,
    status: toProjectStatusLabel(project.status),
    date: formatProjectDate(createdAt),
    createdAt,
    updatedAt,
    source,
    raw: project,
  };
};

export const mapProjectsToViewModel = (projects = []) =>
  projects.filter(Boolean).map((project) => mapProjectToViewModel(project));

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

  const projectType =
    typeof project?.type === "string" && project.type.trim()
      ? project.type.trim()
      : typeof project?.projectType === "string" && project.projectType.trim()
        ? project.projectType.trim()
        : "Genel Proje";

  const status =
    typeof project?.status === "string" && project.status.trim()
      ? project.status.trim()
      : "Aktif";

  return {
    name,
    project_type: projectType,
    status,
  };
};

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
    console.error("Failed to fetch projects:", error.message);
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
    console.error("Failed to fetch project:", error.message);
    throw error;
  }
};

// ============================================================
// CREATE PROJECT
// ============================================================

export const createProject = async (project) => {
  const payload = toProjectPayload(project);

  try {
    const data = await fetchAPI("/api/projects", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    return data.data ? mapProjectToViewModel(data.data) : null;
  } catch (error) {
    console.error("Failed to create project:", error.message);
    throw error;
  }
};

// ============================================================
// DELETE PROJECT
// ============================================================

export const deleteProjectById = async (id) => {
  if (!id) {
    throw new Error("Project ID is required");
  }

  try {
    const data = await fetchAPI(`/api/projects/${id}`, {
      method: "DELETE",
    });

    return data.data ? mapProjectToViewModel(data.data) : null;
  } catch (error) {
    console.error("Failed to delete project:", error.message);
    throw error;
  }
};
