import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { Client } from "pg";
import {
  applyDatabaseMigrations,
  loadMigrations,
  serviceRoleTables,
} from "../src/services/migration-runner.js";

class FakePool {
  constructor(options, { verified = true, history = [], unprotected = [] } = {}) {
    this.options = options;
    this.verified = verified;
    this.history = history;
    this.unprotected = unprotected;
    this.queries = [];
    this.ended = false;
    this.released = false;
  }

  async connect() {
    return {
      query: async (text) => {
        this.queries.push(text);
        if (text.startsWith("SELECT version, checksum FROM public.schema_migrations")) {
          return { rows: this.history };
        }
        if (text.includes("unnest($1::text[]")) {
          return { rows: this.unprotected.map((table_name) => ({ table_name })) };
        }
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
    applyDatabaseMigrations({ connectionString: " " }),
    /DATABASE_URL is required/
  );
});

test("all migrations are applied in numeric order in one locked transaction", async () => {
  let pool;
  class SuccessfulPool extends FakePool {
    constructor(options) {
      super(options);
      pool = this;
    }
  }

  const migrations = await loadMigrations();
  const result = await applyDatabaseMigrations({
    connectionString: "postgresql://example.invalid/ddpro",
    PoolClass: SuccessfulPool,
  });

  assert.deepEqual(result, {
    applied: migrations.map((migration) => migration.name),
    skipped: [],
  });
  assert.equal(result.applied[0], "001_base_schema");
  assert.equal(result.applied.at(-1), "017_project_sheet_import");
  assert.equal(pool.options.ssl.rejectUnauthorized, true);
  assert.equal(pool.queries[0], "BEGIN");
  assert.match(pool.queries[1], /pg_advisory_xact_lock/);
  assert.match(pool.queries[2], /CREATE TABLE IF NOT EXISTS public\.schema_migrations/);
  const executed = pool.queries.filter((text) =>
    migrations.some((migration) => migration.sql === text)
  );
  assert.deepEqual(
    executed,
    migrations.map((migration) => migration.sql)
  );
  assert.equal(
    pool.queries.filter((text) => text.startsWith("INSERT INTO public.schema_migrations")).length,
    migrations.length
  );
  assert.ok(pool.queries.at(-3).includes("table_info.relname = 'ai_tool_confirmations'"));
  assert.ok(pool.queries.at(-2).includes("unnest($1::text[]"));
  assert.equal(pool.queries.at(-1), "COMMIT");
  assert.equal(pool.released, true);
  assert.equal(pool.ended, true);
});

test("migrations loaded from disk are numbered, unique and include the core production tables", async () => {
  const migrations = await loadMigrations();
  const versions = migrations.map((migration) => Number(migration.version));
  assert.deepEqual(versions, [...versions].sort((left, right) => left - right));
  assert.equal(new Set(versions).size, versions.length);
  const allSql = migrations.map((migration) => migration.sql).join("\n");
  for (const table of ["crm_contacts", "offers", "research_items", "ai_usage_events", "whatsapp_inbound_messages"]) {
    assert.ok(serviceRoleTables.includes(table));
    assert.match(allSql, new RegExp(`CREATE TABLE IF NOT EXISTS (public\\.)?${table} \\(`));
  }
});

test("migration files are ordered numerically and invalid names fail closed", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ddpro-migrations-"));
  try {
    await writeFile(join(directory, "010_later.sql"), "SELECT 10;");
    await writeFile(join(directory, "002_earlier.sql"), "SELECT 2;");
    await writeFile(join(directory, "README.md"), "ignored");
    const migrations = await loadMigrations(directory);
    assert.deepEqual(
      migrations.map((migration) => migration.name),
      ["002_earlier", "010_later"]
    );
    await writeFile(join(directory, "2_bad.sql"), "SELECT 1;");
    await assert.rejects(loadMigrations(directory), /Invalid migration file name/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("previously applied migrations are skipped and modified ones fail closed", async () => {
  const migrations = await loadMigrations();
  const history = migrations
    .slice(0, -1)
    .map(({ version, checksum }) => ({ version, checksum }));
  let pool;
  class HistoryPool extends FakePool {
    constructor(options) {
      super(options, { history });
      pool = this;
    }
  }
  const result = await applyDatabaseMigrations({
    connectionString: "postgresql://example.invalid/ddpro",
    PoolClass: HistoryPool,
  });
  assert.deepEqual(result.applied, ["017_project_sheet_import"]);
  assert.equal(result.skipped.length, migrations.length - 1);
  for (const migration of migrations.slice(0, -1)) {
    assert.ok(!pool.queries.includes(migration.sql));
  }
  assert.equal(pool.queries.at(-1), "COMMIT");

  class TamperedPool extends FakePool {
    constructor(options) {
      super(options, { history: [{ version: "004", checksum: "0".repeat(64) }] });
      pool = this;
    }
  }
  await assert.rejects(
    applyDatabaseMigrations({
      connectionString: "postgresql://example.invalid/ddpro",
      PoolClass: TamperedPool,
    }),
    /004_operations_integrations was modified after it was applied/
  );
  assert.equal(pool.queries.at(-1), "ROLLBACK");
  assert.equal(pool.ended, true);
});

test("migration rolls back when core tables are missing or exposed", async () => {
  let pool;
  class UnprotectedPool extends FakePool {
    constructor(options) {
      super(options, { unprotected: ["crm_contacts", "offers"] });
      pool = this;
    }
  }
  await assert.rejects(
    applyDatabaseMigrations({
      connectionString: "postgresql://example.invalid/ddpro",
      PoolClass: UnprotectedPool,
    }),
    /verification failed for: crm_contacts, offers/
  );
  assert.equal(pool.queries.at(-1), "ROLLBACK");
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
    await applyDatabaseMigrations({
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
      await applyDatabaseMigrations({
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
      applyDatabaseMigrations({
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
    applyDatabaseMigrations({
      connectionString: "invalid-secret-database-url",
    }),
    { message: "DATABASE_URL must be a valid PostgreSQL TCP connection URL." }
  );
  await assert.rejects(
    applyDatabaseMigrations({
      connectionString: "https://example.invalid/ddpro",
    }),
    /valid PostgreSQL TCP/
  );
  await assert.rejects(
    applyDatabaseMigrations({
      connectionString: "postgresql://example.invalid/ddpro",
      caCertificate: "CA",
      caCertificatePath: "/unused",
    }),
    /only one/
  );
  await assert.rejects(
    applyDatabaseMigrations({
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
    applyDatabaseMigrations({
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
    applyDatabaseMigrations({
      connectionString: "postgresql://example.invalid/ddpro",
      PoolClass: FailedVerificationPool,
    }),
    /Migration 015 verification failed/
  );

  assert.equal(pool.queries.at(-1), "ROLLBACK");
  assert.equal(pool.released, true);
  assert.equal(pool.ended, true);
});
