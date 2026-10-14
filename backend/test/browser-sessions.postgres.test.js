import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { Client } from "pg";

const connectionString = process.env.DDPRO_SESSION_TEST_DATABASE_URL;
test("independent sessions, epoch fences, proofs and durable disconnect on PostgreSQL",
  { skip: !connectionString && "DDPRO_SESSION_TEST_DATABASE_URL is not set" }, async () => {
    const client = new Client({ connectionString });
    await client.connect();
    const rpc = async (operation, args = {}) => (await client.query(
      "SELECT public.ddpro_auth($1,$2::jsonb) AS result", [operation, JSON.stringify(args)]
    )).rows[0].result;
    const email = `sessions-${randomUUID()}@example.com`;
    const concurrent = new Client({ connectionString });
    await concurrent.connect();
    const login = async () => {
      const attempt = await rpc("begin", { challenge: "challenge" });
      const code = randomUUID();
      await rpc("callback", { attempt: attempt.id, account: email, code,
        token: { ciphertext: "encrypted", version: 1 }, adequate: true });
      const restore = randomUUID();
      return { ...await rpc("exchange", { code, challenge: "challenge", session: randomUUID(), restore }), restore };
    };
    try {
      await client.query(await readFile(new URL("../database/migrations/024_browser_sessions.sql", import.meta.url), "utf8"));
      const [a, b, c] = [await login(), await login(), await login()];
      const whatsappConfirmation = randomUUID();
      await client.query(`INSERT INTO ai_tool_confirmations(id,owner_account,resource,operation,record_payload,expires_at)
        VALUES($1,$2,'projects','create','{}',now()+interval '5 minutes')`, [whatsappConfirmation, email]);
      for (const session of [a, b, c]) {
        assert.ok(await rpc("validate", session));
        assert.ok(await rpc("restore", { session: session.session, restore: session.restore }));
      }
      await rpc("logout", a);
      assert.equal(await rpc("validate", a), null);
      assert.ok(await rpc("validate", b));
      assert.ok(await rpc("validate", c));
      const before = await rpc("begin", { challenge: "old" });
      const proofAttempt = await rpc("begin", { ...b, action: "revoke-all", challenge: "fresh" });
      await rpc("callback", { attempt: proofAttempt.id, account: email, code: "proof-code" });
      const proof = await rpc("exchange", { code: "proof-code", challenge: "fresh", proof: "proof" });
      assert.equal(proof.action, "revoke-all");
      await rpc("revoke-all", { ...b, proof: "proof" });
      for (const session of [a, b, c]) assert.equal(await rpc("validate", session), null);
      assert.equal(await rpc("restore", { session: b.session, restore: b.restore }), null);
      await assert.rejects(rpc("callback", { attempt: before.id, account: email, code: "stale" }));
      assert.equal((await client.query("SELECT id FROM ai_tool_confirmations WHERE id=$1", [whatsappConfirmation])).rows.length, 1);
      const d = await login();
      const disconnect = await rpc("begin", { ...d, action: "disconnect", challenge: "fresh" });
      await rpc("callback", { attempt: disconnect.id, account: email, code: "disconnect-code" });
      await rpc("exchange", { code: "disconnect-code", challenge: "fresh", proof: "disconnect-proof" });
      const job = await rpc("disconnect", { ...d, proof: "disconnect-proof" });
      assert.ok(job.id);
      assert.equal(await rpc("validate", d), null);
      const e = await login();
      assert.ok(await rpc("validate", e));
      assert.ok(await rpc("pending", { account: email }));
      await rpc("finish-revocation", { account: email, job: job.id, succeeded: false });
      assert.ok(await rpc("pending", { account: email }));
      await rpc("finish-revocation", { account: email, job: job.id, succeeded: true });
      assert.equal(await rpc("pending", { account: email }), null);
      const f = await login();
      const fenceAttempt = await rpc("begin", { challenge: "fence" });
      const queuedGrant = await rpc("begin", { challenge: "queued" });
      await rpc("callback", { attempt: queuedGrant.id, account: email, code: "queued-code",
        token: { ciphertext: "encrypted", version: 1 }, adequate: true });
      const freshAttempt = await rpc("begin", { ...f, action: "revoke-all", challenge: "fresh" });
      await rpc("callback", { attempt: freshAttempt.id, account: email, code: "fence-proof-code" });
      await rpc("exchange", { code: "fence-proof-code", challenge: "fresh", proof: "fence-proof" });
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended('ddpro:browser-auth',0))");
      const delayedCallback = concurrent.query("SELECT ddpro_auth('callback',$1::jsonb)", [{
        attempt: fenceAttempt.id, account: email, code: "late-callback", adequate: true,
      }]);
      const callbackRejected = assert.rejects(delayedCallback, /revoked/);
      await rpc("revoke-all", { ...f, proof: "fence-proof" });
      await client.query("COMMIT");
      await callbackRejected;
      assert.equal(await rpc("exchange", { code: "queued-code", challenge: "queued",
        session: randomUUID(), restore: randomUUID() }), null);
      assert.equal(await rpc("restore", { session: f.session, restore: f.restore }), null);
      for (const role of ["anon", "authenticated"]) {
        const { rows } = await client.query(
          "SELECT has_function_privilege($1,'public.ddpro_auth(text,jsonb)','EXECUTE') AS allowed", [role]);
        assert.equal(rows[0].allowed, false);
      }
    } finally {
      await client.query("ROLLBACK");
      await concurrent.end();
      await client.query("DELETE FROM ai_tool_confirmations WHERE owner_account=$1", [email]);
      await client.query("DELETE FROM public.browser_accounts WHERE account=$1", [email]);
      await client.query("DELETE FROM public.integration_tokens WHERE account=$1", [email]);
      await client.end();
    }
  });
