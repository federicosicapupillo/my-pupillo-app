alter table public.job_requests drop constraint if exists job_requests_status_check;
alter table public.job_requests add constraint job_requests_status_check check (status in ('bozza','pubblicato'));
alter table public.job_requests alter column status set default 'bozza';

drop policy if exists "Workers view published job requests" on public.job_requests;
create policy "Workers view published job requests"
on public.job_requests
for select
to authenticated
using (status = 'pubblicato');