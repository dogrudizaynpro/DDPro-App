import { readFile } from "node:fs/promises";
import { Pool } from "pg";

const migrationUrl = new URL(
  "../../database/migrations/015_ai_tool_confirmations.sql",
  import.meta.url
);
const migrationLockName = "ddpro:migration:015_ai_tool_confirmations";
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

export const applyAiToolConfirmationsMigration = async ({
  connectionString = process.env.DATABASE_URL,
  caCertificate = process.env.DATABASE_SSL_CA,
  caCertificatePath = process.env.DATABASE_SSL_CA_PATH,
  PoolClass = Pool,
} = {}) => {
  if (!connectionString?.trim()) {
    throw new Error("DATABASE_URL is required to run production database migrations.");
  }

  let databaseUrl;
  try {
    databaseUrl = new URL(connectionString);
    if (
      !["postgres:", "postgresql:"].includes(databaseUrl.protocol) ||
      !databaseUrl.hostname
    ) {
      throw new Error();
    }
  } catch {
    throw new Error("DATABASE_URL must be a valid PostgreSQL TCP connection URL.");
  }

  // pg URL SSL parameters replace the explicit SSL object, including its CA.
  for (const key of [...databaseUrl.searchParams.keys()]) {
    if (key.startsWith("ssl") || key === "uselibpqcompat") {
      databaseUrl.searchParams.delete(key);
    }
  }

  if (caCertificate?.trim() && caCertificatePath?.trim()) {
    throw new Error("Configure only one of DATABASE_SSL_CA or DATABASE_SSL_CA_PATH.");
  }
  let ca = caCertificate?.replace(/\\n/g, "\n").trim();
  if (caCertificatePath?.trim()) {
    try {
      ca = (await readFile(caCertificatePath.trim(), "utf8")).trim();
    } catch {
      throw new Error("DATABASE_SSL_CA_PATH must point to a readable PEM CA certificate.");
    }
    if (!ca) {
      throw new Error("DATABASE_SSL_CA_PATH contains an empty CA certificate.");
    }
  }

  const migrationSql = await readFile(migrationUrl, "utf8");
  const pool = new PoolClass({
    connectionString: databaseUrl.toString(),
    ssl: { rejectUnauthorized: true, ...(ca ? { ca } : {}) },
    max: 1,
    connectionTimeoutMillis: 10_000,
  });
  let client;

  try {
    client = await pool.connect();
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [
      migrationLockName,
    ]);
    await client.query(migrationSql);

    const { rows } = await client.query(verificationQuery);
    const verified = rows[0];
    if (
      !verified?.rls_enabled ||
      !verified.expected_columns ||
      !verified.service_role_access ||
      !verified.anon_access_revoked ||
      !verified.authenticated_access_revoked
    ) {
      throw new Error("Migration 015 verification failed.");
    }

    await client.query("COMMIT");
    return { migration: "015_ai_tool_confirmations", applied: true };
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
