import assert from "node:assert/strict";
import { test } from "node:test";
import { getProjectUpdatePayload } from "../src/controllers/projects.controller.js";

test("project update payload normalizes editable fields and preserves explicit clears", () => {
  assert.deepEqual(getProjectUpdatePayload({
    name: "  Renovation  ",
    project_type: "  Interior  ",
    customer: "",
    location: "  İstanbul  ",
    area_m2: "42.5",
    systems: ["  HVAC ", "Lighting"],
    notes: "  Site visit  ",
    crm_contact_id: "4bc6f5a6-0b6c-4ddb-b29b-208c84c344d0",
    ignored: "not persisted",
  }), {
    name: "Renovation",
    project_type: "Interior",
    customer: null,
    location: "İstanbul",
    area_m2: 42.5,
    systems: ["HVAC", "Lighting"],
    notes: "Site visit",
    crm_contact_id: "4bc6f5a6-0b6c-4ddb-b29b-208c84c344d0",
  });
});

test("project update payload rejects invalid values before persistence", () => {
  for (const body of [
    { name: " " },
    { status: "" },
    { area_m2: -1 },
    { area_m2: "not a number" },
    { systems: ["ok", 4] },
    { notes: "x".repeat(20_001) },
    { crm_contact_id: "------------------------------------" },
    { cover_document_id: "not-a-uuid" },
  ]) {
    assert.throws(() => getProjectUpdatePayload(body), { statusCode: 400 });
  }
});

test("project update payload rejects non-object bodies and empty updates", () => {
  assert.throws(() => getProjectUpdatePayload(null), { statusCode: 400 });
  assert.deepEqual(getProjectUpdatePayload({ ignored: true }), {});
});
