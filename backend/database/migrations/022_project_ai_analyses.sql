CREATE TABLE IF NOT EXISTS public.project_ai_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_account TEXT NOT NULL,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  request_id UUID NOT NULL,
  command TEXT NOT NULL CHECK (length(command) BETWEEN 1 AND 8000),
  status TEXT NOT NULL CHECK (status IN ('processing', 'success', 'failed')),
  result JSONB,
  failure_code TEXT,
  lease_token UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_account, request_id),
  CHECK (
    (status = 'success' AND result IS NOT NULL AND lease_token IS NULL) OR
    (status = 'processing' AND result IS NULL AND lease_token IS NOT NULL) OR
    (status = 'failed' AND result IS NULL AND lease_token IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS project_ai_analyses_owner_project_created_idx
  ON public.project_ai_analyses (owner_account, project_id, created_at DESC);

ALTER TABLE public.project_ai_analyses ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.project_ai_analyses FROM anon, authenticated;
GRANT ALL ON TABLE public.project_ai_analyses TO service_role;
