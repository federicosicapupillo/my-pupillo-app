DROP POLICY IF EXISTS "Availability viewable by parties" ON public.worker_availability;

CREATE POLICY "Availability readable by authenticated"
ON public.worker_availability
FOR SELECT
TO authenticated
USING (true);