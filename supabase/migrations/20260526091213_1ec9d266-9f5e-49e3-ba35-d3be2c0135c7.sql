create or replace function public.get_application_availability(_announcement_id uuid)
returns table (
  workers_needed integer,
  accepted_count integer,
  is_full boolean,
  restaurant_id uuid
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _workers_needed integer := 1;
  _accepted_count integer := 0;
  _restaurant_id uuid;
begin
  if auth.uid() is null then
    return;
  end if;

  select a.restaurant_id
    into _restaurant_id
  from public.announcements a
  where a.id = _announcement_id
    and a.status in ('active'::public.announcement_status, 'assigned'::public.announcement_status);

  if _restaurant_id is null then
    return;
  end if;

  select greatest(1, coalesce(max(j.workers_needed), 1))
    into _workers_needed
  from public.job_requests j
  where j.announcement_id = _announcement_id;

  select count(*)
    into _accepted_count
  from public.applications existing
  where existing.announcement_id = _announcement_id
    and existing.status = 'accepted'::public.application_status;

  workers_needed := _workers_needed;
  accepted_count := _accepted_count;
  is_full := _accepted_count >= _workers_needed;
  restaurant_id := _restaurant_id;
  return next;
end;
$$;

revoke execute on function public.get_application_availability(uuid) from public;
revoke execute on function public.get_application_availability(uuid) from anon;
grant execute on function public.get_application_availability(uuid) to authenticated;
