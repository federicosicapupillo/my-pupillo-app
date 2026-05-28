-- Allow workers with an accepted application to read the announcement's
-- on-site contact person, so the "Proposta accettata" message can include
-- the Referente field on the worker side too.
CREATE OR REPLACE FUNCTION public.get_announcement_contact(_announcement_id uuid)
RETURNS TABLE (
  job_contact_person_name  text,
  job_contact_person_phone text,
  job_contact_person_email text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.job_contact_person_name, a.job_contact_person_phone, a.job_contact_person_email
    FROM public.announcements a
   WHERE a.id = _announcement_id
     AND (
       a.restaurant_id = auth.uid()
       OR a.assigned_worker_id = auth.uid()
       OR EXISTS (
         SELECT 1
           FROM public.applications ap
          WHERE ap.announcement_id = a.id
            AND ap.worker_id = auth.uid()
            AND ap.status = 'accepted'
       )
       OR EXISTS (
         SELECT 1
           FROM public.shifts s
          WHERE s.announcement_id = a.id
            AND s.worker_id = auth.uid()
            AND s.status IN ('scheduled','completed')
       )
       OR public.has_role(auth.uid(), 'admin'::app_role)
     );
$$;

REVOKE EXECUTE ON FUNCTION public.get_announcement_contact(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_announcement_contact(uuid) TO authenticated;