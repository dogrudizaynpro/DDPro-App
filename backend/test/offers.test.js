import assert from "node:assert/strict";
import { test } from "node:test";
import {
  canTransitionOfferStatus,
  getOfferPayload,
} from "../src/controllers/offers.controller.js";

test("offer payload validation rejects invalid amounts, status, and relation IDs", () => {
  assert.throws(
    () => getOfferPayload({ title: "Offer", amount: -1 }),
    { statusCode: 400 }
  );
  assert.throws(
    () => getOfferPayload({ title: "Offer", status: "Paid" }),
    { statusCode: 400 }
  );
  assert.throws(
    () => getOfferPayload({ title: "Offer", project_id: "not-a-uuid" }),
    { statusCode: 400 }
  );
  assert.equal(getOfferPayload({ title: "Offer" }).status, "Hazırlanıyor");
});

test("offer workflow advances through valid states and prevents reopening terminal states", () => {
  assert.equal(canTransitionOfferStatus("Hazırlanıyor", "Gönderildi"), true);
  assert.equal(canTransitionOfferStatus("Gönderildi", "Onaylandı"), true);
  assert.equal(canTransitionOfferStatus("Gönderildi", "Reddedildi"), true);
  assert.equal(canTransitionOfferStatus("Onaylandı", "Hazırlanıyor"), false);
  assert.equal(canTransitionOfferStatus("Reddedildi", "Gönderildi"), false);
  assert.equal(canTransitionOfferStatus("Gönderildi", "Gönderildi"), true);
});

test("offer updates retain omitted relationships and terms", () => {
  const existing = {
    title: "Existing",
    amount: 500,
    currency: "TRY",
    status: "Gönderildi",
    project_id: "d8a1e2d1-6332-41a4-89a4-2c7fcf25c001",
    crm_contact_id: null,
    system_id: null,
    product_id: null,
    material_analysis_id: null,
  };
  const updated = getOfferPayload({ status: "Onaylandı" }, existing);
  assert.equal(updated.title, "Existing");
  assert.equal(updated.amount, 500);
  assert.equal(updated.project_id, existing.project_id);
  assert.equal(updated.status, "Onaylandı");
});
