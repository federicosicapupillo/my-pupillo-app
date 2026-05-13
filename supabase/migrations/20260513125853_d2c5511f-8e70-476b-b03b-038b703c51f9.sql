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
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = NEW.id AND role = 'worker')
    INTO is_worker;
  IF NOT is_worker THEN RETURN NEW; END IF;

  -- Normalize the ID document number on every write (also when profile is
  -- not yet completed): trim whitespace, force uppercase, strip nothing else
  -- so the format check below is meaningful.
  IF NEW.id_document_number IS NOT NULL THEN
    doc_num := upper(btrim(NEW.id_document_number));
    NEW.id_document_number := doc_num;
    IF length(doc_num) > 0 AND doc_num !~ '^[A-Z0-9]{5,20}$' THEN
      RAISE EXCEPTION 'Numero documento non valido. Inserisci solo lettere e numeri.';
    END IF;
  END IF;

  IF COALESCE(NEW.profile_completed, false) <> true THEN RETURN NEW; END IF;

  IF NEW.first_name IS NULL OR length(btrim(NEW.first_name)) = 0
     OR NEW.last_name IS NULL OR length(btrim(NEW.last_name)) = 0
     OR NEW.birth_date IS NULL
     OR NEW.birth_place IS NULL OR length(btrim(NEW.birth_place)) = 0
     OR NEW.tax_code IS NULL OR length(btrim(NEW.tax_code)) = 0
     OR NEW.nationality IS NULL OR length(btrim(NEW.nationality)) = 0
     OR NEW.residence_address IS NULL OR length(btrim(NEW.residence_address)) = 0
     OR NEW.residence_city IS NULL OR length(btrim(NEW.residence_city)) = 0
     OR NEW.residence_postal_code IS NULL OR length(btrim(NEW.residence_postal_code)) = 0
     OR NEW.residence_province IS NULL OR length(btrim(NEW.residence_province)) = 0
     OR NEW.phone_full IS NULL OR length(btrim(NEW.phone_full)) = 0
     OR NEW.email IS NULL OR length(btrim(NEW.email)) = 0
     OR NEW.id_document_type IS NULL OR NEW.id_document_type NOT IN ('carta_identita','passaporto','patente')
     OR NEW.id_document_number IS NULL OR length(btrim(NEW.id_document_number)) = 0
     OR NEW.id_document_issued_at IS NULL
     OR NEW.id_document_expires_at IS NULL
     OR NEW.id_document_issuer IS NULL OR length(btrim(NEW.id_document_issuer)) = 0
  THEN
    RAISE EXCEPTION 'Completa tutti i dati anagrafici e carica un documento valido per proseguire.';
  END IF;

  -- Re-check format on the completed profile (defense in depth).
  IF NEW.id_document_number !~ '^[A-Z0-9]{5,20}$' THEN
    RAISE EXCEPTION 'Numero documento non valido. Inserisci solo lettere e numeri.';
  END IF;

  cf := upper(btrim(NEW.tax_code));
  cf_ok := (cf ~ '^[A-Z]{6}[0-9]{2}[A-Z][0-9]{2}[A-Z][0-9]{3}[A-Z]$') OR (cf ~ '^[0-9]{11}$');
  IF NOT cf_ok THEN
    RAISE EXCEPTION 'Codice fiscale non valido.';
  END IF;
  NEW.tax_code := cf;

  IF NEW.birth_date >= CURRENT_DATE THEN
    RAISE EXCEPTION 'Data di nascita non valida.';
  END IF;
  IF NEW.birth_date > (CURRENT_DATE - interval '16 years') THEN
    RAISE EXCEPTION 'Devi avere almeno 16 anni.';
  END IF;

  IF NEW.id_document_issued_at > CURRENT_DATE THEN
    RAISE EXCEPTION 'La data di rilascio non può essere futura.';
  END IF;
  IF NEW.id_document_expires_at < CURRENT_DATE THEN
    RAISE EXCEPTION 'Il documento risulta scaduto. Carica un documento valido.';
  END IF;
  IF NEW.id_document_expires_at <= NEW.id_document_issued_at THEN
    RAISE EXCEPTION 'La data di scadenza deve essere successiva alla data di rilascio.';
  END IF;

  RETURN NEW;
END;
$function$;