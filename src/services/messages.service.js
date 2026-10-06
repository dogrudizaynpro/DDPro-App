import { fetchAPI } from "./api.js";

const conversationsPath = "/api/messages/conversations";
const conversationPath = (id) => `${conversationsPath}/${encodeURIComponent(id)}`;

const requireRecords = (response) => {
  if (!Array.isArray(response?.data)) throw new Error("Messages API returned an invalid list.");
  return response.data;
};

export const getConversations = async () => requireRecords(await fetchAPI(conversationsPath));
export const createConversation = async (payload) =>
  (await fetchAPI(conversationsPath, { method: "POST", body: JSON.stringify(payload) })).data;
export const updateConversation = async (id, payload) =>
  (await fetchAPI(conversationPath(id), { method: "PATCH", body: JSON.stringify(payload) })).data;
export const deleteConversation = async (id) =>
  fetchAPI(conversationPath(id), { method: "DELETE" });
export const getMessages = async (id) =>
  requireRecords(await fetchAPI(`${conversationPath(id)}/messages`));
export const createMessage = async (id, payload) =>
  (await fetchAPI(`${conversationPath(id)}/messages`, { method: "POST", body: JSON.stringify(payload) })).data;
export const markMessageRead = async (conversationId, messageId) =>
  (await fetchAPI(`${conversationPath(conversationId)}/messages/${encodeURIComponent(messageId)}/read`, {
    method: "PATCH",
    body: JSON.stringify({}),
  })).data;
export const deleteMessage = async (conversationId, messageId) =>
  fetchAPI(`${conversationPath(conversationId)}/messages/${encodeURIComponent(messageId)}`, { method: "DELETE" });
