import test from "node:test";
import assert from "node:assert/strict";
import {
  getOfferPayload,
  getProjectPayload,
  getResearchPayload,
  isValidUuid,
  validateUuidParam,
} from "../src/utils/validation.js";

test("validateUuidParam accepts UUID values", () => {
  const value = "123e4567-e89b-12d3-a456-426614174000";
  assert.equal(validateUuidParam(value, "Offer ID"), value);
  assert.equal(isValidUuid(value), true);
});

test("validateUuidParam rejects invalid UUID values", () => {
  assert.throws(
    () => validateUuidParam("not-a-uuid", "Offer ID"),
    /Offer ID must be a valid UUID/
  );
});

test("getProjectPayload normalizes project input", () => {
  assert.deepEqual(
    getProjectPayload({
      name: "  DDPro Konut  ",
      projectType: "  Mimari  ",
      status: "Aktif",
      description: "  Açıklama  ",
    }),
    {
      name: "DDPro Konut",
      project_type: "Mimari",
      status: "Aktif",
      description: "Açıklama",
    }
  );
});

test("getResearchPayload requires a title", () => {
  assert.throws(() => getResearchPayload({ note: "Eksik" }), /Research title/);
});

test("getOfferPayload uppercases currency and validates project id", () => {
  assert.deepEqual(
    getOfferPayload({
      title: "Teklif A",
      amount: "1250.50",
      currency: "try",
      status: "Gönderildi",
      project_id: "123e4567-e89b-12d3-a456-426614174000",
    }),
    {
      title: "Teklif A",
      amount: 1250.5,
      currency: "TRY",
      status: "Gönderildi",
      project_id: "123e4567-e89b-12d3-a456-426614174000",
    }
  );
});
