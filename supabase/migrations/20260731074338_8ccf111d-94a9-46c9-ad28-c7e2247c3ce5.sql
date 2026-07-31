-- 1) Feature flag "counteroffer_enabled" OFF must block CREATION only.
CREATE OR REPLACE FUNCTION public.enforce_counteroffer_flag()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  enabled boolean := public.is_feature_enabled('counteroffer_enabled');
BEGIN
  IF enabled THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'counter_offer' THEN
      RAISE EXCEPTION 'La funzione controfferta è disattivata.'
        USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.proposed_tariff IS NOT NULL THEN
      RAISE EXCEPTION 'La funzione controfferta è disattivata: non è possibile proporre una tariffa alternativa.'
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE: block creating a NEW counteroffer from a non-counteroffer row.
  IF NEW.status = 'counter_offer'
     AND OLD.status IS DISTINCT FROM NEW.status THEN
    RAISE EXCEPTION 'La funzione controfferta è disattivata.'
      USING ERRCODE = 'check_violation';
  END IF;

  -- UPDATE: block proposing a NEW / different tariff. Clearing it (-> NULL)
  -- is always allowed so an existing counteroffer can be closed/resolved.
  IF NEW.proposed_tariff IS NOT NULL
     AND NEW.proposed_tariff IS DISTINCT FROM OLD.proposed_tariff THEN
    RAISE EXCEPTION 'La funzione controfferta è disattivata: non è possibile modificare la tariffa proposta.'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Transitions OUT of 'counter_offer' (accept / reject / cancel / expire)
  -- are intentionally allowed: a disabled flag must never trap existing rows.
  RETURN NEW;
END;
$function$;

-- 2) Atomic + idempotent assignment of a worker to a shift.
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
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_authenticated');
  END IF;

  SELECT * INTO app FROM public.applications WHERE id = _application_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_found');
  END IF;
  IF app.restaurant_id <> uid THEN
    RETURN jsonb_build_object('ok', false, 'code', 'forbidden');
  END IF;

  -- Idempotency: already assigned -> report completed state, charge nothing.
  IF app.status = 'accepted' THEN
    RETURN jsonb_build_object('ok', true, 'code', 'already_assigned', 'idempotent', true);
  END IF;

  IF app.status NOT IN ('pending', 'interested', 'counter_offer') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_available');
  END IF;

  IF app.announcement_id IS NOT NULL THEN
    SELECT * INTO ann FROM public.announcements WHERE id = app.announcement_id FOR UPDATE;
    IF FOUND AND ann.status IN ('cancelled', 'completed') THEN
      RETURN jsonb_build_object('ok', false, 'code', 'not_available');
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

  -- Everything below is one atomic unit: on any failure the sub-transaction
  -- is rolled back, so credits are never consumed without an assignment.
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
      'code', CASE WHEN err ILIKE '%announcement_full%' THEN 'announcement_full' ELSE 'assignment_failed' END,
      'detail', err
    );
  END;

  RETURN jsonb_build_object('ok', true, 'code', 'assigned', 'application_id', app.id);
END;
$function$;

REVOKE ALL ON FUNCTION public.accept_application_atomic(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_application_atomic(uuid) TO authenticated;