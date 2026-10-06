import { fetchAPI } from "./api.js";

export const getDocuments = async () => {
  const response = await fetchAPI("/api/documents");
  if (!Array.isArray(response?.data)) throw new Error("Documents API returned an invalid list.");
  return response.data;
};

export const uploadDocument = (file, { projectId, crmContactId } = {}) => {
  const query = new URLSearchParams({ name: file.name });
  if (projectId) query.set("project_id", projectId);
  if (crmContactId) query.set("crm_contact_id", crmContactId);
  return fetchAPI(`/api/documents?${query.toString()}`, {
    method: "POST",
    headers: { "Content-Type": file.type },
    body: file,
  });
};

export const getDocumentDownload = async (id) => {
  const response = await fetchAPI(`/api/documents/${encodeURIComponent(id)}/download`);
  return response.data;
};

export const deleteDocument = (id) =>
  fetchAPI(`/api/documents/${encodeURIComponent(id)}`, { method: "DELETE" });
