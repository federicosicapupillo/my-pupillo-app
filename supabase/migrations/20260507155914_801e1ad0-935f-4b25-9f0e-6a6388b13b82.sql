create table if not exists public.job_requests (
  id uuid primary key default gen_random_uuid(),
  restaurant_profile_id uuid not null references public.profiles(id) on delete cascade,
  restaurant_id uuid not null,
  user_id uuid not null,
  announcement_id uuid,
  title text not null,
  role_required text not null,
  workers_needed integer not null default 1,
  description text,
  tasks text,
  shift_date date not null,
  start_time time without time zone not null,
  end_time time without time zone not null,
  hourly_rate numeric not null,
  break_included boolean not null default false,
  operational_notes text,
  status text not null default 'draft',
  restaurant_name text,
  address text not null,
  city text,
  district text,
  province text,
  postal_code text,
  country text default 'Italia',
  latitude double precision,
  longitude double precision,
  access_restrictions text,
  additional_directions text,
  contact_person_name text,
  contact_person_phone text,
  contact_person_email text,
  worker_notes text,
  license_requirement text,
  language_requirements text[] not null default '{}',
  tattoos_allowed text,
  piercings_allowed text,
  beard_allowed text,
  required_skills text[] not null default '{}',
  dress_code_items text[] not null default '{}',
  dress_code_notes text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint job_requests_status_check check (status in ('draft','published')),
  constraint job_requests_workers_needed_check check (workers_needed > 0),
  constraint job_requests_hourly_rate_check check (hourly_rate > 0)
);

alter table public.job_requests enable row level security;

create index if not exists idx_job_requests_restaurant_id on public.job_requests(restaurant_id);
create index if not exists idx_job_requests_user_id on public.job_requests(user_id);
create index if not exists idx_job_requests_status on public.job_requests(status);
create index if not exists idx_job_requests_shift_date on public.job_requests(shift_date);
create index if not exists idx_job_requests_announcement_id on public.job_requests(announcement_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_job_requests_updated_at on public.job_requests;
create trigger set_job_requests_updated_at
before update on public.job_requests
for each row
execute function public.set_updated_at();

drop policy if exists "Restaurants view own job requests" on public.job_requests;
create policy "Restaurants view own job requests"
on public.job_requests
for select
to authenticated
using ((auth.uid() = user_id) or (auth.uid() = restaurant_id) or public.has_role(auth.uid(), 'admin'));

drop policy if exists "Workers view published job requests" on public.job_requests;
create policy "Workers view published job requests"
on public.job_requests
for select
to authenticated
using (status = 'published');

drop policy if exists "Restaurants create own job requests" on public.job_requests;
create policy "Restaurants create own job requests"
on public.job_requests
for insert
to authenticated
with check (
  auth.uid() = user_id
  and auth.uid() = restaurant_id
  and auth.uid() = restaurant_profile_id
  and public.has_role(auth.uid(), 'restaurant')
);

drop policy if exists "Restaurants update own job requests" on public.job_requests;
create policy "Restaurants update own job requests"
on public.job_requests
for update
to authenticated
using ((auth.uid() = user_id and auth.uid() = restaurant_id) or public.has_role(auth.uid(), 'admin'))
with check ((auth.uid() = user_id and auth.uid() = restaurant_id) or public.has_role(auth.uid(), 'admin'));

drop policy if exists "Restaurants delete own job requests" on public.job_requests;
create policy "Restaurants delete own job requests"
on public.job_requests
for delete
to authenticated
using ((auth.uid() = user_id and auth.uid() = restaurant_id) or public.has_role(auth.uid(), 'admin'));
