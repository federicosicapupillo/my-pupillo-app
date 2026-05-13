
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS birth_place text,
  ADD COLUMN IF NOT EXISTS tax_code text,
  ADD COLUMN IF NOT EXISTS nationality text,
  ADD COLUMN IF NOT EXISTS residence_address text,
  ADD COLUMN IF NOT EXISTS residence_city text,
  ADD COLUMN IF NOT EXISTS residence_postal_code text,
  ADD COLUMN IF NOT EXISTS residence_province text,
  ADD COLUMN IF NOT EXISTS id_document_type text,
  ADD COLUMN IF NOT EXISTS id_document_number text,
  ADD COLUMN IF NOT EXISTS id_document_issued_at date,
  ADD COLUMN IF NOT EXISTS id_document_expires_at date,
  ADD COLUMN IF NOT EXISTS id_document_issuer text;

CREATE OR REPLACE FUNCTION public.enforce_worker_personal_data()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_worker boolean;
  cf text;
  cf_ok boolean;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = NEW.id AND role = 'worker')
    INTO is_worker;
  IF NOT is_worker THEN RETURN NEW; END IF;
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

  -- Tax code validation: Italian CF (16 chars) or 11 digits
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

  IF NEW.id_document_expires_at < CURRENT_DATE THEN
    RAISE EXCEPTION 'Il documento di identità è scaduto.';
  END IF;
  IF NEW.id_document_issued_at > CURRENT_DATE
     OR NEW.id_document_issued_at >= NEW.id_document_expires_at THEN
    RAISE EXCEPTION 'Date documento non valide.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_worker_personal_data_trg ON public.profiles;
CREATE TRIGGER enforce_worker_personal_data_trg
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.enforce_worker_personal_data();
