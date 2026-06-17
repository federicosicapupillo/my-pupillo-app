
ALTER VIEW public.announcements_public SET (security_invoker = on);
ALTER VIEW public.job_requests_public SET (security_invoker = on);

CREATE OR REPLACE FUNCTION public.can_update_application(_announcement_id uuid, _worker_id uuid, _restaurant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  select auth.uid() = _worker_id
      or public.has_role(auth.uid(), 'admin'::public.app_role)
      or (
        auth.uid() = _restaurant_id
        and exists (
          select 1
          from public.announcements a
          where a.id = _announcement_id
            and a.restaurant_id = _restaurant_id
        )
      )
$function$;
