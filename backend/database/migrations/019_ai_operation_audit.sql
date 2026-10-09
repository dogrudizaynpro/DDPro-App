CREATE TABLE IF NOT EXISTS public.ai_operation_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_account TEXT NOT NULL,
  confirmation_id UUID NOT NULL UNIQUE,
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
  target_record_id TEXT,
  execution_status TEXT NOT NULL CHECK (execution_status IN ('processing', 'succeeded', 'failed')),
  error_code TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ai_operation_audit_owner_started_idx
  ON public.ai_operation_audit_events (owner_account, started_at DESC);

ALTER TABLE public.ai_operation_audit_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ai_operation_audit_events FROM anon, authenticated;
GRANT ALL ON TABLE public.ai_operation_audit_events TO service_role;
