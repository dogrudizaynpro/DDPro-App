import { createSign } from "node:crypto";
import { getIntegrationAdmin } from "../config/integration-admin.js";
import { requestAiCompletion } from "./ai.service.js";
import { requestWebsiteCms } from "./website-cms.service.js";
import { testGoogleWorkspaceConnection } from "./google-workspace.service.js";
import { searchResearchProvider } from "./research-provider.service.js";
import { testWhatsAppConnection } from "./whatsapp.service.js";

const recentTests = new Map();
const testResultLifetime = 5 * 60 * 1000;

const resultKey = (provider, account) =>
  ["gmail", "googleCalendar"].includes(provider) ? `${provider}:${account}` : provider;

export const getIntegrationTestResult = (provider, account = "") =>
  recentTests.get(resultKey(provider, account)) || null;

export const getIntegrationHealthStatus = ({
  configured,
  result,
  requiresSession = false,
  sessionReady = false,
  now = Date.now(),
}) => {
  if (!configured) return "credentials_required";
  const testedAt = Date.parse(result?.testedAt || "");
  const testAge = now - testedAt;
  const fresh = Number.isFinite(testedAt) && testAge >= 0 && testAge < testResultLifetime;
  if (fresh && result.connected) return "connected";
  if (fresh && !result.connected) {
    if (result.googleApiError?.operation === "oauth.token.refresh") {
      return result.googleApiError.category === "connection_invalid"
        ? "authorization_required"
        : "token_refresh_failed";
    }
    if (result.googleApiError?.category === "access_denied") {
      const reasons = result.googleApiError.reasons || [];
      return reasons.some((reason) => /insufficientPermissions|insufficient_scope|accessNotConfigured/i.test(reason))
        ? "permission_required"
        : "request_rejected";
    }
    if (result.googleApiError?.category === "authorization") return "request_rejected";
    if (["GOOGLE_CONNECTION_REQUIRED", "BROWSER_SESSION_REQUIRED"].includes(result.code)) {
      return "authorization_required";
    }
    if ([502, 503, 504].includes(result.statusCode)) return "service_unavailable";
    if (result.statusCode === 401) return "authorization_required";
    if ([400, 403].includes(result.statusCode)) return "request_rejected";
    return "test_failed";
  }
  if (requiresSession && !sessionReady) return "authorization_required";
  return "configured_not_tested";
};

const recordResult = (provider, account, result) => {
  const value = { ...result, testedAt: new Date().toISOString() };
  recentTests.set(resultKey(provider, account), value);
  return value;
};

const createAppleToken = () => {
  const issuer = process.env.APPLE_ISSUER_ID;
  const keyId = process.env.APPLE_KEY_ID;
  const privateKey = process.env.APPLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!issuer || !keyId || !privateKey) {
    throw Object.assign(new Error("Apple App Store Connect credentials are not configured."), {
      statusCode: 503,
      expose: true,
    });
  }
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const unsigned = `${encode({ alg: "ES256", kid: keyId, typ: "JWT" })}.${encode({
    iss: issuer,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 300,
    aud: "appstoreconnect-v1",
  })}`;
  const signer = createSign("SHA256");
  signer.update(unsigned);
  signer.end();
  const signature = signer.sign({ key: privateKey, dsaEncoding: "ieee-p1363" }).toString("base64url");
  return `${unsigned}.${signature}`;
};

const testApple = async () => {
  const token = createAppleToken();
  const response = await fetch("https://api.appstoreconnect.apple.com/v1/apps?limit=1", {
    headers: { Authorization: ["Bearer", token].join(" ") },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw Object.assign(new Error(`App Store Connect connection test failed (HTTP ${response.status}).`), {
      statusCode: 502,
      expose: true,
    });
  }
  await response.json();
};

const testCrmAndSupabase = async (provider) => {
  const admin = getIntegrationAdmin();
  if (!admin) {
    throw Object.assign(new Error("Supabase service-role credentials are required for core data and integrations."), {
      statusCode: 503,
      expose: true,
    });
  }
  const coreTables = [
    ["projects", "id"],
    ["offers", "id"],
    ["research_items", "id"],
  ];
  const checks = [
    ...(
      provider === "supabase"
        ? coreTables.map(([table, column]) =>
            admin.from(table).select(column, { head: true }).limit(1)
          )
        : [admin.from("projects").select("id", { head: true }).limit(1)]
    ),
    admin.from("crm_contacts").select("id", { head: true }).limit(1),
    admin.from("integration_tokens").select("provider", { head: true }).limit(1),
  ];
  const results = await Promise.all(checks);
  const coreResultCount = provider === "supabase" ? coreTables.length : 1;
  if (results.slice(0, coreResultCount).some(({ error }) => error)) {
    throw Object.assign(new Error("Supabase core data tables are unavailable; apply the core data migrations."), { statusCode: 503, expose: true });
  }
  const [{ error: crmError }, { error: tokenError }] = results.slice(coreResultCount);
  if (crmError) throw Object.assign(new Error("CRM storage is unavailable; apply the operations integration migration."), { statusCode: 503, expose: true });
  if (tokenError) throw Object.assign(new Error("Secure OAuth token storage is unavailable; apply the operations integration migration."), { statusCode: 503, expose: true });
};

const tests = {
  ai: async () => {
    await requestAiCompletion({
      message: "Connection check. Reply with one short word.",
      context: {},
    });
  },
  gmail: async (_account) => testGoogleWorkspaceConnection(_account, "gmail"),
  googleCalendar: async (_account) => testGoogleWorkspaceConnection(_account, "calendar"),
  whatsapp: testWhatsAppConnection,
  crm: async () => testCrmAndSupabase("crm"),
  website: async () => {
    await requestWebsiteCms({ method: "GET", contentType: "pages" });
  },
  appStore: testApple,
  supabase: async () => testCrmAndSupabase("supabase"),
  research: async () => {
    await searchResearchProvider("DDPro integration connection test");
  },
};

export const testIntegrationConnection = async (provider, account = "") => {
  const test = tests[provider];
  if (!test) {
    throw Object.assign(new Error("Unknown integration provider."), {
      statusCode: 404,
      expose: true,
    });
  }
  try {
    await test(account);
    return recordResult(provider, account, { connected: true, testSucceeded: true, error: "" });
  } catch (error) {
    recordResult(provider, account, {
      connected: false,
      testSucceeded: false,
      error: error.expose ? error.message : "Provider connection test failed.",
      ...(error.code && { code: error.code }),
      ...(error.statusCode && { statusCode: error.statusCode }),
      ...(error.googleApiError && { googleApiError: error.googleApiError }),
    });
    throw error;
  }
};
