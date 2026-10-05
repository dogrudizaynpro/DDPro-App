import { fetchAPI } from "./api.js";
import { completeGoogleConnection } from "./operations-integrations.service.js";

export const getIntegrationStatus = async () => {
  await completeGoogleConnection();
  const response = await fetchAPI("/api/integrations/status");
  return response.data;
};

export const testIntegrationConnection = async (provider) =>
  fetchAPI(`/api/integrations/test/${encodeURIComponent(provider)}`, {
    method: "POST",
    body: JSON.stringify({}),
  });
