import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEFAULT_LOCAL_API_URL,
  resolveApiBaseUrl,
  VERIFIED_PREVIEW_API_ORIGIN,
} from "../../src/services/api-config.js";

test("explicit API origin takes precedence in every deployment environment", () => {
  assert.equal(
    resolveApiBaseUrl({
      apiUrl: " https://api.example.com/ ",
      deploymentEnvironment: "preview",
      hostname: "preview.example.com",
    }),
    "https://api.example.com"
  );
});

test("the verified backend origin is used only for an unconfigured Vercel preview", () => {
  assert.equal(
    resolveApiBaseUrl({ deploymentEnvironment: "preview", hostname: "preview.example.com" }),
    VERIFIED_PREVIEW_API_ORIGIN
  );
  assert.equal(
    resolveApiBaseUrl({ deploymentEnvironment: "production", hostname: "ddpro.example.com" }),
    ""
  );
});

test("local development preserves the localhost backend fallback", () => {
  assert.equal(resolveApiBaseUrl({ hostname: "localhost" }), DEFAULT_LOCAL_API_URL);
  assert.equal(resolveApiBaseUrl({ hostname: "127.0.0.1" }), DEFAULT_LOCAL_API_URL);
});
