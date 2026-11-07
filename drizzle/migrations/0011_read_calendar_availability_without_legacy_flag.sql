CREATE OR REPLACE FUNCTION public.search_worker_availability_exceptions_public(_worker_ids uuid[], _from_date date)
RETURNS TABLE(id uuid, worker_id uuid, date date, is_available boolean, time_slot text, start_time time without time zone, end_time time without time zone, city text, province text, district text, latitude double precision, longitude double precision, radius_km integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
 SELECT we.id,we.worker_id,we.date,we.is_available,we.time_slot,we.start_time,we.end_time,we.city,we.province,we.district,round(we.latitude::numeric,2)::double precision,round(we.longitude::numeric,2)::double precision,we.radius_km
 FROM public.worker_availability_exceptions we
 JOIN public.profiles p ON p.id=we.worker_id
 WHERE auth.uid() IS NOT NULL AND we.worker_id=ANY(_worker_ids)
 AND (_from_date IS NULL OR we.date>=_from_date)
 AND p.profile_completed AND NOT p.is_deleted AND NOT p.is_demo AND NOT p.moderation_hidden
 AND public.has_role(we.worker_id,'worker');
$function$;
COMMENT ON FUNCTION public.search_worker_availability_exceptions_public(uuid[],date) IS 'Sanitized read of ordinary calendar date overrides. Independent of the legacy special-availability feature flag; excludes private notes and rounds coordinates.';