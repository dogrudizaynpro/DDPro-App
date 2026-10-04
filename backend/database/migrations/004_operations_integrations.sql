CREATE TABLE IF NOT EXISTS integration_tokens (
  provider TEXT NOT NULL,
  account TEXT NOT NULL,
  encrypted_token JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (provider, account)
);

ALTER TABLE integration_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON integration_tokens FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS crm_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact_date DATE NOT NULL DEFAULT CURRENT_DATE,
  company TEXT,
  phone TEXT,
  email TEXT,
  request TEXT,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  system TEXT,
  area_m2 NUMERIC CHECK (area_m2 IS NULL OR area_m2 >= 0),
  status TEXT NOT NULL DEFAULT 'Yeni',
  notes TEXT,
  source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'gmail', 'whatsapp', 'website')),
  source_external_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source, source_external_id)
);

ALTER TABLE crm_contacts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON crm_contacts FROM anon, authenticated;

ALTER TABLE offers
  ADD COLUMN IF NOT EXISTS crm_contact_id UUID REFERENCES crm_contacts(id) ON DELETE SET NULL;

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS crm_contact_id UUID REFERENCES crm_contacts(id) ON DELETE SET NULL;

ALTER TABLE research_items
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS product_id UUID;

CREATE INDEX IF NOT EXISTS crm_contacts_created_at_idx
  ON crm_contacts (created_at DESC);
