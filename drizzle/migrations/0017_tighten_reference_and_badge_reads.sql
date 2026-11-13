DROP POLICY IF EXISTS "launch_areas_read_all" ON public.launch_areas;
CREATE POLICY "launch_areas_read_signed_in" ON public.launch_areas FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "launch_area_comuni_read_all" ON public.launch_area_comuni;
CREATE POLICY "launch_area_comuni_read_signed_in" ON public.launch_area_comuni FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Badges public read" ON public.worker_badges;
CREATE POLICY "Badges read by owner restaurants admins" ON public.worker_badges FOR SELECT TO authenticated USING (
  worker_id = auth.uid()
  OR public.has_role(auth.uid(), 'restaurant'::app_role)
  OR public.has_role(auth.uid(), 'admin'::app_role)
);