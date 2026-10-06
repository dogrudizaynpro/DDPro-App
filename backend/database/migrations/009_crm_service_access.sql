ALTER TABLE public.crm_contacts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.crm_contacts FROM anon, authenticated;
GRANT ALL ON TABLE public.crm_contacts TO service_role;
