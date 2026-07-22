
-- 1) Feature flag row (idempotent)
INSERT INTO public.feature_flags (key, enabled, scope, description)
VALUES (
  'counteroffer_enabled',
  false,
  'global',
  'Consente a lavoratori e ristoratori di proporre, accettare o rifiutare una tariffa diversa da quella iniziale.'
)
ON CONFLICT (key) DO NOTHING;

-- 2) Backend guard on public.applications: block new counteroffers when flag OFF.
CREATE OR REPLACE FUNCTION public.enforce_counteroffer_flag()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  enabled boolean := public.is_feature_enabled('counteroffer_enabled');
BEGIN
  IF enabled THEN
    RETURN NEW;
  END IF;

  -- Flag OFF: forbid transitions/writes that create a new counteroffer.
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'counter_offer' THEN
      RAISE EXCEPTION 'La funzione controfferta è disattivata.'
        USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.proposed_tariff IS NOT NULL THEN
      RAISE EXCEPTION 'La funzione controfferta è disattivata: non è possibile proporre una tariffa alternativa.'
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE: allow historical rows to keep their values, but block new counteroffers.
  IF NEW.status = 'counter_offer' AND COALESCE(OLD.status, '') <> 'counter_offer' THEN
    RAISE EXCEPTION 'La funzione controfferta è disattivata.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.proposed_tariff IS DISTINCT FROM OLD.proposed_tariff
     AND NEW.proposed_tariff IS NOT NULL THEN
    RAISE EXCEPTION 'La funzione controfferta è disattivata: non è possibile modificare la tariffa proposta.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_counteroffer_flag ON public.applications;
CREATE TRIGGER trg_enforce_counteroffer_flag
  BEFORE INSERT OR UPDATE ON public.applications
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_counteroffer_flag();
