-- Grok 2: preserve the original Gmail Sent proof ID in the canonical column.
-- Applies only to already verified, counting outreach_sent events with
-- matching Gmail event_key and metadata. Does not create sends or counts.
CREATE OR REPLACE FUNCTION private.fill_grok2_gmail_source_id()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_gmail_id text;
BEGIN
  IF NEW.agent = 'grok_2'
     AND NEW.event_type = 'outreach_sent'
     AND NEW.source_id IS NULL
     AND NEW.verified IS TRUE
     AND NEW.counts_toward_actual IS TRUE
     AND NEW.metadata ->> 'state' = 'sent'
  THEN
    v_gmail_id := NEW.metadata ->> 'gmail_message_id';
    IF v_gmail_id ~ '^[0-9a-f]{16}$'
       AND NEW.event_key = concat('gmail:', v_gmail_id)
    THEN
      NEW.source_id := concat('gmail:', v_gmail_id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_grok2_gmail_source_id ON public.bot_events;
CREATE TRIGGER trg_grok2_gmail_source_id
BEFORE INSERT OR UPDATE OF source_id, metadata, verified, counts_toward_actual
ON public.bot_events
FOR EACH ROW
EXECUTE FUNCTION private.fill_grok2_gmail_source_id();
