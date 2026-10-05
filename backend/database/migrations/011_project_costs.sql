CREATE TABLE IF NOT EXISTS public.project_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_account TEXT NOT NULL,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  system_id UUID REFERENCES public.systems(id) ON DELETE SET NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  material_analysis_id UUID REFERENCES public.material_analysis(id) ON DELETE SET NULL,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 200),
  cost_type TEXT NOT NULL CHECK (cost_type IN ('MATERIAL', 'LABOR', 'OTHER')),
  currency TEXT NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  budget_amount NUMERIC CHECK (budget_amount IS NULL OR budget_amount >= 0),
  actual_amount NUMERIC CHECK (actual_amount IS NULL OR actual_amount > 0),
  source TEXT,
  verification_status TEXT NOT NULL CHECK (verification_status IN ('VERIFIED', 'UNVERIFIED', 'MISSING')),
  verified_at TIMESTAMPTZ,
  occurred_on DATE,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (verification_status <> 'VERIFIED' OR
    (actual_amount IS NOT NULL AND source IS NOT NULL AND source <> '' AND verified_at IS NOT NULL)),
  CHECK (verification_status <> 'MISSING' OR actual_amount IS NULL)
);

CREATE INDEX IF NOT EXISTS project_costs_owner_created_idx
  ON public.project_costs (owner_account, created_at DESC);
CREATE INDEX IF NOT EXISTS project_costs_project_created_idx
  ON public.project_costs (project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS project_costs_project_type_idx
  ON public.project_costs (project_id, cost_type, verification_status);

ALTER TABLE public.project_costs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.project_costs FROM anon, authenticated;
GRANT ALL ON TABLE public.project_costs TO service_role;
