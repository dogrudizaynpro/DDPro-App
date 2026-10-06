import assert from "node:assert/strict";
import { test } from "node:test";
import { applyAiToolConfirmationsMigration } from "../src/services/migration-runner.js";

class FakePool {
  constructor(options, { verified = true } = {}) {
    this.options = options;
    this.verified = verified;
    this.queries = [];
    this.ended = false;
    this.released = false;
  }

  async connect() {
    return {
      query: async (text) => {
        this.queries.push(text);
        if (text.includes("FROM pg_class AS table_info")) {
          return {
            rows: [
              {
                rls_enabled: this.verified,
                expected_columns: this.verified,
                service_role_access: this.verified,
                anon_access_revoked: this.verified,
                authenticated_access_revoked: this.verified,
              },
            ],
          };
        }
        return { rows: [] };
      },
      release: () => {
        this.released = true;
      },
    };
  }

  async end() {
    this.ended = true;
  }
}

test("migration requires a direct database connection configuration", async () => {
  await assert.rejects(
    applyAiToolConfirmationsMigration({ connectionString: " " }),
    /DATABASE_URL is required/
  );
});

test("migration applies and verifies the protected table in one locked transaction", async () => {
  let pool;
  class SuccessfulPool extends FakePool {
    constructor(options) {
      super(options);
      pool = this;
    }
  }

  const result = await applyAiToolConfirmationsMigration({
    connectionString: "postgresql://example.invalid/ddpro",
    PoolClass: SuccessfulPool,
  });

  assert.deepEqual(result, {
    migration: "015_ai_tool_confirmations",
    applied: true,
  });
  assert.equal(pool.options.ssl.rejectUnauthorized, true);
  assert.equal(pool.queries[0], "BEGIN");
  assert.match(pool.queries[1], /pg_advisory_xact_lock/);
  assert.ok(pool.queries[2].includes("CREATE TABLE IF NOT EXISTS"));
  assert.ok(pool.queries[3].includes("FROM pg_class AS table_info"));
  assert.equal(pool.queries.at(-1), "COMMIT");
  assert.equal(pool.released, true);
  assert.equal(pool.ended, true);
});

test("migration rolls back and closes the connection when verification fails", async () => {
  let pool;
  class FailedVerificationPool extends FakePool {
    constructor(options) {
      super(options, { verified: false });
      pool = this;
    }
  }

  await assert.rejects(
    applyAiToolConfirmationsMigration({
      connectionString: "postgresql://example.invalid/ddpro",
      PoolClass: FailedVerificationPool,
    }),
    /Migration 015 verification failed/
  );

  assert.equal(pool.queries.at(-1), "ROLLBACK");
  assert.equal(pool.released, true);
  assert.equal(pool.ended, true);
});
