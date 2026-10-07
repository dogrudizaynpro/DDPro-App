import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { Client } from "pg";
import {
  applyDatabaseMigrations,
  loadMigrations,
  serviceRoleTables,
} from "../src/services/migration-runner.js";

// Runs every migration against a real PostgreSQL server over verified TLS.
// DDPRO_MIGRATION_TEST_DATABASE_URL must point to a disposable database: its
// public schema is dropped and recreated by this test.
const connectionString = process.env.DDPRO_MIGRATION_TEST_DATABASE_URL;
const caCertificatePath = process.env.DDPRO_MIGRATION_TEST_SSL_CA_PATH;

const connect = async () => {
  const ca = caCertificatePath ? await readFile(caCertificatePath, "utf8") : undefined;
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: true, ...(ca ? { ca } : {}) },
  });
  await client.connect();
  return client;
};

const run = () =>
  applyDatabaseMigrations({ connectionString, caCertificate: "", caCertificatePath });

test(
  "all migrations apply, verify and re-run idempotently on PostgreSQL",
  { skip: !connectionString && "DDPRO_MIGRATION_TEST_DATABASE_URL is not set" },
  async () => {
    const migrations = await loadMigrations();
    const client = await connect();
    try {
      // Recreate the Supabase roles/storage objects the migrations rely on.
      await client.query(`
        DROP SCHEMA IF EXISTS public CASCADE;
        CREATE SCHEMA public;
        DO $$
        DECLARE role_name TEXT;
        BEGIN
          FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
            IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
              EXECUTE format('CREATE ROLE %I NOLOGIN', role_name);
            END IF;
          END LOOP;
        END $$;
        GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
        ALTER DEFAULT PRIVILEGES IN SCHEMA public
          GRANT ALL ON TABLES TO anon, authenticated, service_role;
        CREATE SCHEMA IF NOT EXISTS storage;
        CREATE TABLE IF NOT EXISTS storage.buckets (
          id TEXT PRIMARY KEY, name TEXT NOT NULL, public BOOLEAN DEFAULT false
        );
      `);
      // Reproduce production: only migration 015 was ever applied.
      const latest = migrations.at(-1);
      await client.query(latest.sql);

      const first = await run();
      assert.deepEqual(
        first.applied,
        migrations.map((migration) => migration.name)
      );
      assert.deepEqual(first.skipped, []);

      const { rows: tables } = await client.query(
        `SELECT c.relname, c.relrowsecurity,
           has_table_privilege('anon', c.oid, 'SELECT') AS anon_select,
           has_table_privilege('service_role', c.oid, 'SELECT,INSERT,UPDATE,DELETE') AS service_access
         FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relkind = 'r'`
      );
      const byName = new Map(tables.map((row) => [row.relname, row]));
      for (const table of [
        ...serviceRoleTables,
        "crm_contacts",
        "offers",
        "research_items",
        "ai_usage_events",
      ]) {
        const row = byName.get(table);
        assert.ok(row, `${table} should exist`);
        assert.equal(row.relrowsecurity, true, `${table} should enable RLS`);
        assert.equal(row.anon_select, false, `${table} should deny anon`);
        assert.equal(row.service_access, true, `${table} should allow service_role`);
      }

      const { rows: history } = await client.query(
        "SELECT version, checksum FROM public.schema_migrations ORDER BY version"
      );
      assert.deepEqual(
        history,
        migrations.map(({ version, checksum }) => ({ version, checksum }))
      );

      const second = await run();
      assert.deepEqual(second.applied, []);
      assert.equal(second.skipped.length, migrations.length);

      // Legacy databases migrated by hand have no history: replaying must not
      // fail or duplicate constraints.
      const constraintCount = async () =>
        (
          await client.query(
            `SELECT count(*)::int AS count FROM pg_constraint c
             JOIN pg_namespace n ON n.oid = c.connamespace WHERE n.nspname = 'public'`
          )
        ).rows[0].count;
      const constraintsBefore = await constraintCount();
      await client.query("DROP TABLE public.schema_migrations");
      const replay = await run();
      assert.equal(replay.applied.length, migrations.length);
      assert.equal(await constraintCount(), constraintsBefore);
    } finally {
      await client.end();
    }
  }
);
