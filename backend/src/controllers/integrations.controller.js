import { hasIntegrationAdmin } from "../config/integration-admin.js";
import { getGoogleConfigurationStatus } from "../services/google-integration.service.js";
import { websiteCmsConfigured } from "../services/website-cms.service.js";

export const getIntegrationStatus = async (_req, res, next) => {
 try {
  const googleOAuthConfigured = Boolean(
    process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.GOOGLE_REDIRECT_URI
  );
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

  res.status(200).json({
    status: "success",
    data: {
      ai: {
        configured: aiConfigured,
        status: aiConfigured ? "configured" : "credentials_required",
      },
      gmail: {
        configured: google.configured,
        connected: google.connected,
        oauthFlowAvailable: google.oauthFlowAvailable && Boolean(process.env.INTEGRATION_SESSION_SECRET) && Boolean(process.env.GOOGLE_ALLOWED_EMAILS),
        status: google.connected ? "connected" : google.configured ? "not_connected" : "credentials_required",
      },
      googleCalendar: {
        configured: google.configured,
        connected: google.connected,
        status: google.connected ? "connected" : google.configured ? "not_connected" : "credentials_required",
      },
      whatsapp: {
        configured: whatsappConfigured && whatsappWebhookConfigured,
        sendConfigured: whatsappConfigured,
        webhookConfigured: whatsappWebhookConfigured,
        status: whatsappConfigured && whatsappWebhookConfigured ? "configured" : "credentials_required",
      },
      research: {
        configured: Boolean(
          process.env.RESEARCH_API_URL && process.env.RESEARCH_API_KEY
        ),
      },
      google: {
        configured: google.configured,
        connected: google.connected,
        oauthFlowAvailable: google.oauthFlowAvailable && Boolean(process.env.INTEGRATION_SESSION_SECRET) && Boolean(process.env.GOOGLE_ALLOWED_EMAILS),
        status: google.connected ? "connected" : google.configured ? "not_connected" : "credentials_required",
      },
      supabase: {
        configured: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY),
        integrationStorageConfigured: databaseConfigured,
      },
      crm: {
        configured: databaseConfigured,
        status: databaseConfigured ? "configured" : "credentials_required",
      },
      web: {
        url: "https://www.ddizaynpro.com/",
        managementConfigured: cmsConfigured,
        inboundLeadConfigured: websiteWebhookConfigured && databaseConfigured,
        status: cmsConfigured ? "configured" : "credentials_required",
      },
    },
  });
 } catch(error) {
   return next(error);
 }
};
