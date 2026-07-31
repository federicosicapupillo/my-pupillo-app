DROP POLICY IF EXISTS "Workers update own exceptions" ON public.worker_availability_exceptions;
CREATE POLICY "Workers update own exceptions"
  ON public.worker_availability_exceptions
  FOR UPDATE
  USING ((worker_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK ((worker_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Workers delete own exceptions" ON public.worker_availability_exceptions;
CREATE POLICY "Workers delete own exceptions"
  ON public.worker_availability_exceptions
  FOR DELETE
  USING ((worker_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));