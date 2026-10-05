import { fetchAPI } from "./api.js";
import { completeGoogleConnection } from "./operations-integrations.service.js";

export const getIntegrationStatus = async () => {
  try {
    await completeGoogleConnection();
  } catch (error) {
    if (![400, 401].includes(error.status)) throw error;
  }
  const response = await fetchAPI("/api/integrations/status");
  return response.data;
};

export const testIntegrationConnection = async (provider) =>
  fetchAPI(`/api/integrations/test/${encodeURIComponent(provider)}`, {
    method: "POST",
    body: JSON.stringify({}),
  });
