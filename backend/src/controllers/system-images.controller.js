import {
  deleteSystemImage,
  listSystemImages,
  replaceSystemImage,
  uploadSystemImage,
} from "../services/system-images.service.js";

const queryString = (value) => typeof value === "string" ? value : undefined;
const forwardImageError = (error, next) => next(error.expose
  ? error
  : Object.assign(
    new Error("Sistem görseli işlemi sırasında veritabanı veya dosya depolama hizmeti başarısız oldu."),
    { statusCode: 503, expose: true }
  ));

export const getSystemImages = async (req, res, next) => {
  try {
    return res.json({
      status: "success",
      data: await listSystemImages(req.integrationAccount, req.params.systemId),
    });
  } catch (error) { return forwardImageError(error, next); }
};

const imageInput = (req) => ({
  originalName: queryString(req.query.name),
  contentType: req.get("content-type"),
  buffer: Buffer.isBuffer(req.body) ? Buffer.from(req.body) : null,
});

export const postSystemImage = async (req, res, next) => {
  try {
    const data = await uploadSystemImage(
      req.integrationAccount,
      req.params.systemId,
      imageInput(req)
    );
    return res.status(201).json({ status: "success", data });
  } catch (error) { return forwardImageError(error, next); }
};

export const putSystemImage = async (req, res, next) => {
  try {
    const data = await replaceSystemImage(
      req.integrationAccount,
      req.params.systemId,
      req.params.imageId,
      imageInput(req)
    );
    return data
      ? res.json({ status: "success", data })
      : res.status(404).json({ status: "error", message: "Sistem görseli bulunamadı." });
  } catch (error) { return forwardImageError(error, next); }
};

export const removeSystemImage = async (req, res, next) => {
  try {
    const deleted = await deleteSystemImage(
      req.integrationAccount,
      req.params.systemId,
      req.params.imageId
    );
    return deleted
      ? res.json({ status: "success", data: { deleted: true } })
      : res.status(404).json({ status: "error", message: "Sistem görseli bulunamadı." });
  } catch (error) { return forwardImageError(error, next); }
};
