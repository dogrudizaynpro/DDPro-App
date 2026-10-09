import { getIntegrationAdmin, hasIntegrationAdmin } from "../config/integration-admin.js";
import {
  getGoogleConfigurationStatus,
  getGoogleSessionAccount,
} from "../services/google-integration.service.js";
import { websiteCmsConfigured } from "../services/website-cms.service.js";
import {
  getIntegrationHealthState,
  getIntegrationTestResult,
  testIntegrationConnection,
} from "../services/integration-health.service.js";
import { getWhatsAppConfigurationStatus } from "../services/whatsapp.service.js";

export const getIntegrationStatus = async (req, res, next) => {
 try {
  const aiConfigured = Boolean(
    process.env.AI_API_URL && process.env.AI_API_KEY && process.env.AI_MODEL
  );
  const googleAccount = await getGoogleSessionAccount(req);
  const google = await getGoogleConfigurationStatus(googleAccount);
  const databaseConfigured = hasIntegrationAdmin();
  const whatsapp = getWhatsAppConfigurationStatus();
  const websiteWebhookConfigured = Boolean(process.env.WEBSITE_WEBHOOK_SECRET);
  const cmsConfigured = websiteCmsConfigured();
  const websiteConfigured = cmsConfigured && websiteWebhookConfigured && databaseConfigured;
  let coreDataConnected = false;
  let crmStorageConnected = false;
  let crmConnected = false;
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
    crmConnected = !coreResults[0].error && crmStorageConnected;
  }
  const googleConfigured = google.configured;
  const googleOAuthAvailable = google.oauthFlowAvailable;
  const last = (provider) => getIntegrationTestResult(provider, googleAccount);
  const statusAfterTest = (provider, configured, sessionReady = false) => {
    const result = last(provider);
    const checkedAt = new Date().toISOString();
    const requiresGoogleSession = ["gmail", "googleCalendar"].includes(provider);
    const state = getIntegrationHealthState({
      configured,
      result,
      requiresSession: requiresGoogleSession,
      sessionReady,
    });
    return {
      ...state,
      lastTest: result,
      checkedAt,
    };
  };
  const appleConfigured = Boolean(
    process.env.APPLE_ISSUER_ID &&
    process.env.APPLE_KEY_ID &&
    process.env.APPLE_PRIVATE_KEY
  );
  const supabaseConfigured = databaseConfigured;
  const googleSessionReady = Boolean(googleAccount);
  const gmailHealth = statusAfterTest("gmail", googleConfigured, googleSessionReady);
  const calendarHealth = statusAfterTest("googleCalendar", googleConfigured, googleSessionReady);
  const workspaceHealth = [gmailHealth, calendarHealth];
  const googleStatus = workspaceHealth.find(({ status }) =>
    !["connected", "configured_not_tested"].includes(status))?.status ||
    (workspaceHealth.every(({ connected }) => connected) ? "connected" : "configured_not_tested");
  const supabaseConnected = coreDataConnected && crmStorageConnected;
  const supabaseStatus = !supabaseConfigured
    ? "credentials_required"
    : supabaseConnected ? "connected" : "service_unavailable";
  const supabaseCheckedAt = new Date().toISOString();
  const supabaseLastTest = {
    connected: supabaseConnected,
    testSucceeded: supabaseConnected,
    testedAt: supabaseCheckedAt,
    error: supabaseConnected ? "" : "Supabase core data or integration storage could not be reached.",
  };
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
        ...gmailHealth,
      },
      googleCalendar: {
        configured: googleConfigured,
        oauthFlowAvailable: googleOAuthAvailable,
        ...calendarHealth,
      },
      whatsapp: {
        ...whatsapp,
        ...statusAfterTest("whatsapp", whatsapp.configured),
      },
      research: {
        configured: Boolean(process.env.RESEARCH_API_URL && process.env.RESEARCH_API_KEY),
        ...statusAfterTest("research", Boolean(process.env.RESEARCH_API_URL && process.env.RESEARCH_API_KEY)),
      },
      google: {
        configured: googleConfigured,
        oauthFlowAvailable: googleOAuthAvailable,
        authenticated: googleSessionReady,
        authorized: workspaceHealth.every(({ authorized }) => authorized === true) ? true
          : workspaceHealth.some(({ authorized }) => authorized === false) ? false : null,
        reachable: workspaceHealth.every(({ reachable }) => reachable === true) ? true
          : workspaceHealth.some(({ reachable }) => reachable === false) ? false : null,
        working: workspaceHealth.every(({ working }) => working === true) ? true
          : workspaceHealth.some(({ working }) => working === false) ? false : null,
        status: googleStatus,
        connected: workspaceHealth.every(({ connected }) => connected),
        lastTest: null,
        checkedAt,
      },
      supabase: {
        configured: supabaseConfigured,
        connected: supabaseConfigured && supabaseConnected,
        authenticated: null,
        authorized: supabaseConnected ? true : null,
        reachable: supabaseConnected ? true : null,
        working: supabaseConnected,
        status: supabaseStatus,
        lastTest: supabaseLastTest,
        checkedAt: supabaseCheckedAt,
        coreDataConnected,
        integrationStorageConfigured: databaseConfigured,
        integrationStorageConnected: crmStorageConnected,
      },
      crm: {
        configured: databaseConfigured,
        authenticated: null,
        authorized: crmConnected ? true : null,
        connected: crmConnected,
        reachable: crmConnected ? true : null,
        working: crmConnected,
        status: !databaseConfigured ? "credentials_required"
          : crmConnected ? "connected" : "service_unavailable",
        lastTest: {
          connected: crmConnected,
          testSucceeded: crmConnected,
          testedAt: checkedAt,
          error: crmConnected ? "" : "CRM storage could not be reached.",
        },
        checkedAt,
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
        ...(error.googleApiError && {
          code: error.code,
          provider,
          upstreamStatus: error.upstreamStatus,
          googleApiError: error.googleApiError,
        }),
        data: { provider, connected: false, testSucceeded: false },
      });
    }
    return next(error);
  }
};
