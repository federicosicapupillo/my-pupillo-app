-- 1) Canonical active/closed application statuses
CREATE OR REPLACE FUNCTION public.application_status_is_active(_s public.application_status)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT _s IN (
    'pending'::public.application_status,
    'interested'::public.application_status,
    'counter_offer'::public.application_status,
    'accepted'::public.application_status
  );
$$;

-- 2) Minimum buffer between two shifts of the same worker
CREATE OR REPLACE FUNCTION public.shift_buffer_minutes()
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$ SELECT 60; $$;

-- 3) Announcement bounds with strict end validation
CREATE OR REPLACE FUNCTION public.announcement_shift_bounds(_ann uuid)
RETURNS tstzrange
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  a record;
  r tstzrange;
BEGIN
  SELECT id, end_time, shift_duration_hours, duration_hours, shift_start_at
    INTO a FROM public.announcements WHERE id = _ann;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF a.shift_start_at IS NULL THEN RETURN NULL; END IF;
  IF a.end_time IS NULL AND COALESCE(a.shift_duration_hours, a.duration_hours) IS NULL THEN
    RAISE EXCEPTION 'SHIFT_END_TIME_MISSING' USING ERRCODE = 'P0001';
  END IF;
  r := public.announcement_shift_interval(_ann);
  RETURN r;
END;
$$;

-- 4) Buffer conflict lookup (symmetric, inclusive 60 minutes)
CREATE OR REPLACE FUNCTION public.worker_shift_buffer_conflict(
  _worker_id uuid,
  _start timestamptz,
  _end timestamptz,
  _exclude_application_id uuid DEFAULT NULL,
  _exclude_shift_id uuid DEFAULT NULL
)
RETURNS TABLE(source text, application_id uuid, shift_id uuid, announcement_id uuid, start_at timestamptz, end_at timestamptz)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH buf AS (SELECT (public.shift_buffer_minutes() || ' minutes')::interval AS b),
  candidate AS (
    SELECT tstzrange(_start, GREATEST(_end, _start + interval '1 minute') + (SELECT b FROM buf), '[)') AS r
  ),
  busy AS (
    SELECT 'application'::text AS source, ap.id AS application_id, NULL::uuid AS shift_id,
           a.id AS announcement_id,
           lower(public.announcement_shift_interval(a.id)) AS start_at,
           upper(public.announcement_shift_interval(a.id)) AS end_at
    FROM public.applications ap
    JOIN public.announcements a ON a.id = ap.announcement_id
    WHERE ap.worker_id = _worker_id
      AND public.application_status_is_active(ap.status)
      AND (_exclude_application_id IS NULL OR ap.id <> _exclude_application_id)
      AND a.status <> 'cancelled'::public.announcement_status
    UNION ALL
    SELECT 'shift'::text, NULL::uuid, s.id, a.id,
           lower(public.announcement_shift_interval(a.id)),
           upper(public.announcement_shift_interval(a.id))
    FROM public.shifts s
    JOIN public.announcements a ON a.id = s.announcement_id
    WHERE s.worker_id = _worker_id
      AND s.status = 'scheduled'::public.shift_status
      AND (_exclude_shift_id IS NULL OR s.id <> _exclude_shift_id)
      AND a.status <> 'cancelled'::public.announcement_status
  )
  SELECT busy.source, busy.application_id, busy.shift_id, busy.announcement_id, busy.start_at, busy.end_at
  FROM busy, candidate, buf
  WHERE busy.start_at IS NOT NULL AND busy.end_at IS NOT NULL
    AND tstzrange(busy.start_at, busy.end_at + buf.b, '[)') && candidate.r
  ORDER BY busy.start_at
  LIMIT 1;
$$;

-- 5) Authoritative assertion used by all write paths
DROP FUNCTION IF EXISTS public.assert_no_worker_shift_conflict(uuid, uuid, uuid);

CREATE OR REPLACE FUNCTION public.assert_no_worker_shift_conflict(
  _worker_id uuid,
  _announcement_id uuid,
  _exclude_shift_id uuid DEFAULT NULL,
  _exclude_application_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r tstzrange;
  c record;
BEGIN
  IF _worker_id IS NULL OR _announcement_id IS NULL THEN RETURN; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(_worker_id::text, 42));
  r := public.announcement_shift_bounds(_announcement_id);
  IF r IS NULL THEN RETURN; END IF;
  SELECT * INTO c FROM public.worker_shift_buffer_conflict(
    _worker_id, lower(r), upper(r), _exclude_application_id, _exclude_shift_id);
  IF FOUND THEN
    RAISE EXCEPTION 'SHIFT_APPLICATION_BUFFER_CONFLICT'
      USING ERRCODE = 'P0001',
        DETAIL = json_build_object(
          'code', 'SHIFT_APPLICATION_BUFFER_CONFLICT',
          'minimumBufferMinutes', public.shift_buffer_minutes(),
          'conflictingShiftId', COALESCE(c.shift_id, c.application_id),
          'conflictingShiftStartAt', c.start_at,
          'conflictingShiftEndAt', c.end_at
        )::text;
  END IF;
END;
$$;

-- 6) Applications trigger: exclude the row itself on UPDATE
CREATE OR REPLACE FUNCTION public.enforce_application_shift_conflict()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF public.application_status_is_active(NEW.status) THEN
      PERFORM public.assert_no_worker_shift_conflict(NEW.worker_id, NEW.announcement_id, NULL, NEW.id);
    END IF;
  ELSIF NEW.status IS DISTINCT FROM OLD.status
        AND public.application_status_is_active(NEW.status) THEN
    PERFORM public.assert_no_worker_shift_conflict(NEW.worker_id, NEW.announcement_id, NULL, NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

-- 7) Shifts trigger: ignore the application that generated the shift
CREATE OR REPLACE FUNCTION public.enforce_shift_conflict()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _app_id uuid;
BEGIN
  IF NEW.status <> 'scheduled'::public.shift_status THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE'
     AND NEW.worker_id IS NOT DISTINCT FROM OLD.worker_id
     AND NEW.announcement_id IS NOT DISTINCT FROM OLD.announcement_id
     AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;
  SELECT ap.id INTO _app_id FROM public.applications ap
   WHERE ap.worker_id = NEW.worker_id AND ap.announcement_id = NEW.announcement_id
   ORDER BY ap.created_at DESC LIMIT 1;
  PERFORM public.assert_no_worker_shift_conflict(NEW.worker_id, NEW.announcement_id, NEW.id, _app_id);
  RETURN NEW;
END;
$$;

-- 8) Proposal acceptance: ignore the application being accepted
CREATE OR REPLACE FUNCTION public.enforce_proposal_response_shift_conflict()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  app record;
BEGIN
  IF NEW.status <> 'accepted' THEN RETURN NEW; END IF;
  SELECT id, worker_id, announcement_id INTO app
  FROM public.applications WHERE id = NEW.application_id;
  IF FOUND THEN
    PERFORM public.assert_no_worker_shift_conflict(app.worker_id, app.announcement_id, NULL, app.id);
  END IF;
  RETURN NEW;
END;
$$;

-- 9) Reschedule: also validate active applications, not only scheduled shifts
CREATE OR REPLACE FUNCTION public.enforce_announcement_reschedule_conflict()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r record;
BEGIN
  IF NEW.service_date IS NOT DISTINCT FROM OLD.service_date
     AND NEW.service_time IS NOT DISTINCT FROM OLD.service_time
     AND NEW.end_date IS NOT DISTINCT FROM OLD.end_date
     AND NEW.end_time IS NOT DISTINCT FROM OLD.end_time
     AND NEW.duration_hours IS NOT DISTINCT FROM OLD.duration_hours
     AND NEW.shift_duration_hours IS NOT DISTINCT FROM OLD.shift_duration_hours THEN
    RETURN NEW;
  END IF;
  FOR r IN
    SELECT s.id AS shift_id, NULL::uuid AS app_id, s.worker_id FROM public.shifts s
    WHERE s.announcement_id = NEW.id AND s.status = 'scheduled'::public.shift_status
    UNION ALL
    SELECT NULL::uuid, ap.id, ap.worker_id FROM public.applications ap
    WHERE ap.announcement_id = NEW.id AND public.application_status_is_active(ap.status)
  LOOP
    PERFORM public.assert_no_worker_shift_conflict(r.worker_id, NEW.id, r.shift_id, r.app_id);
  END LOOP;
  RETURN NEW;
END;
$$;

-- 10) RLS pre-check for application inserts uses the same buffer rule
CREATE OR REPLACE FUNCTION public.worker_conflicts_with_announcement(
  _worker_id uuid, _announcement_id uuid, _exclude_shift_id uuid DEFAULT NULL::uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r tstzrange;
BEGIN
  IF _worker_id IS NULL OR _announcement_id IS NULL THEN RETURN false; END IF;
  r := public.announcement_shift_interval(_announcement_id);
  IF r IS NULL THEN RETURN false; END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.worker_shift_buffer_conflict(
      _worker_id, lower(r), upper(r), NULL, _exclude_shift_id)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.application_status_is_active(public.application_status) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.shift_buffer_minutes() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.announcement_shift_bounds(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.worker_shift_buffer_conflict(uuid, timestamptz, timestamptz, uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.assert_no_worker_shift_conflict(uuid, uuid, uuid, uuid) TO authenticated, service_role;