CREATE TABLE IF NOT EXISTS public.report_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_account TEXT NOT NULL,
  report_type TEXT NOT NULL CHECK (report_type IN ('PROJECT', 'DAILY_SITE', 'OFFER', 'COST', 'PROCUREMENT')),
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  report_date DATE,
  snapshot JSONB NOT NULL CHECK (jsonb_typeof(snapshot) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS report_records_owner_created_idx
  ON public.report_records (owner_account, created_at DESC);
CREATE INDEX IF NOT EXISTS report_records_project_created_idx
  ON public.report_records (project_id, created_at DESC);

ALTER TABLE public.report_records ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.report_records FROM anon, authenticated;
GRANT ALL ON TABLE public.report_records TO service_role;
