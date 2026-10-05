CREATE TABLE IF NOT EXISTS public.systems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE CHECK (code ~ '^[a-z0-9-]{2,80}$'),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'ARCHIVED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.systems (code, name)
VALUES
  ('asma-tavan', 'Asma Tavan'),
  ('bolme-duvar', 'Bölme Duvar'),
  ('ic-dekorasyon', 'İç Dekorasyon'),
  ('cephe', 'Cephe'),
  ('zemin', 'Zemin'),
  ('aydinlatma', 'Aydınlatma')
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  product_code TEXT UNIQUE,
  system_id UUID REFERENCES public.systems(id) ON DELETE SET NULL,
  manufacturer TEXT,
  description TEXT NOT NULL DEFAULT '',
  unit TEXT NOT NULL DEFAULT 'adet',
  source_url TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'ARCHIVED', 'DRAFT')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.price_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  system_id UUID REFERENCES public.systems(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  unit_price NUMERIC CHECK (unit_price IS NULL OR unit_price > 0),
  currency TEXT NOT NULL DEFAULT 'TRY' CHECK (currency ~ '^[A-Z]{3}$'),
  unit TEXT NOT NULL,
  source TEXT,
  source_url TEXT,
  verification_status TEXT NOT NULL DEFAULT 'UNVERIFIED'
    CHECK (verification_status IN ('VERIFIED', 'UNVERIFIED', 'MISSING')),
  verified_at TIMESTAMPTZ,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (verification_status <> 'VERIFIED' OR
    (unit_price IS NOT NULL AND source IS NOT NULL AND source <> '' AND verified_at IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS public.material_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  system_id UUID REFERENCES public.systems(id) ON DELETE SET NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  price_analysis_id UUID REFERENCES public.price_analysis(id) ON DELETE SET NULL,
  quantity NUMERIC NOT NULL CHECK (quantity > 0),
  unit TEXT NOT NULL,
  unit_price NUMERIC CHECK (unit_price IS NULL OR unit_price > 0),
  total_cost NUMERIC CHECK (total_cost IS NULL OR total_cost >= 0),
  currency TEXT,
  source TEXT,
  verification_status TEXT NOT NULL CHECK (verification_status IN ('VERIFIED', 'UNVERIFIED', 'MISSING')),
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (verification_status = 'VERIFIED' OR (unit_price IS NULL AND total_cost IS NULL))
);

CREATE INDEX IF NOT EXISTS products_system_id_idx ON public.products (system_id);
CREATE INDEX IF NOT EXISTS products_status_idx ON public.products (status);
CREATE INDEX IF NOT EXISTS price_analysis_project_id_idx ON public.price_analysis (project_id);
CREATE INDEX IF NOT EXISTS price_analysis_product_id_idx ON public.price_analysis (product_id);
CREATE INDEX IF NOT EXISTS price_analysis_verified_idx
  ON public.price_analysis (verification_status, verified_at DESC);
CREATE INDEX IF NOT EXISTS material_analysis_project_id_idx ON public.material_analysis (project_id);
CREATE INDEX IF NOT EXISTS material_analysis_product_id_idx ON public.material_analysis (product_id);

ALTER TABLE public.systems ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_analysis ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.systems, public.products, public.price_analysis, public.material_analysis
  FROM anon, authenticated;
GRANT ALL ON TABLE public.systems, public.products, public.price_analysis, public.material_analysis
  TO service_role;
