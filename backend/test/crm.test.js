import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeCrmContact } from "../src/services/crm.service.js";

const projectId = "4bc6f5a6-0b6c-4ddb-b29b-208c84c344d0";

test("CRM contact normalization accepts project relations and normalized contact details", () => {
  const contact = normalizeCrmContact({
    name: "  Ada Yılmaz ",
    email: " ADA@EXAMPLE.COM ",
    phone: " +90 555 000 00 00 ",
    projectId,
    area_m2: "42.5",
  });
  assert.equal(contact.name, "Ada Yılmaz");
  assert.equal(contact.email, "ada@example.com");
  assert.equal(contact.project_id, projectId);
  assert.equal(contact.area_m2, 42.5);
  assert.equal(contact.source, "manual");
});

test("CRM contact validation rejects invalid project references and empty contacts", () => {
  assert.throws(
    () => normalizeCrmContact({ name: "Valid name", project_id: "invalid" }),
    /project reference must be a valid UUID/
  );
  assert.throws(
    () => normalizeCrmContact({}),
    /requires a name, email address, or phone number/
  );
  assert.throws(
    () => normalizeCrmContact({ name: "Valid name", contact_date: "2026-99-32" }),
    /valid YYYY-MM-DD date/
  );
});
