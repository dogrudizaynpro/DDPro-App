import { createReport, deleteReport, listReports } from "../services/reports.service.js";

export const getReports = async (req, res, next) => {
  try {
    return res.status(200).json({ status: "success", data: await listReports(req.integrationAccount) });
  } catch (error) {
    return next(error);
  }
};

export const postReport = async (req, res, next) => {
  try {
    const data = await createReport(req.integrationAccount, req.body);
    return res.status(201).json({ status: "success", data });
  } catch (error) {
    return next(error);
  }
};

export const removeReport = async (req, res, next) => {
  try {
    const deleted = await deleteReport(req.integrationAccount, req.params.id);
    if (!deleted) return res.status(404).json({ status: "error", message: "Report not found." });
    return res.status(200).json({ status: "success", data: { deleted: true } });
  } catch (error) {
    return next(error);
  }
};
