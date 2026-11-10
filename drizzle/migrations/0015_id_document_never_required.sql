CREATE OR REPLACE FUNCTION public.enforce_worker_id_document()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- ID documents are no longer collected: never required, regardless of the historical require_id_document flag.
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_worker_personal_data()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  is_worker boolean;
  cf text;
  cf_ok boolean;
  doc_num text;
  today_it date := (now() AT TIME ZONE 'Europe/Rome')::date;
  has_residence_address boolean;
  require_tax_code boolean := public.is_feature_enabled('worker_tax_code_enabled');
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = NEW.id AND role = 'worker')
    INTO is_worker;
  IF NOT is_worker THEN RETURN NEW; END IF;

  IF NEW.id_document_number IS NOT NULL THEN
    doc_num := upper(btrim(NEW.id_document_number));
    NEW.id_document_number := doc_num;
    IF length(doc_num) > 0 AND doc_num !~ '^[A-Z0-9]{5,20}$' THEN
      RAISE EXCEPTION 'Numero documento non valido. Inserisci solo lettere e numeri.';
    END IF;
  END IF;

  IF COALESCE(NEW.profile_completed, false) <> true THEN RETURN NEW; END IF;

  has_residence_address :=
    (NEW.residence_address IS NOT NULL AND length(btrim(NEW.residence_address)) > 0)
    OR (
      NEW.residence_street IS NOT NULL AND length(btrim(NEW.residence_street)) > 0
      AND NEW.residence_number IS NOT NULL AND length(btrim(NEW.residence_number)) > 0
    );

  IF NEW.first_name IS NULL OR length(btrim(NEW.first_name)) = 0
     OR NEW.last_name IS NULL OR length(btrim(NEW.last_name)) = 0
     OR NEW.birth_date IS NULL
     OR NEW.birth_place IS NULL OR length(btrim(NEW.birth_place)) = 0
     OR (require_tax_code AND (NEW.tax_code IS NULL OR length(btrim(NEW.tax_code)) = 0))
     OR NEW.nationality IS NULL OR length(btrim(NEW.nationality)) = 0
     OR NOT has_residence_address
     OR NEW.residence_city IS NULL OR length(btrim(NEW.residence_city)) = 0
     OR NEW.residence_postal_code IS NULL OR length(btrim(NEW.residence_postal_code)) = 0
     OR NEW.residence_province IS NULL OR length(btrim(NEW.residence_province)) = 0
     OR NEW.phone_full IS NULL OR length(btrim(NEW.phone_full)) = 0
     OR NEW.email IS NULL OR length(btrim(NEW.email)) = 0
  THEN
    RAISE EXCEPTION 'Completa tutti i campi anagrafici obbligatori.';
  END IF;

  -- ID document requirements removed: documents are no longer collected; historical values are kept untouched.

  IF require_tax_code AND NEW.tax_code IS NOT NULL AND length(btrim(NEW.tax_code)) > 0 THEN
    cf := upper(btrim(NEW.tax_code));
    cf_ok := (cf ~ '^[A-Z]{6}[0-9]{2}[A-Z][0-9]{2}[A-Z][0-9]{3}[A-Z]$') OR (cf ~ '^[0-9]{11}$');
    IF NOT cf_ok THEN
      RAISE EXCEPTION 'Codice fiscale non valido.';
    END IF;
    NEW.tax_code := cf;
  END IF;

  IF NEW.birth_date > today_it THEN
    RAISE EXCEPTION 'La data di nascita non può essere futura.';
  END IF;
  IF NEW.birth_date > (today_it - interval '18 years') THEN
    RAISE EXCEPTION 'Devi avere almeno 18 anni per completare l''iscrizione.';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_worker_date_fields_always()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  is_worker boolean;
  today_it date := (now() AT TIME ZONE 'Europe/Rome')::date;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = NEW.id AND role = 'worker')
    INTO is_worker;
  IF NOT is_worker THEN RETURN NEW; END IF;

  IF NEW.birth_date IS NOT NULL THEN
    IF NEW.birth_date > today_it THEN
      RAISE EXCEPTION 'La data di nascita non può essere futura.';
    END IF;
    IF NEW.birth_date > (today_it - interval '18 years') THEN
      RAISE EXCEPTION 'Devi avere almeno 18 anni per completare l''iscrizione.';
    END IF;
  END IF;

  -- Historical ID document dates: only validated when the user changes them, so an expired historical document never blocks a save.
  IF NEW.id_document_issued_at IS NOT NULL AND NEW.id_document_issued_at > today_it
     AND (TG_OP = 'INSERT' OR NEW.id_document_issued_at IS DISTINCT FROM OLD.id_document_issued_at) THEN
    RAISE EXCEPTION 'La data di rilascio non può essere futura.';
  END IF;

  IF NEW.id_document_expires_at IS NOT NULL AND NEW.id_document_expires_at < today_it
     AND (TG_OP = 'INSERT' OR NEW.id_document_expires_at IS DISTINCT FROM OLD.id_document_expires_at) THEN
    RAISE EXCEPTION 'Il documento risulta scaduto.';
  END IF;

  IF NEW.id_document_issued_at IS NOT NULL AND NEW.id_document_expires_at IS NOT NULL
     AND NEW.id_document_expires_at <= NEW.id_document_issued_at
     AND (TG_OP = 'INSERT' OR NEW.id_document_issued_at IS DISTINCT FROM OLD.id_document_issued_at OR NEW.id_document_expires_at IS DISTINCT FROM OLD.id_document_expires_at) THEN
    RAISE EXCEPTION 'La data di scadenza deve essere successiva alla data di rilascio.';
  END IF;

  RETURN NEW;
END;
$function$;