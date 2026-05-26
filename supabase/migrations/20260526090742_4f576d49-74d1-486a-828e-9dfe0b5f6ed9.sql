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

  if _status not in ('pending'::public.application_status, 'counter_offer'::public.application_status) then
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
      and a.status = 'active'::public.announcement_status
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

create or replace function public.can_read_application(_announcement_id uuid, _worker_id uuid, _restaurant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() = _worker_id
      or auth.uid() = _restaurant_id
      or public.has_role(auth.uid(), 'admin'::public.app_role)
      or exists (
        select 1
        from public.announcements a
        where a.id = _announcement_id
          and a.restaurant_id = auth.uid()
      )
$$;

create or replace function public.can_update_application(_announcement_id uuid, _worker_id uuid, _restaurant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() = _worker_id
      or auth.uid() = _restaurant_id
      or public.has_role(auth.uid(), 'admin'::public.app_role)
      or exists (
        select 1
        from public.announcements a
        where a.id = _announcement_id
          and a.restaurant_id = auth.uid()
      )
$$;

drop policy if exists "Workers create own applications" on public.applications;
drop policy if exists "Workers can insert their own applications" on public.applications;
drop policy if exists "Workers can insert own applications by auth id" on public.applications;

create policy "Workers can insert own available applications"
on public.applications
for insert
to authenticated
with check (
  public.can_worker_insert_application(announcement_id, worker_id, restaurant_id, status)
);

drop policy if exists "Applications viewable by parties" on public.applications;
drop policy if exists "Workers can read own applications" on public.applications;
drop policy if exists "Restaurants can read applications for their jobs" on public.applications;

create policy "Applications readable by involved parties"
on public.applications
for select
to authenticated
using (
  public.can_read_application(announcement_id, worker_id, restaurant_id)
);

drop policy if exists "Parties update applications" on public.applications;

create policy "Applications updateable by involved parties"
on public.applications
for update
to authenticated
using (
  public.can_update_application(announcement_id, worker_id, restaurant_id)
);
