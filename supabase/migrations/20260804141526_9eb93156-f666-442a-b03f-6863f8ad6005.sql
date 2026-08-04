-- =====================================================================
-- REGOLA CENTRALIZZATA: luogo di lavoro nell'area operativa Pupillo
-- =====================================================================
-- Unica sorgente di verita' server-side. Non si basa su stringhe fragili:
-- usa il comune strutturato + provincia (public.is_in_launch_area, che
-- normalizza e confronta con launch_area_comuni/launch_areas) e le
-- coordinate SOLO come controllo aggiuntivo.

CREATE OR REPLACE FUNCTION public.location_is_in_operational_area(
  _city text,
  _province text,
  _lat double precision DEFAULT NULL,
  _lng double precision DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.is_in_launch_area(_city, _province)
     AND public.are_coords_in_launch_area(_lat, _lng);
$$;

COMMENT ON FUNCTION public.location_is_in_operational_area(text, text, double precision, double precision)
  IS 'Regola unica: il luogo di lavoro appartiene all''area operativa attiva (comune + provincia strutturati, coordinate come controllo aggiuntivo).';

CREATE OR REPLACE FUNCTION public.announcement_is_in_operational_area(_announcement_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE((
    SELECT public.location_is_in_operational_area(
             a.job_city,
             a.job_province,
             COALESCE(a.job_latitude, a.location_lat),
             COALESCE(a.job_longitude, a.location_lng))
    FROM public.announcements a
    WHERE a.id = _announcement_id
  ), true);  -- annuncio inesistente: non e' questo controllo a doverlo bloccare
$$;

COMMENT ON FUNCTION public.announcement_is_in_operational_area(uuid)
  IS 'True se il LUOGO DEL TURNO dell''annuncio rientra nell''area operativa attiva. Usata da candidature, proposte, accettazioni e vista pubblica.';

GRANT EXECUTE ON FUNCTION public.location_is_in_operational_area(text, text, double precision, double precision) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.announcement_is_in_operational_area(uuid) TO authenticated, anon, service_role;

-- =====================================================================
-- 1) CANDIDATURE — insert bloccato lato DB (trigger + RLS helper)
-- =====================================================================

CREATE OR REPLACE FUNCTION public.enforce_application_not_expired()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.announcement_id IS NOT NULL THEN
    -- Area operativa: errore applicativo dedicato e distinguibile.
    IF NOT public.announcement_is_in_operational_area(NEW.announcement_id) THEN
      RAISE EXCEPTION 'ANNOUNCEMENT_OUTSIDE_OPERATIONAL_AREA' USING ERRCODE = 'P0001';
    END IF;
    -- Stato active + turno non iniziato + offerta non scaduta.
    IF NOT public.announcement_is_applicable(NEW.announcement_id) THEN
      RAISE EXCEPTION 'ANNOUNCEMENT_EXPIRED' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- RLS: nessun INSERT possibile via REST diretta su annuncio fuori area.
CREATE OR REPLACE FUNCTION public.can_worker_insert_application(
  _announcement_id uuid,
  _worker_id uuid,
  _restaurant_id uuid,
  _status public.application_status
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
  _workers_needed integer := 1;
  _accepted_count integer := 0;
  _profile_completed boolean := false;
begin
  if auth.uid() is null or _worker_id <> auth.uid() then
    return false;
  end if;

  if not public.has_role(auth.uid(), 'worker'::public.app_role) then
    return false;
  end if;

  if _status <> 'pending'::public.application_status then
    return false;
  end if;

  select coalesce(profile_completed, false) into _profile_completed
    from public.profiles where id = _worker_id;
  if not _profile_completed then
    return false;
  end if;

  -- Area operativa (regola centralizzata).
  if _announcement_id is not null
     and not public.announcement_is_in_operational_area(_announcement_id) then
    return false;
  end if;

  -- Turno non iniziato / offerta non scaduta / annuncio active.
  if _announcement_id is not null
     and not public.announcement_is_applicable(_announcement_id) then
    return false;
  end if;

  select greatest(1, coalesce(max(j.workers_needed), 1))
    into _workers_needed
  from public.job_requests j
  where j.announcement_id = _announcement_id;

  if not exists (
    select 1
    from public.announcements a
    where a.id = _announcement_id
      and a.restaurant_id = _restaurant_id
      and a.status in ('active'::public.announcement_status, 'assigned'::public.announcement_status)
  ) then
    return false;
  end if;

  select count(*)
    into _accepted_count
  from public.applications existing
  where existing.announcement_id = _announcement_id
    and existing.status = 'accepted'::public.application_status;

  -- Nessuna candidatura duplicata sullo stesso annuncio.
  if exists (
    select 1 from public.applications d
    where d.announcement_id = _announcement_id
      and d.worker_id = _worker_id
      and d.status not in ('cancelled'::public.application_status,
                           'rejected'::public.application_status,
                           'expired'::public.application_status)
  ) then
    return false;
  end if;

  return _accepted_count < _workers_needed;
end;
$$;

-- =====================================================================
-- 2) PROPOSTE / ACCETTAZIONI — nuove transizioni bloccate fuori area
-- =====================================================================
-- Legacy: gli annunci gia' 'assigned' non vengono toccati; qui si bloccano
-- SOLO le nuove transizioni verso interested/counter_offer/accepted.

CREATE OR REPLACE FUNCTION public.enforce_offer_not_expired_on_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status IN ('interested', 'accepted', 'counter_offer')
     AND NEW.announcement_id IS NOT NULL THEN
    IF NOT public.announcement_is_in_operational_area(NEW.announcement_id) THEN
      RAISE EXCEPTION 'ANNOUNCEMENT_OUTSIDE_OPERATIONAL_AREA' USING ERRCODE = 'P0001';
    END IF;
    IF NOT public.announcement_offer_acceptable(NEW.announcement_id) THEN
      RAISE EXCEPTION 'OFFER_EXPIRED' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_proposal_response_not_expired()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _ann uuid;
BEGIN
  SELECT a.announcement_id INTO _ann
  FROM public.applications a
  WHERE a.id = NEW.application_id;

  IF _ann IS NOT NULL THEN
    IF NOT public.announcement_is_in_operational_area(_ann) THEN
      RAISE EXCEPTION 'ANNOUNCEMENT_OUTSIDE_OPERATIONAL_AREA' USING ERRCODE = 'P0001';
    END IF;
    IF NOT public.announcement_offer_acceptable(_ann) THEN
      RAISE EXCEPTION 'OFFER_EXPIRED' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Accettazione atomica: codice errore dedicato, prima di consumare crediti.
CREATE OR REPLACE FUNCTION public.accept_application_atomic(_application_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
    IF FOUND AND ann.status IN ('cancelled', 'completed', 'draft') THEN
      RETURN jsonb_build_object('ok', false, 'code', 'not_available');
    END IF;

    -- Area operativa (regola centralizzata) PRIMA di qualunque addebito.
    IF NOT public.announcement_is_in_operational_area(app.announcement_id) THEN
      RETURN jsonb_build_object('ok', false, 'code', 'outside_operational_area');
    END IF;

    -- Scadenza: turno gia' iniziato o annuncio non piu' accettabile.
    IF NOT public.announcement_offer_acceptable(app.announcement_id) THEN
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
        WHEN err ILIKE '%OUTSIDE_OPERATIONAL_AREA%' THEN 'outside_operational_area'
        WHEN err ILIKE '%OFFER_EXPIRED%' OR err ILIKE '%ANNOUNCEMENT_EXPIRED%' THEN 'offer_expired'
        WHEN err ILIKE '%announcement_full%' THEN 'announcement_full'
        ELSE 'assignment_failed' END,
      'detail', err
    );
  END;

  RETURN jsonb_build_object('ok', true, 'code', 'assigned', 'application_id', app.id);
END;
$$;

-- =====================================================================
-- 3) CHIUSURA ANNUNCI LEGACY FUORI AREA
-- =====================================================================
-- Prima, cambiare stato a un annuncio legacy fuori area (anche solo per
-- scaderlo/annullarlo) veniva bloccato dal trigger territoriale. Ora la
-- validazione si applica solo a INSERT e a modifiche della localita' o a
-- riaperture (draft/active/assigned): chiudere resta sempre possibile.

CREATE OR REPLACE FUNCTION public.enforce_launch_area_announcement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _location_changed boolean;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    _location_changed :=
         NEW.job_city IS DISTINCT FROM OLD.job_city
      OR NEW.job_province IS DISTINCT FROM OLD.job_province
      OR NEW.job_latitude IS DISTINCT FROM OLD.job_latitude
      OR NEW.job_longitude IS DISTINCT FROM OLD.job_longitude
      OR NEW.location_lat IS DISTINCT FROM OLD.location_lat
      OR NEW.location_lng IS DISTINCT FROM OLD.location_lng;

    -- Localita' invariata: consenti sempre la CHIUSURA di record legacy
    -- (expired/cancelled/completed) e le modifiche non territoriali.
    IF NOT _location_changed THEN
      IF NEW.status IS NOT DISTINCT FROM OLD.status
         OR NEW.status IN ('expired', 'cancelled', 'completed') THEN
        RETURN NEW;
      END IF;
    END IF;
  END IF;

  IF NOT public.validate_launch_location(
        NEW.job_city, NEW.job_province,
        coalesce(NEW.job_latitude, NEW.location_lat),
        coalesce(NEW.job_longitude, NEW.location_lng))
     OR NOT public.are_coords_in_launch_area(NEW.location_lat, NEW.location_lng) THEN
    RAISE EXCEPTION 'Pupillo è attualmente disponibile esclusivamente a Bologna e nei comuni della Città metropolitana di Bologna.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

-- =====================================================================
-- 4) VISTA PUBBLICA — stessa regola centralizzata
-- =====================================================================

CREATE OR REPLACE VIEW public.announcements_public AS
  SELECT id, restaurant_id, service_date, service_time, end_time, end_date,
         duration_hours, speed, tariff_type, tariff_amount, location_address,
         location_lat, location_lng, professional_profile, languages,
         deposit_paid, status, expires_at, assigned_worker_id, created_at,
         notes, license_requirement, language_requirements, tattoos_allowed,
         piercings_allowed, beard_allowed, required_skills, dress_code_items,
         dress_code_notes, job_city, job_province, job_postal_code,
         job_country, seed_batch_id, is_demo, reused_from_announcement_id,
         long_shift_reason, is_long_shift, shift_duration_hours,
         job_location_notes, shift_start_at
  FROM public.announcements a
  WHERE public.location_is_in_operational_area(
          a.job_city, a.job_province,
          COALESCE(a.job_latitude, a.location_lat),
          COALESCE(a.job_longitude, a.location_lng))
    AND a.shift_start_at > now();
