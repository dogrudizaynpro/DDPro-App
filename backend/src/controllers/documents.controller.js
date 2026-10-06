import {
  deleteDocument,
  getDocumentDownload,
  listDocuments,
  uploadDocument,
} from "../services/documents.service.js";

export const getDocuments = async (req, res, next) => {
  try {
    return res.json({ status: "success", data: await listDocuments(req.integrationAccount) });
  } catch (error) { return next(error); }
};

export const postDocument = async (req, res, next) => {
  if (!Buffer.isBuffer(req.body)) {
    return res.status(400).json({ status: "error", message: "Document request body must be binary data." });
  }
  const queryString = (value) => typeof value === "string" ? value : undefined;
  try {
    const data = await uploadDocument(req.integrationAccount, {
      originalName: queryString(req.query.name),
      contentType: req.get("content-type"),
      projectId: queryString(req.query.project_id),
      crmContactId: queryString(req.query.crm_contact_id),
      buffer: Buffer.from(req.body),
    });
    return res.status(201).json({ status: "success", data });
  } catch (error) { return next(error); }
};

export const getDocument = async (req, res, next) => {
  try {
    const data = await getDocumentDownload(req.integrationAccount, req.params.id);
    return data ? res.json({ status: "success", data }) : res.status(404).json({ status: "error", message: "Document not found." });
  } catch (error) { return next(error); }
};

export const removeDocument = async (req, res, next) => {
  try {
    const deleted = await deleteDocument(req.integrationAccount, req.params.id);
    return deleted ? res.json({ status: "success", data: { deleted: true } }) : res.status(404).json({ status: "error", message: "Document not found." });
  } catch (error) { return next(error); }
};
