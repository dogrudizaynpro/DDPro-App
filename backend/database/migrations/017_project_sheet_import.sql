ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS customer TEXT,
  ADD COLUMN IF NOT EXISTS company TEXT,
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS product TEXT,
  ADD COLUMN IF NOT EXISTS start_date TEXT,
  ADD COLUMN IF NOT EXISTS end_date TEXT,
  ADD COLUMN IF NOT EXISTS source_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS import_source_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS projects_import_source_key_unique
  ON public.projects (import_source_key)
  WHERE import_source_key IS NOT NULL;

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.projects FROM anon, authenticated;
GRANT ALL ON TABLE public.projects TO service_role;
