import { getIntegrationAdmin, hasIntegrationAdmin } from "../config/integration-admin.js";
import { getSupabaseClient, isSupabaseAvailable } from "../config/supabase.js";
import {
  getGoogleConfigurationStatus,
  getGoogleSessionAccount,
} from "../services/google-integration.service.js";
import { websiteCmsConfigured } from "../services/website-cms.service.js";

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

  res.status(200).json({
    status: "success",
    data: {
      ai: {
        configured: aiConfigured,
        connected: false,
        status: aiConfigured ? "configured_not_tested" : "credentials_required",
      },
      gmail: {
        configured: googleConfigured,
        connected: googleConnected,
        oauthFlowAvailable: googleOAuthAvailable,
        status: googleConnected ? "connected" : googleConfigured ? "not_connected" : "credentials_required",
      },
      googleCalendar: {
        configured: googleConfigured,
        connected: googleConnected,
        oauthFlowAvailable: googleOAuthAvailable,
        status: googleConnected ? "connected" : googleConfigured ? "not_connected" : "credentials_required",
      },
      whatsapp: {
        configured: whatsappConfigured && whatsappWebhookConfigured,
        sendConfigured: whatsappConfigured,
        webhookConfigured: whatsappWebhookConfigured,
        connected: false,
        status: whatsappConfigured && whatsappWebhookConfigured ? "configured_not_tested" : "credentials_required",
      },
      research: {
        configured: Boolean(
          process.env.RESEARCH_API_URL && process.env.RESEARCH_API_KEY
        ),
        connected: false,
      },
      google: {
        configured: googleConfigured,
        connected: googleConnected,
        oauthFlowAvailable: googleOAuthAvailable,
        status: googleConnected ? "connected" : googleConfigured ? "not_connected" : "credentials_required",
      },
      supabase: {
        configured: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY),
        connected: supabaseConnected,
        integrationStorageConfigured: databaseConfigured,
        integrationStorageConnected: crmStorageConnected,
      },
      crm: {
        configured: crmStorageConnected,
        connected: crmStorageConnected && googleConnected,
        status: crmStorageConnected ? "configured_not_connected" : "credentials_required",
      },
      web: {
        url: "https://www.ddizaynpro.com/",
        managementConfigured: cmsConfigured,
        inboundLeadConfigured: websiteWebhookConfigured && databaseConfigured,
        connected: false,
        status: cmsConfigured ? "configured" : "credentials_required",
      },
    },
  });
 } catch(error) {
   return next(error);
 }
};
