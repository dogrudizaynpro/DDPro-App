import assert from "node:assert/strict";
import { test } from "node:test";
import { getResearchPayload } from "../src/controllers/research.controller.js";

const id = "4bc6f5a6-0b6c-4ddb-b29b-208c84c344d0";

test("procurement payload maps relationships and defaults prices to unverified", () => {
  const payload = getResearchPayload({
    name: "Aluminum profile",
    supplier: "Supplier A",
    projectId: id,
    productId: id,
    systemId: id,
    procurementStatus: "QUOTE_RECEIVED",
    price: "125",
    url: "https://supplier.example/item",
  });

  assert.equal(payload.title, "Aluminum profile");
  assert.equal(payload.supplier, "Supplier A");
  assert.equal(payload.project_id, id);
  assert.equal(payload.product_id, id);
  assert.equal(payload.system_id, id);
  assert.equal(payload.procurement_status, "QUOTE_RECEIVED");
  assert.equal(payload.price_verification, "Doğrulanmadı");
});

test("procurement update preserves omitted existing values and allows explicit relationship clearing", () => {
  const payload = getResearchPayload(
    { title: "Updated title", project_id: null },
    {
      title: "Old title",
      description: "Existing notes",
      source: "Existing source",
      project_id: id,
      product_id: id,
      system_id: id,
      procurement_status: "ORDERED",
      price_verification: "Doğrulanmadı",
    }
  );

  assert.equal(payload.title, "Updated title");
  assert.equal(payload.description, "Existing notes");
  assert.equal(payload.source, "Existing source");
  assert.equal(payload.project_id, null);
  assert.equal(payload.product_id, id);
  assert.equal(payload.system_id, id);
  assert.equal(payload.procurement_status, "ORDERED");
});

test("procurement payload rejects unverifiable price claims and invalid references", () => {
  assert.throws(() => getResearchPayload({
    title: "Unsupported verified price",
    price: "125",
    price_verification: "Kullanıcı kaynağı kontrol etti",
  }), /requires a source price and URL/);
  assert.throws(() => getResearchPayload({
    title: "Invalid product",
    product_id: "not-a-uuid",
  }), /valid UUID/);
  assert.throws(() => getResearchPayload({
    title: "Invalid status",
    procurement_status: "PAID",
  }), /Procurement status is invalid/);
});

