import assert from "node:assert/strict";
import { test } from "node:test";
import { createCrmContact, normalizeCrmContact, updateCrmContact } from "../src/services/crm.service.js";

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

const contactStore = () => {
  const rows = [];
  const client = {
    from(table) {
      assert.equal(table, "crm_contacts");
      const predicates = [];
      let insert, update;
      return {
        select() { return this; },
        eq(field, value) { predicates.push((row) => row[field] === value); return this; },
        neq(field, value) { predicates.push((row) => row[field] !== value); return this; },
        limit() { return this; },
        insert(payload) { insert = payload; return this; },
        update(payload) { update = payload; return this; },
        async maybeSingle() {
          const row = rows.find((row) => predicates.every((predicate) => predicate(row)));
          if (row && update) Object.assign(row, update);
          return { data: row || null };
        },
        async single() {
          if (rows.some((row) => row.source === insert.source &&
              row.source_external_id === insert.source_external_id && insert.source_external_id)) {
            return { error: { code: "23505" } };
          }
          const row = { id: String(rows.length + 1), ...insert };
          rows.push(row);
          return { data: row };
        },
      };
    },
  };
  return { rows, client };
};

test("WhatsApp CRM identity is per external message ID, not per phone number", async () => {
  const { rows, client } = contactStore();
  const lead = { name: "Ada", phone: "905551234567", source: "whatsapp" };
  const first = await createCrmContact({ ...lead, source_external_id: "wamid.first" }, { inbound: true }, client);
  const duplicate = await createCrmContact({ ...lead, source_external_id: "wamid.first" }, { inbound: true }, client);
  const second = await createCrmContact({ ...lead, source_external_id: "wamid.second" }, { inbound: true }, client);
  assert.equal(first.duplicate, false);
  assert.equal(duplicate.duplicate, true);
  assert.equal(second.duplicate, false);
  assert.equal(rows.length, 2);
});

test("WhatsApp CRM concurrent external message inserts resolve the unique constraint safely", async () => {
  const { rows, client } = contactStore();
  const body = { name: "Ada", phone: "905551234567", source: "whatsapp", source_external_id: "wamid.race" };
  const results = await Promise.all([
    createCrmContact(body, { inbound: true }, client),
    createCrmContact(body, { inbound: true }, client),
  ]);
  assert.equal(rows.length, 1);
  assert.equal(results.filter((result) => result.duplicate).length, 1);
  assert.equal(results[0].contact.id, results[1].contact.id);
});

test("natural CRM dedup remains unchanged for website, Gmail, manual and WhatsApp without message IDs", async () => {
  for (const source of ["website", "gmail", "manual", "whatsapp"]) {
    const { rows, client } = contactStore();
    const lead = { name: "Ada", phone: "905551234567", source };
    await createCrmContact(lead, { inbound: true }, client);
    const result = await createCrmContact({
      ...lead,
      ...(source === "whatsapp" ? {} : { source_external_id: "another-id" }),
    }, { inbound: true }, client);
    assert.equal(result.duplicate, true, source);
    assert.equal(rows.length, 1, source);
  }
});

test("distinct WhatsApp message leads remain editable without changing other sources' update dedup", async () => {
  for (const source of ["whatsapp", "website"]) {
    const { rows, client } = contactStore();
    const lead = {
      id: projectId, name: "Ada", phone: "905551234567", source,
      source_external_id: "message-one", contact_date: "2026-10-07",
    };
    rows.push(lead, { ...lead, id: "4bc6f5a6-0b6c-4ddb-b29b-208c84c344d1", source_external_id: "message-two" });
    if (source === "whatsapp") {
      const updated = await updateCrmContact(projectId, { status: "İşlemde" }, client);
      assert.equal(updated.status, "İşlemde");
      assert.equal(updated.source_external_id, "message-one");
    } else {
      await assert.rejects(updateCrmContact(projectId, { status: "İşlemde" }, client),
        (error) => error.statusCode === 409);
    }
  }
});
