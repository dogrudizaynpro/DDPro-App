ALTER TABLE public.document_records
  ADD COLUMN IF NOT EXISTS project_asset_type TEXT NOT NULL DEFAULT 'document'
    CHECK (project_asset_type IN ('document', 'before', 'progress', 'completed'));

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS cover_document_id UUID
    REFERENCES public.document_records(id) ON DELETE SET NULL;
