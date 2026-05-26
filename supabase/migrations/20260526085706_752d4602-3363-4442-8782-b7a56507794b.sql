-- Relax the worker INSERT policy on applications so it doesn't fail when the
-- announcement status has transitioned (e.g. to 'assigned') or when the client
-- restaurant_id differs slightly from the joined announcement. Business rules
-- (duplicate guard, availability) are enforced by app code + the existing
-- enforce_announcement_positions trigger on UPDATE to 'accepted'.

DROP POLICY IF EXISTS "Workers create own applications" ON public.applications;

CREATE POLICY "Workers create own applications"
ON public.applications
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = worker_id
  AND public.has_role(auth.uid(), 'worker'::public.app_role)
  AND EXISTS (
    SELECT 1 FROM public.announcements a
    WHERE a.id = applications.announcement_id
      AND a.restaurant_id = applications.restaurant_id
  )
);