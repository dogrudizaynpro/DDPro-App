import assert from "node:assert/strict";
import { test } from "node:test";
import { GoogleApiError } from "../src/services/google-api-error.js";
import { errorHandler } from "../src/middleware/errorHandler.js";

test("Google API errors separate upstream 401 from session 401 and preserve safe diagnostics", () => {
  for (const status of [400, 401, 403, 404, 429, 500, 503]) {
    const error = new GoogleApiError(status, {
      error: {
        code: 999,
        message: "Gmail API has not been used in project before or it is disabled.",
        errors: [{ reason: "accessNotConfigured" }, { reason: "accessNotConfigured" }, { reason: "forbidden" }],
        details: [{ secret: "must-not-be-retained" }],
      },
    });
    assert.equal(error.statusCode, status === 401 ? 502 : status);
    assert.equal(error.upstreamStatus, status);
    assert.equal(error.provider, "google");
    assert.equal(error.code, status === 401 ? "GOOGLE_API_AUTH_ERROR"
      : status === 403 ? "GOOGLE_API_ACCESS_DENIED"
        : status === 429 ? "GOOGLE_API_RATE_LIMIT" : "GOOGLE_API_ERROR");
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

test("workspace error middleware forwards safe metadata and logs only upstream status/category", () => {
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
    assert.equal(body.code, "GOOGLE_API_RATE_LIMIT");
    assert.equal(body.upstreamStatus, 429);
    assert.equal(body.provider, "google");
    assert.deepEqual(logs, [["Google API error:", { upstreamStatus: 429, category: "rate_limit" }]]);
  } finally {
    console.error = originalLog;
  }
});

test("workspace middleware maps Google 401 to 502 but keeps real session 401 unchanged", () => {
  const originalLog = console.error;
  console.error = () => {};
  try {
    for (const error of [
      new GoogleApiError(401, { error: { message: "Invalid credentials" } }, [], "gmail"),
      Object.assign(new Error("Session expired"), { statusCode: 401, expose: true }),
    ]) {
      let status;
      let body;
      errorHandler(error, {}, {
        status(value) { status = value; return this; },
        json(value) { body = value; },
      }, () => {});
      assert.equal(status, error.googleApiError ? 502 : 401);
      assert.equal(body.code, error.googleApiError ? "GOOGLE_API_AUTH_ERROR" : undefined);
      assert.equal(body.upstreamStatus, error.googleApiError ? 401 : undefined);
    }
  } finally {
    console.error = originalLog;
  }
});
