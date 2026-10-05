const safeGoogleText = (value, credentials = []) => {
  if (typeof value !== "string") return "";
  let text = value;
  const secrets = [
    ...credentials,
    ...Object.entries(process.env)
      .filter(([key]) => /SECRET|TOKEN|KEY|PASSWORD/i.test(key))
      .map(([, secret]) => secret),
  ];
  for (const secret of secrets) {
    if (!secret) continue;
    for (const variant of new Set([secret, encodeURIComponent(secret)])) {
      text = text.split(variant).join("[REDACTED]");
    }
  }
  return text
    .replace(/Bearer\s+\S+/gi, "******")
    .replace(/((?:access[_-]?token|refresh[_-]?token|client[_-]?secret|authorization|api[_-]?key)\s*["']?\s*[:=]\s*["']?)[^\s"'&,;]+/gi, "$1[REDACTED]")
    .replace(/\b(?:ya29\.[\w.-]+|1\/\/[\w.-]+|GOCSPX-[\w-]+|AIza[\w-]+|eyJ[\w-]+\.[\w-]+\.[\w-]+)\b/g, "[REDACTED]")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .slice(0, 2_000);
};

export class GoogleApiError extends Error {
  constructor(httpStatus, payload, credentials = [], provider = "google") {
    const message = safeGoogleText(payload?.error?.message, credentials) ||
      `Google API request failed (HTTP ${httpStatus}).`;
    super(message);
    this.name = "GoogleApiError";
    this.statusCode = httpStatus === 401 ? 502 : httpStatus;
    this.code = httpStatus === 401 ? "GOOGLE_API_AUTH_ERROR"
      : httpStatus === 403 ? "GOOGLE_API_ACCESS_DENIED"
        : httpStatus === 429 ? "GOOGLE_API_RATE_LIMIT" : "GOOGLE_API_ERROR";
    this.provider = provider;
    this.upstreamStatus = httpStatus;
    this.expose = true;
    this.googleApiError = {
      httpStatus,
      category: httpStatus === 401 ? "authorization"
        : httpStatus === 403 ? "access_denied"
          : httpStatus === 429 ? "rate_limit" : "api_error",
      message,
      reasons: Array.isArray(payload?.error?.errors)
        ? [...new Set(payload.error.errors.slice(0, 20)
          .map((error) => safeGoogleText(error?.reason, credentials).slice(0, 128)).filter(Boolean))]
        : [],
    };
  }
}
