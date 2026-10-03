export const getIntegrationStatus = (_req, res) => {
  const googleOAuthConfigured = Boolean(
    process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.GOOGLE_REDIRECT_URI
  );
  const aiConfigured = Boolean(
    process.env.AI_API_URL && process.env.AI_API_KEY && process.env.AI_MODEL
  );

  res.status(200).json({
    status: "success",
    data: {
      ai: {
        configured: aiConfigured,
        status: aiConfigured ? "configured" : "credentials_required",
      },
      gmail: {
        configured: googleOAuthConfigured,
        oauthFlowAvailable: false,
        status: googleOAuthConfigured
          ? "oauth_implementation_required"
          : "credentials_required",
      },
      google: {
        configured: googleOAuthConfigured,
        status: googleOAuthConfigured
          ? "oauth_implementation_required"
          : "credentials_required",
      },
      supabase: {
        configured: Boolean(
          process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY
        ),
      },
      web: {
        url: "https://www.ddizaynpro.com/",
        managementConfigured: false,
      },
    },
  });
};
