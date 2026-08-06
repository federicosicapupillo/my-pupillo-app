-- 1) Trigger: no-show consentito solo da inizio + 15 minuti, e solo tramite RPC
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

  -- Il cambio di stato a no_show deve passare esclusivamente dalla RPC sicura.
  IF NEW.status = 'no_show'
     AND COALESCE(current_setting('pupillo.no_show_via_rpc', true), '') <> '1' THEN
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

  IF NEW.status = 'no_show' AND now() < v_allowed THEN
    RAISE EXCEPTION 'Il No-show può essere segnalato solo dopo 15 minuti dall''inizio previsto del turno.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF now() > v_deadline THEN
    RAISE EXCEPTION 'Il termine per segnalare il no-show è scaduto. Dopo 30 minuti dall''inizio non è più possibile annullare il turno.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$function$;

-- 2) RPC sicura per la segnalazione del no-show
CREATE OR REPLACE FUNCTION public.report_shift_no_show(_shift_id uuid, _notes text DEFAULT NULL, _now timestamptz DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_shift public.shifts%ROWTYPE;
  v_start timestamptz;
  v_allowed timestamptz;
  v_deadline timestamptz;
  v_now timestamptz := now();
BEGIN
  -- _now è accettato solo per i test automatici eseguiti come service_role
  IF _now IS NOT NULL AND current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role'
     AND current_setting('role', true) NOT IN ('service_role', 'postgres') THEN
    RAISE EXCEPTION 'Parametro non consentito.' USING ERRCODE = '42501';
  ELSIF _now IS NOT NULL THEN
    v_now := _now;
  END IF;

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Devi effettuare l''accesso.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_shift FROM public.shifts WHERE id = _shift_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Turno non trovato.' USING ERRCODE = '42501';
  END IF;

  IF v_shift.restaurant_id IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'Non sei il proprietario di questo turno.' USING ERRCODE = '42501';
  END IF;

  IF v_shift.worker_id IS NULL THEN
    RAISE EXCEPTION 'Il turno non ha un lavoratore assegnato.' USING ERRCODE = 'check_violation';
  END IF;

  -- Idempotenza
  IF v_shift.status = 'no_show' THEN
    RETURN jsonb_build_object('ok', true, 'already', true, 'status', 'no_show');
  END IF;

  IF v_shift.status = 'cancelled' THEN
    RAISE EXCEPTION 'Il turno è stato annullato: non è possibile segnalare il No-show.' USING ERRCODE = 'check_violation';
  END IF;

  IF v_shift.status <> 'scheduled' THEN
    RAISE EXCEPTION 'Il turno è già concluso: non è possibile segnalare il No-show.' USING ERRCODE = 'check_violation';
  END IF;

  SELECT COALESCE(
    a.shift_start_at,
    (
      (COALESCE(a.service_date::text, v_shift.shift_date::text) || ' ' ||
       COALESCE(a.service_time::text, '00:00:00'))::timestamp AT TIME ZONE 'Europe/Rome'
    )
  ) INTO v_start
  FROM public.announcements a
  WHERE a.id = v_shift.announcement_id;

  IF v_start IS NULL THEN
    v_start := ((v_shift.shift_date::text || ' 00:00:00')::timestamp AT TIME ZONE 'Europe/Rome');
  END IF;

  v_allowed := v_start + interval '15 minutes';
  v_deadline := v_start + interval '30 minutes';

  IF v_now < v_allowed THEN
    INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, metadata)
    VALUES (v_uid, 'no_show_rejected_too_early', 'shift', v_shift.id, jsonb_build_object(
      'restaurant_id', v_uid,
      'worker_id', v_shift.worker_id,
      'shift_start_at', v_start,
      'attempted_at', v_now,
      'allowed_from', v_allowed,
      'outcome', 'rejected_too_early'
    ));
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'too_early',
      'allowed_from', v_allowed,
      'shift_start_at', v_start,
      'message', 'Il No-show può essere segnalato solo dopo 15 minuti dall''inizio previsto del turno.'
    );
  END IF;

  IF v_now > v_deadline THEN
    INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, metadata)
    VALUES (v_uid, 'no_show_rejected_expired', 'shift', v_shift.id, jsonb_build_object(
      'restaurant_id', v_uid,
      'worker_id', v_shift.worker_id,
      'shift_start_at', v_start,
      'attempted_at', v_now,
      'deadline', v_deadline,
      'outcome', 'rejected_expired'
    ));
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'expired',
      'deadline', v_deadline,
      'message', 'Il termine per segnalare il no-show è scaduto. Dopo 30 minuti dall''inizio non è più possibile annullare il turno.'
    );
  END IF;

  PERFORM set_config('pupillo.no_show_via_rpc', '1', true);
  UPDATE public.shifts SET status = 'no_show' WHERE id = v_shift.id AND status = 'scheduled';
  PERFORM set_config('pupillo.no_show_via_rpc', '', true);

  INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, metadata)
  VALUES (v_uid, 'no_show_reported', 'shift', v_shift.id, jsonb_build_object(
    'restaurant_id', v_uid,
    'worker_id', v_shift.worker_id,
    'shift_start_at', v_start,
    'reported_at', v_now,
    'notes', NULLIF(btrim(COALESCE(_notes, '')), ''),
    'outcome', 'accepted'
  ));

  RETURN jsonb_build_object('ok', true, 'status', 'no_show', 'shift_start_at', v_start, 'reported_at', v_now);
END;
$function$;

REVOKE ALL ON FUNCTION public.report_shift_no_show(uuid, text, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.report_shift_no_show(uuid, text, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_shift_no_show(uuid, text, timestamptz) TO service_role;