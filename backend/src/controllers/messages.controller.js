import {
  createConversation,
  createMessage,
  deleteConversation,
  deleteMessage,
  listConversations,
  listMessages,
  markMessageRead,
  updateConversation,
} from "../services/messages.service.js";

export const getConversations = async (req, res, next) => {
  try {
    return res.json({ status: "success", data: await listConversations(req.integrationAccount) });
  } catch (error) { return next(error); }
};

export const postConversation = async (req, res, next) => {
  try {
    return res.status(201).json({ status: "success", data: await createConversation(req.integrationAccount, req.body) });
  } catch (error) { return next(error); }
};

export const patchConversation = async (req, res, next) => {
  try {
    const data = await updateConversation(req.integrationAccount, req.params.id, req.body);
    return data ? res.json({ status: "success", data }) : res.status(404).json({ status: "error", message: "Conversation not found." });
  } catch (error) { return next(error); }
};

export const removeConversation = async (req, res, next) => {
  try {
    const deleted = await deleteConversation(req.integrationAccount, req.params.id);
    return deleted ? res.json({ status: "success", data: { deleted: true } }) : res.status(404).json({ status: "error", message: "Conversation not found." });
  } catch (error) { return next(error); }
};

export const getMessages = async (req, res, next) => {
  try {
    const data = await listMessages(req.integrationAccount, req.params.id);
    return data ? res.json({ status: "success", data }) : res.status(404).json({ status: "error", message: "Conversation not found." });
  } catch (error) { return next(error); }
};

export const postMessage = async (req, res, next) => {
  try {
    const data = await createMessage(req.integrationAccount, req.params.id, req.body);
    return data ? res.status(201).json({ status: "success", data }) : res.status(404).json({ status: "error", message: "Conversation not found." });
  } catch (error) { return next(error); }
};

export const patchMessageRead = async (req, res, next) => {
  try {
    const data = await markMessageRead(req.integrationAccount, req.params.id, req.params.messageId);
    return data ? res.json({ status: "success", data }) : res.status(404).json({ status: "error", message: "Message not found." });
  } catch (error) { return next(error); }
};

export const removeMessage = async (req, res, next) => {
  try {
    const deleted = await deleteMessage(req.integrationAccount, req.params.id, req.params.messageId);
    return deleted ? res.json({ status: "success", data: { deleted: true } }) : res.status(404).json({ status: "error", message: "Message not found." });
  } catch (error) { return next(error); }
};
