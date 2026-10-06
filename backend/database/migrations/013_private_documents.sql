INSERT INTO storage.buckets (id, name, public)
VALUES ('ddpro-documents', 'ddpro-documents', false)
ON CONFLICT (id) DO UPDATE SET public = false;

CREATE TABLE IF NOT EXISTS public.document_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_account TEXT NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  crm_contact_id UUID REFERENCES public.crm_contacts(id) ON DELETE SET NULL,
  original_name TEXT NOT NULL CHECK (length(original_name) BETWEEN 1 AND 255),
  content_type TEXT NOT NULL,
  file_size BIGINT NOT NULL CHECK (file_size > 0 AND file_size <= 10485760),
  storage_key TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS document_records_owner_created_idx
  ON public.document_records (owner_account, created_at DESC);
CREATE INDEX IF NOT EXISTS document_records_project_idx
  ON public.document_records (project_id);
CREATE INDEX IF NOT EXISTS document_records_contact_idx
  ON public.document_records (crm_contact_id);

ALTER TABLE public.document_records ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.document_records FROM anon, authenticated;
GRANT ALL ON TABLE public.document_records TO service_role;
