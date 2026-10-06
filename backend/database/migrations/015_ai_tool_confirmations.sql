CREATE TABLE IF NOT EXISTS public.ai_tool_confirmations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_account TEXT NOT NULL,
  resource TEXT NOT NULL CHECK (
    resource IN (
      'projects',
      'customers',
      'products',
      'systems',
      'price-analysis',
      'material-analysis',
      'offers',
      'procurement',
      'reports',
      'calendar'
    )
  ),
  operation TEXT NOT NULL CHECK (operation IN ('create', 'update', 'delete')),
  record_id UUID,
  record_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  expires_at TIMESTAMPTZ NOT NULL,
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_tool_confirmations_owner_expiry_idx
  ON public.ai_tool_confirmations (owner_account, expires_at);

ALTER TABLE public.ai_tool_confirmations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ai_tool_confirmations FROM anon, authenticated;
GRANT ALL ON TABLE public.ai_tool_confirmations TO service_role;
