CREATE OR REPLACE FUNCTION public.enforce_worker_service_area()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_worker boolean;
  mode text;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = NEW.id AND role = 'worker')
    INTO is_worker;
  IF NOT is_worker THEN RETURN NEW; END IF;
  IF COALESCE(NEW.profile_completed, false) <> true THEN RETURN NEW; END IF;

  mode := COALESCE(NULLIF(btrim(NEW.work_area_mode), ''),
                   CASE WHEN NEW.service_area_district = '__georadar__' THEN 'georadar' ELSE 'zones' END);
  NEW.work_area_mode := mode;

  IF NEW.service_area_city IS NULL OR length(btrim(NEW.service_area_city)) = 0 THEN
    RAISE EXCEPTION 'Indica la città di partenza per la tua area di interesse.';
  END IF;

  IF NEW.service_area_radius_m IS NULL
     OR NEW.service_area_radius_m NOT IN (2000, 5000, 10000, 15000, 20000, 30000, 50000) THEN
    RAISE EXCEPTION 'Seleziona un raggio d''azione valido (2, 5, 10, 15, 20, 30 o 50 km).';
  END IF;

  IF mode = 'zones' THEN
    IF COALESCE(NEW.all_zones, false) = false
       AND COALESCE(array_length(NEW.selected_zones, 1), 0) = 0
       AND (NEW.service_area_district IS NULL OR length(btrim(NEW.service_area_district)) = 0) THEN
      RAISE EXCEPTION 'Indica la zona o il quartiere della tua area di interesse.';
    END IF;
    NEW.service_area_district := COALESCE(NULLIF(array_to_string(NEW.selected_zones, ', '), ''), NEW.service_area_district);
  ELSIF mode = 'georadar' THEN
    IF NEW.service_area_lat IS NULL OR NEW.service_area_lng IS NULL THEN
      RAISE EXCEPTION 'Usa la posizione attuale o inserisci città e zona per usare il GeoRadar.';
    END IF;
    IF NEW.service_area_district = '__georadar__' THEN
      NEW.service_area_district := NULL;
    END IF;
    NEW.selected_zones := '{}';
    NEW.all_zones := false;
  ELSE
    RAISE EXCEPTION 'Seleziona una modalità valida per la tua area di lavoro.';
  END IF;

  RETURN NEW;
END;
$$;