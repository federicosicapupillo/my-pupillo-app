-- Always-on validation of worker date fields, regardless of profile_completed.
-- Mirrors the client guard and the existing enforce_worker_personal_data
-- trigger, returning the SAME Italian messages, so any UPDATE/INSERT that
-- tries to set invalid dates via the API is rejected at the database layer.
CREATE OR REPLACE FUNCTION public.enforce_worker_date_fields_always()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE is_worker boolean;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = NEW.id AND role = 'worker')
    INTO is_worker;
  IF NOT is_worker THEN RETURN NEW; END IF;

  -- birth_date: must be a past calendar day and the user must be at least 16.
  IF NEW.birth_date IS NOT NULL THEN
    IF NEW.birth_date >= CURRENT_DATE THEN
      RAISE EXCEPTION 'Data di nascita non valida.';
    END IF;
    IF NEW.birth_date > (CURRENT_DATE - interval '16 years') THEN
      RAISE EXCEPTION 'Devi avere almeno 16 anni.';
    END IF;
  END IF;

  -- id_document_issued_at: cannot be in the future.
  IF NEW.id_document_issued_at IS NOT NULL
     AND NEW.id_document_issued_at > CURRENT_DATE THEN
    RAISE EXCEPTION 'La data di rilascio non può essere futura.';
  END IF;

  -- id_document_expires_at: cannot be already expired.
  IF NEW.id_document_expires_at IS NOT NULL
     AND NEW.id_document_expires_at < CURRENT_DATE THEN
    RAISE EXCEPTION 'Il documento risulta scaduto. Carica un documento valido.';
  END IF;

  -- Cross-check: expiry must be strictly after issue.
  IF NEW.id_document_issued_at IS NOT NULL
     AND NEW.id_document_expires_at IS NOT NULL
     AND NEW.id_document_expires_at <= NEW.id_document_issued_at THEN
    RAISE EXCEPTION 'La data di scadenza deve essere successiva alla data di rilascio.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_worker_date_fields_always ON public.profiles;
CREATE TRIGGER trg_enforce_worker_date_fields_always
BEFORE INSERT OR UPDATE OF birth_date, id_document_issued_at, id_document_expires_at
ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.enforce_worker_date_fields_always();
