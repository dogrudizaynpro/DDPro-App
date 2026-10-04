import { getIntegrationAdmin, hasIntegrationAdmin } from "../config/integration-admin.js";
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
  const googleAccount = getGoogleSessionAccount(req);
  const google = await getGoogleConfigurationStatus(googleAccount);
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
  let coreDataConnected = false;
  let crmStorageConnected = false;
  if (databaseConfigured) {
    const admin = getIntegrationAdmin();
    const coreTables = [
      ["projects", "id"],
      ["offers", "id"],
      ["research_items", "id"],
    ];
    const [coreResults, { error: crmError }, { error: tokenError }] = await Promise.all([
      Promise.all(
        coreTables.map(([table, column]) =>
          admin.from(table).select(column, { head: true }).limit(1)
        )
      ),
      admin.from("crm_contacts").select("id", { head: true }).limit(1),
      admin.from("integration_tokens").select("provider", { head: true }).limit(1),
    ]);
    coreDataConnected = coreResults.every(({ error }) => !error);
    crmStorageConnected = !crmError && !tokenError;
  }
  const googleConfigured = google.configured;
  const googleOAuthAvailable = google.oauthFlowAvailable;
  const last = (provider) => getIntegrationTestResult(provider);
  const statusAfterTest = (provider, configured, sessionReady = false) => {
    const result = last(provider);
    const checkedAt = new Date().toISOString();
    const testIsFresh =
      result && Date.now() - Date.parse(result.testedAt) < 5 * 60 * 1000;
    if (!configured) return { connected: false, status: "credentials_required", lastTest: result, checkedAt };
    if (result && !result.connected && testIsFresh) {
      return { connected: false, status: "test_failed", lastTest: result, checkedAt };
    }
    const requiresGoogleSession = ["gmail", "googleCalendar", "crm"].includes(provider);
    if (result?.connected && testIsFresh && (!requiresGoogleSession || sessionReady)) {
      return { connected: true, status: "connected", lastTest: result, checkedAt };
    }
    return {
      connected: false,
      status: result && !result.connected ? "test_failed" : "configured_not_tested",
      lastTest: result,
      checkedAt,
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
  const googleConnected = googleConfigured && google.connected && Boolean(googleAccount);
  const supabaseConnected = coreDataConnected && crmStorageConnected;
  const checkedAt = new Date().toISOString();

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
        ...statusAfterTest("google", googleConfigured, googleConnected && last("google")?.connected),
      },
      supabase: {
        configured: supabaseConfigured,
        connected: supabaseConfigured && supabaseConnected,
        coreDataConnected,
        integrationStorageConfigured: databaseConfigured,
        integrationStorageConnected: crmStorageConnected,
      },
      crm: {
        configured: crmStorageConnected,
        ...statusAfterTest("crm", crmStorageConnected, crmStorageConnected && googleConnected),
      },
      backendApi: { configured: true, connected: true, status: "connected", checkedAt },
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
