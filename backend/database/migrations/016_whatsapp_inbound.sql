CREATE TABLE IF NOT EXISTS public.whatsapp_inbound_messages (
  message_id TEXT PRIMARY KEY CHECK (length(message_id) BETWEEN 1 AND 500),
  sender TEXT NOT NULL CHECK (sender ~ '^[0-9]{8,20}$'),
  status TEXT NOT NULL DEFAULT 'retry' CHECK (status IN ('retry', 'processing', 'completed')),
  lease_token UUID,
  leased_until TIMESTAMPTZ,
  contact_id UUID REFERENCES public.crm_contacts(id) ON DELETE SET NULL,
  owner_account TEXT,
  connection_version TEXT CHECK (connection_version IS NULL OR connection_version ~ '^[0-9a-f]{64}$'),
  reply_chunks JSONB,
  next_chunk INTEGER NOT NULL DEFAULT 0 CHECK (next_chunk >= 0),
  usage_recorded BOOLEAN NOT NULL DEFAULT false,
  confirmation_attempted BOOLEAN NOT NULL DEFAULT false,
  pending_action_id UUID,
  pending_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS whatsapp_inbound_sender_idx
  ON public.whatsapp_inbound_messages (sender, status, leased_until);
CREATE INDEX IF NOT EXISTS whatsapp_inbound_pending_idx
  ON public.whatsapp_inbound_messages (pending_action_id, sender, owner_account);

ALTER TABLE public.whatsapp_inbound_messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.whatsapp_inbound_messages FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.whatsapp_inbound_messages TO service_role;

-- Serialize active work for a phone across webhook deliveries and server replicas.
-- A crashed worker becomes retryable after the bounded processing lease expires.
CREATE OR REPLACE FUNCTION public.claim_whatsapp_inbound(
  p_message_id TEXT, p_sender TEXT, p_lease_token UUID
) RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  claimed public.whatsapp_inbound_messages;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('whatsapp:' || p_sender, 0));
  INSERT INTO public.whatsapp_inbound_messages (message_id, sender)
    VALUES (p_message_id, p_sender) ON CONFLICT (message_id) DO NOTHING;
  IF EXISTS (
    SELECT 1 FROM public.whatsapp_inbound_messages
    WHERE sender = p_sender AND status = 'processing' AND leased_until > now()
  ) THEN
    RETURN NULL;
  END IF;
  UPDATE public.whatsapp_inbound_messages
    SET status = 'processing', lease_token = p_lease_token,
        leased_until = now() + interval '10 minutes', updated_at = now()
    WHERE message_id = p_message_id AND sender = p_sender
      AND status <> 'completed'
      AND (status <> 'processing' OR leased_until <= now())
    RETURNING * INTO claimed;
  RETURN CASE WHEN claimed.message_id IS NULL THEN NULL ELSE to_jsonb(claimed) END;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_whatsapp_inbound(TEXT, TEXT, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_whatsapp_inbound(TEXT, TEXT, UUID) TO service_role;
