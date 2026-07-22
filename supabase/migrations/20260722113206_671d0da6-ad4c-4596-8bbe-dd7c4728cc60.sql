CREATE OR REPLACE FUNCTION public.enforce_counteroffer_flag()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

  -- UPDATE: block creating a new counteroffer from a non-counteroffer row.
  IF NEW.status = 'counter_offer' AND COALESCE(OLD.status, '') <> 'counter_offer' THEN
    RAISE EXCEPTION 'La funzione controfferta è disattivata.'
      USING ERRCODE = 'check_violation';
  END IF;

  -- UPDATE: a pending counteroffer row cannot change status while flag is OFF
  -- (prevents accept/reject/cancel/expire of a pending counteroffer via direct update).
  IF OLD.status = 'counter_offer'
     AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'La funzione controfferta è disattivata: la controfferta non è più azionabile.'
      USING ERRCODE = 'check_violation';
  END IF;

  -- UPDATE: forbid modifying the proposed tariff.
  IF NEW.proposed_tariff IS DISTINCT FROM OLD.proposed_tariff THEN
    RAISE EXCEPTION 'La funzione controfferta è disattivata: non è possibile modificare la tariffa proposta.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$function$;