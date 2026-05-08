-- Add new location and phone columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS province_code text,
  ADD COLUMN IF NOT EXISTS city_code text,
  ADD COLUMN IF NOT EXISTS phone_country_code text,
  ADD COLUMN IF NOT EXISTS phone_number text,
  ADD COLUMN IF NOT EXISTS phone_full text;

-- (street_number already exists; ensure column is present without error if it doesn't)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS street_number text;

-- Validation: restaurant profiles require province + city when completed
CREATE OR REPLACE FUNCTION public.enforce_restaurant_location()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  is_restaurant boolean;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = NEW.id AND role = 'restaurant')
    INTO is_restaurant;
  IF NOT is_restaurant THEN RETURN NEW; END IF;

  IF COALESCE(NEW.profile_completed, false) = true THEN
    IF NEW.province IS NULL OR length(btrim(NEW.province)) = 0 THEN
      RAISE EXCEPTION 'Seleziona una provincia.';
    END IF;
    IF NEW.city IS NULL OR length(btrim(NEW.city)) = 0 THEN
      RAISE EXCEPTION 'Seleziona una città.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_restaurant_location_trg ON public.profiles;
CREATE TRIGGER enforce_restaurant_location_trg
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_restaurant_location();