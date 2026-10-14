import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { test } from "node:test";
import { Client } from "pg";

const connectionString = process.env.DDPRO_SESSION_TEST_DATABASE_URL;
test("browser HTTP sessions enforce fresh bound proofs, durable disconnect retries and races",
  { skip: !connectionString && "DDPRO_SESSION_TEST_DATABASE_URL is not set" }, async () => {
    const client = new Client({ connectionString });
    await client.connect();
    const email = "browser-session-tests@example.com";
    Object.assign(process.env, {
      NODE_ENV: "production", GOOGLE_CLIENT_ID: "session-test-client",
      GOOGLE_CLIENT_SECRET: "session-test-secret",
      GOOGLE_REDIRECT_URI: "https://backend.example/api/integrations/google/callback",
      GOOGLE_ALLOWED_EMAILS: email, FRONTEND_URL: "https://frontend.example/",
      INTEGRATION_SESSION_SECRET: "session-test-signing-key",
      INTEGRATION_TOKEN_ENCRYPTION_KEY: "b".repeat(64),
      SUPABASE_URL: "https://session-storage.example", SUPABASE_SERVICE_ROLE_KEY: "session-test-service-role",
    });
    const originalFetch = globalThis.fetch;
    const scopes = ["https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/calendar.events", "https://www.googleapis.com/auth/spreadsheets.readonly"].join(" ");
    let issuedScopes = scopes;
    let nonce, fresh = true, identityEmail = email, providerStatus = 500, refreshHook;
    let revocationCalls = 0;
    globalThis.fetch = async (input, options = {}) => {
      const url = new URL(String(input));
      if (url.origin === "https://session-storage.example") {
        if (url.pathname.endsWith("/rpc/ddpro_auth")) {
          const { op, args } = JSON.parse(options.body);
          try {
            const { rows } = await client.query("SELECT public.ddpro_auth($1,$2::jsonb) AS result", [op, args]);
            return Response.json(rows[0].result);
          } catch (error) {
            return Response.json({ code: error.code, message: "transition rejected" }, { status: 409 });
          }
        }
        if (url.pathname.endsWith("/integration_tokens") && options.method !== "HEAD") {
          const { rows } = await client.query("SELECT encrypted_token FROM integration_tokens WHERE provider='google' AND account=$1 AND enabled", [email]);
          if (options.method === "PATCH") {
            if (refreshHook) { const hook = refreshHook; refreshHook = null; await hook(); }
            const expected = url.searchParams.get("encrypted_token")?.slice(3);
            const { rows: updated } = await client.query(
              "UPDATE integration_tokens SET encrypted_token=$1 WHERE provider='google' AND account=$2 AND enabled AND encrypted_token=$3 RETURNING provider",
              [JSON.parse(options.body).encrypted_token, email, expected]);
            return Response.json(updated);
          }
          return Response.json(rows);
        }
        return new Response(null, { status: 200 });
      }
      if (url.pathname === "/token") {
        const body = new URLSearchParams(options.body);
        if (body.get("grant_type") === "refresh_token") return Response.json({ access_token: "refreshed-test", expires_in: 3600 });
        const claims = { nonce, auth_time: fresh ? Math.floor(Date.now() / 1000) : 1 };
        return Response.json({ access_token: "test-access", refresh_token: "test-refresh", scope: issuedScopes,
          expires_in: 3600, id_token: `header.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.signature` });
      }
      if (url.pathname === "/oauth2/v2/userinfo") return Response.json({ email: identityEmail, verified_email: true, id: "test-sub" });
      if (url.pathname === "/tokeninfo") return Response.json({ email: identityEmail, sub: "test-sub",
        aud: "session-test-client", iss: "https://accounts.google.com", exp: String(Math.floor(Date.now() / 1000) + 3600) });
      if (url.pathname === "/revoke") { revocationCalls++; return new Response(null, { status: providerStatus }); }
      throw new Error(`Unexpected provider: ${url}`);
    };
    const { default: app } = await import("../src/app.js");
    const { encryptIntegrationToken, decryptIntegrationToken } = await import("../src/services/integration-vault.service.js");
    const server = app.listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    let requestId = 0;
    const headers = (bearer) => ({ Origin: "https://frontend.example", "Content-Type": "application/json",
      "X-Forwarded-For": `192.0.2.${++requestId}`, ...(bearer ? { Authorization: ["Bearer", bearer].join(" ") } : {}) });
    const post = (path, bearer, body = {}, extra = {}) => originalFetch(`${base}${path}`, {
      method: "POST", headers: { ...headers(bearer), ...extra }, body: JSON.stringify(body) });
    const begin = async (bearer, action, identityOnly = false) => {
      const verifier = randomBytes(32).toString("base64url");
      const challenge = createHash("sha256").update(verifier).digest("base64url");
      const response = action ? await post(action === "reconnect" ? "/api/integrations/google/reconnect" : "/api/sessions/reauth", bearer, { action, challenge })
        : await originalFetch(`${base}/api/integrations/google/start?challenge=${challenge}${identityOnly ? "&identity_only=1" : ""}`, { redirect: "manual", headers: headers() });
      assert.equal(response.status, action ? 200 : 302);
      const url = new URL(action ? (await response.json()).data.url : response.headers.get("location"));
      nonce = url.searchParams.get("nonce");
      if (identityOnly) assert.equal(url.searchParams.get("scope"), "openid email");
      if (action && action !== "reconnect") assert.equal(url.searchParams.get("max_age"), "0");
      return { verifier, state: url.searchParams.get("state"), cookie: response.headers.getSetCookie()[0].split(";")[0] };
    };
    const callback = async (attempt) => {
      nonce = JSON.parse(Buffer.from(attempt.state.split(".")[0], "base64url").toString()).nonce;
      const response = await originalFetch(`${base}/api/integrations/google/callback?state=${encodeURIComponent(attempt.state)}&code=test-code`,
        { redirect: "manual", headers: { ...headers(), ...(attempt.cookie ? { Cookie: attempt.cookie } : {}) } });
      return { response, code: new URLSearchParams(response.headers.get("location").split("?")[1]).get("exchange_code") };
    };
    const exchange = async (attempt, code) => post("/api/integrations/google/exchange", undefined, { code, verifier: attempt.verifier });
    const login = async (identityOnly = false) => {
      const attempt = await begin(undefined, undefined, identityOnly);
      const { code } = await callback(attempt);
      assert.ok(code);
      const response = await exchange(attempt, code);
      assert.equal(response.status, 200);
      return { bearer: (await response.json()).data.session, cookie: response.headers.getSetCookie()[0].split(";")[0] };
    };
    const proof = async (session, action) => {
      const attempt = await begin(session.bearer, action);
      attempt.cookie = "";
      const { code } = await callback(attempt);
      assert.ok(code);
      const response = await exchange(attempt, code);
      assert.equal(response.headers.get("set-cookie"), null);
      const data = (await response.json()).data;
      assert.equal(data.action, action);
      return data.proof;
    };
    const restore = (session) => post("/api/integrations/google/restore", undefined, {}, { Cookie: session.cookie });
    try {
      const originalToken = encryptIntegrationToken({ accessToken: "kept-access", refreshToken: "kept-refresh",
        expiresAt: Date.now() + 3600_000, scopes, sessionVersion: "whatsapp-connection-identity" });
      await client.query("INSERT INTO integration_tokens(provider,account,encrypted_token) VALUES('google',$1,$2)", [email, originalToken]);
      const [a, b, c] = [await login(), await login(), await login()];
      const doppelgangerRestore = a.cookie.replace(/\.[A-Za-z0-9_-]{43}$/, "." + "x".repeat(43));
      assert.equal((await post("/api/integrations/google/restore", undefined, {}, { Cookie: doppelgangerRestore })).status, 401);
      const tokenSnapshot = async () => (await client.query("SELECT encrypted_token,enabled FROM integration_tokens WHERE provider='google' AND account=$1", [email])).rows[0];
      assert.deepEqual((await tokenSnapshot()).encrypted_token, originalToken);
      const restoreSecret = decodeURIComponent(a.cookie.split("=")[1]).split(".")[1];
      const restoreStorage = (await client.query("SELECT restore_hash FROM browser_sessions WHERE account=$1", [email])).rows;
      assert.ok(restoreStorage.every((row) => row.restore_hash !== restoreSecret));
      const bound = JSON.parse(Buffer.from(a.bearer.split(".")[0], "base64url").toString());
      const confirmation = randomUUID();
      await client.query(`INSERT INTO ai_tool_confirmations(id,owner_account,resource,operation,record_payload,expires_at,browser_session_id,browser_epoch)
        VALUES($1,$2,'projects','create','{}',now()+interval '5 minutes',$3,$4)`, [confirmation, email, bound.session, bound.epoch]);
      const bBound = JSON.parse(Buffer.from(b.bearer.split(".")[0], "base64url").toString());
      assert.equal((await client.query("SELECT ddpro_auth('confirm',$1::jsonb) AS result", [{ ...bBound, confirmation }])).rows[0].result, null);
      const localAttempt = await begin(a.bearer, "disconnect");
      assert.equal((await post("/api/sessions/logout", a.bearer, {}, { Origin: "https://evil.example" })).status, 403);
      assert.equal((await post("/api/sessions/logout", a.bearer)).status, 200);
      assert.equal((await restore(a)).status, 401);
      assert.equal((await restore(b)).status, 200);
      assert.equal((await restore(c)).status, 200);
      assert.equal((await callback(localAttempt)).code, null);
      const browserGrant = await client.query("SELECT ddpro_auth('confirm',$1::jsonb) AS result", [{ ...bound, confirmation }]);
      assert.equal(browserGrant.rows[0].result, null);
      assert.equal((await client.query("SELECT id FROM ai_tool_confirmations WHERE id=$1", [confirmation])).rows.length, 0);
      const staleStart = await begin();
      const staleGrantAttempt = await begin();
      const staleGrant = await callback(staleGrantAttempt);
      fresh = false;
      const oldAuth = await begin(b.bearer, "revoke-all");
      assert.match((await callback(oldAuth)).response.headers.get("location"), /fresh_authentication_required/);
      fresh = true;
      const differentAccount = await begin(b.bearer, "revoke-all");
      process.env.GOOGLE_ALLOWED_EMAILS = `${email},other-browser@example.com`;
      identityEmail = "other-browser@example.com";
      assert.equal((await callback(differentAccount)).code, null);
      identityEmail = email;
      process.env.GOOGLE_ALLOWED_EMAILS = email;
      const expiredProof = await proof(b, "revoke-all");
      await client.query("UPDATE browser_action_proofs SET expires_at=now()-interval '1 second' WHERE account=$1", [email]);
      assert.equal((await post("/api/sessions/revoke-all", b.bearer, { proof: expiredProof })).status, 401);
      const globalProof = await proof(b, "revoke-all");
      assert.equal((await post("/api/integrations/google/disconnect", b.bearer, { proof: globalProof })).status, 401);
      assert.equal((await post("/api/sessions/revoke-all", c.bearer, { proof: globalProof })).status, 401);
      assert.equal((await post("/api/sessions/revoke-all", b.bearer, { proof: globalProof })).status, 200);
      assert.deepEqual((await tokenSnapshot()).encrypted_token, originalToken);
      for (const session of [a, b, c]) assert.equal((await restore(session)).status, 401);
      assert.equal((await callback(staleStart)).code, null);
      assert.equal((await exchange(staleGrantAttempt, staleGrant.code)).status, 401);
      const d = await login();
      assert.equal((await post("/api/sessions/revoke-all", d.bearer, { proof: globalProof })).status, 401);
      const disconnectProof = await proof(d, "disconnect");
      const disconnect = await post("/api/integrations/google/disconnect", d.bearer, { proof: disconnectProof });
      assert.equal(disconnect.status, 200);
      assert.deepEqual((await disconnect.json()).data, { disconnected: true, providerRevoked: false, pendingRevocation: true });
      assert.equal((await tokenSnapshot()).enabled, false);
      assert.equal((await restore(d)).status, 401);
      const pending = (await client.query("SELECT * FROM google_pending_revocations WHERE account=$1", [email])).rows[0];
      assert.deepEqual(pending.encrypted_token, originalToken);
      issuedScopes = "openid email";
      const e = await login(true);
      issuedScopes = scopes;
      const pendingStatus = await originalFetch(`${base}/api/integrations/status`, { headers: headers(e.bearer) });
      assert.equal(pendingStatus.status, 200);
      assert.equal((await pendingStatus.json()).data.google.pendingRevocation, true);
      assert.equal((await tokenSnapshot()).enabled, false);
      assert.deepEqual((await tokenSnapshot()).encrypted_token, originalToken);
      const blockedReconnect = await post("/api/integrations/google/reconnect", e.bearer, { challenge: "x".repeat(43) });
      assert.equal(blockedReconnect.status, 409);
      assert.equal((await blockedReconnect.json()).code, "GOOGLE_REVOCATION_PENDING");
      providerStatus = 400;
      assert.equal((await (await post("/api/integrations/google/disconnect/retry", e.bearer)).json()).data.pendingRevocation, true);
      assert.equal((await client.query("SELECT * FROM google_pending_revocations WHERE account=$1", [email])).rows.length, 1);
      providerStatus = 200;
      assert.equal((await (await post("/api/integrations/google/disconnect/retry", e.bearer)).json()).data.providerRevoked, true);
      assert.equal((await client.query("SELECT * FROM google_pending_revocations WHERE account=$1", [email])).rows.length, 0);
      const completedStatus = await originalFetch(`${base}/api/integrations/status`, { headers: headers(e.bearer) });
      assert.equal((await completedStatus.json()).data.google.pendingRevocation, false);
      const f = await login();
      const beforeReconnect = JSON.parse(Buffer.from(f.bearer.split(".")[0], "base64url").toString());
      const reconnectAttempt = await begin(f.bearer, "reconnect");
      reconnectAttempt.cookie = "";
      const reconnectCallback = await callback(reconnectAttempt);
      const reconnectExchange = await exchange(reconnectAttempt, reconnectCallback.code);
      assert.equal(reconnectExchange.status, 200);
      assert.equal(reconnectExchange.headers.get("set-cookie"), null);
      const reconnectSession = JSON.parse(Buffer.from((await reconnectExchange.json()).data.session.split(".")[0], "base64url").toString());
      assert.equal(reconnectSession.session, beforeReconnect.session);
      assert.equal(reconnectSession.epoch, beforeReconnect.epoch);
      assert.equal((await restore(e)).status, 200);
      assert.equal((await restore(f)).status, 200);
      const reconnected = await tokenSnapshot();
      assert.equal(reconnected.enabled, true);
      assert.notEqual(decryptIntegrationToken(reconnected.encrypted_token).sessionVersion, "whatsapp-connection-identity");
      // A refresh read before disable must fail its enabled+snapshot CAS.
      await client.query("UPDATE integration_tokens SET encrypted_token=$1 WHERE provider='google' AND account=$2",
        [encryptIntegrationToken({ ...decryptIntegrationToken(reconnected.encrypted_token), expiresAt: 1 }), email]);
      refreshHook = async () => client.query("UPDATE integration_tokens SET enabled=false WHERE provider='google' AND account=$1", [email]);
      const { getGoogleAccessToken } = await import("../src/services/google-integration.service.js");
      await assert.rejects(getGoogleAccessToken(email), (error) => error.statusCode === 409);
      assert.equal((await tokenSnapshot()).enabled, false);
      assert.equal(revocationCalls, 3);
      const legacy = await post("/api/integrations/google/logout");
      assert.equal(legacy.status, 409);
      assert.equal((await legacy.json()).code, "UPDATE_REQUIRED");
    } finally {
      globalThis.fetch = originalFetch;
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
      await client.query("DELETE FROM ai_tool_confirmations WHERE owner_account=$1", [email]);
      await client.query("DELETE FROM browser_accounts WHERE account=$1", [email]);
      await client.query("DELETE FROM integration_tokens WHERE account=$1", [email]);
      await client.end();
    }
  });
