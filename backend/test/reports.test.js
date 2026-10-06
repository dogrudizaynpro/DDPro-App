import assert from "node:assert/strict";
import { test } from "node:test";
import {
  calculateProjectCostTotals,
  calculateVerifiedMaterialTotals,
  normalizeReportRequest,
} from "../src/services/reports.service.js";

const projectId = "4bc6f5a6-0b6c-4ddb-b29b-208c84c344d0";

test("report request validates type, project linkage, and daily site report fields", () => {
  assert.deepEqual(normalizeReportRequest({
    type: "DAILY_SITE",
    projectId,
    reportDate: "2026-10-05",
    summary: "Ceiling framing completed.",
    workCompleted: "Installed 40 m².",
  }), {
    type: "DAILY_SITE",
    title: "Günlük saha raporu",
    projectId,
    reportDate: "2026-10-05",
    siteReport: {
      summary: "Ceiling framing completed.",
      workCompleted: "Installed 40 m².",
      issues: "",
      nextSteps: "",
    },
  });
  assert.throws(() => normalizeReportRequest({ type: "PROJECT" }), /project is required/);
  assert.throws(() => normalizeReportRequest({ type: "DAILY_SITE", projectId, reportDate: "2026-02-30", summary: "Work" }), /valid YYYY-MM-DD date/);
  assert.throws(() => normalizeReportRequest({ type: "UNSUPPORTED" }), /Report type is invalid/);
});

test("cost reports sum verified material only and keep missing/unverified counts separate", () => {
  assert.deepEqual(calculateVerifiedMaterialTotals([
    { verification_status: "VERIFIED", total_cost: "120.50", currency: "TRY" },
    { verification_status: "UNVERIFIED", total_cost: null },
    { verification_status: "MISSING", total_cost: null },
  ]), {
    totalsByCurrency: { TRY: 120.5 },
    unverifiedCount: 1,
    missingCount: 1,
  });
  assert.deepEqual(calculateProjectCostTotals([
    { cost_type: "MATERIAL", currency: "TRY", budget_amount: "150", actual_amount: "125", verification_status: "VERIFIED" },
    { cost_type: "MATERIAL", currency: "TRY", budget_amount: "40", actual_amount: "30", verification_status: "UNVERIFIED" },
    { cost_type: "LABOR", currency: "EUR", budget_amount: "100", actual_amount: "90", verification_status: "VERIFIED" },
  ]), {
    MATERIAL: { budgeted: { TRY: 190 }, verifiedActual: { TRY: 125 } },
    LABOR: { budgeted: { EUR: 100 }, verifiedActual: { EUR: 90 } },
  });
});
