import assert from "node:assert/strict";
import { test } from "node:test";
import {
  consumeOperationalConfirmation,
  createFileImportFingerprint,
  isRecordSnapshotCurrent,
  prepareOperationalWrite,
  readOperationalRecords,
} from "../src/services/ai-tools.service.js";

const uuid = "4bc6f5a6-0b6c-4ddb-b29b-208c84c344d0";

test("file import fingerprints are stable for the same proposed row and scoped to module", () => {
  const source = "a".repeat(64);
  assert.equal(
    createFileImportFingerprint(source, "projects", { name: "Chair", status: "Active" }),
    createFileImportFingerprint(source, "projects", { status: "Active", name: "Chair" })
  );
  assert.notEqual(
    createFileImportFingerprint(source, "projects", { name: "Chair" }),
    createFileImportFingerprint(source, "projects", { name: "Table" })
  );
  assert.notEqual(
    createFileImportFingerprint(source, "projects", { name: "Chair" }),
    createFileImportFingerprint(source, "products", { name: "Chair" })
  );
  assert.equal(createFileImportFingerprint("invalid", "projects", {}), null);
});

test("AI operational tools reject unsupported resources and write operations", async () => {
  await assert.rejects(
    readOperationalRecords("owner@example.com", { resource: "integration_tokens" }),
    (error) => error.statusCode === 400
  );
  await assert.rejects(
    prepareOperationalWrite("owner@example.com", {
      resource: "projects",
      operation: "execute_sql",
      id: uuid,
    }),
    (error) => error.statusCode === 400
  );
});

test("AI writes require a valid target ID for updates and deletes", async () => {
  for (const operation of ["update", "delete"]) {
    await assert.rejects(
      prepareOperationalWrite("owner@example.com", {
        resource: "projects",
        operation,
        id: "not-a-uuid",
      }),
      (error) => error.statusCode === 400
    );
  }
});

test("AI confirmations are owner-bound, expire, and can be consumed only once", async () => {
  const now = "2026-10-06T17:00:00.000Z";
  const row = {
    id: uuid,
    owner_account: "owner@example.com",
    expires_at: "2026-10-06T17:05:00.000Z",
    confirmed_at: null,
    resource: "projects",
    operation: "create",
    record_id: null,
    record_payload: { name: "Approved project" },
  };
  const admin = {
    from(table) {
      assert.equal(table, "ai_tool_confirmations");
      let predicates = [];
      return {
        update(values) {
          this.values = values;
          return this;
        },
        eq(column, value) {
          predicates.push([column, value]);
          return this;
        },
        is(column, value) {
          predicates.push([column, value]);
          return this;
        },
        gt(column, value) {
          predicates.push([column, value]);
          return this;
        },
        select() {
          return this;
        },
        async maybeSingle() {
          const matches = predicates.every(([column, value]) => {
            if (column === "expires_at") return row.expires_at > value;
            return row[column] === value;
          });
          if (!matches) return { data: null, error: null };
          row.confirmed_at = this.values.confirmed_at;
          return { data: { ...row }, error: null };
        },
      };
    },
  };

  const firstUse = await consumeOperationalConfirmation(admin, "owner@example.com", uuid, now);
  assert.equal(firstUse.record_payload.name, "Approved project");
  assert.equal(
    await consumeOperationalConfirmation(admin, "owner@example.com", uuid, now),
    null
  );
  assert.equal(
    await consumeOperationalConfirmation(admin, "other@example.com", uuid, now),
    null
  );
  assert.equal(
    await consumeOperationalConfirmation(admin, "owner@example.com", uuid, "2026-10-06T17:06:00.000Z"),
    null
  );
});

test("AI update confirmation detects target changes after the user reviewed the preview", () => {
  const reviewed = { id: uuid, name: "Project", nested: { status: "Active" } };
  assert.equal(
    isRecordSnapshotCurrent(
      { nested: { status: "Active" }, name: "Project", id: uuid },
      reviewed
    ),
    true
  );
  assert.equal(
    isRecordSnapshotCurrent({ ...reviewed, name: "Changed by another user" }, reviewed),
    false
  );
  assert.equal(isRecordSnapshotCurrent(null, reviewed), false);
});
