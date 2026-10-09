CREATE TABLE IF NOT EXISTS public.ai_file_imports (
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
  file_row_fingerprint TEXT NOT NULL CHECK (file_row_fingerprint ~ '^[0-9a-f]{64}$'),
  confirmation_id UUID NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_account, resource, file_row_fingerprint),
  UNIQUE (confirmation_id)
);

CREATE INDEX IF NOT EXISTS ai_file_imports_pending_expiry_idx
  ON public.ai_file_imports (expires_at)
  WHERE confirmed_at IS NULL;

ALTER TABLE public.ai_file_imports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ai_file_imports FROM anon, authenticated;
GRANT ALL ON TABLE public.ai_file_imports TO service_role;
