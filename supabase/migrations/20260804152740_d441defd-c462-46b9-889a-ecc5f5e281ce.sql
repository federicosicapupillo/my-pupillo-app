CREATE OR REPLACE FUNCTION public.accept_application_atomic(_application_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  app record;
  ann record;
  needed integer := 1;
  filled integer := 0;
  charged boolean;
  err text;
  v_worker uuid;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_authenticated');
  END IF;

  -- Lettura preliminare SENZA lock: serve solo a conoscere il lavoratore.
  SELECT worker_id INTO v_worker FROM public.applications WHERE id = _application_id;
  IF v_worker IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_found');
  END IF;

  -- Lock per-lavoratore PRIMA di qualunque row lock: due conferme concorrenti
  -- su turni sovrapposti dello stesso worker vengono serializzate qui, evitando
  -- il deadlock (advisory lock vs row lock incrociati con la chiusura delle
  -- candidature sovrapposte).
  PERFORM pg_advisory_xact_lock(hashtextextended(v_worker::text, 42));

  SELECT * INTO app FROM public.applications WHERE id = _application_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_found');
  END IF;
  IF app.restaurant_id <> uid THEN
    RETURN jsonb_build_object('ok', false, 'code', 'forbidden');
  END IF;

  IF app.status = 'accepted' THEN
    RETURN jsonb_build_object('ok', true, 'code', 'already_assigned', 'idempotent', true);
  END IF;

  IF app.status NOT IN ('pending', 'interested', 'counter_offer') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_available');
  END IF;

  IF app.announcement_id IS NOT NULL THEN
    SELECT * INTO ann FROM public.announcements WHERE id = app.announcement_id FOR UPDATE;
    IF FOUND AND ann.status IN ('cancelled', 'completed', 'draft') THEN
      RETURN jsonb_build_object('ok', false, 'code', 'not_available');
    END IF;

    IF NOT public.announcement_is_in_operational_area(app.announcement_id) THEN
      RETURN jsonb_build_object('ok', false, 'code', 'outside_operational_area');
    END IF;

    IF NOT public.announcement_offer_acceptable(app.announcement_id) THEN
      RETURN jsonb_build_object('ok', false, 'code', 'offer_expired');
    END IF;

    IF public.worker_conflicts_with_announcement(app.worker_id, app.announcement_id, NULL) THEN
      RETURN jsonb_build_object('ok', false, 'code', 'worker_shift_conflict');
    END IF;

    SELECT GREATEST(1, COALESCE(jr.workers_needed, 1)) INTO needed
    FROM public.job_requests jr
    WHERE jr.announcement_id = app.announcement_id
    ORDER BY jr.created_at DESC
    LIMIT 1;
    needed := COALESCE(needed, 1);

    SELECT count(*) INTO filled
    FROM public.applications a2
    WHERE a2.announcement_id = app.announcement_id AND a2.status = 'accepted';

    IF filled >= needed THEN
      RETURN jsonb_build_object('ok', false, 'code', 'announcement_full');
    END IF;
  END IF;

  BEGIN
    charged := public.consume_credits(7, 'assign_worker', app.id::text);
    IF NOT charged THEN
      RETURN jsonb_build_object('ok', false, 'code', 'insufficient_credits');
    END IF;

    UPDATE public.applications SET status = 'accepted' WHERE id = app.id;

    IF app.announcement_id IS NOT NULL THEN
      IF (filled + 1) >= needed THEN
        UPDATE public.announcements
          SET status = 'assigned', assigned_worker_id = app.worker_id
          WHERE id = app.announcement_id;
      ELSE
        UPDATE public.announcements
          SET assigned_worker_id = app.worker_id
          WHERE id = app.announcement_id;
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS err = MESSAGE_TEXT;
    RETURN jsonb_build_object(
      'ok', false,
      'code', CASE
        WHEN err ILIKE '%WORKER_SHIFT_CONFLICT%' THEN 'worker_shift_conflict'
        WHEN err ILIKE '%OUTSIDE_OPERATIONAL_AREA%' THEN 'outside_operational_area'
        WHEN err ILIKE '%OFFER_EXPIRED%' OR err ILIKE '%ANNOUNCEMENT_EXPIRED%' THEN 'offer_expired'
        WHEN err ILIKE '%announcement_full%' THEN 'announcement_full'
        ELSE 'assignment_failed' END,
      'detail', err
    );
  END;

  RETURN jsonb_build_object('ok', true, 'code', 'assigned', 'application_id', app.id);
END;
$function$;