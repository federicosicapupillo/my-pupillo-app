DROP POLICY IF EXISTS "Exceptions viewable by parties" ON public.worker_availability_exceptions;

CREATE POLICY "Exceptions readable by authenticated"
ON public.worker_availability_exceptions
FOR SELECT
TO authenticated
USING (true);