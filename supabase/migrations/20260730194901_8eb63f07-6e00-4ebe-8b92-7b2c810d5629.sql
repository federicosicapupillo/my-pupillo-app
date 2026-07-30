CREATE OR REPLACE FUNCTION public.shift_effective_start(_shift_id uuid)
RETURNS timestamptz
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    (COALESCE(a.service_date::text, s.shift_date::text) || ' ' ||
     COALESCE(a.service_time::text, '00:00:00'))::timestamp AT TIME ZONE 'Europe/Rome'
  )
  FROM public.shifts s
  LEFT JOIN public.announcements a ON a.id = s.announcement_id
  WHERE s.id = _shift_id
$$;

REVOKE ALL ON FUNCTION public.shift_effective_start(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.shift_effective_start(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.enforce_restaurant_no_show_window()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start timestamptz;
  v_deadline timestamptz;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM NEW.restaurant_id THEN
    RETURN NEW;
  END IF;

  IF NEW.status NOT IN ('no_show', 'cancelled') OR OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  IF OLD.status <> 'scheduled' THEN
    RETURN NEW;
  END IF;

  SELECT (
    (COALESCE(a.service_date::text, NEW.shift_date::text) || ' ' ||
     COALESCE(a.service_time::text, '00:00:00'))::timestamp AT TIME ZONE 'Europe/Rome'
  ) INTO v_start
  FROM public.announcements a
  WHERE a.id = NEW.announcement_id;

  IF v_start IS NULL AND NEW.shift_date IS NOT NULL THEN
    v_start := ((NEW.shift_date::text || ' 00:00:00')::timestamp AT TIME ZONE 'Europe/Rome');
  END IF;

  IF v_start IS NULL THEN
    RETURN NEW;
  END IF;

  v_deadline := v_start + interval '30 minutes';

  IF NEW.status = 'no_show' AND now() < v_start THEN
    RAISE EXCEPTION 'Il No show può essere segnalato solo dall''orario di inizio del turno.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF now() > v_deadline THEN
    RAISE EXCEPTION 'Il termine per segnalare il no-show è scaduto. Dopo 30 minuti dall''inizio non è più possibile annullare il turno.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_restaurant_no_show_window ON public.shifts;
CREATE TRIGGER trg_enforce_restaurant_no_show_window
BEFORE UPDATE ON public.shifts
FOR EACH ROW EXECUTE FUNCTION public.enforce_restaurant_no_show_window();