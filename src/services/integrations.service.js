import { fetchAPI } from "./api.js";

export const getIntegrationStatus = async () => {
  const response = await fetchAPI("/api/integrations/status");
  return response.data;
};
