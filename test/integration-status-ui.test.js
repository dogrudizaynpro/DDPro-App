import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const source = await readFile(
  new URL("../src/modules/OperationsModule.jsx", import.meta.url),
  "utf8",
);

test("integration dashboard keeps initial status pending until the configured AI model responds", () => {
  assert.match(source, /const \[statusLoading, setStatusLoading\] = useState\(true\)/);
  assert.match(source, /if \(value\.ai\?\.configured\)\s*\{\s*try\s*\{\s*await testIntegrationConnection\("ai"\)/);
  assert.match(source, /value = await getIntegrationStatus\(\)/);
  assert.match(source, /Entegrasyon bağlantıları ve AI sağlayıcı yanıtı doğrulanıyor/);
  assert.match(source, /DURUM KONTROL EDİLİYOR/);
});
