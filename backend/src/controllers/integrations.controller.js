import { getIntegrationAdmin, hasIntegrationAdmin } from "../config/integration-admin.js";
import { getSupabaseClient, isSupabaseAvailable } from "../config/supabase.js";
import {
  getGoogleConfigurationStatus,
  getGoogleSessionAccount,
} from "../services/google-integration.service.js";
import { websiteCmsConfigured } from "../services/website-cms.service.js";
import { getIntegrationTestResult, testIntegrationConnection } from "../services/integration-health.service.js";

export const getIntegrationStatus = async (req, res, next) => {
 try {
  const aiConfigured = Boolean(
    process.env.AI_API_URL && process.env.AI_API_KEY && process.env.AI_MODEL
  );
  const google = await getGoogleConfigurationStatus();
  const databaseConfigured = hasIntegrationAdmin();
  const whatsappConfigured = Boolean(
    process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID
  );
  const whatsappWebhookConfigured = Boolean(
    process.env.WHATSAPP_APP_SECRET && process.env.WHATSAPP_VERIFY_TOKEN
  );
  const websiteWebhookConfigured = Boolean(process.env.WEBSITE_WEBHOOK_SECRET);
  const cmsConfigured = websiteCmsConfigured();
  const websiteConfigured = cmsConfigured && websiteWebhookConfigured && databaseConfigured;
  let supabaseConnected = false;
  let crmStorageConnected = false;
  if (isSupabaseAvailable()) {
    const { error } = await getSupabaseClient().from("projects").select("id").limit(1);
    supabaseConnected = !error;
  }
  if (databaseConfigured) {
    const admin = getIntegrationAdmin();
    const [{ error: crmError }, { error: tokenError }] = await Promise.all([
      admin.from("crm_contacts").select("id").limit(1),
      admin.from("integration_tokens").select("provider").limit(1),
    ]);
    crmStorageConnected = !crmError && !tokenError;
  }
  const googleConfigured = google.configured && crmStorageConnected;
  const googleOAuthAvailable =
    googleConfigured &&
    Boolean(process.env.INTEGRATION_SESSION_SECRET) &&
    (process.env.GOOGLE_ALLOWED_EMAILS || "").split(",").some((email) => email.trim());
  const googleConnected = googleConfigured && google.connected && Boolean(getGoogleSessionAccount(req));
  const last = (provider) => getIntegrationTestResult(provider);
  const statusAfterTest = (provider, configured, connected = false) => {
    const result = last(provider);
    const testIsFresh =
      result && Date.now() - Date.parse(result.testedAt) < 5 * 60 * 1000;
    if (!configured) return { connected: false, status: "credentials_required", lastTest: result };
    if (connected && result && !result.connected && testIsFresh) {
      return { connected: false, status: "test_failed", lastTest: result };
    }
    if (connected) return { connected: true, status: "connected", lastTest: result };
    if (result?.connected && testIsFresh && !["gmail", "googleCalendar", "crm"].includes(provider)) {
      return { connected: true, status: "connected", lastTest: result };
    }
    return {
      connected: false,
      status: result && !result.connected ? "test_failed" : "configured_not_tested",
      lastTest: result,
    };
  };
  const appleConfigured = Boolean(
    process.env.APPLE_ISSUER_ID &&
    process.env.APPLE_KEY_ID &&
    process.env.APPLE_PRIVATE_KEY
  );
  const supabaseConfigured = Boolean(
    process.env.SUPABASE_URL &&
    process.env.SUPABASE_ANON_KEY &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  res.status(200).json({
    status: "success",
    data: {
      ai: {
        configured: aiConfigured,
        ...statusAfterTest("ai", aiConfigured),
      },
      gmail: {
        configured: googleConfigured,
        oauthFlowAvailable: googleOAuthAvailable,
        ...statusAfterTest("gmail", googleConfigured, googleConnected),
      },
      googleCalendar: {
        configured: googleConfigured,
        oauthFlowAvailable: googleOAuthAvailable,
        ...statusAfterTest("googleCalendar", googleConfigured, googleConnected),
      },
      whatsapp: {
        configured: whatsappConfigured && whatsappWebhookConfigured,
        sendConfigured: whatsappConfigured,
        webhookConfigured: whatsappWebhookConfigured,
        ...statusAfterTest("whatsapp", whatsappConfigured),
      },
      research: {
        configured: Boolean(process.env.RESEARCH_API_URL && process.env.RESEARCH_API_KEY),
        ...statusAfterTest("research", Boolean(process.env.RESEARCH_API_URL && process.env.RESEARCH_API_KEY)),
      },
      google: {
        configured: googleConfigured,
        oauthFlowAvailable: googleOAuthAvailable,
        ...statusAfterTest("google", googleConfigured, googleConnected),
      },
      supabase: {
        configured: supabaseConfigured && crmStorageConnected,
        connected: supabaseConnected && crmStorageConnected,
        integrationStorageConfigured: databaseConfigured,
        integrationStorageConnected: crmStorageConnected,
      },
      crm: {
        configured: crmStorageConnected,
        ...statusAfterTest("crm", crmStorageConnected, crmStorageConnected && googleConnected),
      },
      web: {
        url: "https://www.ddizaynpro.com/",
        managementConfigured: cmsConfigured,
        inboundLeadConfigured: websiteWebhookConfigured && databaseConfigured,
        ...statusAfterTest("website", websiteConfigured),
      },
      appStore: {
        configured: appleConfigured,
        ...statusAfterTest("appStore", appleConfigured),
        requiredEnvironment: ["APPLE_ISSUER_ID", "APPLE_KEY_ID", "APPLE_PRIVATE_KEY"],
      },
    },
  });
 } catch(error) {
   return next(error);
 }
};

export const postIntegrationTest = async (req, res, next) => {
  const provider = req.params.provider;
  const account = ["gmail", "googleCalendar"].includes(provider)
    ? req.integrationAccount
    : "";
  try {
    const result = await testIntegrationConnection(provider, account);
    return res.status(200).json({
      status: "success",
      data: { provider, ...result },
    });
  } catch (error) {
    if (error.expose) {
      return res.status(error.statusCode || 502).json({
        status: "error",
        message: error.message,
        data: { provider, connected: false },
      });
    }
    return next(error);
  }
};
