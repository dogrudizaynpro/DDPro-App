ALTER TABLE public.research_items
  ADD COLUMN IF NOT EXISTS supplier TEXT,
  ADD COLUMN IF NOT EXISTS system_id UUID,
  ADD COLUMN IF NOT EXISTS procurement_status TEXT NOT NULL DEFAULT 'RESEARCH';

UPDATE public.research_items
SET price_verification = 'Doğrulanmadı'
WHERE price_verification IS NULL
   OR price_verification NOT IN ('Doğrulanmadı', 'Kullanıcı kaynağı kontrol etti')
   OR (
     price_verification = 'Kullanıcı kaynağı kontrol etti'
     AND (NULLIF(BTRIM(price), '') IS NULL OR NULLIF(BTRIM(url), '') IS NULL)
   );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'research_items_system_id_fkey'
  ) THEN
    ALTER TABLE public.research_items
      ADD CONSTRAINT research_items_system_id_fkey
      FOREIGN KEY (system_id) REFERENCES public.systems(id) ON DELETE SET NULL NOT VALID;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'research_items_product_id_fkey'
  ) THEN
    ALTER TABLE public.research_items
      ADD CONSTRAINT research_items_product_id_fkey
      FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'research_items_procurement_status_check'
  ) THEN
    ALTER TABLE public.research_items
      ADD CONSTRAINT research_items_procurement_status_check
      CHECK (procurement_status IN ('RESEARCH', 'QUOTE_RECEIVED', 'ORDERED', 'RECEIVED', 'CANCELLED'))
      NOT VALID;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS research_items_system_id_idx ON public.research_items (system_id);
CREATE INDEX IF NOT EXISTS research_items_product_id_idx ON public.research_items (product_id);
CREATE INDEX IF NOT EXISTS research_items_procurement_status_idx
  ON public.research_items (procurement_status, updated_at DESC);
