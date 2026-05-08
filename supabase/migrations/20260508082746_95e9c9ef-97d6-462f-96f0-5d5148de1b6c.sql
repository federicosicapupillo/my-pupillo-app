
-- Add additional company fields for VAT verification
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS company_tax_code text,
  ADD COLUMN IF NOT EXISTS registered_office_address text,
  ADD COLUMN IF NOT EXISTS registered_office_city text,
  ADD COLUMN IF NOT EXISTS registered_office_province text,
  ADD COLUMN IF NOT EXISTS registered_office_postal_code text,
  ADD COLUMN IF NOT EXISTS business_status text,
  ADD COLUMN IF NOT EXISTS pec_email text,
  ADD COLUMN IF NOT EXISTS sdi_code text;

-- Normalize vat_number on write: strip spaces/dots/dashes, uppercase. Used to enforce uniqueness.
CREATE OR REPLACE FUNCTION public.normalize_vat(_v text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NULLIF(regexp_replace(UPPER(COALESCE(_v,'')), '[^A-Z0-9]', '', 'g'), '');
$$;

-- Unique index on normalized vat_number to block duplicates (case/format-insensitive).
CREATE UNIQUE INDEX IF NOT EXISTS profiles_vat_number_unique_idx
  ON public.profiles ((public.normalize_vat(vat_number)))
  WHERE vat_number IS NOT NULL AND length(public.normalize_vat(vat_number)) > 0;

-- Validation trigger: if a restaurant completes profile, vat_number must be 11 digits (IT) once provided.
CREATE OR REPLACE FUNCTION public.enforce_restaurant_vat()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_restaurant boolean;
  digits text;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = NEW.id AND role = 'restaurant')
    INTO is_restaurant;

  IF NOT is_restaurant THEN
    RETURN NEW;
  END IF;

  IF NEW.vat_number IS NOT NULL THEN
    digits := regexp_replace(NEW.vat_number, '\D', '', 'g');
    -- Strip leading IT prefix if present (already non-digits removed above)
    -- Accept exactly 11 digits for Italian VAT
    IF length(digits) <> 11 THEN
      RAISE EXCEPTION 'La Partita IVA deve contenere 11 cifre numeriche.';
    END IF;
    NEW.vat_number := digits;
  END IF;

  IF COALESCE(NEW.profile_completed, false) = true AND (NEW.vat_number IS NULL OR length(NEW.vat_number) <> 11) THEN
    RAISE EXCEPTION 'Partita IVA obbligatoria (11 cifre) per completare il profilo ristoratore.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_restaurant_vat_trg ON public.profiles;
CREATE TRIGGER enforce_restaurant_vat_trg
BEFORE INSERT OR UPDATE OF vat_number, profile_completed ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.enforce_restaurant_vat();
