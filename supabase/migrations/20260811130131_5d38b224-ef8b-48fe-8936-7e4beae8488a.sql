-- Solo gli incarichi CONFERMATI occupano il calendario del lavoratore.
-- Le candidature pending/interested/counter_offer non generano più conflitto.
CREATE OR REPLACE FUNCTION public.application_status_is_assigned(_s application_status)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $function$
  SELECT _s = 'accepted'::public.application_status;
$function$;

CREATE OR REPLACE FUNCTION public.worker_shift_buffer_conflict(
  _worker_id uuid,
  _start timestamp with time zone,
  _end timestamp with time zone,
  _exclude_application_id uuid DEFAULT NULL::uuid,
  _exclude_shift_id uuid DEFAULT NULL::uuid,
  _exclude_announcement_id uuid DEFAULT NULL::uuid
)
RETURNS TABLE(source text, application_id uuid, shift_id uuid, announcement_id uuid, start_at timestamp with time zone, end_at timestamp with time zone)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
      AND public.application_status_is_assigned(ap.status)
      AND (_exclude_application_id IS NULL OR ap.id <> _exclude_application_id)
      AND (_exclude_announcement_id IS NULL OR a.id <> _exclude_announcement_id)
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
      AND (_exclude_announcement_id IS NULL OR a.id <> _exclude_announcement_id)
      AND a.status <> 'cancelled'::public.announcement_status
  )
  SELECT busy.source, busy.application_id, busy.shift_id, busy.announcement_id, busy.start_at, busy.end_at
  FROM busy, candidate, buf
  WHERE busy.start_at IS NOT NULL AND busy.end_at IS NOT NULL
    AND tstzrange(busy.start_at, busy.end_at + buf.b, '[)') && candidate.r
  ORDER BY busy.start_at
  LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.assert_no_worker_shift_conflict(
  _worker_id uuid,
  _announcement_id uuid,
  _exclude_shift_id uuid DEFAULT NULL::uuid,
  _exclude_application_id uuid DEFAULT NULL::uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  r tstzrange;
  c record;
BEGIN
  IF _worker_id IS NULL OR _announcement_id IS NULL THEN RETURN; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(_worker_id::text, 42));
  r := public.announcement_shift_bounds(_announcement_id);
  IF r IS NULL THEN RETURN; END IF;
  SELECT * INTO c FROM public.worker_shift_buffer_conflict(
    _worker_id, lower(r), upper(r), _exclude_application_id, _exclude_shift_id, _announcement_id);
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
$function$;