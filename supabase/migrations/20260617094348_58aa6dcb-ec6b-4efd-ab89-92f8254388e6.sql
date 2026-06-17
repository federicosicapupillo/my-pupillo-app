-- Fix worker browse: workers can't see any announcement because the only
-- SELECT policy on public.announcements restricts to owner/applicant/shift
-- parties. Add a permissive SELECT policy for authenticated users limited to
-- currently active announcements; column-level GRANTs (migration 20260617090929)
-- continue to hide sensitive columns, and the announcements_public view
-- (security_invoker=on) only exposes safe columns.
--
-- Also grant SELECT on the announcements_public view to authenticated; without
-- it PostgREST returns permission denied even with security_invoker=on.

CREATE POLICY "Authenticated can browse active announcements"
  ON public.announcements
  FOR SELECT
  TO authenticated
  USING (status = 'active');

GRANT SELECT ON public.announcements_public TO authenticated;