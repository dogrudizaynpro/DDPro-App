import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeCostPayload } from "../src/services/finance.service.js";

const projectId = "4bc6f5a6-0b6c-4ddb-b29b-208c84c344d0";

test("finance cost payload validates project, currency, budget, and verification evidence", () => {
  const payload = normalizeCostPayload({
    name: "Suspended ceiling material",
    projectId,
    costType: "MATERIAL",
    currency: "try",
    budgetAmount: "1500",
    actualAmount: "1325",
    source: "Supplier invoice INV-14",
    verificationStatus: "VERIFIED",
    verifiedAt: "2026-10-05T12:30:00.000Z",
    occurredOn: "2026-10-04",
  });
  assert.equal(payload.project_id, projectId);
  assert.equal(payload.currency, "TRY");
  assert.equal(payload.budget_amount, 1500);
  assert.equal(payload.actual_amount, 1325);
  assert.equal(payload.verification_status, "VERIFIED");
  assert.equal(payload.source, "Supplier invoice INV-14");
});

test("finance rejects guessed verified totals, negative amounts, and malformed dates", () => {
  assert.throws(() => normalizeCostPayload({
    name: "Unsubstantiated",
    projectId,
    costType: "OTHER",
    currency: "TRY",
    actualAmount: "100",
    verificationStatus: "VERIFIED",
  }), /require a positive amount, source, and valid verification timestamp/);
  assert.throws(() => normalizeCostPayload({
    name: "Negative amount",
    projectId,
    costType: "LABOR",
    currency: "TRY",
    budgetAmount: "-1",
  }), /non-negative number/);
  assert.throws(() => normalizeCostPayload({
    name: "Invalid date",
    projectId,
    costType: "OTHER",
    currency: "TRY",
    occurredOn: "2026-02-31",
  }), /valid YYYY-MM-DD date/);
  assert.throws(() => normalizeCostPayload({
    name: "Missing actual",
    projectId,
    costType: "MATERIAL",
    currency: "TRY",
    actualAmount: "25",
    verificationStatus: "MISSING",
  }), /cannot include an actual amount/);
});

test("finance updates prioritize changed fields and preserve omitted values", () => {
  const payload = normalizeCostPayload(
    {
      costType: "LABOR",
      budgetAmount: null,
      notes: "Updated notes",
    },
    {
      name: "Existing cost",
      project_id: projectId,
      cost_type: "MATERIAL",
      currency: "TRY",
      budget_amount: 500,
      actual_amount: 200,
      verification_status: "UNVERIFIED",
      source: "Existing receipt",
      notes: "Old notes",
    }
  );
  assert.equal(payload.cost_type, "LABOR");
  assert.equal(payload.budget_amount, null);
  assert.equal(payload.actual_amount, 200);
  assert.equal(payload.source, "Existing receipt");
  assert.equal(payload.notes, "Updated notes");
});
