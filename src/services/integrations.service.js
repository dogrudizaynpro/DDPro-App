import { fetchAPI } from "./api.js";

export const getIntegrationStatus = async () => {
  const response = await fetchAPI("/api/integrations/status");
  return response.data;
};

export const testIntegrationConnection = async (provider) =>
  fetchAPI(`/api/integrations/test/${encodeURIComponent(provider)}`, {
    method: "POST",
    body: JSON.stringify({}),
  });
