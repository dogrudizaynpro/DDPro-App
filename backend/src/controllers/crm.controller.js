import {
  createCrmContact,
  deleteCrmContact,
  listCrmContacts,
  updateCrmContact,
} from "../services/crm.service.js";

export const getCrmContacts = async (_req, res, next) => {
  try {
    return res.status(200).json({ status: "success", data: await listCrmContacts() });
  } catch (error) {
    return next(error);
  }
};

export const postCrmContact = async (req, res, next) => {
  try {
    const result = await createCrmContact(req.body);
    return res.status(result.duplicate ? 200 : 201).json({
      status: "success",
      data: result.contact,
      duplicate: result.duplicate,
    });
  } catch (error) {
    return next(error);
  }
};

export const patchCrmContact = async (req, res, next) => {
  try {
    const data = await updateCrmContact(req.params.id, req.body);
    if (!data) return res.status(404).json({ status: "error", message: "CRM contact not found." });
    return res.status(200).json({ status: "success", data });
  } catch (error) {
    return next(error);
  }
};

export const removeCrmContact = async (req, res, next) => {
  try {
    const deleted = await deleteCrmContact(req.params.id);
    if (!deleted) return res.status(404).json({ status: "error", message: "CRM contact not found." });
    return res.status(200).json({ status: "success" });
  } catch (error) {
    return next(error);
  }
};
