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
const appSource = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");

test("integration dashboard uses one shared status and separates loading from provider health", () => {
  assert.match(source, /useSyncExternalStore\(/);
  assert.match(source, /const status = integrationSnapshot\.status/);
  assert.match(source, /const \[statusLoading, setStatusLoading\] = useState\(integrationSnapshot\.refreshing\)/);
  assert.doesNotMatch(source, /setStatus\(|applyAiVerification/);
  assert.match(source, /value\.ai\?\.configured && hasStaleIntegrationTest\(value\.ai, receivedAt\)/);
  assert.match(source, /value = await getIntegrationStatusOnce\(\)/);
  assert.match(source, /if \(!status\) return "DURUM ALINAMADI"/);
  assert.match(source, /Entegrasyon durumları yenileniyor; son doğrulanmış sonuçlar korunuyor/);
  assert.match(source, /DURUM KONTROL EDİLİYOR/);
  assert.match(source, /state === "authorization_required"/);
  assert.match(source, /Bağlantı test ediliyor; son doğrulanmış sonuç korunuyor/);
  assert.match(source, /const pendingIntegrationTests = new Map\(\)/);
  assert.match(source, /SON DOĞRULAMA · API YENİLENEMEDİ/);
  assert.doesNotMatch(source.match(/const refresh = async[\s\S]*?const startGoogleOAuth/)?.[0] || "", /setStatus\(null\)/);
  const labelBlock = source.match(/const integrationStatusLabel = \([\s\S]*?\n  };/)?.[0] || "";
  assert.match(labelBlock, /if \(!status && \(statusLoading \|\| integrationSnapshot\.refreshing\)\)/);
  assert.doesNotMatch(labelBlock, /testing === integration.id/);
  assert.match(source, /connection\?\.connected && !hasRefreshFailure && !statusIsStale/);
  assert.match(source, /isIntegrationStatusStale\(connection, now, integrationSnapshot\.updatedAt\)/);
});

test("CRM storage health and browser authorization are shown independently", () => {
  assert.match(source, /CRM depolama sağlığı: \{connection\?\.connected/);
  assert.match(source, /Kullanıcı oturum yetkisi: \{isGoogleConnected/);
  assert.match(source, /integration\.requiresOAuth && !isGoogleConnected/);
});

test("shell and both integration views subscribe to the same authority without clearing it on navigation", () => {
  assert.match(appSource, /useSyncExternalStore\(\s*subscribeToIntegrationStatus,\s*getIntegrationStatusSnapshot/);
  assert.match(appSource, /const integrationState = integrationSnapshot\.status/);
  assert.doesNotMatch(appSource, /setIntegrationState\(/);
  assert.match(source, /moduleId === "settings"\) return <IntegrationSettings/);
  assert.match(source, /moduleId === "integrations"\) return <IntegrationSettings[^;]*hubMode/);
  assert.doesNotMatch(source, /<IntegrationSettings[^>]*key=/);
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

test("device logout and account-wide actions have distinct labels and explicit confirmation", () => {
  assert.match(source, /Bu cihazdan çıkış/);
  assert.match(source, /Tüm DDPro oturumlarını iptal et/);
  assert.match(source, /Google entegrasyonunu tüm hesapta kaldır/);
  assert.match(source, /window\.confirm\("Yalnız bu tarayıcı profilinden/);
  assert.match(source, /beginSessionReauthentication\(action\)/);
  assert.match(source, /Henüz iptal yapılmadı/);
  assert.match(source, /await finishSecurityAction\(\)/);
  assert.doesNotMatch(source, /disconnectGoogleAccount/);
  const voiceSource = readFile(new URL("../src/modules/AIModule.jsx", import.meta.url), "utf8");
  return voiceSource.then((voice) => {
    assert.match(voice, /addEventListener\("ddpro:session-ended", stopRealtimeVoice\)/);
    assert.match(voice, /addEventListener\("ddpro:session-invalid", stopRealtimeVoice\)/);
  });
});
