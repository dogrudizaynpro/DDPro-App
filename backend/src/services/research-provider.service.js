const TAVILY_ENDPOINT = "https://api.tavily.com/search";
const DDPRO_WEBSITE_HOST = "www.ddizaynpro.com";

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
    return ["http:", "https:"].includes(url.protocol) && Boolean(url.hostname);
  } catch {
    return false;
  }
};

const isAllowedDdproWebsiteUrl = (value) => {
  if (!isValidHttpUrl(value)) return false;

  try {
    const url = new URL(value);
    return url.hostname.toLowerCase() === DDPRO_WEBSITE_HOST &&
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
  "ara", "arastir", "arastirin", "arastirma", "bul", "goster", "incele",
  "uretici", "ureticileri", "ureticilerini", "firma", "firmalari",
  "dogru", "dizayn", "ddpro", "hizmet", "hizmetleri", "sunuyor", "sunan",
  "turkiye", "turkiye'deki", "en", "az", "sonuc", "sonuclari", "her",
  "biri", "icin", "dogrudan", "kaynak", "baglanti", "baglantisi", "web", "deki",
  "internette", "lutfen", "ile", "ve", "mi", "mu", "mı", "mü",
]);

const getResearchTerms = (query) =>
  normalizeResearchText(query)
    .match(/[\p{L}\p{N}]{3,}/gu)
    ?.filter((term) => !RESEARCH_STOP_WORDS.has(term) && !term.startsWith("uretic")) || [];

const isRelevantResearchResult = (query, item, { siteOnly = false } = {}) => {
  const terms = [...new Set(getResearchTerms(query))];
  if (!terms.length) return true;

  const content = normalizeResearchText(
    `${item.title || ""} ${item.content || ""} ${item.url || ""}`,
  );
  const matchingTerms = terms.filter((term) => content.includes(term));
  return matchingTerms.length >= Math.min(siteOnly ? 1 : 2, terms.length);
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
        include_answer: true,
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

  const seenUrls = new Set();
  return payload.results
    .filter((item) =>
      item &&
      isValidHttpUrl(item.url) &&
      (!siteOnly || isAllowedDdproWebsiteUrl(item.url)) &&
      [item.title, item.content].some((value) => typeof value === "string" && value.trim()) &&
      isRelevantResearchResult(query, item, { siteOnly })
    )
    .filter((item) => {
      const canonicalUrl = getCanonicalSourceUrl(item.url);
      if (seenUrls.has(canonicalUrl)) return false;
      seenUrls.add(canonicalUrl);
      return true;
    })
    .slice(0, 10)
    .map((item) => ({
      source: typeof item.content === "string" ? item.content.slice(0, 300) : "",
      product: typeof item.title === "string" ? item.title.slice(0, 300) : "",
      manufacturer: "",
      technicalInfo: typeof item.content === "string" ? item.content.slice(0, 4_000) : "",
      price: "",
      priceVerification: "Doğrulanmadı",
      url: item.url,
      date: siteOnly ? getPageDate(item) : new Date().toISOString(),
      status: "Harici sonuç · kullanıcı doğrulaması bekliyor",
    }));
};
