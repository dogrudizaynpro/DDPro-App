import { fetchAPI } from "./api.js";

const resourcePaths = {
  products: "products",
  systems: "systems",
  "price-analysis": "price-analysis",
  "material-analysis": "material-analysis",
};

const pathFor = (resource, id) => {
  const path = resourcePaths[resource];
  if (!path) throw new Error("Unsupported catalog module.");
  return `/api/${path}${id ? `/${encodeURIComponent(id)}` : ""}`;
};

export const getCatalogRecords = async (resource) => {
  const response = await fetchAPI(pathFor(resource));
  if (!Array.isArray(response?.data)) throw new Error("Backend returned an invalid catalog response.");
  return response.data;
};

export const createCatalogRecord = async (resource, payload) => {
  const endpoint = resource === "material-analysis"
    ? "/api/material-analysis/calculate"
    : pathFor(resource);
  const response = await fetchAPI(endpoint, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return response.data;
};

export const updateCatalogRecord = async (resource, id, payload) => {
  const response = await fetchAPI(pathFor(resource, id), {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  return response.data;
};

export const deleteCatalogRecord = async (resource, id) => {
  const response = await fetchAPI(pathFor(resource, id), { method: "DELETE" });
  return response.data;
};
