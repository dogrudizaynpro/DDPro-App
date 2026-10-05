import { fetchAPI } from "./api.js";

export const getFinanceCosts = async () => {
  const response = await fetchAPI("/api/finance/costs");
  return Array.isArray(response.data) ? response.data : [];
};

export const createFinanceCost = async (record) => {
  const response = await fetchAPI("/api/finance/costs", {
    method: "POST",
    body: JSON.stringify(record),
  });
  return response.data || null;
};

export const updateFinanceCost = async (id, record) => {
  const response = await fetchAPI(`/api/finance/costs/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(record),
  });
  return response.data || null;
};

export const deleteFinanceCost = (id) =>
  fetchAPI(`/api/finance/costs/${encodeURIComponent(id)}`, { method: "DELETE" });
