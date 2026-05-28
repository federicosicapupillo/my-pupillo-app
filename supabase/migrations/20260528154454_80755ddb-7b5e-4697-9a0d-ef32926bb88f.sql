
-- Block applications and proposal acceptances for workers with incomplete profiles

CREATE OR REPLACE FUNCTION public.can_worker_insert_application(_announcement_id uuid, _worker_id uuid, _restaurant_id uuid, _status application_status)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- Block candidatura if worker profile is not 100% completed
  select coalesce(profile_completed, false) into _profile_completed
    from public.profiles where id = _worker_id;
  if not _profile_completed then
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

  return _accepted_count < _workers_needed;
end;
$function$;

-- Update proposal_responses INSERT policy: worker must have completed profile to ACCEPT
DROP POLICY IF EXISTS "Worker records own proposal response" ON public.proposal_responses;
CREATE POLICY "Worker records own proposal response"
ON public.proposal_responses
FOR INSERT
TO authenticated
WITH CHECK (
  (responder_id = auth.uid())
  AND (
    EXISTS (
      SELECT 1
      FROM applications a
      JOIN messages m ON m.id = proposal_responses.message_id
      WHERE a.id = proposal_responses.application_id
        AND m.application_id = a.id
        AND a.worker_id = auth.uid()
    )
  )
  AND (
    status <> 'accepted'
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND coalesce(p.profile_completed, false) = true
    )
  )
);
