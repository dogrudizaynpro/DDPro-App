import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const source = await readFile(
  new URL("../src/modules/OperationsModule.jsx", import.meta.url),
  "utf8",
);

test("integration dashboard keeps initial status pending until the configured AI model responds", () => {
  assert.match(source, /const \[statusLoading, setStatusLoading\] = useState\(true\)/);
  assert.match(source, /if \(value\.ai\?\.configured\)\s*\{\s*try\s*\{\s*aiTestResult = await testIntegrationConnection\("ai"\)/);
  assert.match(source, /value = await getIntegrationStatus\(\)/);
  assert.match(source, /const applyAiVerification = \(status, testResult, testError\)/);
  assert.match(source, /const connected = !testError && testResult\?\.data\?\.connected === true/);
  assert.match(source, /setStatus\(applyAiVerification\(nextStatus, aiTestResult, aiTestError\)\)/);
  assert.match(source, /aiTestResult: provider === "ai" \? testResult : undefined/);
  assert.match(source, /integration\.id === "ai"\) return "TEST EDİLİYOR"/);
  assert.match(source, /integration\.id === "crm"\) return "CRM VERİ ERİŞİMİ DOĞRULANIYOR"/);
  assert.match(source, /if \(!status\) return "DURUM ALINAMADI"/);
  assert.match(source, /Entegrasyon bağlantıları ve AI sağlayıcı yanıtı doğrulanıyor/);
  assert.match(source, /DURUM KONTROL EDİLİYOR/);
  assert.match(source, /state === "authorization_required"/);
  assert.match(source, /const isChecking = statusLoading \|\| testing === integration\.id/);
  const labelBlock = source.match(/const integrationStatusLabel = \([\s\S]*?\n  };/)?.[0] || "";
  assert.ok(labelBlock.indexOf('testing === integration.id') < labelBlock.indexOf('if (statusLoading)'));
  assert.ok(labelBlock.indexOf('if (statusLoading)') < labelBlock.indexOf('if (!status)'));
});

test("service failures do not disable Google retries or masquerade as configuration success", () => {
  assert.match(source, /const isGoogleConnected = status\?\.google\?\.authenticated/);
  assert.match(source, /\["gmail", status\.gmail\?\.configured && status\.google\?\.authenticated\]/);
  assert.match(source, /testResult\?\.data\?\.testSucceeded !== true/);
  for (const category of ["api_disabled", "scope_required", "permission_denied", "failed_precondition"]) {
    assert.ok(source.includes(`state === "${category}"`));
  }
  assert.match(source, /connection\.reachable === true/);
  assert.match(source, /connection\.working === true/);
  assert.match(source, /connection\.authorized === true/);
  const refresh = source.match(/const refresh = async[\s\S]*?const startGoogleOAuth/)?.[0] || "";
  assert.doesNotMatch(refresh, /let aiTestResult;/);
});
