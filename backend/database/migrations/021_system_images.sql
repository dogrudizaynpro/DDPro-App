INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ddpro-system-images',
  'ddpro-system-images',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

CREATE TABLE IF NOT EXISTS public.system_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  system_id UUID NOT NULL REFERENCES public.systems(id) ON DELETE CASCADE,
  owner_account TEXT NOT NULL,
  original_name TEXT NOT NULL CHECK (length(original_name) BETWEEN 1 AND 255),
  content_type TEXT NOT NULL CHECK (content_type IN ('image/jpeg', 'image/png', 'image/webp')),
  file_size BIGINT NOT NULL CHECK (file_size > 0 AND file_size <= 10485760),
  storage_key TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS system_images_owner_system_created_idx
  ON public.system_images (owner_account, system_id, created_at DESC);
CREATE INDEX IF NOT EXISTS system_images_system_idx
  ON public.system_images (system_id);

ALTER TABLE public.system_images ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.system_images FROM anon, authenticated;
GRANT ALL ON TABLE public.system_images TO service_role;
