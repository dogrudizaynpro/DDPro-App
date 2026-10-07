import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

// Errors raised by the runner itself carry safe, credential-free messages.
export class MigrationError extends Error {
  name = "MigrationError";
}

const migrationsDirectoryUrl = new URL("../../database/migrations/", import.meta.url);
const migrationFilePattern = /^(\d{3})_([a-z0-9_]+)\.sql$/;
const migrationLockName = "ddpro:database-migrations";
const historyTableSql = `
  CREATE TABLE IF NOT EXISTS public.schema_migrations (
    version TEXT PRIMARY KEY CHECK (version ~ '^[0-9]{3}$'),
    name TEXT NOT NULL,
    checksum TEXT NOT NULL CHECK (checksum ~ '^[0-9a-f]{64}$'),
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  ALTER TABLE public.schema_migrations ENABLE ROW LEVEL SECURITY;
  REVOKE ALL ON TABLE public.schema_migrations FROM anon, authenticated;
`;

// Tables that must exist with RLS enabled, backend service-role access and no
// direct anon/authenticated access once every migration has been applied.
export const serviceRoleTables = [
  "projects",
  "research_items",
  "offers",
  "crm_contacts",
  "systems",
  "products",
  "price_analysis",
  "material_analysis",
  "report_records",
  "project_costs",
  "message_conversations",
  "messages",
  "document_records",
  "ai_usage_events",
  "ai_tool_confirmations",
];
// Tables that must exist with RLS enabled and no direct client access.
const privateTables = ["integration_tokens", "schema_migrations"];

const protectedTablesQuery = `
  SELECT required.table_name
  FROM unnest($1::text[], $2::boolean[]) AS required(table_name, requires_service_role)
  LEFT JOIN pg_class AS table_info
    ON table_info.oid = to_regclass('public.' || quote_ident(required.table_name))
  WHERE NOT COALESCE(
    table_info.relkind IN ('r', 'p')
      AND table_info.relrowsecurity
      AND (
        NOT required.requires_service_role
        OR (
          has_table_privilege('service_role', table_info.oid, 'SELECT')
          AND has_table_privilege('service_role', table_info.oid, 'INSERT')
          AND has_table_privilege('service_role', table_info.oid, 'UPDATE')
          AND has_table_privilege('service_role', table_info.oid, 'DELETE')
        )
      )
      AND NOT has_table_privilege('anon', table_info.oid, 'SELECT,INSERT,UPDATE,DELETE')
      AND NOT has_table_privilege('authenticated', table_info.oid, 'SELECT,INSERT,UPDATE,DELETE'),
    false
  )
  ORDER BY required.table_name
`;
const verificationQuery = `
  SELECT
    table_info.relrowsecurity AS rls_enabled,
    (
      SELECT count(*) = 10
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'ai_tool_confirmations'
        AND column_name IN (
          'id', 'owner_account', 'resource', 'operation', 'record_id',
          'record_payload', 'record_snapshot', 'expires_at', 'confirmed_at',
          'created_at'
        )
    ) AS expected_columns,
    has_table_privilege('service_role', table_info.oid, 'SELECT')
      AND has_table_privilege('service_role', table_info.oid, 'INSERT')
      AND has_table_privilege('service_role', table_info.oid, 'UPDATE')
      AND has_table_privilege('service_role', table_info.oid, 'DELETE')
      AS service_role_access,
    NOT has_table_privilege('anon', table_info.oid, 'SELECT')
      AND NOT has_table_privilege('anon', table_info.oid, 'INSERT')
      AND NOT has_table_privilege('anon', table_info.oid, 'UPDATE')
      AND NOT has_table_privilege('anon', table_info.oid, 'DELETE')
      AS anon_access_revoked,
    NOT has_table_privilege('authenticated', table_info.oid, 'SELECT')
      AND NOT has_table_privilege('authenticated', table_info.oid, 'INSERT')
      AND NOT has_table_privilege('authenticated', table_info.oid, 'UPDATE')
      AND NOT has_table_privilege('authenticated', table_info.oid, 'DELETE')
      AS authenticated_access_revoked
  FROM pg_class AS table_info
  JOIN pg_namespace AS schema_info ON schema_info.oid = table_info.relnamespace
  WHERE schema_info.nspname = 'public'
    AND table_info.relname = 'ai_tool_confirmations'
`;

export const loadMigrations = async (directory = migrationsDirectoryUrl) => {
  const directoryPath = directory instanceof URL ? fileURLToPath(directory) : directory;
  const entries = await readdir(directoryPath, { withFileTypes: true });
  const migrations = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".sql")) {
      continue;
    }
    const match = migrationFilePattern.exec(entry.name);
    if (!match) {
      throw new MigrationError(`Invalid migration file name: ${entry.name}`);
    }
    const sql = await readFile(join(directoryPath, entry.name), "utf8");
    migrations.push({
      version: match[1],
      name: entry.name.slice(0, -".sql".length),
      sql,
      checksum: createHash("sha256").update(sql).digest("hex"),
    });
  }

  migrations.sort((left, right) => Number(left.version) - Number(right.version));
  for (let index = 1; index < migrations.length; index += 1) {
    if (migrations[index].version === migrations[index - 1].version) {
      throw new MigrationError(`Duplicate migration version: ${migrations[index].version}`);
    }
  }
  if (migrations.length === 0) {
    throw new MigrationError("No database migrations were found.");
  }
  return migrations;
};

export const applyDatabaseMigrations = async ({
  connectionString = process.env.DATABASE_URL,
  caCertificate = process.env.DATABASE_SSL_CA,
  caCertificatePath = process.env.DATABASE_SSL_CA_PATH,
  migrationsDirectory = migrationsDirectoryUrl,
  PoolClass = Pool,
} = {}) => {
  if (!connectionString?.trim()) {
    throw new MigrationError("DATABASE_URL is required to run production database migrations.");
  }

  let databaseUrl;
  try {
    databaseUrl = new URL(connectionString);
    if (
      !["postgres:", "postgresql:"].includes(databaseUrl.protocol) ||
      !databaseUrl.hostname
    ) {
      throw new MigrationError();
    }
  } catch {
    throw new MigrationError("DATABASE_URL must be a valid PostgreSQL TCP connection URL.");
  }

  // pg URL SSL parameters replace the explicit SSL object, including its CA.
  for (const key of [...databaseUrl.searchParams.keys()]) {
    if (key.startsWith("ssl") || key === "uselibpqcompat") {
      databaseUrl.searchParams.delete(key);
    }
  }

  if (caCertificate?.trim() && caCertificatePath?.trim()) {
    throw new MigrationError("Configure only one of DATABASE_SSL_CA or DATABASE_SSL_CA_PATH.");
  }
  let ca = caCertificate?.replace(/\\n/g, "\n").trim();
  if (caCertificatePath?.trim()) {
    try {
      ca = (await readFile(caCertificatePath.trim(), "utf8")).trim();
    } catch {
      throw new MigrationError("DATABASE_SSL_CA_PATH must point to a readable PEM CA certificate.");
    }
    if (!ca) {
      throw new MigrationError("DATABASE_SSL_CA_PATH contains an empty CA certificate.");
    }
  }

  const migrations = await loadMigrations(migrationsDirectory);
  const pool = new PoolClass({
    connectionString: databaseUrl.toString(),
    ssl: { rejectUnauthorized: true, ...(ca ? { ca } : {}) },
    max: 1,
    connectionTimeoutMillis: 10_000,
  });
  let client;

  try {
    client = await pool.connect();
    // All pending migrations, their history rows and the verification run in a
    // single serialized transaction so a failure leaves the schema unchanged.
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [
      migrationLockName,
    ]);
    await client.query(historyTableSql);
    const history = await client.query(
      "SELECT version, checksum FROM public.schema_migrations"
    );
    const appliedChecksums = new Map(
      history.rows.map((row) => [row.version, row.checksum])
    );

    const applied = [];
    const skipped = [];
    for (const migration of migrations) {
      if (appliedChecksums.has(migration.version)) {
        if (appliedChecksums.get(migration.version) !== migration.checksum) {
          throw new MigrationError(
            `Migration ${migration.name} was modified after it was applied; add a new migration instead.`
          );
        }
        skipped.push(migration.name);
        continue;
      }
      await client.query(migration.sql);
      await client.query(
        "INSERT INTO public.schema_migrations (version, name, checksum) VALUES ($1, $2, $3)",
        [migration.version, migration.name, migration.checksum]
      );
      applied.push(migration.name);
    }

    const { rows } = await client.query(verificationQuery);
    const verified = rows[0];
    if (
      !verified?.rls_enabled ||
      !verified.expected_columns ||
      !verified.service_role_access ||
      !verified.anon_access_revoked ||
      !verified.authenticated_access_revoked
    ) {
      throw new MigrationError("Migration 015 verification failed.");
    }

    const tables = [...serviceRoleTables, ...privateTables];
    const unprotected = await client.query(protectedTablesQuery, [
      tables,
      tables.map((table) => serviceRoleTables.includes(table)),
    ]);
    if (unprotected.rows.length > 0) {
      throw new MigrationError(
        `Database schema/RLS/grants verification failed for: ${unprotected.rows
          .map((row) => row.table_name)
          .join(", ")}.`
      );
    }

    await client.query("COMMIT");
    return { applied, skipped };
  } catch (error) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // Preserve the original migration error.
      }
    }
    throw error;
  } finally {
    client?.release();
    await pool.end();
  }
};
