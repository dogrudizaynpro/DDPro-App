import {
  getAiUsageCount,
  getAiProviderStatus,
  recordAiUsage,
  confirmAiAction,
} from "../services/ai.service.js";
import { orchestrateAiCommand } from "../services/ai-orchestrator.service.js";
import {
  createGeminiLiveSessionConfig,
  createGeminiLiveToken,
  getGeminiLiveWebSocketUrl,
} from "../services/ai-voice.service.js";

const MAX_MESSAGE_LENGTH = 8_000;
const MAX_CONTEXT_LENGTH = 24_000;

export const getAiStatus = (_req, res) => {
  res.status(200).json({ status: "success", data: getAiProviderStatus() });
};

export const getAiUsage = async (req, res, next) => {
  try {
    return res.status(200).json({
      status: "success",
      data: { count: await getAiUsageCount(req.integrationAccount) },
    });
  } catch (error) {
    return next(error);
  }
};

export const createAiCompletion = async (req, res, next) => {
  const message =
    typeof req.body?.message === "string" ? req.body.message.trim() : "";
  let context = req.body?.context ?? {};

  if (typeof context === "string") {
    try {
      context = JSON.parse(context);
    } catch {
      return res.status(400).json({
        status: "error",
        message: "Application context must be valid JSON.",
      });
    }
  }

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
    const completion = await orchestrateAiCommand({
      message,
      context,
      attachment: req.aiFile,
      integrationAccount: req.integrationAccount,
    });
    await recordAiUsage(req.integrationAccount);
    return res.status(200).json({
      status: "success",
      data: {
        ...completion,
        ...(completion.orchestration.intent === "web_research"
          ? {}
          : { provider: getAiProviderStatus().provider }),
      },
    });
  } catch (error) {
    return next(error);
  }
};

export const createAiVoiceSession = async (req, res, next) => {
  const context = req.body?.context ?? {};
  const history = req.body?.history ?? [];
  if (
    !context ||
    typeof context !== "object" ||
    Array.isArray(context) ||
    !Array.isArray(history) ||
    history.length > 12 ||
    history.some((message) =>
      !["user", "assistant"].includes(message?.role) ||
      typeof message?.text !== "string' ||
      message.text.length > 2_000
    )
  ) {
    return res.status(400).json({
      status: "error",
      message: "Voice session context or conversation history is invalid.",
    });
  }

  try {
    const sessionConfig = createGeminiLiveSessionConfig({ context, history });
    const token = await createGeminiLiveToken(sessionConfig);
    await recordAiUsage(req.integrationAccount);
    res.set("Cache-Control", "no-store");
    return res.status(200).json({
      status: "success",
      data: {
        token,
        websocketUrl: getGeminiLiveWebSocketUrl(),
        setup: sessionConfig,
      },
    });
  } catch (error) {
    return next(error);
  }
};

export const confirmAiOperationalAction = async (req, res, next) => {
  try {
    const data = await confirmAiAction(
      req.integrationAccount,
      req.body?.confirmationId
    );
    return res.status(200).json({ status: "success", data });
  } catch (error) {
    return next(error);
  }
};
