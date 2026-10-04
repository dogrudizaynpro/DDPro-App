ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.research_items ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.projects, public.offers, public.research_items
  FROM anon, authenticated;
GRANT ALL ON TABLE public.projects, public.offers, public.research_items
  TO service_role;
