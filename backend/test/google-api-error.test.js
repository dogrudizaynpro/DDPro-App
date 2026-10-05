import assert from "node:assert/strict";
import { test } from "node:test";
import { GoogleApiError } from "../src/services/google-api-error.js";
import { errorHandler } from "../src/middleware/errorHandler.js";

test("Google API errors preserve status, message and distinct reasons without retaining the response", () => {
  for (const status of [400, 401, 403, 404, 429, 500, 503]) {
    const error = new GoogleApiError(status, {
      error: {
        code: 999,
        message: "Gmail API has not been used in project before or it is disabled.",
        errors: [{ reason: "accessNotConfigured" }, { reason: "accessNotConfigured" }, { reason: "forbidden" }],
        details: [{ secret: "must-not-be-retained" }],
      },
    });
    assert.equal(error.statusCode, status);
    assert.equal(error.googleApiError.httpStatus, status);
    assert.equal(error.message, "Gmail API has not been used in project before or it is disabled.");
    assert.deepEqual(error.googleApiError.reasons, ["accessNotConfigured", "forbidden"]);
    assert.equal(error.expose, true);
    assert.doesNotMatch(JSON.stringify(error), /must-not-be-retained/);
  }
});

test("Google API errors redact credentials in both messages and reasons", () => {
  const previous = process.env.GOOGLE_CLIENT_SECRET;
  process.env.GOOGLE_CLIENT_SECRET = "example-secret/value";
  try {
    const error = new GoogleApiError(403, {
      error: {
        message: `Denied opaque-access-value, example-secret/value, example-secret%2Fvalue, ${["Bearer", "unknown-token"].join(" ")} refresh_token="unknown-refresh", ya29.provider-token, 1//refresh-value, GOCSPX-client-secret`,
        errors: [{ reason: "opaque-access-value" }, { reason: "example-secret/value" }],
      },
    }, ["opaque-access-value"]);
    assert.doesNotMatch(JSON.stringify(error), /opaque-access-value|example-secret|unknown-token|unknown-refresh|ya29\.provider|1\/\/refresh|GOCSPX-client/);
    assert.match(error.message, /REDACTED/);
    assert.deepEqual(error.googleApiError.reasons, ["[REDACTED]"]);
  } finally {
    if (previous === undefined) delete process.env.GOOGLE_CLIENT_SECRET;
    else process.env.GOOGLE_CLIENT_SECRET = previous;
  }
});

test("missing or malformed Google error bodies retain the real HTTP status", () => {
  for (const payload of [undefined, null, {}, { error: "unavailable" }, { error: { message: {}, errors: {} } }]) {
    const error = new GoogleApiError(503, payload);
    assert.equal(error.statusCode, 503);
    assert.equal(error.message, "Google API request failed (HTTP 503).");
    assert.deepEqual(error.googleApiError.reasons, []);
  }
});

test("workspace error middleware forwards safe metadata and logs only status/category", () => {
  const error = new GoogleApiError(429, { error: { message: "Rate limit exceeded", errors: [{ reason: "rateLimitExceeded" }] } });
  const originalLog = console.error;
  const logs = [];
  console.error = (...args) => logs.push(args);
  let httpStatus;
  let body;
  try {
    errorHandler(error, {}, {
      status(value) { httpStatus = value; return this; },
      json(value) { body = value; },
    }, () => {});
    assert.equal(httpStatus, 429);
    assert.deepEqual(body.googleApiError, error.googleApiError);
    assert.equal(body.message, "Rate limit exceeded");
    assert.deepEqual(logs, [["Google API error:", { statusCode: 429, category: "rate_limit" }]]);
  } finally {
    console.error = originalLog;
  }
});
