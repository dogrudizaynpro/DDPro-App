import assert from "node:assert/strict";
import { test } from "node:test";
import { getIntegrationHealthStatus, getIntegrationHealthState } from "../src/services/integration-health.service.js";

const now = Date.now();
const result = (values = {}) => ({
  connected: false,
  testedAt: new Date(now - 1_000).toISOString(),
  ...values,
});

test("health separates disabled APIs, scopes, and failed preconditions using provider evidence", () => {
  for (const [category, status] of [
    ["api_disabled", "api_disabled"],
    ["scope_required", "scope_required"],
    ["permission_denied", "permission_denied"],
    ["failed_precondition", "failed_precondition"],
  ]) {
    assert.equal(getIntegrationHealthStatus({
      configured: true, result: result({ googleApiError: { category } }), now,
    }), status);
  }
});

test("health does not equate stored authorization or reachability with working service", () => {
  const options = { configured: true, requiresSession: true, sessionReady: true, now };
  const untested = getIntegrationHealthState(options);
  assert.equal(untested.authenticated, true);
  assert.equal(untested.connected, false);
  assert.equal(untested.working, null);
  assert.equal(untested.reachable, null);
  const rejected = getIntegrationHealthState({
    ...options, result: result({ googleApiError: { category: "failed_precondition" } }),
  });
  assert.equal(rejected.authenticated, true);
  assert.equal(rejected.authorized, null);
  assert.equal(rejected.reachable, true);
  assert.equal(rejected.working, false);
  assert.equal(rejected.connected, false);
  assert.equal(getIntegrationHealthState({
    ...options, result: result({ reachable: false, statusCode: 502 }),
  }).reachable, false);
  assert.equal(getIntegrationHealthState({
    ...options, result: result({ googleApiError: { category: "scope_required", requestSent: false } }),
  }).reachable, null);
  assert.equal(getIntegrationHealthState({
    ...options, sessionReady: false, result: result({ connected: true }),
  }).connected, false);
  assert.equal(getIntegrationHealthState({
    ...options, result: result({ connected: true, testSucceeded: false }),
  }).connected, false);
  const expiredAccess = getIntegrationHealthState({
    ...options, result: result({ code: "GOOGLE_CONNECTION_REQUIRED", statusCode: 401 }),
  });
  assert.equal(expiredAccess.status, "authorization_required");
  assert.equal(expiredAccess.authenticated, true);
  assert.equal(expiredAccess.authorized, false);
  assert.equal(expiredAccess.working, false);
  assert.equal(getIntegrationHealthState({
    ...options, configured: false,
  }).authenticated, true);
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
    result: result({ operation: "oauth.token.refresh", reachable: false, statusCode: 502 }),
    now,
  }), "token_refresh_failed");
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
  }), "scope_required");
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

test("service authorization reflects fresh credential evidence separately from browser authentication", () => {
  const options = { configured: true, now };
  assert.equal(getIntegrationHealthState(options).authorized, null);
  assert.equal(getIntegrationHealthState({
    ...options, result: result({ connected: true, testSucceeded: true }),
  }).authorized, true);
  assert.equal(getIntegrationHealthState({
    ...options, result: result({ connected: true, testSucceeded: true }),
  }).authenticated, null);
  for (const statusCode of [401, 403]) {
    assert.equal(getIntegrationHealthState({
      ...options, result: result({ statusCode }),
    }).authorized, false);
  }
  assert.equal(getIntegrationHealthState({
    ...options, result: result({ statusCode: 503 }),
  }).authorized, null);
  assert.equal(getIntegrationHealthState({
    ...options, result: { connected: true, testedAt: new Date(now - 6 * 60_000).toISOString() },
  }).authorized, null);
  for (const category of ["scope_required", "permission_denied", "authorization"]) {
    const health = getIntegrationHealthState({
      ...options, requiresSession: true, sessionReady: true,
      result: result({ statusCode: 403, googleApiError: { category } }),
    });
    assert.equal(health.authenticated, true);
    assert.equal(health.authorized, false);
  }
  assert.equal(getIntegrationHealthState({
    ...options, requiresSession: true, sessionReady: true,
    result: result({ statusCode: 403, googleApiError: { category: "api_disabled" } }),
  }).authorized, null);
});
