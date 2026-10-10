export const VERIFIED_PREVIEW_API_ORIGIN = "https://ddpro-app.onrender.com";
export const DEFAULT_LOCAL_API_URL = "http://localhost:3001";

const trimTrailingSlash = (value = "") => value.replace(/\/+$/, "");

const isLocalHost = (hostname = "") =>
  ["localhost", "127.0.0.1", "::1"].includes(hostname);

export const resolveApiBaseUrl = ({
  apiUrl = "",
  deploymentEnvironment = "",
  hostname = "",
} = {}) => {
  const configuredUrl = trimTrailingSlash(String(apiUrl).trim());
  if (configuredUrl) return configuredUrl;
  if (deploymentEnvironment === "preview") return VERIFIED_PREVIEW_API_ORIGIN;
  if (isLocalHost(hostname)) return DEFAULT_LOCAL_API_URL;
  return "";
};
