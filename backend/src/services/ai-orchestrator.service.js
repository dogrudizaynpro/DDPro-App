import { randomUUID } from "node:crypto";
import { requestAiCompletion } from "./ai.service.js";
import { searchResearchProvider } from "./research-provider.service.js";

const MAX_COMMAND_LENGTH = 8_000;
const MUTATION_PATTERN =
  /\b(create|add|update|delete|remove|change|set|ekle|oluştur|güncelle|sil|değiştir|kaydet)\b/i;
const RESEARCH_PATTERN =
  /\b(araştır|araştırma|internette|web(?:'de|de)|online|kaynak(?:ları)? bul|search the web|web search|search online|look up|find online|browse the web|google it)\b/i;
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

const getResearchResults = (results) => {
  const seenUrls = new Set();
  return results.filter((result) => {
    if (!result || typeof result !== "object" || !isValidResearchUrl(result.url)) return false;
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
  });
};

const getResearchQuery = (message) => message.toLocaleLowerCase("tr-TR")
  .replace(/^\s*(?:lütfen\s+)?/iu, "")
  .replace(/^(?:(?:internette|web(?:'de|de))\s+)/iu, "")
  .replace(/^(?:araştır(?:ma)?|ara)\b[\s:,.!?-]*/iu, "")
  .replace(/[\s,;:.-]*\b(?:araştır(?:ma)?|araştırma yap|webde ara)\s*[?.!]*$/iu, "")
  .replace(/^[\s:,.!?-]+|[\s,;:.-]+$/gu, "")
  .trim();

export const classifyAiCommand = ({ message, attachment } = {}) => {
  if (attachment) return { intent: "attachment_analysis", toolPolicy: "all" };
  if (typeof message !== "string" || !message.trim()) {
    return { intent: "invalid", error: "AI_ORCHESTRATOR_COMMAND_REQUIRED" };
  }
  if (message.length > MAX_COMMAND_LENGTH) {
    return { intent: "invalid", error: "AI_ORCHESTRATOR_COMMAND_TOO_LONG" };
  }

  const normalizedMessage = message.toLocaleLowerCase("tr-TR");
  const research = RESEARCH_PATTERN.test(normalizedMessage);
  const mutation = MUTATION_PATTERN.test(normalizedMessage);
  if (research && mutation) {
    return { intent: "unsupported", error: "AI_ORCHESTRATOR_UNSUPPORTED_COMBINATION" };
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
  if (mutation) return { intent: "operational_write", toolPolicy: "all" };
  if (RECORD_PATTERN.test(normalizedMessage)) return { intent: "company_data", toolPolicy: "read" };
  return { intent: "direct_answer", toolPolicy: "none" };
};

const formatResearchAnswer = (results) => {
  if (!results.length) {
    return "Bu sorgu için kaynak URL'si olan, konuyla ilgili araştırma sonucu bulunamadı. Araştırma yapılamadı; başka bir sorgu deneyin.";
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
          ? "Bu birleşik veya harici işlem bu aşamada desteklenmiyor; herhangi bir işlem yapılmadı."
          : classification.error === "AI_ORCHESTRATOR_COMMAND_TOO_LONG"
            ? `AI command must be at most ${MAX_COMMAND_LENGTH} characters.`
            : "AI command is required.",
      missing ? 400 : 422,
      classification.error
    );
  }
  const taskContext = Object.freeze({
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    intent: classification.intent,
  });

  let result;
  if (classification.intent === "web_research") {
    if (typeof search !== "function") {
      throw createOrchestrationError(
        "Harici araştırma yeteneği kullanılamıyor.",
        503,
        "AI_ORCHESTRATOR_CAPABILITY_UNAVAILABLE"
      );
    }
    try {
      const providerResults = await search(classification.query, {
        taskContext,
        integrationAccount,
      });
      if (!Array.isArray(providerResults)) {
        throw createOrchestrationError(
          "Araştırma sağlayıcısı geçersiz sonuç döndürdü.",
          502,
          "AI_ORCHESTRATOR_INVALID_RESULT"
        );
      }
      const results = getResearchResults(providerResults);
      result = {
        answer: formatResearchAnswer(results),
        researchResults: results,
      };
    } catch (error) {
      if (error.expose) throw error;
      throw createOrchestrationError(
        "Harici araştırma tamamlanamadı; sonuç uydurulmadı.",
        502,
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
      });
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

  return {
    ...result,
    orchestration: {
      taskId: taskContext.id,
      intent: taskContext.intent,
      status: "completed",
    },
  };
};

export const orchestrateAiCommand = createAiOrchestrator();
