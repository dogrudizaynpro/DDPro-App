import assert from "node:assert/strict";
import { test } from "node:test";

test("authorization RPC distinguishes known conflicts from unavailable storage", async () => {
  process.env.SUPABASE_URL = "https://session-storage-errors.example";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "session-test-service-role";
  const originalFetch = globalThis.fetch;
  let failure;
  globalThis.fetch = async () => {
    if (failure instanceof Error) throw failure;
    return Response.json(failure, { status: 400 });
  };
  try {
    const { browserAuthRpc } = await import("../src/services/browser-session.service.js");
    for (const error of [
      { code: "42P01", message: "private table details" },
      { code: "PGRST202", message: "private RPC details" },
      { code: "08006", message: "private connection details" },
      { code: "23505", message: "unknown database constraint" },
      { code: "P0001", message: "unexpected database exception" },
      new Error("private network details"),
    ]) {
      failure = error;
      await assert.rejects(browserAuthRpc("validate"), (result) => {
        assert.equal(result.statusCode, 503);
        assert.equal(result.code, "AUTHORIZATION_STORAGE_UNAVAILABLE");
        assert.doesNotMatch(result.message, /private|constraint|exception/);
        return true;
      });
    }
    failure = { code: "P0001", message: "OAuth attempt revoked" };
    await assert.rejects(browserAuthRpc("callback"), (error) =>
      error.statusCode === 409 && error.code === "AUTHORIZATION_CONFLICT");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
