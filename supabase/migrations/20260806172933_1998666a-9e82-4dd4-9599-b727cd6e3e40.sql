CREATE OR REPLACE FUNCTION public.enforce_restaurant_no_show_window()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_start timestamptz;
  v_allowed timestamptz;
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

  IF NEW.status = 'no_show' THEN
    -- Il no-show passa esclusivamente dalla RPC sicura, che è anche
    -- l'unica autorità sulla finestra temporale (inizio + 15 → + 30 min).
    IF COALESCE(current_setting('pupillo.no_show_via_rpc', true), '') = '1' THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Il No-show può essere segnalato solo tramite la procedura dedicata.'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT COALESCE(
    a.shift_start_at,
    (
      (COALESCE(a.service_date::text, NEW.shift_date::text) || ' ' ||
       COALESCE(a.service_time::text, '00:00:00'))::timestamp AT TIME ZONE 'Europe/Rome'
    )
  ) INTO v_start
  FROM public.announcements a
  WHERE a.id = NEW.announcement_id;

  IF v_start IS NULL AND NEW.shift_date IS NOT NULL THEN
    v_start := ((NEW.shift_date::text || ' 00:00:00')::timestamp AT TIME ZONE 'Europe/Rome');
  END IF;

  IF v_start IS NULL THEN
    RETURN NEW;
  END IF;

  v_allowed := v_start + interval '15 minutes';
  v_deadline := v_start + interval '30 minutes';

  IF now() > v_deadline THEN
    RAISE EXCEPTION 'Il termine per segnalare il no-show è scaduto. Dopo 30 minuti dall''inizio non è più possibile annullare il turno.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$function$;