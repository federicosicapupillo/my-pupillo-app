-- Restrict cross-user reads on worker_availability tables.
-- Rationale: previous policies used USING (true) which exposed notes,
-- precise lat/lng, and other fields to any authenticated user. We keep
-- the marketplace search working via SECURITY DEFINER RPCs that return
-- a sanitized projection (no notes, rounded coordinates ~1.1km precision).

-- 1) Replace SELECT policies with owner + admin only
DROP POLICY IF EXISTS "Availability readable by authenticated" ON public.worker_availability;
DROP POLICY IF EXISTS "Exceptions readable by authenticated" ON public.worker_availability_exceptions;

CREATE POLICY "Workers read own availability"
  ON public.worker_availability
  FOR SELECT
  TO authenticated
  USING (worker_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Workers read own exceptions"
  ON public.worker_availability_exceptions
  FOR SELECT
  TO authenticated
  USING (worker_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

-- 2) Sanitized search RPCs for the marketplace
--    - Excludes free-form notes field
--    - Rounds latitude/longitude to 2 decimals (~1.1km) so precise home
--      coordinates are not leaked, while keeping the map/zone filter usable.

CREATE OR REPLACE FUNCTION public.search_worker_availability_public(_worker_ids uuid[])
RETURNS TABLE(
  id uuid,
  worker_id uuid,
  day_of_week smallint,
  time_slot text,
  start_time time without time zone,
  end_time time without time zone,
  is_flexible boolean,
  is_last_minute boolean,
  city text,
  province text,
  district text,
  latitude double precision,
  longitude double precision,
  radius_km integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    wa.id,
    wa.worker_id,
    wa.day_of_week,
    wa.time_slot,
    wa.start_time,
    wa.end_time,
    wa.is_flexible,
    wa.is_last_minute,
    wa.city,
    wa.province,
    wa.district,
    round(wa.latitude::numeric, 2)::double precision AS latitude,
    round(wa.longitude::numeric, 2)::double precision AS longitude,
    wa.radius_km
  FROM public.worker_availability wa
  WHERE auth.uid() IS NOT NULL
    AND wa.worker_id = ANY(_worker_ids);
$$;

CREATE OR REPLACE FUNCTION public.search_worker_availability_exceptions_public(_worker_ids uuid[], _from_date date)
RETURNS TABLE(
  id uuid,
  worker_id uuid,
  date date,
  is_available boolean,
  time_slot text,
  start_time time without time zone,
  end_time time without time zone,
  city text,
  province text,
  district text,
  latitude double precision,
  longitude double precision,
  radius_km integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    we.id,
    we.worker_id,
    we.date,
    we.is_available,
    we.time_slot,
    we.start_time,
    we.end_time,
    we.city,
    we.province,
    we.district,
    round(we.latitude::numeric, 2)::double precision AS latitude,
    round(we.longitude::numeric, 2)::double precision AS longitude,
    we.radius_km
  FROM public.worker_availability_exceptions we
  WHERE auth.uid() IS NOT NULL
    AND we.worker_id = ANY(_worker_ids)
    AND (_from_date IS NULL OR we.date >= _from_date);
$$;

REVOKE ALL ON FUNCTION public.search_worker_availability_public(uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.search_worker_availability_exceptions_public(uuid[], date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_worker_availability_public(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_worker_availability_exceptions_public(uuid[], date) TO authenticated;