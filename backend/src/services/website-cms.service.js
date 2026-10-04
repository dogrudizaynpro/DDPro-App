const allowedContentTypes = new Set(["pages", "products", "references"]);

const getProviderConfig = () => {
  const endpoint = process.env.WEBSITE_CMS_API_URL;
  const token = process.env.WEBSITE_CMS_API_TOKEN;
  if (!endpoint || !token) return null;
  let url;
  try {
    url = new URL(endpoint);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && !["localhost", "127.0.0.1", "::1"].includes(url.hostname)) {
    return null;
  }
  return { url: url.toString().replace(/\/+$/, ""), token };
};

export const websiteCmsConfigured = () => Boolean(getProviderConfig());

export const requestWebsiteCms = async ({ method, contentType, id, body }) => {
  const config = getProviderConfig();
  if (!config) {
    throw Object.assign(new Error("Website CMS provider is not configured."), {
      statusCode: 503,
      expose: true,
    });
  }
  if (!allowedContentTypes.has(contentType)) {
    throw Object.assign(new Error("Unsupported website content type."), {
      statusCode: 400,
      expose: true,
    });
  }
  const path = new URL(`${contentType}${id ? `/${encodeURIComponent(id)}` : ""}`, `${config.url}/`);
  const response = await fetch(path, {
    method,
    headers: {
      Authorization: "Bearer " + config.token,
      "Content-Type": "application/json",
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw Object.assign(new Error(`Website CMS request failed (HTTP ${response.status}).`), {
      statusCode: 502,
      expose: true,
    });
  }
  return response.status === 204 ? null : response.json();
};
