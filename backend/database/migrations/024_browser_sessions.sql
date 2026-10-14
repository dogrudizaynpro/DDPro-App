-- One-time reauthentication: retain encrypted provider credentials, not legacy grants.
DELETE FROM public.integration_tokens WHERE provider = 'google_session_exchange';
ALTER TABLE public.integration_tokens ADD COLUMN IF NOT EXISTS enabled boolean NOT NULL DEFAULT true;
CREATE SEQUENCE IF NOT EXISTS public.browser_auth_sequence;
CREATE TABLE IF NOT EXISTS public.browser_accounts (
  account text PRIMARY KEY,
  epoch bigint NOT NULL DEFAULT 1,
  revoked_sequence bigint NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS public.browser_sessions (
  id uuid PRIMARY KEY,
  account text NOT NULL REFERENCES public.browser_accounts(account) ON DELETE CASCADE,
  epoch bigint NOT NULL,
  restore_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz
);
CREATE TABLE IF NOT EXISTS public.browser_oauth_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence bigint NOT NULL,
  challenge text NOT NULL,
  account text,
  session_id uuid,
  epoch bigint,
  action text NOT NULL DEFAULT 'login' CHECK (action IN ('login','revoke-all','disconnect')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  expires_at timestamptz NOT NULL DEFAULT (clock_timestamp() + interval '10 minutes'),
  consumed_at timestamptz
);
CREATE TABLE IF NOT EXISTS public.browser_oauth_grants (
  code_hash text PRIMARY KEY,
  attempt_id uuid NOT NULL REFERENCES public.browser_oauth_attempts(id) ON DELETE CASCADE,
  account text NOT NULL REFERENCES public.browser_accounts(account) ON DELETE CASCADE,
  epoch bigint NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (clock_timestamp() + interval '2 minutes')
);
CREATE TABLE IF NOT EXISTS public.browser_action_proofs (
  proof_hash text PRIMARY KEY,
  account text NOT NULL REFERENCES public.browser_accounts(account) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.browser_sessions(id) ON DELETE CASCADE,
  epoch bigint NOT NULL,
  action text NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (clock_timestamp() + interval '2 minutes')
);
CREATE TABLE IF NOT EXISTS public.google_pending_revocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account text NOT NULL UNIQUE REFERENCES public.browser_accounts(account) ON DELETE CASCADE,
  encrypted_token jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  attempted_at timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  lease_id uuid,
  lease_expires_at timestamptz
);
ALTER TABLE public.ai_tool_confirmations ADD COLUMN IF NOT EXISTS browser_session_id uuid;
ALTER TABLE public.ai_tool_confirmations ADD COLUMN IF NOT EXISTS browser_epoch bigint;
DELETE FROM public.ai_tool_confirmations c WHERE confirmed_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM public.whatsapp_inbound_messages w
    WHERE w.pending_action_id=c.id AND w.owner_account=c.owner_account);

-- All transitions share a database lock, including account-unknown OAuth starts.
-- nextval alone does not serialize transaction commit ordering.
CREATE OR REPLACE FUNCTION public.ddpro_auth(op text, args jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  a public.browser_accounts;
  s public.browser_sessions;
  attempt public.browser_oauth_attempts;
  grant_row public.browser_oauth_grants;
  proof public.browser_action_proofs;
  job public.google_pending_revocations;
  account_name text := args->>'account';
  n bigint;
  affected integer;
  result jsonb;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('ddpro:browser-auth',0));
  IF op = 'ready' THEN
    RETURN jsonb_build_object('ready',
      has_function_privilege('service_role','public.ddpro_auth(text,jsonb)','EXECUTE')
      AND NOT has_function_privilege('anon','public.ddpro_auth(text,jsonb)','EXECUTE')
      AND NOT has_function_privilege('authenticated','public.ddpro_auth(text,jsonb)','EXECUTE')
      AND NOT EXISTS (
        SELECT 1 FROM pg_proc p, LATERAL aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) acl
        WHERE p.oid='public.ddpro_auth(text,jsonb)'::regprocedure AND acl.grantee=0
          AND acl.privilege_type='EXECUTE'));
  END IF;
  IF op = 'begin' THEN
    DELETE FROM browser_oauth_attempts WHERE expires_at<clock_timestamp();
    DELETE FROM browser_action_proofs WHERE expires_at<clock_timestamp();
    IF COALESCE(args->>'action','login') <> 'login' THEN
      SELECT * INTO s FROM browser_sessions WHERE id=(args->>'session')::uuid
        AND account=account_name AND epoch=(args->>'epoch')::bigint
        AND revoked_at IS NULL AND expires_at>clock_timestamp();
      SELECT * INTO a FROM browser_accounts WHERE account=account_name;
      IF s.id IS NULL OR s.epoch <> a.epoch THEN RAISE EXCEPTION 'Session inactive'; END IF;
    END IF;
    INSERT INTO browser_oauth_attempts(sequence,challenge,account,session_id,epoch,action)
    VALUES(nextval('browser_auth_sequence'),args->>'challenge',s.account,s.id,s.epoch,
      COALESCE(args->>'action','login')) RETURNING * INTO attempt;
    RETURN to_jsonb(attempt);
  END IF;
  IF op = 'callback' THEN
    SELECT * INTO attempt FROM browser_oauth_attempts WHERE id=(args->>'attempt')::uuid;
    IF attempt.id IS NULL OR attempt.consumed_at IS NOT NULL OR attempt.expires_at<=clock_timestamp()
      OR (attempt.account IS NOT NULL AND attempt.account<>account_name)
    THEN RAISE EXCEPTION 'OAuth attempt invalid'; END IF;
    INSERT INTO browser_accounts(account) VALUES(account_name) ON CONFLICT DO NOTHING;
    SELECT * INTO a FROM browser_accounts WHERE account=account_name FOR UPDATE;
    IF attempt.sequence<=a.revoked_sequence THEN RAISE EXCEPTION 'OAuth attempt revoked'; END IF;
    IF attempt.action<>'login' THEN
      SELECT * INTO s FROM browser_sessions WHERE id=attempt.session_id AND revoked_at IS NULL
        AND expires_at>clock_timestamp() AND epoch=a.epoch;
      IF s.id IS NULL OR attempt.epoch<>a.epoch THEN RAISE EXCEPTION 'Session inactive'; END IF;
    ELSE
      IF NOT EXISTS(SELECT 1 FROM google_pending_revocations WHERE account=account_name)
        AND (NOT EXISTS(SELECT 1 FROM integration_tokens WHERE provider='google' AND account=account_name AND enabled)
          OR (NOT COALESCE((args->>'adequate')::boolean,false)
            AND EXISTS(SELECT 1 FROM integration_tokens WHERE provider='google' AND account=account_name AND enabled
              AND encrypted_token=args->'snapshot')))
      THEN
        IF args->'token' IS NULL THEN RAISE EXCEPTION 'Provider credential required'; END IF;
        INSERT INTO integration_tokens(provider,account,encrypted_token,enabled)
          VALUES('google',account_name,args->'token',true)
          ON CONFLICT(provider,account) DO UPDATE SET encrypted_token=EXCLUDED.encrypted_token,
            enabled=true,updated_at=clock_timestamp();
      END IF;
    END IF;
    UPDATE browser_oauth_attempts SET consumed_at=clock_timestamp() WHERE id=attempt.id;
    INSERT INTO browser_oauth_grants(code_hash,attempt_id,account,epoch)
      VALUES(args->>'code',attempt.id,account_name,a.epoch);
    RETURN jsonb_build_object('account',account_name,'epoch',a.epoch);
  END IF;
  IF op = 'exchange' THEN
    SELECT * INTO grant_row FROM browser_oauth_grants WHERE code_hash=args->>'code';
    SELECT * INTO attempt FROM browser_oauth_attempts WHERE id=grant_row.attempt_id;
    SELECT * INTO a FROM browser_accounts WHERE account=grant_row.account FOR UPDATE;
    IF grant_row.code_hash IS NULL OR grant_row.expires_at<=clock_timestamp()
      OR attempt.challenge<>args->>'challenge' OR grant_row.epoch<>a.epoch
      OR attempt.sequence<=a.revoked_sequence THEN RETURN NULL; END IF;
    DELETE FROM browser_oauth_grants WHERE code_hash=grant_row.code_hash;
    IF attempt.action<>'login' THEN
      SELECT * INTO s FROM browser_sessions WHERE id=attempt.session_id AND revoked_at IS NULL
        AND expires_at>clock_timestamp() AND epoch=a.epoch;
      IF s.id IS NULL THEN RETURN NULL; END IF;
      INSERT INTO browser_action_proofs(proof_hash,account,session_id,epoch,action)
        VALUES(args->>'proof',a.account,s.id,a.epoch,attempt.action);
      RETURN jsonb_build_object('action',attempt.action);
    END IF;
    INSERT INTO browser_sessions(id,account,epoch,restore_hash,expires_at)
      VALUES((args->>'session')::uuid,a.account,a.epoch,args->>'restore',
        clock_timestamp()+interval '30 days') RETURNING * INTO s;
    RETURN jsonb_build_object('account',s.account,'session',s.id,'epoch',s.epoch,'expiresAt',s.expires_at);
  END IF;
  IF op IN ('validate','restore','logout','revoke-all','disconnect','confirm') THEN
    SELECT * INTO s FROM browser_sessions WHERE id=(args->>'session')::uuid
      AND revoked_at IS NULL AND expires_at>clock_timestamp();
    SELECT * INTO a FROM browser_accounts WHERE account=s.account FOR UPDATE;
    IF s.id IS NULL OR s.epoch<>a.epoch THEN RETURN NULL; END IF;
    IF op='restore' THEN
      IF s.restore_hash<>args->>'restore' THEN RETURN NULL; END IF;
    ELSIF s.account IS DISTINCT FROM account_name OR s.epoch IS DISTINCT FROM (args->>'epoch')::bigint
    THEN RETURN NULL; END IF;
    IF op IN ('validate','restore') THEN
      RETURN jsonb_build_object('account',s.account,'session',s.id,'epoch',s.epoch,'expiresAt',s.expires_at);
    END IF;
    IF op='confirm' THEN
      UPDATE ai_tool_confirmations SET confirmed_at=clock_timestamp()
        WHERE id=(args->>'confirmation')::uuid AND owner_account=s.account
          AND browser_session_id=s.id AND browser_epoch=s.epoch
          AND confirmed_at IS NULL AND expires_at>clock_timestamp()
        RETURNING to_jsonb(ai_tool_confirmations.*) INTO result;
      RETURN result;
    END IF;
    IF op='logout' THEN
      UPDATE browser_sessions SET revoked_at=clock_timestamp() WHERE id=s.id;
      UPDATE browser_accounts SET revoked_sequence=nextval('browser_auth_sequence') WHERE account=s.account;
      DELETE FROM ai_tool_confirmations WHERE browser_session_id=s.id AND confirmed_at IS NULL;
      RETURN jsonb_build_object('revoked',true);
    END IF;
    SELECT * INTO proof FROM browser_action_proofs WHERE proof_hash=args->>'proof'
      AND account=s.account AND session_id=s.id AND epoch=s.epoch AND action=op
      AND expires_at>clock_timestamp();
    IF proof.proof_hash IS NULL THEN RETURN NULL; END IF;
    DELETE FROM browser_action_proofs WHERE proof_hash=proof.proof_hash;
    n := nextval('browser_auth_sequence');
    UPDATE browser_accounts SET epoch=epoch+1,revoked_sequence=n WHERE account=s.account;
    UPDATE browser_sessions SET revoked_at=clock_timestamp() WHERE account=s.account AND revoked_at IS NULL;
    DELETE FROM ai_tool_confirmations WHERE owner_account=s.account
      AND browser_session_id IS NOT NULL AND confirmed_at IS NULL;
    IF op='disconnect' THEN
      INSERT INTO google_pending_revocations(account,encrypted_token)
        SELECT account,encrypted_token FROM integration_tokens WHERE provider='google' AND account=s.account AND enabled
        ON CONFLICT(account) DO NOTHING;
      UPDATE integration_tokens SET enabled=false WHERE provider='google' AND account=s.account;
      SELECT * INTO job FROM google_pending_revocations WHERE account=s.account;
      RETURN COALESCE(to_jsonb(job),jsonb_build_object('disconnected',true));
    END IF;
    RETURN jsonb_build_object('revoked',true);
  END IF;
  IF op='pending' THEN
    SELECT * INTO job FROM google_pending_revocations WHERE account=account_name;
    RETURN CASE WHEN job.id IS NULL THEN NULL ELSE to_jsonb(job) END;
  END IF;
  IF op='claim-revocation' THEN
    UPDATE google_pending_revocations SET lease_id=(args->>'lease')::uuid,
      lease_expires_at=clock_timestamp()+interval '2 minutes'
      WHERE account=account_name AND id=(args->>'job')::uuid
        AND (lease_id IS NULL OR lease_expires_at<clock_timestamp())
      RETURNING * INTO job;
    RETURN CASE WHEN job.id IS NULL THEN NULL ELSE to_jsonb(job) END;
  END IF;
  IF op='finish-revocation' THEN
    IF COALESCE((args->>'succeeded')::boolean,false) THEN
      DELETE FROM google_pending_revocations WHERE account=account_name AND id=(args->>'job')::uuid
        AND lease_id IS NOT DISTINCT FROM (args->>'lease')::uuid;
    ELSE
      UPDATE google_pending_revocations SET attempted_at=clock_timestamp(),attempts=attempts+1,
        lease_id=NULL,lease_expires_at=NULL
        WHERE account=account_name AND id=(args->>'job')::uuid
          AND lease_id IS NOT DISTINCT FROM (args->>'lease')::uuid;
    END IF;
    GET DIAGNOSTICS affected = ROW_COUNT;
    RETURN jsonb_build_object('recorded',affected=1);
  END IF;
  RAISE EXCEPTION 'Unknown authorization operation';
END $$;
DO $$
DECLARE name text;
BEGIN
  FOREACH name IN ARRAY ARRAY['browser_accounts','browser_sessions','browser_oauth_attempts',
    'browser_oauth_grants','browser_action_proofs','google_pending_revocations'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',name);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated',name);
    EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON public.%I TO service_role',name);
  END LOOP;
END $$;
REVOKE ALL ON SEQUENCE public.browser_auth_sequence FROM PUBLIC, anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.browser_auth_sequence TO service_role;
REVOKE ALL ON FUNCTION public.ddpro_auth(text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ddpro_auth(text,jsonb) TO service_role;
