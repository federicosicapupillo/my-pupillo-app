
CREATE POLICY "Workers create own applications" ON public.applications
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = worker_id
    AND has_role(auth.uid(), 'worker'::app_role)
    AND EXISTS (SELECT 1 FROM public.announcements a WHERE a.id = announcement_id AND a.restaurant_id = applications.restaurant_id AND a.status = 'active')
  );
