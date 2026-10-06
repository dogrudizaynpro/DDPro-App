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
  PoolClass = Pool,
} = {}) => {
  if (!connectionString?.trim()) {
    throw new Error("DATABASE_URL is required to run production database migrations.");
  }

  const migrationSql = await readFile(migrationUrl, "utf8");
  const pool = new PoolClass({
    connectionString,
    ssl: { rejectUnauthorized: true },
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
