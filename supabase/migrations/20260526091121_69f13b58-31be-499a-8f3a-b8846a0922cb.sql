create or replace function public.can_worker_insert_application(
  _announcement_id uuid,
  _worker_id uuid,
  _restaurant_id uuid,
  _status public.application_status
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _workers_needed integer := 1;
  _accepted_count integer := 0;
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
$$;

revoke execute on function public.can_worker_insert_application(uuid, uuid, uuid, public.application_status) from public;
revoke execute on function public.can_worker_insert_application(uuid, uuid, uuid, public.application_status) from anon;
grant execute on function public.can_worker_insert_application(uuid, uuid, uuid, public.application_status) to authenticated;
