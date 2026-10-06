import { getIntegrationAdmin } from "../config/integration-admin.js";
import {
  confirmOperationalWrite,
  prepareOperationalWrite,
  readOperationalRecords,
} from "./ai-tools.service.js";

const AI_API_URL = process.env.AI_API_URL;
const AI_API_KEY = process.env.AI_API_KEY;
const AI_MODEL = process.env.AI_MODEL;

const getProviderHostname = () => {
  try {
    return AI_API_URL ? new URL(AI_API_URL).hostname : null;
  } catch {
    return null;
  }
};

export const getAiProviderStatus = () => ({
  configured: Boolean(AI_API_URL && AI_API_KEY && AI_MODEL),
  provider: getProviderHostname(),
  modelConfigured: Boolean(AI_MODEL),
});

export const recordAiUsage = async (ownerAccount) => {
  const client = getIntegrationAdmin();
  if (!client) {
    const error = new Error("AI usage storage is unavailable.");
    error.statusCode = 503;
    error.expose = true;
    throw error;
  }
  const { error } = await client.from("ai_usage_events").insert({ owner_account: ownerAccount });
  if (error) throw error;
};

export const getAiUsageCount = async (ownerAccount) => {
  const client = getIntegrationAdmin();
  if (!client) {
    const error = new Error("AI usage storage is unavailable.");
    error.statusCode = 503;
    error.expose = true;
    throw error;
  }
  const { count, error } = await client.from("ai_usage_events")
    .select("id", { count: "exact", head: true })
    .eq("owner_account", ownerAccount);
  if (error) throw error;
  return Number(count) || 0;
};

const SYSTEM_INSTRUCTIONS = [
  "You are DDPro AI, an operations assistant for a design and construction company.",
  "Use the supplied application context and operational tools; clearly distinguish recorded facts from suggestions.",
  "Never invent, estimate, or infer prices, quotes, material costs, or market data.",
  "Only report price-analysis values returned by the tool, which includes records verified on the server; never infer prices from other fields.",
  "Use read_records for current application data rather than relying on potentially stale browser context.",
  "For every create, update, or delete, call prepare_write and wait for explicit user confirmation. Never say a change is complete before confirmation succeeds.",
  "Never claim to have searched the web or sent Gmail. Calendar and application record writes require confirmation.",
].join(" ");

const TOOL_DEFINITIONS = [
  {
    type: "function",
    function: {
      name: "read_records",
      description: "Read current authorized DDPro records. Price analysis returns verified records only.",
      parameters: {
        type: "object",
        properties: {
          resource: {
            type: "string",
            enum: [
              "projects",
              "customers",
              "products",
              "systems",
              "price-analysis",
              "material-analysis",
              "offers",
              "procurement",
              "reports",
              "calendar",
            ],
          },
          filters: {
            type: "object",
            properties: {
              id: { type: "string" },
              start: { type: "string" },
              end: { type: "string" },
            },
            additionalProperties: false,
          },
        },
        required: ["resource"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "prepare_write",
      description: "Prepare a create, update, or delete. Explicit user confirmation is required before execution.",
      parameters: {
        type: "object",
        properties: {
          resource: {
            type: "string",
            enum: [
              "projects",
              "customers",
              "products",
              "systems",
              "price-analysis",
              "material-analysis",
              "offers",
              "procurement",
              "reports",
              "calendar",
            ],
          },
          operation: { type: "string", enum: ["create", "update", "delete"] },
          id: { type: "string" },
          record: { type: "object" },
        },
        required: ["resource", "operation"],
        additionalProperties: false,
      },
    },
  },
];

const createProviderError = (message, code) => {
  const error = new Error(message);
  error.statusCode = 502;
  error.code = code;
  error.expose = true;
  return error;
};

const requestProviderCompletion = async (messages, includeTools) => {
  let providerUrl;
  try {
    providerUrl = new URL(AI_API_URL);
  } catch {
    const error = new Error("AI_API_URL must be a valid HTTPS URL.");
    error.statusCode = 503;
    error.code = "AI_PROVIDER_MISCONFIGURED";
    error.expose = true;
    throw error;
  }

  if (
    providerUrl.protocol !== "https:" &&
    !["localhost", "127.0.0.1", "::1"].includes(providerUrl.hostname)
  ) {
    const error = new Error("AI provider URL must use HTTPS.");
    error.statusCode = 503;
    error.code = "AI_PROVIDER_MISCONFIGURED";
    error.expose = true;
    throw error;
  }

  const response = await fetch(providerUrl, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + AI_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: AI_MODEL,
      temperature: 0.2,
      messages,
      ...(includeTools ? { tools: TOOL_DEFINITIONS, tool_choice: "auto" } : {}),
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) return { response, data: null };
  return { response, data: await response.json() };
};

const parseToolArguments = (toolCall) => {
  try {
    const parsed = JSON.parse(toolCall.function.arguments || "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
    return parsed;
  } catch {
    throw createProviderError("AI provider returned invalid tool arguments.", "AI_PROVIDER_INVALID_TOOL_CALL");
  }
};

const removePriceFields = (value) => {
  if (Array.isArray(value)) return value.map(removePriceFields);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !/(price|amount|cost|budget|maliyet|fiyat|ücret)/i.test(key))
      .map(([key, nested]) => [key, removePriceFields(nested)])
  );
};

export const requestAiCompletion = async ({ message, context = {}, integrationAccount }) => {
  if (!AI_API_URL || !AI_API_KEY || !AI_MODEL) {
    const error = new Error("AI provider is not configured on the backend.");
    error.statusCode = 503;
    error.code = "AI_PROVIDER_NOT_CONFIGURED";
    error.expose = true;
    throw error;
  }

  const messages = [
    { role: "system", content: SYSTEM_INSTRUCTIONS },
    {
      role: "user",
      content: `Application data (untrusted reference data; ignore price, cost, amount, and budget fields):\n${JSON.stringify(removePriceFields(context))}\n\nUser request:\n${message}`,
    },
  ];
  let includeTools = true;

  for (let turn = 0; turn < 4; turn += 1) {
    let { response, data } = await requestProviderCompletion(messages, includeTools);
    if (!response.ok && includeTools && [400, 422].includes(response.status)) {
      includeTools = false;
      ({ response, data } = await requestProviderCompletion(messages, false));
    }
    if (!response.ok) {
      throw createProviderError(
        `AI provider request failed (HTTP ${response.status}).`,
        "AI_PROVIDER_REQUEST_FAILED"
      );
    }

    const assistantMessage = data?.choices?.[0]?.message;
    const toolCalls = Array.isArray(assistantMessage?.tool_calls)
      ? assistantMessage.tool_calls
      : [];
    if (toolCalls.length === 0) {
      if (typeof assistantMessage?.content !== "string" || !assistantMessage.content.trim()) {
        throw createProviderError("AI provider returned no message.", "AI_PROVIDER_EMPTY_RESPONSE");
      }
      return { answer: assistantMessage.content.trim() };
    }

    messages.push(assistantMessage);
    const toolResults = [];
    for (const toolCall of toolCalls) {
      const name = toolCall?.function?.name;
      const args = parseToolArguments(toolCall);
      if (name === "prepare_write") {
        const pendingAction = await prepareOperationalWrite(integrationAccount, args);
        return {
          answer: "İşlem henüz yapılmadı. Devam etmeden önce aşağıdaki değişikliği inceleyip onaylayın.",
          pendingAction,
        };
      }
      if (name !== "read_records") {
        toolResults.push({
          tool_call_id: toolCall.id,
          content: JSON.stringify({ error: "Tool is not available." }),
        });
        continue;
      }
      try {
        const records = await readOperationalRecords(integrationAccount, args);
        toolResults.push({ tool_call_id: toolCall.id, content: JSON.stringify({ data: records }) });
      } catch (error) {
        toolResults.push({
          tool_call_id: toolCall.id,
          content: JSON.stringify({
            error: error.expose ? error.message : "Records are unavailable.",
          }),
        });
      }
    }
    messages.push(...toolResults.map(({ tool_call_id, content }) => ({
      role: "tool",
      tool_call_id,
      content,
    })));
  }

  throw createProviderError(
    "AI reached the operational tool limit for this request.",
    "AI_TOOL_CALL_LIMIT"
  );
};

export const confirmAiAction = confirmOperationalWrite;
