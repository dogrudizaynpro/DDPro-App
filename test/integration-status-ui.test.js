import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const source = await readFile(
  new URL("../src/modules/OperationsModule.jsx", import.meta.url),
  "utf8",
);
const serviceSource = await readFile(
  new URL("../src/services/integrations.service.js", import.meta.url),
  "utf8",
);

test("integration dashboard keeps initial status pending until the configured AI model responds", () => {
  assert.match(source, /useSyncExternalStore\(/);
  assert.match(source, /const \[status, setStatus\] = useState\(integrationSnapshot\.status\)/);
  assert.match(source, /const \[statusLoading, setStatusLoading\] = useState\(integrationSnapshot\.refreshing\)/);
  assert.match(source, /integrationSnapshot\.status\) setStatus\(integrationSnapshot\.status\)/);
  assert.match(source, /value\.ai\?\.configured && hasStaleIntegrationTest\(value\.ai\)/);
  assert.match(source, /value = await getIntegrationStatusOnce\(\)/);
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
  assert.match(source, /const isChecking = statusLoading \|\| integrationSnapshot\.refreshing \|\| testing === integration\.id/);
  assert.match(source, /const pendingIntegrationTests = new Map\(\)/);
  assert.match(source, /integrationStatusCacheLifetime = INTEGRATION_STATUS_MAX_AGE/);
  assert.match(source, /SON DOĞRULAMA · API YENİLENEMEDİ/);
  assert.doesNotMatch(source.match(/const refresh = async[\s\S]*?const startGoogleOAuth/)?.[0] || "", /setStatus\(null\)/);
  const labelBlock = source.match(/const integrationStatusLabel = \([\s\S]*?\n  };/)?.[0] || "";
  assert.ok(labelBlock.indexOf('testing === integration.id') < labelBlock.indexOf('if (statusLoading || integrationSnapshot.refreshing)'));
  assert.ok(labelBlock.indexOf('if (statusLoading || integrationSnapshot.refreshing)') < labelBlock.indexOf('if (!status)'));
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
  assert.match(source, /SON DOĞRULAMA ESKİ · DURUM BELİRSİZ/);
  assert.match(source, /Son başarılı API yanıtındaki durum güncel bağlantı olarak doğrulanmadı/);
  assert.match(serviceSource, /status: null,[\s\S]*checkedAt: null,[\s\S]*updatedAt: null,[\s\S]*refreshing: false,[\s\S]*error: null/);
  assert.match(serviceSource, /publish\(\{ error \}\)/);
  assert.match(serviceSource, /export const subscribeToIntegrationStatus/);
  const refresh = source.match(/const refresh = async[\s\S]*?const startGoogleOAuth/)?.[0] || "";
  assert.doesNotMatch(refresh, /let aiTestResult;/);
});
