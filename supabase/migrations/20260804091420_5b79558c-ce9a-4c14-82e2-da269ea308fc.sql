-- 1) Timestamp affidabile di inizio turno (wall time Europe/Rome -> timestamptz)
ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS shift_start_at timestamptz
  GENERATED ALWAYS AS ((service_date + COALESCE(service_time, '00:00'::time)) AT TIME ZONE 'Europe/Rome') STORED;

-- 2) Regola unica lato DB: un annuncio è "aperto" (candidabile/accettabile)
CREATE OR REPLACE FUNCTION public.announcement_is_open(_announcement_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.announcements a
    WHERE a.id = _announcement_id
      AND a.status IN ('active', 'draft', 'assigned')
      AND a.shift_start_at > now()
      AND (a.expires_at IS NULL OR a.expires_at > now())
  );
$$;

REVOKE ALL ON FUNCTION public.announcement_is_open(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.announcement_is_open(uuid) TO authenticated, service_role;

-- 3) BONIFICA (prima di attivare i blocchi)
-- Il controllo "area di lancio" non deve bloccare la bonifica di righe storiche.
ALTER TABLE public.announcements DISABLE TRIGGER trg_enforce_launch_area_announcement;

UPDATE public.announcements
   SET status = 'expired'
 WHERE status IN ('active', 'draft')
   AND shift_start_at <= now();

ALTER TABLE public.announcements ENABLE TRIGGER trg_enforce_launch_area_announcement;

UPDATE public.applications a
   SET status = 'expired'
  FROM public.announcements an
 WHERE an.id = a.announcement_id
   AND a.status IN ('pending', 'interested', 'counter_offer')
   AND an.shift_start_at <= now()
   AND NOT EXISTS (
     SELECT 1 FROM public.shifts s
      WHERE s.announcement_id = a.announcement_id
        AND s.worker_id = a.worker_id
        AND s.status <> 'cancelled'
   );

-- 4) Blocco candidature su turni scaduti
CREATE OR REPLACE FUNCTION public.enforce_application_not_expired()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.announcement_id IS NOT NULL AND NOT public.announcement_is_open(NEW.announcement_id) THEN
    RAISE EXCEPTION 'ANNOUNCEMENT_EXPIRED' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_00_enforce_application_not_expired ON public.applications;
CREATE TRIGGER trg_00_enforce_application_not_expired
  BEFORE INSERT ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.enforce_application_not_expired();

-- 5) Blocco accettazione/avanzamento di offerte scadute
CREATE OR REPLACE FUNCTION public.enforce_offer_not_expired_on_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status IN ('interested', 'accepted', 'counter_offer')
     AND NEW.announcement_id IS NOT NULL
     AND NOT public.announcement_is_open(NEW.announcement_id) THEN
    RAISE EXCEPTION 'OFFER_EXPIRED' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_00_enforce_offer_not_expired ON public.applications;
CREATE TRIGGER trg_00_enforce_offer_not_expired
  BEFORE UPDATE ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.enforce_offer_not_expired_on_update();

-- 6) Blocco risposta "accettata" a una proposta il cui turno è già iniziato
CREATE OR REPLACE FUNCTION public.enforce_proposal_response_not_expired()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ann_id uuid;
BEGIN
  IF NEW.status <> 'accepted' THEN
    RETURN NEW;
  END IF;
  SELECT a.announcement_id INTO ann_id FROM public.applications a WHERE a.id = NEW.application_id;
  IF ann_id IS NOT NULL AND NOT public.announcement_is_open(ann_id) THEN
    RAISE EXCEPTION 'OFFER_EXPIRED' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_00_enforce_proposal_response_not_expired ON public.proposal_responses;
CREATE TRIGGER trg_00_enforce_proposal_response_not_expired
  BEFORE INSERT ON public.proposal_responses
  FOR EACH ROW EXECUTE FUNCTION public.enforce_proposal_response_not_expired();

-- 7) Vista pubblica: espone shift_start_at e nasconde gli annunci scaduti
CREATE OR REPLACE VIEW public.announcements_public AS
  SELECT id, restaurant_id, service_date, service_time, end_time, end_date,
         duration_hours, speed, tariff_type, tariff_amount, location_address,
         location_lat, location_lng, professional_profile, languages, deposit_paid,
         status, expires_at, assigned_worker_id, created_at, notes,
         license_requirement, language_requirements, tattoos_allowed, piercings_allowed,
         beard_allowed, required_skills, dress_code_items, dress_code_notes,
         job_city, job_province, job_postal_code, job_country, seed_batch_id, is_demo,
         reused_from_announcement_id, long_shift_reason, is_long_shift,
         shift_duration_hours, job_location_notes,
         shift_start_at
    FROM announcements
   WHERE is_in_launch_area(job_city, job_province)
     AND shift_start_at > now();

-- 8) Accettazione atomica: rifiuta le offerte scadute prima di scalare crediti
CREATE OR REPLACE FUNCTION public.accept_application_atomic(_application_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

    -- Scadenza: turno gia' iniziato o annuncio non piu' aperto.
    IF NOT public.announcement_is_open(app.announcement_id) THEN
      RETURN jsonb_build_object('ok', false, 'code', 'offer_expired');
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
        WHEN err ILIKE '%OFFER_EXPIRED%' OR err ILIKE '%ANNOUNCEMENT_EXPIRED%' THEN 'offer_expired'
        WHEN err ILIKE '%announcement_full%' THEN 'announcement_full'
        ELSE 'assignment_failed' END,
      'detail', err
    );
  END;

  RETURN jsonb_build_object('ok', true, 'code', 'assigned', 'application_id', app.id);
END;
$$;

REVOKE ALL ON FUNCTION public.accept_application_atomic(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_application_atomic(uuid) TO authenticated, service_role;