-- Personal-only incentive payout notifications; winner congratulations remain separate.
CREATE TABLE IF NOT EXISTS public.incentive_payment_notifications (
  incentive_id uuid PRIMARY KEY REFERENCES public.weekly_incentives(id) ON DELETE CASCADE,
  recipient_user_id uuid NOT NULL REFERENCES auth.users(id),
  delivery_status text NOT NULL DEFAULT 'sending'
    CHECK (delivery_status IN ('sending', 'sent', 'failed')),
  discord_message_id text,
  delivered_at timestamptz,
  last_error text,
  attempt_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.incentive_payment_notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.incentive_payment_notifications FROM anon, authenticated;

INSERT INTO public.internal_cron_tokens(name,token)
VALUES ('incentive_payment', replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''))
ON CONFLICT (name) DO NOTHING;

CREATE OR REPLACE FUNCTION public.queue_personal_incentive_payment_notice()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  cron_secret text;
BEGIN
  IF NEW.status = 'Paid' AND NEW.paid_at IS NOT NULL THEN
    SELECT token INTO cron_secret FROM public.internal_cron_tokens WHERE name = 'incentive_payment';
    IF cron_secret IS NOT NULL THEN
      PERFORM net.http_post(
        url := 'https://dwroeyybppbeyuexkwlg.supabase.co/functions/v1/notify-incentive-paid',
        headers := jsonb_build_object('Content-Type','application/json','x-incentive-payment-secret',cron_secret),
        body := jsonb_build_object('incentive_id',NEW.id::text),
        timeout_milliseconds := 60000
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$fn$;
REVOKE ALL ON FUNCTION public.queue_personal_incentive_payment_notice() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_personal_incentive_paid_update ON public.weekly_incentives;
CREATE TRIGGER trg_personal_incentive_paid_update
AFTER UPDATE OF status, paid_at ON public.weekly_incentives
FOR EACH ROW WHEN (
  NEW.status = 'Paid' AND NEW.paid_at IS NOT NULL AND
  (OLD.status IS DISTINCT FROM NEW.status OR OLD.paid_at IS DISTINCT FROM NEW.paid_at)
)
EXECUTE FUNCTION public.queue_personal_incentive_payment_notice();
DROP TRIGGER IF EXISTS trg_personal_incentive_paid_insert ON public.weekly_incentives;
CREATE TRIGGER trg_personal_incentive_paid_insert
AFTER INSERT ON public.weekly_incentives
FOR EACH ROW WHEN (NEW.status = 'Paid' AND NEW.paid_at IS NOT NULL)
EXECUTE FUNCTION public.queue_personal_incentive_payment_notice();
