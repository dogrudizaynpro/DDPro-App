import { createSign } from "node:crypto";
import { getIntegrationAdmin } from "../config/integration-admin.js";
import { requestAiCompletion } from "./ai.service.js";
import { requestWebsiteCms } from "./website-cms.service.js";
import { testGoogleWorkspaceConnection } from "./google-workspace.service.js";
import { searchResearchProvider } from "./research-provider.service.js";

const recentTests = new Map();

export const getIntegrationTestResult = (provider) => recentTests.get(provider) || null;

const recordResult = (provider, result) => {
  const value = { ...result, testedAt: new Date().toISOString() };
  recentTests.set(provider, value);
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

const testWhatsApp = async () => {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const version = process.env.WHATSAPP_API_VERSION || "v23.0";
  if (!accessToken || !phoneNumberId || !/^v\d+\.\d+$/.test(version)) {
    throw Object.assign(new Error("WhatsApp Cloud API credentials are not configured."), {
      statusCode: 503,
      expose: true,
    });
  }
  const endpoint = new URL(`https://graph.facebook.com/${version}/${encodeURIComponent(phoneNumberId)}`);
  endpoint.searchParams.set("fields", "id,display_phone_number");
  const response = await fetch(endpoint, {
    headers: { Authorization: ["Bearer", accessToken].join(" ") },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw Object.assign(new Error(`WhatsApp Cloud API connection test failed (HTTP ${response.status}).`), {
      statusCode: 502,
      expose: true,
    });
  }
  await response.json();
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
  const [{ error: projectsError }, { error: crmError }, { error: tokenError }] = await Promise.all([
    admin.from("projects").select("id").limit(1),
    admin.from("crm_contacts").select("id").limit(1),
    admin.from("integration_tokens").select("provider").limit(1),
  ]);
  if (projectsError) throw Object.assign(new Error("Supabase core data tables are unavailable; apply the core data migrations."), { statusCode: 503, expose: true });
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
  whatsapp: testWhatsApp,
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
    return recordResult(provider, { connected: true, error: "" });
  } catch (error) {
    recordResult(provider, {
      connected: false,
      error: error.expose ? error.message : "Provider connection test failed.",
    });
    throw error;
  }
};
