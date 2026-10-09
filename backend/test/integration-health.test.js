import assert from "node:assert/strict";
import { test } from "node:test";
import { getIntegrationHealthStatus } from "../src/services/integration-health.service.js";

const now = Date.now();
const result = (values = {}) => ({
  connected: false,
  testedAt: new Date(now - 1_000).toISOString(),
  ...values,
});

test("integration health requires configuration and a recent successful provider test", () => {
  assert.equal(getIntegrationHealthStatus({ configured: false }), "credentials_required");
  assert.equal(getIntegrationHealthStatus({ configured: true }), "configured_not_tested");
  assert.equal(getIntegrationHealthStatus({
    configured: true,
    result: result({ connected: true }),
    now,
  }), "connected");
});

test("integration health distinguishes missing authorization and failed token refresh", () => {
  assert.equal(getIntegrationHealthStatus({
    configured: true,
    requiresSession: true,
    sessionReady: false,
    now,
  }), "authorization_required");
  assert.equal(getIntegrationHealthStatus({
    configured: true,
    result: result({
      googleApiError: { operation: "oauth.token.refresh", category: "api_error" },
    }),
    now,
  }), "token_refresh_failed");
  assert.equal(getIntegrationHealthStatus({
    configured: true,
    result: result({
      googleApiError: { operation: "oauth.token.refresh", category: "connection_invalid" },
    }),
    now,
  }), "authorization_required");
});

test("integration health distinguishes missing permissions, rejected requests, and unreachable services", () => {
  assert.equal(getIntegrationHealthStatus({
    configured: true,
    result: result({
      googleApiError: {
        category: "access_denied",
        reasons: ["insufficientPermissions"],
      },
    }),
    now,
  }), "permission_required");
  assert.equal(getIntegrationHealthStatus({
    configured: true,
    result: result({
      googleApiError: { category: "authorization" },
    }),
    now,
  }), "request_rejected");
  assert.equal(getIntegrationHealthStatus({
    configured: true,
    result: result({ statusCode: 503 }),
    now,
  }), "service_unavailable");
});

test("integration health ignores expired test results", () => {
  assert.equal(getIntegrationHealthStatus({
    configured: true,
    requiresSession: true,
    sessionReady: true,
    result: {
      connected: true,
      testedAt: new Date(now - 5 * 60 * 1000 - 1).toISOString(),
    },
    now,
  }), "configured_not_tested");
});
