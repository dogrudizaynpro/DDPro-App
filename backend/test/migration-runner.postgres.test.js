import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
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
  async (t) => {
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
              IF role_name = 'service_role' THEN
                EXECUTE format('CREATE ROLE %I NOLOGIN BYPASSRLS', role_name);
              ELSE
                EXECUTE format('CREATE ROLE %I NOLOGIN', role_name);
              END IF;
            END IF;
          END LOOP;
        END $$;
        ALTER ROLE service_role BYPASSRLS;
        GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
        ALTER DEFAULT PRIVILEGES IN SCHEMA public
          GRANT ALL ON TABLES TO anon, authenticated, service_role;
        CREATE SCHEMA IF NOT EXISTS storage;
        CREATE TABLE IF NOT EXISTS storage.buckets (
          id TEXT PRIMARY KEY, name TEXT NOT NULL, public BOOLEAN DEFAULT false
        );
      `);
      // Reproduce production: only migration 015 was ever applied.
      const deployedFixture = migrations.find((migration) => migration.version === "015");
      assert.ok(deployedFixture);
      await client.query(deployedFixture.sql);

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

      await t.test("WhatsApp table and claim RPC deny direct client roles and allow the backend service role", async () => {
        for (const role of ["anon", "authenticated", "service_role"]) {
          const { rows: [privileges] } = await client.query(
            `SELECT
               has_table_privilege($1, 'public.whatsapp_inbound_messages', 'SELECT') AS can_select,
               has_table_privilege($1, 'public.whatsapp_inbound_messages', 'INSERT') AS can_insert,
               has_table_privilege($1, 'public.whatsapp_inbound_messages', 'UPDATE') AS can_update,
               has_table_privilege($1, 'public.whatsapp_inbound_messages', 'DELETE') AS can_delete,
               has_function_privilege($1, 'public.claim_whatsapp_inbound(text,text,uuid)', 'EXECUTE') AS can_claim`,
            [role]
          );
          for (const permitted of Object.values(privileges)) {
            assert.equal(permitted, role === "service_role", `${role} privilege isolation`);
          }
        }
        assert.equal(byName.get("whatsapp_inbound_messages").relrowsecurity, true);
        for (const role of ["anon", "authenticated"]) {
          await client.query(`SET ROLE ${role}`);
          try {
            await assert.rejects(client.query("SELECT * FROM public.whatsapp_inbound_messages"),
              (error) => error.code === "42501");
            await assert.rejects(client.query(
              "SELECT public.claim_whatsapp_inbound($1, $2, $3)",
              ["denied-message", "905551234567", randomUUID()]
            ), (error) => error.code === "42501");
          } finally {
            await client.query("RESET ROLE");
          }
        }
        await client.query("SET ROLE service_role");
        try {
          const { rows: [row] } = await client.query(
            "SELECT public.claim_whatsapp_inbound($1, $2, $3) AS claimed",
            ["service-role-message", "905550000001", randomUUID()]
          );
          assert.equal(row.claimed.status, "processing");
        } finally {
          await client.query("RESET ROLE");
        }
      });

      await t.test("WhatsApp concurrent claims serialize duplicate IDs and distinct messages from the same phone", async () => {
        const peer = await connect();
        const sender = "905551234567";
        const claim = async (connection, id, phone = sender, token = randomUUID()) => {
          const { rows: [row] } = await connection.query(
            "SELECT public.claim_whatsapp_inbound($1, $2, $3) AS claimed",
            [id, phone, token]
          );
          return row.claimed;
        };
        try {
          const results = await Promise.all([
            claim(client, "concurrent-message"),
            claim(peer, "concurrent-message"),
          ]);
          assert.equal(results.filter(Boolean).length, 1);
          const winner = results.find(Boolean);
          assert.equal(winner.status, "processing");
          assert.equal(winner.sender, sender);
          assert.equal(await claim(peer, "next-message"), null);
          const independent = await claim(peer, "independent-message", "905557654321");
          assert.equal(independent.status, "processing");

          const { rows: [blocked] } = await client.query(
            "SELECT status FROM public.whatsapp_inbound_messages WHERE message_id = $1",
            ["next-message"]
          );
          assert.equal(blocked.status, "retry");
          await client.query(
            "UPDATE public.whatsapp_inbound_messages SET status = 'completed', lease_token = NULL, leased_until = NULL WHERE message_id = $1",
            ["concurrent-message"]
          );
          assert.equal(await claim(peer, "concurrent-message"), null);
          const next = await claim(peer, "next-message");
          assert.equal(next.status, "processing");
          const { rows: [count] } = await client.query(
            "SELECT count(*)::int AS count FROM public.whatsapp_inbound_messages WHERE sender = $1",
            [sender]
          );
          assert.equal(count.count, 2);
        } finally {
          await peer.end();
        }
      });

      await t.test("WhatsApp retry and expired leases preserve reply checkpoints and fence stale workers", async () => {
        const id = "retry-message";
        const sender = "905550000002";
        const firstToken = randomUUID();
        const secondToken = randomUUID();
        const claim = async (token) => (await client.query(
          "SELECT public.claim_whatsapp_inbound($1, $2, $3) AS claimed", [id, sender, token]
        )).rows[0].claimed;
        const initial = await claim(firstToken);
        assert.equal(initial.next_chunk, 0);
        assert.ok(Date.parse(initial.leased_until) > Date.now());
        await client.query(
          `UPDATE public.whatsapp_inbound_messages SET
             owner_account = 'owner@example.com', connection_version = repeat('a', 64),
             reply_chunks = '["first","second"]'::jsonb,
             next_chunk = 1, usage_recorded = true, confirmation_attempted = true,
             status = 'retry', lease_token = NULL, leased_until = NULL
           WHERE message_id = $1 AND lease_token = $2`,
          [id, firstToken]
        );
        const retry = await claim(secondToken);
        assert.deepEqual(retry.reply_chunks, ["first", "second"]);
        assert.equal(retry.next_chunk, 1);
        assert.equal(retry.usage_recorded, true);
        assert.equal(retry.confirmation_attempted, true);
        assert.equal(retry.connection_version, "a".repeat(64));
        const stale = await client.query(
          "UPDATE public.whatsapp_inbound_messages SET next_chunk = 2 WHERE message_id = $1 AND lease_token = $2 AND status = 'processing' RETURNING message_id",
          [id, firstToken]
        );
        assert.equal(stale.rowCount, 0);
        await client.query(
          "UPDATE public.whatsapp_inbound_messages SET leased_until = now() - interval '1 second' WHERE message_id = $1",
          [id]
        );
        const recovered = await claim(randomUUID());
        assert.equal(recovered.next_chunk, 1);
        assert.notEqual(recovered.lease_token, secondToken);
        assert.equal(recovered.owner_account, "owner@example.com");
        assert.equal(recovered.connection_version, "a".repeat(64));
        await assert.rejects(client.query(
          "UPDATE public.whatsapp_inbound_messages SET connection_version = $1 WHERE message_id = $2",
          ["invalid-connection-version", id]
        ), (error) => error.code === "23514");
        await assert.rejects(client.query(
          "SELECT public.claim_whatsapp_inbound($1, $2, $3)",
          ["invalid-sender-message", "not-a-phone", randomUUID()]
        ), (error) => error.code === "23514");
      });

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
