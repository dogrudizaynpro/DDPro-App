import { fetchAPI } from "./api.js";

export const getAiProviderStatus = async () => {
  const response = await fetchAPI("/api/ai/status");
  return response.data;
};

export const getAiUsageCount = async () => {
  const response = await fetchAPI("/api/ai/usage");
  const count = Number(response?.data?.count);
  if (!Number.isInteger(count) || count < 0) throw new Error("AI usage API returned an invalid count.");
  return count;
};

export const requestAiCompletion = async ({ message, context, attachment }) => {
  if (attachment) {
    const body = new FormData();
    body.set("message", message);
    body.set("context", JSON.stringify(context));
    body.set("file", attachment, attachment.name);
    const response = await fetchAPI("/api/ai/chat", {
      method: "POST",
      body,
    });
    return response.data;
  }
  const response = await fetchAPI("/api/ai/chat", {
    method: "POST",
    body: JSON.stringify({ message, context }),
  });
  return response.data;
};

export const confirmAiAction = async (confirmationId) => {
  const response = await fetchAPI("/api/ai/tools/confirm", {
    method: "POST",
    body: JSON.stringify({ confirmationId }),
  });
  return response.data;
};
