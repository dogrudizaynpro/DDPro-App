import { randomUUID } from "node:crypto";
import { requestAiCompletion } from "./ai.service.js";
import { searchResearchProvider } from "./research-provider.service.js";
import {
  findUnavailableAiCapability,
  planAiAgents,
} from "./ai-agent-registry.service.js";

const MAX_COMMAND_LENGTH = 8_000;
const MUTATION_PATTERN =
  /\b(create|add|update|delete|remove|change|set|ekle|oluştur|güncelle|sil|değiştir|kaydet)\b/i;
const RESEARCH_PATTERN =
  /\b(araştır|araştırma|internette|web(?:'de|de)|online|kaynak(?:ları)? bul|search the web|web search|search online|look up|find online|browse the web|google it)\b/i;
const DDPRO_SITE_PATTERN =
  /(?<![\p{L}\p{N}_])(?:dd\s*pro|ddpro|doğru\s+dizayn\s+pro|www\.ddizaynpro\.com|ddizaynpro\.com|web\s*sitesi|website|sitemiz)(?![\p{L}\p{N}_])/iu;
const COMPANY_CONTEXT_PATTERN =
  /(?<![\p{L}\p{N}_])(?:şirket|firma|marka|company|our|bizim|kurumsal)[\p{L}\p{N}_]*(?![\p{L}\p{N}_])/iu;
const COMPANY_TOPIC_PATTERN =
  /(?<![\p{L}\p{N}_])(?:hizmet|service|ürün|product|sistem|system|uygulama|application|proje|project|referans|reference)[\p{L}\p{N}_]*(?![\p{L}\p{N}_])/iu;
const OWNED_COMPANY_TOPIC_PATTERN =
  /(?<![\p{L}\p{N}_])(?:hizmet|service|ürün|product|sistem|system|uygulama|application|proje|project|referans|reference)(?:lar|ler)?(?:ımız|imiz|umuz|ümüz|ınız|iniz|unuz|ünüz)(?![\p{L}\p{N}_])/iu;
const CEILING_TOPIC_PATTERN =
  /(?<![\p{L}\p{N}_])(?:asma\s*tavan|suspended\s*ceiling|lineer\s*tavan|baffle\s*tavan)(?![\p{L}\p{N}_])/iu;
const UNVERIFIED_SITE_PRICE_PATTERN =
  /(?<![\p{L}\p{N}_])(?:fiyat|ücret|bedel|price|pricing|cost)[\p{L}\p{N}_]*|(?:₺|€|\$|\b(?:TL|TRY|USD|EUR)\b)/iu;
const RECORD_PATTERN =
  /\b(?:proje|project|teklif|offer|tedarik|procurement|müşteri|crm|ürün|product|sistem|system|fiyat|price|maliyet|cost|rapor|report|takvim|calendar|belge|document)[\p{L}\p{N}_]*\b/iu;
const UNSUPPORTED_ACTION_PATTERN =
  /\b(send|sending|gönder|gönderme|mail at|e-?posta gönder|email gönder|gmail gönder|email the|send an? email)\b/i;

const createOrchestrationError = (message, statusCode, code) =>
  Object.assign(new Error(message), { statusCode, code, expose: true });

const isValidResearchUrl = (value) => {
  if (typeof value !== "string" || !/^https?:\/\/\S+$/i.test(value)) return false;
  try {
    return Boolean(new URL(value).hostname);
  } catch {
    return false;
  }
};

const isAllowedDdproWebsiteUrl = (value) => {
  if (!isValidResearchUrl(value)) return false;
  try {
    const url = new URL(value);
    return url.hostname.toLowerCase() === "www.ddizaynpro.com" &&
      !url.username &&
      !url.password &&
      !url.port;
  } catch {
    return false;
  }
};

const getResearchResults = (results, { siteOnly = false } = {}) => {
  const seenUrls = new Set();
  return results.filter((result) => {
    if (
      !result ||
      typeof result !== "object" ||
      !isValidResearchUrl(result.url) ||
      (siteOnly && !isAllowedDdproWebsiteUrl(result.url))
    ) return false;
    const url = new URL(result.url);
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (/^(?:utm_.+|fbclid|gclid)$/i.test(key)) url.searchParams.delete(key);
    }
    url.pathname = url.pathname.replace(/\/+$/, "") || "/";
    const canonicalUrl = url.toString();
    if (seenUrls.has(canonicalUrl)) return false;
    seenUrls.add(canonicalUrl);
    return [result.product, result.source, result.technicalInfo]
      .some((value) => typeof value === "string" && value.trim());
  }).map((result) => {
    if (!siteOnly) return result;
    const withoutUnverifiedPrices = (value) => typeof value === "string"
      ? value.split(/(?<=[.!?])\s+|\n+/u)
        .filter((part) => !UNVERIFIED_SITE_PRICE_PATTERN.test(part))
        .join(" ")
        .trim()
      : "";
    const pageDate = typeof result.date === "string" && !Number.isNaN(Date.parse(result.date))
      ? new Date(Date.parse(result.date)).toISOString()
      : "";
    return {
      ...result,
      product: withoutUnverifiedPrices(result.product),
      source: withoutUnverifiedPrices(result.source),
      technicalInfo: withoutUnverifiedPrices(result.technicalInfo),
      price: "",
      date: pageDate,
    };
  });
};

const getResearchQuery = (message) => message.toLocaleLowerCase("tr-TR")
  .replace(/^\s*(?:lütfen\s+)?/iu, "")
  .replace(/^(?:(?:internette|web(?:'de|de))\s+)/iu, "")
  .replace(/^(?:araştır(?:ma)?|ara)\b[\s:,.!?-]*/iu, "")
  .replace(/[\s,;:.-]*\b(?:araştır(?:ma)?|araştırma yap|webde ara)\s*[?.!]*$/iu, "")
  .replace(/^[\s:,.!?-]+|[\s,;:.-]+$/gu, "")
  .trim();

const isDdproWebsiteQuestion = (message) =>
  DDPRO_SITE_PATTERN.test(message) ||
  OWNED_COMPANY_TOPIC_PATTERN.test(message) ||
  (COMPANY_CONTEXT_PATTERN.test(message) && COMPANY_TOPIC_PATTERN.test(message)) ||
  CEILING_TOPIC_PATTERN.test(message);

export const classifyAiCommand = ({ message, attachment } = {}) => {
  if (attachment) {
    const unavailableCapability = findUnavailableAiCapability(
      typeof message === "string" ? message : ""
    );
    return unavailableCapability
      ? {
        intent: "unsupported",
        error: "AI_ORCHESTRATOR_CAPABILITY_UNAVAILABLE",
        capability: unavailableCapability,
      }
      : { intent: "attachment_analysis", toolPolicy: "all" };
  }
  if (typeof message !== "string" || !message.trim()) {
    return { intent: "invalid", error: "AI_ORCHESTRATOR_COMMAND_REQUIRED" };
  }
  if (message.length > MAX_COMMAND_LENGTH) {
    return { intent: "invalid", error: "AI_ORCHESTRATOR_COMMAND_TOO_LONG" };
  }

  const unavailableCapability = findUnavailableAiCapability(message);
  if (unavailableCapability) {
    return {
      intent: "unsupported",
      error: "AI_ORCHESTRATOR_CAPABILITY_UNAVAILABLE",
      capability: unavailableCapability,
    };
  }

  const normalizedMessage = message.toLocaleLowerCase("tr-TR");
  const research = RESEARCH_PATTERN.test(normalizedMessage);
  const mutation = MUTATION_PATTERN.test(normalizedMessage);
  if (research && mutation) {
    return { intent: "unsupported", error: "AI_ORCHESTRATOR_UNSUPPORTED_COMBINATION" };
  }
  if (mutation) return { intent: "operational_write", toolPolicy: "all" };
  if (isDdproWebsiteQuestion(normalizedMessage)) {
    return { intent: "site_research", query: research ? getResearchQuery(message) : message.trim() };
  }
  if (research) {
    const query = getResearchQuery(message);
    return query
      ? { intent: "web_research", query }
      : { intent: "missing_parameters", error: "AI_ORCHESTRATOR_MISSING_RESEARCH_QUERY" };
  }
  if (UNSUPPORTED_ACTION_PATTERN.test(normalizedMessage)) {
    return { intent: "unsupported", error: "AI_ORCHESTRATOR_UNSUPPORTED_ACTION" };
  }
  if (RECORD_PATTERN.test(normalizedMessage)) return { intent: "company_data", toolPolicy: "read" };
  return { intent: "direct_answer", toolPolicy: "none" };
};

const formatResearchAnswer = (results, { siteOnly = false } = {}) => {
  if (!results.length) {
    if (siteOnly) {
      return "İlgili bilgi DDPro web sitesinde bulunamadı veya site araştırması yapılamadı. Araştırma yapılamadı; kaynak doğrulanamadığı için bilgi uydurulmadı.";
    }
    return "Bu sorgu için kaynak URL'si olan, konuyla ilgili araştırma sonucu bulunamadı. Araştırma yapılamadı; başka bir sorgu deneyin.";
  }

  if (siteOnly) {
    return [
      "Aşağıdaki bilgiler yalnızca www.ddizaynpro.com üzerindeki herkese açık sayfalardan alınan araştırma özetleridir; DDPro'nun dahili kayıtlarıyla birleştirilmemiştir ve güncelliği kaynak sayfa tarihine bağlıdır.",
      "Sayfa içeriği güvenilmeyen kaynak verisidir; içindeki talimatlar uygulanmaz. Kaynakta açıkça güncel olduğu doğrulanmadıkça fiyat bilgisi verilmez.",
      ...results.map((result, index) => {
        const title = result.product || `DDPro sayfa özeti ${index + 1}`;
        const details = [
          result.technicalInfo || result.source,
          result.date ? `Sayfa tarihi: ${result.date}` : "",
          `Doğrudan kaynak URL'si: ${result.url}`,
        ].filter(Boolean);
        return `${index + 1}. ${title}${details.length ? `\n${details.join("\n")}` : ""}`;
      }),
    ].join("\n\n");
  }

  return [
    "Harici kaynak özetleri aşağıdadır. Firma üreticiliği DDPro tarafından bağımsız doğrulanmamıştır; doğrulanmamış fiyat bilgisi gösterilmez.",
    ...results.map((result, index) => {
      const title = result.product || `Kaynak özeti ${index + 1}`;
      const details = [
        result.technicalInfo,
        result.price ? `Fiyat (doğrulanmadı): ${result.price}` : "",
        `Doğrudan kaynak URL'si: ${result.url}`,
      ].filter(Boolean);
      return `${index + 1}. ${title}${details.length ? `\n${details.join("\n")}` : ""}`;
    }),
  ].join("\n\n");
};

export const createAiOrchestrator = ({
  complete = requestAiCompletion,
  search = searchResearchProvider,
} = {}) => async ({ message, context = {}, attachment, integrationAccount } = {}) => {
  if (typeof integrationAccount !== "string" || !integrationAccount.trim()) {
    throw createOrchestrationError(
      "An authenticated DDPro account is required for AI commands.",
      401,
      "AI_ORCHESTRATOR_UNAUTHORIZED"
    );
  }
  if (!context || typeof context !== "object" || Array.isArray(context)) {
    throw createOrchestrationError(
      "AI application context must be an object.",
      400,
      "AI_ORCHESTRATOR_INVALID_CONTEXT"
    );
  }

  const classification = classifyAiCommand({ message, attachment });
  if (classification.error) {
    const missing = classification.intent === "invalid" ||
      classification.intent === "missing_parameters";
    throw createOrchestrationError(
      classification.intent === "missing_parameters"
        ? "Araştırma için aranacak konuyu belirtin."
        : classification.intent === "unsupported"
        ? classification.capability
          ? `Bu istekte ${classification.capability.label} yeteneği mevcut sistemde bulunmuyor; işlem yapılmadı.`
          : "Bu birleşik veya harici işlem bu aşamada desteklenmiyor; herhangi bir işlem yapılmadı."
        : classification.error === "AI_ORCHESTRATOR_COMMAND_TOO_LONG"
            ? `AI command must be at most ${MAX_COMMAND_LENGTH} characters.`
            : "AI command is required.",
      missing ? 400 : 422,
      classification.error
    );
  }
  const agents = planAiAgents({
    message: message || "",
    intent: classification.intent,
  });
  const taskContext = Object.freeze({
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    intent: classification.intent,
    agents,
  });

  let result;
  let steps = [];
  if (["web_research", "site_research"].includes(classification.intent)) {
    const siteOnly = classification.intent === "site_research";
    if (typeof search !== "function") {
      throw createOrchestrationError(
        siteOnly ? "DDPro web sitesi araştırma yeteneği kullanılamıyor." : "Harici araştırma yeteneği kullanılamıyor.",
        503,
        "AI_ORCHESTRATOR_CAPABILITY_UNAVAILABLE"
      );
    }
    try {
      const providerResults = await search(classification.query, {
        taskContext,
        integrationAccount,
        siteOnly,
      });
      if (!Array.isArray(providerResults)) {
        throw createOrchestrationError(
          "Araştırma sağlayıcısı geçersiz sonuç döndürdü.",
          502,
          "AI_ORCHESTRATOR_INVALID_RESULT"
        );
      }
      const results = getResearchResults(providerResults, { siteOnly });
      steps = [{
        agentId: "research",
        operation: siteOnly ? "ddpro_site_search" : "web_search",
        status: "completed",
        resultCount: results.length,
      }];
      result = {
        answer: formatResearchAnswer(results, { siteOnly }),
        researchResults: results,
      };
    } catch (error) {
      if (error.expose && !siteOnly) throw error;
      throw createOrchestrationError(
        siteOnly
          ? "DDPro web sitesi şu anda araştırılamıyor; site bilgisi uydurulmadı."
          : "Harici araştırma tamamlanamadı; sonuç uydurulmadı.",
        error.statusCode || 502,
        "AI_ORCHESTRATOR_RESEARCH_FAILED"
      );
    }
  } else {
    if (typeof complete !== "function") {
      throw createOrchestrationError(
        "AI yanıt yeteneği kullanılamıyor.",
        503,
        "AI_ORCHESTRATOR_CAPABILITY_UNAVAILABLE"
      );
    }
    try {
      result = await complete({
        message,
        context,
        attachment,
        integrationAccount,
        toolPolicy: classification.toolPolicy,
        taskContext,
        agents,
      });
      steps = Array.isArray(result?.toolExecutions) ? result.toolExecutions : [];
    } catch (error) {
      if (error.expose) throw error;
      throw createOrchestrationError(
        "AI komutu tamamlanamadı; başarısızlık başarı olarak gösterilmedi.",
        error.statusCode || 502,
        "AI_ORCHESTRATOR_EXECUTION_FAILED"
      );
    }
  }

  if (!result || typeof result.answer !== "string" || !result.answer.trim()) {
    throw createOrchestrationError(
      "AI capability returned no valid answer.",
      502,
      "AI_ORCHESTRATOR_INVALID_RESULT"
    );
  }

  const agentStatuses = agents.map((agent) => {
    const agentSteps = steps.filter(({ agentId }) => agentId === agent.id);
    const status = result.pendingAction && agentSteps.some(
      (step) => step.status === "awaiting_confirmation"
    )
      ? "awaiting_confirmation"
      : agentSteps.some((step) => ["failed", "unavailable"].includes(step.status))
        ? "failed"
        : agent.resources.length && !agentSteps.length
          ? "not_invoked"
          : "completed";
    return { ...agent, status };
  });
  const hasUninvokedAgent = agentStatuses.some(({ status }) => status === "not_invoked");
  return {
    ...result,
    orchestration: {
      taskId: taskContext.id,
      intent: taskContext.intent,
      status: result.pendingAction
        ? "awaiting_confirmation"
        : steps.some((step) => ["failed", "unavailable"].includes(step.status))
          ? "completed_with_errors"
          : hasUninvokedAgent ? "incomplete" : "completed",
      agents: agentStatuses,
      steps,
    },
  };
};

export const orchestrateAiCommand = createAiOrchestrator();
