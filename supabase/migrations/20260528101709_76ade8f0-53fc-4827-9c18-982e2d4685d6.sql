
ALTER VIEW public.announcements_public SET (security_invoker = true);
ALTER VIEW public.job_requests_public SET (security_invoker = true);

CREATE OR REPLACE FUNCTION public.is_confirmed_delay(_status text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $function$
  SELECT COALESCE(_status, 'pending') IN ('pending', 'verified');
$function$;
