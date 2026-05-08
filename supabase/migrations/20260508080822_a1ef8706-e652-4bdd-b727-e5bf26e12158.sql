
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS representative_age integer;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_representative_age_range;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_representative_age_range
  CHECK (representative_age IS NULL OR (representative_age BETWEEN 18 AND 99));

CREATE OR REPLACE FUNCTION public.enforce_restaurant_age()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_restaurant boolean;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = NEW.id AND role = 'restaurant')
    INTO is_restaurant;

  IF is_restaurant AND COALESCE(NEW.profile_completed, false) = true THEN
    IF NEW.representative_age IS NULL THEN
      RAISE EXCEPTION 'Seleziona l''età del referente. Devi avere almeno 18 anni per creare un account ristoratore.';
    END IF;
    IF NEW.representative_age < 18 OR NEW.representative_age > 99 THEN
      RAISE EXCEPTION 'Età del referente non valida (18-99).';
    END IF;
    NEW.age_verified := true;
    IF NEW.age_verified_at IS NULL THEN
      NEW.age_verified_at := now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
