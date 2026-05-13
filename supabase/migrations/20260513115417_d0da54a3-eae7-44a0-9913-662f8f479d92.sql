ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS service_area_city text,
  ADD COLUMN IF NOT EXISTS service_area_district text;

CREATE OR REPLACE FUNCTION public.enforce_worker_service_area()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE is_worker boolean;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = NEW.id AND role = 'worker')
    INTO is_worker;
  IF NOT is_worker THEN RETURN NEW; END IF;
  IF COALESCE(NEW.profile_completed, false) <> true THEN RETURN NEW; END IF;

  IF NEW.service_area_city IS NULL OR length(btrim(NEW.service_area_city)) = 0 THEN
    RAISE EXCEPTION 'Indica la città di partenza per la tua area di interesse.';
  END IF;
  IF NEW.service_area_district IS NULL OR length(btrim(NEW.service_area_district)) = 0 THEN
    RAISE EXCEPTION 'Indica la zona o il quartiere della tua area di interesse.';
  END IF;
  IF NEW.service_area_address IS NULL OR length(btrim(NEW.service_area_address)) < 3 THEN
    RAISE EXCEPTION 'Indica l''indirizzo o un punto di riferimento della tua area di interesse.';
  END IF;
  IF NEW.service_area_lat IS NULL OR NEW.service_area_lng IS NULL THEN
    RAISE EXCEPTION 'Impossibile localizzare l''indirizzo della tua area di interesse. Verifica e riprova.';
  END IF;
  IF NEW.service_area_radius_m IS NULL
     OR NEW.service_area_radius_m NOT IN (2000, 5000, 10000, 15000, 20000, 30000, 50000) THEN
    RAISE EXCEPTION 'Seleziona un raggio d''azione valido (2, 5, 10, 15, 20, 30 o 50 km).';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_worker_service_area ON public.profiles;
CREATE TRIGGER trg_enforce_worker_service_area
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.enforce_worker_service_area();