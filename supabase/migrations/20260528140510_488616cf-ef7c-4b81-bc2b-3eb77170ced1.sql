
-- Enforce: an application can only transition to 'accepted' if the
-- restaurant's credits have been consumed (or covered by paid plan).
-- consume_credits writes credit_transactions with reason='assign_worker'
-- and reference_id = application_id, for both free (kind='consume') and
-- pro/business (kind='plan_bonus') flows.
CREATE OR REPLACE FUNCTION public.enforce_application_accept_credits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  charged boolean;
BEGIN
  IF NEW.status = 'accepted' AND COALESCE(OLD.status::text, '') <> 'accepted' THEN
    -- Admins can bypass (manual fixes/backfills)
    IF public.has_role(auth.uid(), 'admin'::app_role) THEN
      RETURN NEW;
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM public.credit_transactions ct
      WHERE ct.user_id = NEW.restaurant_id
        AND ct.reason = 'assign_worker'
        AND ct.reference_id = NEW.id::text
        AND ct.kind IN ('consume', 'plan_bonus')
    ) INTO charged;

    IF NOT charged THEN
      RAISE EXCEPTION 'insufficient_credits_or_not_charged'
        USING HINT = 'Il ristoratore deve confermare il lavoratore (7 crediti) prima che la candidatura passi ad accettata.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_application_accept_credits ON public.applications;
CREATE TRIGGER trg_enforce_application_accept_credits
BEFORE UPDATE ON public.applications
FOR EACH ROW
EXECUTE FUNCTION public.enforce_application_accept_credits();
