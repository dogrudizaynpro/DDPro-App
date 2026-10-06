import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { Client } from "pg";
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

test("URL SSL options cannot replace CA trust or disable certificate/hostname verification", async () => {
  const ca = "test CA\nsecond line";
  for (const parameters of [
    "sslmode=require",
    "sslmode=verify-full",
    "sslmode=no-verify",
    "sslmode=disable",
    "ssl=false",
    "ssl=0",
    "sslmode=verify-ca&uselibpqcompat=true",
    "sslrootcert=/missing/ca&sslcert=/missing/cert&sslkey=/missing/key",
  ]) {
    const databaseUrl = new URL("postgresql://example.invalid/ddpro");
    databaseUrl.username = "test-user";
    databaseUrl.password = "p@ss";
    databaseUrl.search = `${parameters}&application_name=migration`;
    let pool;
    class ConfigPool extends FakePool {
      constructor(options) {
        super(options);
        pool = this;
      }
    }
    await applyAiToolConfirmationsMigration({
      connectionString: databaseUrl.toString(),
      caCertificate: ca,
      caCertificatePath: "",
      PoolClass: ConfigPool,
    });
    // Exercise pg's actual URL parsing, not just the mocked pool options.
    const client = new Client(pool.options);
    assert.deepEqual(client.connectionParameters.ssl, { rejectUnauthorized: true, ca });
    assert.equal(client.connectionParameters.host, "example.invalid");
    assert.equal(client.connectionParameters.password, "p@ss");
    assert.equal(client.connectionParameters.application_name, "migration");
    assert.equal(client.connectionParameters.ssl.checkServerIdentity, undefined);
    assert.equal(pool.queries.at(-1), "COMMIT");
  }
});

test("CA configuration supports escaped PEM newlines and mounted files", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ddpro-ca-"));
  const path = join(directory, "ca.pem");
  await writeFile(path, "test CA\nsecond line\n");
  try {
    for (const source of [
      { caCertificate: "test CA\\nsecond line", caCertificatePath: "" },
      { caCertificate: "", caCertificatePath: path },
    ]) {
      let pool;
      class ConfigPool extends FakePool {
        constructor(options) {
          super(options);
          pool = this;
        }
      }
      await applyAiToolConfirmationsMigration({
        connectionString: "postgresql://example.invalid/ddpro",
        ...source,
        PoolClass: ConfigPool,
      });
      assert.deepEqual(pool.options.ssl, {
        rejectUnauthorized: true,
        ca: "test CA\nsecond line",
      });
    }
    await writeFile(path, " ");
    await assert.rejects(
      applyAiToolConfirmationsMigration({
        connectionString: "postgresql://example.invalid/ddpro",
        caCertificate: "",
        caCertificatePath: path,
      }),
      /empty CA certificate/
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("configuration errors fail closed without exposing connection credentials", async () => {
  await assert.rejects(
    applyAiToolConfirmationsMigration({
      connectionString: "invalid-secret-database-url",
    }),
    { message: "DATABASE_URL must be a valid PostgreSQL TCP connection URL." }
  );
  await assert.rejects(
    applyAiToolConfirmationsMigration({
      connectionString: "https://example.invalid/ddpro",
    }),
    /valid PostgreSQL TCP/
  );
  await assert.rejects(
    applyAiToolConfirmationsMigration({
      connectionString: "postgresql://example.invalid/ddpro",
      caCertificate: "CA",
      caCertificatePath: "/unused",
    }),
    /only one/
  );
  await assert.rejects(
    applyAiToolConfirmationsMigration({
      connectionString: "postgresql://example.invalid/ddpro",
      caCertificate: "",
      caCertificatePath: "/missing/ca.pem",
    }),
    { message: "DATABASE_SSL_CA_PATH must point to a readable PEM CA certificate." }
  );
});

test("TLS connection failures close the pool without applying the migration", async () => {
  let pool;
  const error = Object.assign(new Error("untrusted chain"), { code: "SELF_SIGNED_CERT_IN_CHAIN" });
  class UntrustedPool extends FakePool {
    constructor(options) {
      super(options);
      pool = this;
    }
    async connect() {
      throw error;
    }
  }
  await assert.rejects(
    applyAiToolConfirmationsMigration({
      connectionString: "postgresql://example.invalid/ddpro",
      caCertificate: "",
      caCertificatePath: "",
      PoolClass: UntrustedPool,
    }),
    (caught) => caught === error
  );
  assert.deepEqual(pool.queries, []);
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
