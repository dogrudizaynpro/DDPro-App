import {
  getAiProviderStatus,
  requestAiCompletion,
} from "../services/ai.service.js";

const MAX_MESSAGE_LENGTH = 8_000;
const MAX_CONTEXT_LENGTH = 24_000;

export const getAiStatus = (_req, res) => {
  res.status(200).json({ status: "success", data: getAiProviderStatus() });
};

export const createAiCompletion = async (req, res, next) => {
  const message =
    typeof req.body?.message === "string" ? req.body.message.trim() : "";
  const context = req.body?.context ?? {};

  if (!message || message.length > MAX_MESSAGE_LENGTH) {
    return res.status(400).json({
      status: "error",
      message: `Message is required and must be at most ${MAX_MESSAGE_LENGTH} characters.`,
    });
  }

  if (
    context === null ||
    typeof context !== "object" ||
    JSON.stringify(context).length > MAX_CONTEXT_LENGTH
  ) {
    return res.status(400).json({
      status: "error",
      message: `Application context must be an object of at most ${MAX_CONTEXT_LENGTH} characters.`,
    });
  }

  try {
    const answer = await requestAiCompletion({ message, context });
    return res.status(200).json({
      status: "success",
      data: { answer, provider: getAiProviderStatus().provider },
    });
  } catch (error) {
    return next(error);
  }
};
