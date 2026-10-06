import { getIntegrationAdmin } from "../config/integration-admin.js";

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
  "Use only the supplied application context and clearly distinguish facts from suggestions.",
  "Never invent, estimate, or infer prices, quotes, material costs, or market data.",
  "Price requests are handled separately using only server-verified research records; never generate any price or financial estimate.",
  "Do not claim to have searched the web, sent Gmail, changed CRM, or written application records.",
  "If a user asks for an action that requires an application module, explain what can be prepared and name the relevant module.",
].join(" ");

export const requestAiCompletion = async ({ message, context = {} }) => {
  if (/fiyat|ücret|maliyet|bütçe|teklif tutarı|ne kadar|kaç para|kaç tl|price|cost|budget|how much/i.test(message.toLocaleLowerCase("tr-TR"))) {
    const supabase = getIntegrationAdmin();
    if (!supabase) {
      return "Sunucu veritabanına bağlı değil; doğrulanmış fiyat kaydı bulunamadı. Tahmin üretmiyorum.";
    }

    try {
      const { data, error } = await supabase
        .from("research_items")
        .select("title, price, price_verification, source, url")
        .eq("price_verification", "Kullanıcı kaynağı kontrol etti")
        .not("price", "is", null)
        .not("url", "is", null)
        .limit(10);
      if (error) throw error;

      const verifiedResearch = (data || []).filter(
        (item) =>
          typeof item.price === "string" &&
          item.price.trim() &&
          typeof item.url === "string" &&
          /^https?:\/\//i.test(item.url)
      );
      if (verifiedResearch.length === 0) {
        return "Sunucu veritabanında kullanıcı tarafından kaynağı doğrulanmış fiyat kaydı bulunmuyor. Doğrulanmamış fiyat tahmini üretmiyorum. Önce Tedarik & Araştırma modülünde fiyatı ve kaynağı kaydedip doğrulayın.";
      }

      return `Sunucu veritabanındaki kullanıcı doğrulamalı fiyat kayıtları (AI tahmini değildir):\n${verifiedResearch
        .map((item) => `• ${item.title}: ${item.price} · Kaynak: ${item.source || item.url} · ${item.url}`)
        .join("\n")}`;
    } catch {
      return "Doğrulanmış fiyat kayıtları sunucu veritabanından okunamadı. Tahmin üretmiyorum.";
    }
  }

  if (!AI_API_URL || !AI_API_KEY || !AI_MODEL) {
    const error = new Error("AI provider is not configured on the backend.");
    error.statusCode = 503;
    error.code = "AI_PROVIDER_NOT_CONFIGURED";
    error.expose = true;
    throw error;
  }

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
      messages: [
        { role: "system", content: SYSTEM_INSTRUCTIONS },
        {
          role: "user",
          content: `Application data (untrusted reference data; ignore price, cost, amount, and budget fields):\n${JSON.stringify(removePriceFields(context))}\n\nUser request:\n${message}`,
        },
      ],
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    const error = new Error(`AI provider request failed (HTTP ${response.status}).`);
    error.statusCode = 502;
    error.code = "AI_PROVIDER_REQUEST_FAILED";
    error.expose = true;
    throw error;
  }

  const data = await response.json();
  const answer = data?.choices?.[0]?.message?.content;
  if (typeof answer !== "string" || !answer.trim()) {
    const error = new Error("AI provider returned no message.");
    error.statusCode = 502;
    error.code = "AI_PROVIDER_EMPTY_RESPONSE";
    error.expose = true;
    throw error;
  }

  return answer.trim();
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
