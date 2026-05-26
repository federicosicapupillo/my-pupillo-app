drop policy if exists "Restaurants create applications" on public.applications;

create policy "Restaurants create applications for own announcements"
on public.applications
for insert
to authenticated
with check (
  auth.uid() = restaurant_id
  and public.has_role(auth.uid(), 'restaurant'::public.app_role)
  and exists (
    select 1
    from public.announcements a
    where a.id = applications.announcement_id
      and a.restaurant_id = applications.restaurant_id
  )
);
