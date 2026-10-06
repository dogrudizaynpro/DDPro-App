CREATE TABLE IF NOT EXISTS public.ai_usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_account TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_usage_events_owner_created_idx
  ON public.ai_usage_events (owner_account, created_at DESC);

ALTER TABLE public.ai_usage_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ai_usage_events FROM anon, authenticated;
GRANT ALL ON TABLE public.ai_usage_events TO service_role;
