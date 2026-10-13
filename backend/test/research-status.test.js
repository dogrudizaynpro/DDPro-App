import assert from "node:assert/strict";
import { test } from "node:test";
import { getIntegrationStatus } from "../src/controllers/integrations.controller.js";
import { getResearchProviderStatus } from "../src/controllers/research.controller.js";

const withResearchConfiguration = async (apiKey, callback) => {
  const envKeys = [
    "RESEARCH_API_KEY",
    "RESEARCH_API_URL",
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "INTEGRATION_TOKEN_ENCRYPTION_KEY",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "GOOGLE_REDIRECT_URI",
    "GOOGLE_ALLOWED_EMAILS",
    "INTEGRATION_SESSION_SECRET",
    "FRONTEND_URL",
  ];
  const previous = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
  for (const key of envKeys) delete process.env[key];
  if (apiKey !== null) process.env.RESEARCH_API_KEY = apiKey;

  try {
    await callback();
  } finally {
    for (const key of envKeys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
};

const captureResponse = () => {
  const response = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
  return response;
};

test("research status endpoints use the API key and distinguish configured from tested", async () => {
  await withResearchConfiguration(null, async () => {
    const providerResponse = captureResponse();
    getResearchProviderStatus({}, providerResponse);
    assert.equal(providerResponse.statusCode, 200);
    assert.equal(providerResponse.body.data.configured, false);
    assert.equal(providerResponse.body.data.provider, "Tavily");

    const integrationResponse = captureResponse();
    await getIntegrationStatus({ get: () => null, headers: {} }, integrationResponse, (error) => { throw error; });
    assert.equal(integrationResponse.statusCode, 200);
    assert.equal(integrationResponse.body.data.research.configured, false);
    assert.equal(integrationResponse.body.data.research.connected, false);
    assert.equal(integrationResponse.body.data.research.status, "credentials_required");
  });

  await withResearchConfiguration("regression-test-key", async () => {
    const providerResponse = captureResponse();
    getResearchProviderStatus({}, providerResponse);
    assert.equal(providerResponse.body.data.provider, "Tavily");
    assert.equal(providerResponse.body.data.configured, true);

    const integrationResponse = captureResponse();
    await getIntegrationStatus({ get: () => null, headers: {} }, integrationResponse, (error) => { throw error; });
    assert.equal(integrationResponse.body.data.research.configured, true);
    assert.equal(integrationResponse.body.data.research.connected, false);
    assert.equal(integrationResponse.body.data.research.status, "configured_not_tested");
  });
});
