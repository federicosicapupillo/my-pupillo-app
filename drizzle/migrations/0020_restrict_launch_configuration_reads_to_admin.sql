-- Operational-area tables are administrative configuration. Ordinary user
-- selectors use the browser-safe launch-area catalogue; validation RPCs retain
-- their existing controlled access. Existing admin ALL policies cover SELECT.
DROP POLICY IF EXISTS "launch_areas_read_signed_in" ON public.launch_areas;
DROP POLICY IF EXISTS "launch_area_comuni_read_signed_in" ON public.launch_area_comuni;