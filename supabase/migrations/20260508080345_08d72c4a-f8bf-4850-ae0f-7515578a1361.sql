
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS birth_date date,
  ADD COLUMN IF NOT EXISTS age_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS age_verified_at timestamptz;

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
    IF NEW.birth_date IS NULL THEN
      RAISE EXCEPTION 'Data di nascita obbligatoria per i ristoratori';
    END IF;
    IF (NEW.birth_date + INTERVAL '18 years') > now() THEN
      RAISE EXCEPTION 'Per registrarti come ristoratore devi avere almeno 18 anni.';
    END IF;
    NEW.age_verified := true;
    IF NEW.age_verified_at IS NULL THEN
      NEW.age_verified_at := now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_restaurant_age ON public.profiles;
CREATE TRIGGER trg_enforce_restaurant_age
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.enforce_restaurant_age();
