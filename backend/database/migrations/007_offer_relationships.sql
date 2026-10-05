ALTER TABLE public.offers
  ADD COLUMN IF NOT EXISTS system_id UUID,
  ADD COLUMN IF NOT EXISTS product_id UUID,
  ADD COLUMN IF NOT EXISTS material_analysis_id UUID,
  ADD COLUMN IF NOT EXISTS offer_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'offers_system_id_fkey'
  ) THEN
    ALTER TABLE public.offers
      ADD CONSTRAINT offers_system_id_fkey
      FOREIGN KEY (system_id) REFERENCES public.systems(id) ON DELETE SET NULL NOT VALID;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'offers_product_id_fkey'
  ) THEN
    ALTER TABLE public.offers
      ADD CONSTRAINT offers_product_id_fkey
      FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL NOT VALID;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'offers_material_analysis_id_fkey'
  ) THEN
    ALTER TABLE public.offers
      ADD CONSTRAINT offers_material_analysis_id_fkey
      FOREIGN KEY (material_analysis_id) REFERENCES public.material_analysis(id) ON DELETE SET NULL NOT VALID;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS offers_system_id_idx ON public.offers (system_id);
CREATE INDEX IF NOT EXISTS offers_product_id_idx ON public.offers (product_id);
CREATE INDEX IF NOT EXISTS offers_material_analysis_id_idx ON public.offers (material_analysis_id);

ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.offers FROM anon, authenticated;
GRANT ALL ON TABLE public.offers TO service_role;
