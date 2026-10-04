import { fetchAPI } from "./api.js";

export const getAiProviderStatus = async () => {
  const response = await fetchAPI("/api/ai/status");
  return response.data;
};

export const requestAiCompletion = async ({ message, context }) => {
  const response = await fetchAPI("/api/ai/chat", {
    method: "POST",
    body: JSON.stringify({ message, context }),
  });
  return response.data;
};
