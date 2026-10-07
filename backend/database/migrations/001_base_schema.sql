CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  project_type TEXT,
  status TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.research_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  category TEXT,
  description TEXT,
  status TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  project_id UUID,
  amount NUMERIC,
  currency TEXT,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT fk_offers_project_id
    FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.research_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.projects, public.research_items, public.offers
  FROM anon, authenticated;
GRANT ALL ON TABLE public.projects, public.research_items, public.offers
  TO service_role;
