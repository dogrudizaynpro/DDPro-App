CREATE TABLE IF NOT EXISTS public.message_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_account TEXT NOT NULL,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  crm_contact_id UUID REFERENCES public.crm_contacts(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.message_conversations(id) ON DELETE CASCADE,
  owner_account TEXT NOT NULL,
  direction TEXT NOT NULL DEFAULT 'OUTBOUND' CHECK (direction IN ('INBOUND', 'OUTBOUND')),
  content TEXT NOT NULL CHECK (length(content) BETWEEN 1 AND 10000),
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS message_conversations_owner_updated_idx
  ON public.message_conversations (owner_account, updated_at DESC);
CREATE INDEX IF NOT EXISTS message_conversations_project_idx
  ON public.message_conversations (project_id);
CREATE INDEX IF NOT EXISTS message_conversations_contact_idx
  ON public.message_conversations (crm_contact_id);
CREATE INDEX IF NOT EXISTS messages_conversation_created_idx
  ON public.messages (conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS messages_owner_unread_idx
  ON public.messages (owner_account, read_at)
  WHERE read_at IS NULL;

ALTER TABLE public.message_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.message_conversations, public.messages FROM anon, authenticated;
GRANT ALL ON TABLE public.message_conversations, public.messages TO service_role;
