import {
  createCostRecord,
  deleteCostRecord,
  listCostRecords,
  updateCostRecord,
} from "../services/finance.service.js";

export const getCostRecords = async (req, res, next) => {
  try {
    return res.status(200).json({ status: "success", data: await listCostRecords(req.integrationAccount) });
  } catch (error) {
    return next(error);
  }
};

export const postCostRecord = async (req, res, next) => {
  try {
    return res.status(201).json({
      status: "success",
      data: await createCostRecord(req.integrationAccount, req.body),
    });
  } catch (error) {
    return next(error);
  }
};

export const patchCostRecord = async (req, res, next) => {
  try {
    const data = await updateCostRecord(req.integrationAccount, req.params.id, req.body);
    if (!data) return res.status(404).json({ status: "error", message: "Cost record not found." });
    return res.status(200).json({ status: "success", data });
  } catch (error) {
    return next(error);
  }
};

export const removeCostRecord = async (req, res, next) => {
  try {
    const deleted = await deleteCostRecord(req.integrationAccount, req.params.id);
    if (!deleted) return res.status(404).json({ status: "error", message: "Cost record not found." });
    return res.status(200).json({ status: "success", data: { deleted: true } });
  } catch (error) {
    return next(error);
  }
};
