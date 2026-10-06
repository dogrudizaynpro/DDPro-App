import { getIntegrationAdmin } from "../config/integration-admin.js";

const UUID_PATTERN = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
const fail = (message, statusCode = 400) => Object.assign(new Error(message), {
  statusCode,
  expose: true,
});

export const normalizeConversationPayload = (body = {}, existing = {}) => {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw fail("Conversation payload must be an object.");
  }
  const read = (key) => Object.hasOwn(body, key) ? body[key] : existing[key];
  const title = typeof read("title") === "string" ? read("title").trim() : "";
  if (!title || title.length > 200) throw fail("Conversation title is required and must be at most 200 characters.");
  const reference = (value, label) => {
    if (value === undefined || value === null || value === "") return null;
    if (typeof value !== "string" || !UUID_PATTERN.test(value)) throw fail(`${label} reference must be a valid UUID.`);
    return value;
  };
  return {
    title,
    project_id: reference(read("project_id") ?? read("projectId"), "Project"),
    crm_contact_id: reference(read("crm_contact_id") ?? read("crmContactId"), "CRM contact"),
  };
};

export const normalizeMessagePayload = (body = {}) => {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw fail("Message payload must be an object.");
  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!content || content.length > 10_000) throw fail("Message content is required and must be at most 10000 characters.");
  const direction = body.direction ?? "OUTBOUND";
  if (!["INBOUND", "OUTBOUND"].includes(direction)) throw fail("Message direction must be INBOUND or OUTBOUND.");
  return { content, direction };
};

const requireDatabase = () => {
  const client = getIntegrationAdmin();
  if (!client) throw fail("Messages database service-role configuration is required.", 503);
  return client;
};

export const listConversations = async (ownerAccount) => {
  const client = requireDatabase();
  const { data, error } = await client.from("message_conversations")
    .select("*").eq("owner_account", ownerAccount).order("updated_at", { ascending: false }).limit(200);
  if (error) throw error;
  return data || [];
};

export const createConversation = async (ownerAccount, body) => {
  const client = requireDatabase();
  const payload = normalizeConversationPayload(body);
  const { data, error } = await client.from("message_conversations")
    .insert({ ...payload, owner_account: ownerAccount }).select("*").single();
  if (error) throw error;
  return data;
};

export const updateConversation = async (ownerAccount, id, body) => {
  if (!UUID_PATTERN.test(id || "")) throw fail("Conversation id must be a valid UUID.");
  const client = requireDatabase();
  const { data: existing, error: lookupError } = await client.from("message_conversations")
    .select("*").eq("id", id).eq("owner_account", ownerAccount).maybeSingle();
  if (lookupError) throw lookupError;
  if (!existing) return null;
  const payload = normalizeConversationPayload(body, existing);
  const { data, error } = await client.from("message_conversations")
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("id", id).eq("owner_account", ownerAccount).select("*").maybeSingle();
  if (error) throw error;
  return data;
};

export const deleteConversation = async (ownerAccount, id) => {
  if (!UUID_PATTERN.test(id || "")) throw fail("Conversation id must be a valid UUID.");
  const { data, error } = await requireDatabase().from("message_conversations")
    .delete().eq("id", id).eq("owner_account", ownerAccount).select("id").maybeSingle();
  if (error) throw error;
  return Boolean(data);
};

const ownedConversation = async (client, ownerAccount, id) => {
  if (!UUID_PATTERN.test(id || "")) throw fail("Conversation id must be a valid UUID.");
  const { data, error } = await client.from("message_conversations")
    .select("id").eq("id", id).eq("owner_account", ownerAccount).maybeSingle();
  if (error) throw error;
  return data;
};

export const listMessages = async (ownerAccount, conversationId) => {
  const client = requireDatabase();
  if (!await ownedConversation(client, ownerAccount, conversationId)) return null;
  const { data, error } = await client.from("messages").select("*")
    .eq("conversation_id", conversationId).eq("owner_account", ownerAccount)
    .order("created_at", { ascending: true }).limit(500);
  if (error) throw error;
  return data || [];
};

export const createMessage = async (ownerAccount, conversationId, body) => {
  const client = requireDatabase();
  if (!await ownedConversation(client, ownerAccount, conversationId)) return null;
  const payload = normalizeMessagePayload(body);
  const { data, error } = await client.from("messages")
    .insert({ ...payload, owner_account: ownerAccount, conversation_id: conversationId })
    .select("*").single();
  if (error) throw error;
  const { error: updateError } = await client.from("message_conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId).eq("owner_account", ownerAccount);
  if (updateError) throw updateError;
  return data;
};

export const markMessageRead = async (ownerAccount, conversationId, messageId) => {
  if (!UUID_PATTERN.test(messageId || "")) throw fail("Message id must be a valid UUID.");
  const client = requireDatabase();
  if (!await ownedConversation(client, ownerAccount, conversationId)) return null;
  const { data, error } = await client.from("messages").update({ read_at: new Date().toISOString() })
    .eq("id", messageId).eq("conversation_id", conversationId).eq("owner_account", ownerAccount)
    .select("*").maybeSingle();
  if (error) throw error;
  return data;
};

export const deleteMessage = async (ownerAccount, conversationId, messageId) => {
  if (!UUID_PATTERN.test(messageId || "")) throw fail("Message id must be a valid UUID.");
  const client = requireDatabase();
  if (!await ownedConversation(client, ownerAccount, conversationId)) return null;
  const { data, error } = await client.from("messages").delete()
    .eq("id", messageId).eq("conversation_id", conversationId).eq("owner_account", ownerAccount)
    .select("id").maybeSingle();
  if (error) throw error;
  return Boolean(data);
};
