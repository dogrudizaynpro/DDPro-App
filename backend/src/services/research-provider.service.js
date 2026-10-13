const TAVILY_ENDPOINT = "https://api.tavily.com/search";
const DDPRO_WEBSITE_HOST = "ddizaynpro.com";

const createProviderError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.expose = true;
  return error;
};

const isValidHttpUrl = (value) => {
  if (typeof value !== "string" || !/^https?:\/\/\S+$/i.test(value)) {
    return false;
  }

  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) &&
      Boolean(url.hostname) &&
      !url.username &&
      !url.password;
  } catch {
    return false;
  }
};

const isAllowedDdproWebsiteUrl = (value) => {
  if (!isValidHttpUrl(value)) return false;

  try {
    const url = new URL(value);
    return [DDPRO_WEBSITE_HOST, `www.${DDPRO_WEBSITE_HOST}`].includes(url.hostname.toLowerCase()) &&
      !url.username &&
      !url.password &&
      (!url.port || (url.protocol === "http:" && url.port === "80") ||
        (url.protocol === "https:" && url.port === "443"));
  } catch {
    return false;
  }
};

const normalizeResearchText = (value) =>
  value.toLocaleLowerCase("tr-TR").normalize("NFD").replace(/\p{M}/gu, "").replace(/ı/g, "i");

const RESEARCH_STOP_WORDS = new Set([
  "ara", "arastir", "arastirin", "arastirma", "bul", "goster", "hangi", "incele",
  "uretici", "ureticileri", "ureticilerini", "firma", "firmalari",
  "dogru", "dizayn", "ddpro", "sunuyor", "sunan", "nelerdir", "neler", "nedir",
  "pro",
  "turkiye", "turkiye'deki", "en", "az", "sonuc", "sonuclari", "her",
  "biri", "icin", "dogrudan", "kaynak", "baglanti", "baglantisi", "web", "deki",
  "internette", "lutfen", "ile", "ve", "mi", "mu", "mı", "mü", "hakkinda",
]);

const normalizeResearchTerm = (term) => term.replace(
  /(?:lar|ler)(?:imiz|ımız|umuz|ümüz|iniz|ınız|unuz|ünüz|i|ı)?$/u,
  "",
);

const getResearchTerms = (query) =>
  normalizeResearchText(query)
    .match(/[\p{L}\p{N}]{3,}/gu)
    ?.map(normalizeResearchTerm)
    .filter((term) => term.length >= 3 && !RESEARCH_STOP_WORDS.has(term) && !term.startsWith("uretic")) || [];

const getResearchRelevance = (query, item) => {
  const terms = [...new Set(getResearchTerms(query))];
  if (!terms.length) return { relevant: false, score: 0, terms };

  const title = normalizeResearchText(item.title || "");
  const content = normalizeResearchText(item.content || "");
  const matchingTerms = terms.filter((term) =>
    title.includes(term) || content.includes(term)
  );
  const relevant = matchingTerms.length >= Math.min(2, terms.length);
  const providerScore = Number.isFinite(item.score) ? Math.max(0, Math.min(item.score, 1)) : 0;
  const score = matchingTerms.reduce((total, term) =>
    total + (title.includes(term) ? 4 : 0) +
      (content.includes(term) ? 2 : 0),
  0) + providerScore * 0.25;
  return { relevant, score, terms };
};

const getRelevantSummary = (content, terms) => {
  if (typeof content !== "string" || !content.trim()) return "";
  const sentences = content
    .split(/(?<=[.!?])\s+|\n+/u)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  const selected = sentences.filter((sentence) => {
    const normalized = normalizeResearchText(sentence);
    return terms.some((term) => normalized.includes(term));
  }).slice(0, 2);
  const summary = (selected.length ? selected : [])
    .join(" ")
    .trim();
  return summary.length > 500 ? `${summary.slice(0, 497).trimEnd()}…` : summary;
};

const getPageDate = (item) => {
  const value = item.published_date ?? item.publishedDate;
  if (typeof value !== "string" || !value.trim()) return "";
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? "" : new Date(timestamp).toISOString();
};

const getCanonicalSourceUrl = (value) => {
  const url = new URL(value);
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    if (/^(?:utm_.+|fbclid|gclid)$/i.test(key)) url.searchParams.delete(key);
  }
  url.pathname = url.pathname.replace(/\/+$/, "") || "/";
  return url.toString();
};

export const searchResearchProvider = async (query, { siteOnly = false } = {}) => {
  const apiKey = process.env.RESEARCH_API_KEY;
  if (!apiKey) {
    throw createProviderError("Web research provider is not configured.", 503);
  }

  const url = new URL(TAVILY_ENDPOINT);
  if (url.protocol !== "https:") {
    throw createProviderError("Research provider URL must use HTTPS.", 503);
  }

  const signal = AbortSignal.timeout(30_000);
  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query: siteOnly ? `site:${DDPRO_WEBSITE_HOST} ${query}` : query,
        include_answer: false,
        max_results: 10,
      }),
      signal,
    });
  } catch {
    throw createProviderError(
      signal.aborted ? "Research provider request timed out." : "Research provider request failed.",
      signal.aborted ? 504 : 502
    );
  }

  if (!response.ok) {
    throw createProviderError(`Research provider request failed (HTTP ${response.status}).`, 502);
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw createProviderError("Research provider returned an invalid response.", 502);
  }

  if (!Array.isArray(payload?.results)) {
    throw createProviderError("Research provider response must contain a results array.", 502);
  }

  const rankedResults = payload.results
    .filter((item) =>
      item &&
      isValidHttpUrl(item.url) &&
      (!siteOnly || isAllowedDdproWebsiteUrl(item.url)) &&
      [item.title, item.content].some((value) => typeof value === "string" && value.trim())
    )
    .map((item) => ({
      item,
      canonicalUrl: getCanonicalSourceUrl(item.url),
      ...getResearchRelevance(query, item),
    }))
    .filter(({ relevant }) => relevant)
    .sort((first, second) => second.score - first.score);
  const seenUrls = new Set();
  return rankedResults
    .filter(({ canonicalUrl }) => {
      if (seenUrls.has(canonicalUrl)) return false;
      seenUrls.add(canonicalUrl);
      return true;
    })
    .slice(0, 10)
    .map(({ item, terms }) => {
      const summary = getRelevantSummary(item.content, terms);
      return {
        source: summary,
        product: typeof item.title === "string" ? item.title.slice(0, 200) : "",
        manufacturer: "",
        technicalInfo: "",
        price: "",
        priceVerification: "Doğrulanmadı",
        url: item.url,
        date: getPageDate(item) || (siteOnly ? "" : new Date().toISOString()),
        status: "Harici sonuç · kullanıcı doğrulaması bekliyor",
      };
    });
};
