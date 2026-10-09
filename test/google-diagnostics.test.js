import assert from "node:assert/strict";
import { test } from "node:test";
import { formatGoogleIntegrationError } from "../src/services/operations-integrations.service.js";

test("Google diagnostics distinguish cloud configuration, scopes, access and Gmail preconditions", () => {
  for (const [category, expected] of [
    ["api_disabled", /API etkinleştirilmeli/],
    ["scope_required", /Kullanıcı onayı/],
    ["permission_denied", /kaynak erişimi/],
    ["failed_precondition", /token sıfırlamak çözüm değildir/],
  ]) {
    const message = formatGoogleIntegrationError({
      googleApiError: { category, httpStatus: 403, reasons: ["safe_reason"], message: "Safe provider error" },
    });
    assert.match(message, expected);
    assert.match(message, /HTTP 403 · safe_reason: Safe provider error/);
  }
});
