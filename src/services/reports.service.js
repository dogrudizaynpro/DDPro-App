import { fetchAPI } from "./api.js";

export const getReports = async () => {
  const response = await fetchAPI("/api/reports");
  return Array.isArray(response.data) ? response.data : [];
};

export const createReport = async (report) => {
  const response = await fetchAPI("/api/reports", {
    method: "POST",
    body: JSON.stringify(report),
  });
  return response.data || null;
};

export const deleteReport = async (id) => {
  if (!id) throw new Error("Report ID is required.");
  return fetchAPI(`/api/reports/${encodeURIComponent(id)}`, { method: "DELETE" });
};
