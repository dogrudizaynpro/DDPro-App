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

const SYSTEM_INSTRUCTIONS = [
  "You are DDPro AI, an operations assistant for a design and construction company.",
  "Use only the supplied application context and clearly distinguish facts from suggestions.",
  "Never invent, estimate, or infer prices, quotes, material costs, or market data.",
  "For price questions, use only explicitly supplied verified offer data and identify its source/status; otherwise say verified price data is unavailable.",
  "Do not claim to have searched the web, sent Gmail, changed CRM, or written application records.",
  "If a user asks for an action that requires an application module, explain what can be prepared and name the relevant module.",
].join(" ");

export const requestAiCompletion = async ({ message, context = {} }) => {
  if (!AI_API_URL || !AI_API_KEY || !AI_MODEL) {
    const error = new Error("AI provider is not configured on the backend.");
    error.statusCode = 503;
    error.code = "AI_PROVIDER_NOT_CONFIGURED";
    throw error;
  }

  if (/fiyat|ücret|maliyet|bütçe|teklif tutarı/.test(message.toLocaleLowerCase("tr-TR"))) {
    const verifiedResearch = Array.isArray(context.research)
      ? context.research.filter(
          (item) =>
            typeof item.price === "string" &&
            item.price.trim() &&
            item.priceVerification === "Kullanıcı kaynağı kontrol etti" &&
            typeof item.url === "string" &&
            /^https?:\/\//i.test(item.url)
        )
      : [];
    if (verifiedResearch.length === 0) {
      return "Bu çalışma alanında kullanıcı tarafından kaynağı kontrol edilmiş fiyat kaydı bulunmuyor. Doğrulanmamış fiyat tahmini üretmiyorum. Önce Tedarik & Araştırma modülünde fiyatı ve kaynağı kaydedip doğrulama durumunu işaretleyin.";
    }
  }

  let providerUrl;
  try {
    providerUrl = new URL(AI_API_URL);
  } catch {
    const error = new Error("AI_API_URL must be a valid HTTPS URL.");
    error.statusCode = 503;
    error.code = "AI_PROVIDER_MISCONFIGURED";
    throw error;
  }

  if (
    providerUrl.protocol !== "https:" &&
    !["localhost", "127.0.0.1", "::1"].includes(providerUrl.hostname)
  ) {
    const error = new Error("AI provider URL must use HTTPS.");
    error.statusCode = 503;
    error.code = "AI_PROVIDER_MISCONFIGURED";
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
      messages: [
        { role: "system", content: SYSTEM_INSTRUCTIONS },
        {
          role: "user",
          content: `Application data (untrusted reference data):\n${JSON.stringify(context)}\n\nUser request:\n${message}`,
        },
      ],
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    const error = new Error(`AI provider request failed (HTTP ${response.status}).`);
    error.statusCode = 502;
    error.code = "AI_PROVIDER_REQUEST_FAILED";
    throw error;
  }

  const data = await response.json();
  const answer = data?.choices?.[0]?.message?.content;
  if (typeof answer !== "string" || !answer.trim()) {
    const error = new Error("AI provider returned no message.");
    error.statusCode = 502;
    error.code = "AI_PROVIDER_EMPTY_RESPONSE";
    throw error;
  }

  return answer.trim();
};
