const API_URL = process.env.RESEARCH_API_URL;
const API_KEY = process.env.RESEARCH_API_KEY;

export const searchResearchProvider = async (query) => {
  if (!API_URL || !API_KEY) {
    const error = new Error("Web research provider is not configured.");
    error.statusCode = 503;
    throw error;
  }

  let url;
  try {
    url = new URL(API_URL);
  } catch {
    const error = new Error("RESEARCH_API_URL must be a valid HTTPS URL.");
    error.statusCode = 503;
    throw error;
  }
  if (url.protocol !== "https:" && !["localhost", "127.0.0.1", "::1"].includes(url.hostname)) {
    const error = new Error("Research provider URL must use HTTPS.");
    error.statusCode = 503;
    throw error;
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    const error = new Error(`Research provider request failed (HTTP ${response.status}).`);
    error.statusCode = 502;
    throw error;
  }

  const payload = await response.json();
  if (!Array.isArray(payload?.results)) {
    const error = new Error("Research provider response must contain a results array.");
    error.statusCode = 502;
    throw error;
  }

  return payload.results.slice(0, 30).map((item) => ({
    source: typeof item?.source === "string" ? item.source.slice(0, 300) : "",
    product: typeof item?.product === "string" ? item.product.slice(0, 300) : "",
    manufacturer: typeof item?.manufacturer === "string" ? item.manufacturer.slice(0, 300) : "",
    technicalInfo: typeof item?.technicalInfo === "string" ? item.technicalInfo.slice(0, 4_000) : "",
    price: typeof item?.price === "string" ? item.price.slice(0, 200) : "",
    priceVerification: "Doğrulanmadı",
    url: typeof item?.url === "string" && /^https?:\/\/\S+$/i.test(item.url) ? item.url : "",
    date: new Date().toISOString(),
    status: "Harici sonuç · kullanıcı doğrulaması bekliyor",
  }));
};
