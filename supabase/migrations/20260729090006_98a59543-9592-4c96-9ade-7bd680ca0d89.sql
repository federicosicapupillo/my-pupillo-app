-- 1) Feature flag (idempotente)
INSERT INTO public.feature_flags (key, enabled, scope, description)
VALUES (
  'worker_special_availability_enabled',
  false,
  'global',
  'Disponibilità speciali lavoratori — mostra o nasconde la gestione delle disponibilità speciali per gli utenti con ruolo lavoratore.'
)
ON CONFLICT (key) DO NOTHING;

-- 2) Protezione server-side delle scritture su worker_availability_exceptions
DROP POLICY IF EXISTS "Workers insert own exceptions" ON public.worker_availability_exceptions;
CREATE POLICY "Workers insert own exceptions"
ON public.worker_availability_exceptions
FOR INSERT
TO authenticated
WITH CHECK (
  worker_id = auth.uid()
  AND public.has_role(auth.uid(), 'worker'::app_role)
  AND public.is_feature_enabled('worker_special_availability_enabled')
);

DROP POLICY IF EXISTS "Workers update own exceptions" ON public.worker_availability_exceptions;
CREATE POLICY "Workers update own exceptions"
ON public.worker_availability_exceptions
FOR UPDATE
TO authenticated
USING (
  (worker_id = auth.uid() AND public.is_feature_enabled('worker_special_availability_enabled'))
  OR public.has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  (worker_id = auth.uid() AND public.is_feature_enabled('worker_special_availability_enabled'))
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

DROP POLICY IF EXISTS "Workers delete own exceptions" ON public.worker_availability_exceptions;
CREATE POLICY "Workers delete own exceptions"
ON public.worker_availability_exceptions
FOR DELETE
TO authenticated
USING (
  (worker_id = auth.uid() AND public.is_feature_enabled('worker_special_availability_enabled'))
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

-- 3) Ricerca lavoratori / mappa: nessuna disponibilità speciale quando il flag è spento
CREATE OR REPLACE FUNCTION public.search_worker_availability_exceptions_public(_worker_ids uuid[], _from_date date)
RETURNS TABLE(id uuid, worker_id uuid, date date, is_available boolean, time_slot text, start_time time without time zone, end_time time without time zone, city text, province text, district text, latitude double precision, longitude double precision, radius_km integer)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    AND public.is_feature_enabled('worker_special_availability_enabled')
    AND we.worker_id = ANY(_worker_ids)
    AND (_from_date IS NULL OR we.date >= _from_date);
$function$;