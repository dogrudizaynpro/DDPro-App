import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildMaterialCostSnapshot,
  normalizeCatalogPayload,
} from "../src/controllers/catalog.controller.js";

test("catalog payloads reject incomplete or malformed product and system records", () => {
  assert.throws(
    () => normalizeCatalogPayload("products", { name: "Ürün", system_id: "not-a-uuid" }),
    { statusCode: 400 }
  );
  assert.throws(
    () => normalizeCatalogPayload("systems", { name: "Cephe", code: "Cephe" }),
    { statusCode: 400 }
  );
  assert.equal(
    normalizeCatalogPayload("systems", { name: "Cephe", code: "cephe" }).status,
    "ACTIVE"
  );
});

test("price analysis never accepts VERIFIED without positive price, source, unit, and verification time", () => {
  assert.throws(
    () => normalizeCatalogPayload("price-analysis", {
      name: "Doğrulanmış kayıt",
      unit: "m2",
      unit_price: 0,
      verification_status: "VERIFIED",
    }),
    { statusCode: 400 }
  );
  assert.throws(
    () => normalizeCatalogPayload("price-analysis", {
      name: "Doğrulanmış kayıt",
      unit: "m2",
      unit_price: 150,
      verification_status: "VERIFIED",
      verified_at: "2026-10-05T12:00:00.000Z",
    }),
    { statusCode: 400 }
  );

  const verified = normalizeCatalogPayload("price-analysis", {
    name: "Doğrulanmış kayıt",
    unit: "m2",
    unit_price: "150.5",
    source: "Supplier quote 42",
    source_url: "https://example.com/quote/42",
    currency: "try",
    verification_status: "VERIFIED",
    verified_at: "2026-10-05T12:00:00.000Z",
  });
  assert.equal(verified.unit_price, 150.5);
  assert.equal(verified.currency, "TRY");
  assert.equal(verified.verification_status, "VERIFIED");
  assert.equal(verified.verified_at, "2026-10-05T12:00:00.000Z");
});

test("material analysis ignores client-supplied prices and requires positive quantities", () => {
  const payload = normalizeCatalogPayload("material-analysis", {
    name: "Alçı levha",
    unit: "m2",
    quantity: "12.5",
    verification_status: "VERIFIED",
    unit_price: 1,
    total_cost: 12.5,
    source: "untrusted",
  });

  test("material snapshots calculate only from matching verified prices", () => {
    const payload = normalizeCatalogPayload("material-analysis", {
      name: "Alçı levha",
      unit: "m2",
      quantity: 3,
    });
    const price = {
      id: "d8a1e2d1-6332-41a4-89a4-2c7fcf25c001",
      product_id: "d8a1e2d1-6332-41a4-89a4-2c7fcf25c002",
      project_id: null,
      system_id: "d8a1e2d1-6332-41a4-89a4-2c7fcf25c003",
      unit_price: "12.35",
      currency: "TRY",
      unit: "m2",
      source: "Supplier quote",
      source_url: "https://example.com/quote",
      verification_status: "VERIFIED",
      verified_at: "2026-10-05T12:00:00.000Z",
    };
    const snapshot = buildMaterialCostSnapshot(payload, price);
    assert.equal(snapshot.total_cost, 37.05);
    assert.equal(snapshot.unit_price, 12.35);
    assert.equal(snapshot.currency, "TRY");
    assert.equal(snapshot.verification_status, "VERIFIED");
    assert.equal(snapshot.product_id, price.product_id);
    assert.equal(snapshot.system_id, price.system_id);
    assert.equal(snapshot.source, "https://example.com/quote");

    const unverified = buildMaterialCostSnapshot(payload, {
      ...price,
      unit_price: 99,
      verification_status: "UNVERIFIED",
      verified_at: null,
    });
    assert.equal(unverified.total_cost, null);
    assert.equal(unverified.unit_price, null);
    assert.equal(unverified.verification_status, "UNVERIFIED");

    const missing = buildMaterialCostSnapshot(payload);
    assert.equal(missing.total_cost, null);
    assert.equal(missing.verification_status, "MISSING");
    assert.throws(
      () => buildMaterialCostSnapshot(payload, { ...price, unit: "adet" }),
      { statusCode: 400 }
    );
  });
  assert.equal(payload.quantity, 12.5);
  assert.equal("unit_price" in payload, false);
  assert.equal("verification_status" in payload, false);
  assert.throws(
    () => normalizeCatalogPayload("material-analysis", {
      name: "Alçı levha",
      unit: "m2",
      quantity: 0,
    }),
    { statusCode: 400 }
  );
});
