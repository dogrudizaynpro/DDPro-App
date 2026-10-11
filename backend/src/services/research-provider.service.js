const TAVILY_ENDPOINT = "https://api.tavily.com/search";

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

export const searchResearchProvider = async (query) => {
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
        query,
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

  return payload.results
    .slice(0, 10)
    .filter((item) => isValidHttpUrl(item?.url))
    .map((item) => ({
      source: typeof item?.content === "string" ? item.content.slice(0, 300) : "",
      product: typeof item?.title === "string" ? item.title.slice(0, 300) : "",
      manufacturer: "",
      technicalInfo: typeof item?.content === "string" ? item.content.slice(0, 4_000) : "",
      price: "",
      priceVerification: "Doğrulanmadı",
      url: item.url,
      date: new Date().toISOString(),
      status: "Harici sonuç · kullanıcı doğrulaması bekliyor",
    }));
};
