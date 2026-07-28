-- Root cause: SELECT privilege on public.profiles was revoked from `authenticated`,
-- so any query (direct or via triggers running with invoker rights) failed with
-- `permission denied for table profiles`, even though the RLS policy
-- "Profiles viewable by all authenticated" is USING (true).
--
-- The RLS policies are the actual access-control layer and are left untouched.
-- We only re-issue the GRANTs the policies presuppose.

GRANT SELECT ON public.profiles TO authenticated;
GRANT SELECT ON public.announcements TO anon;
GRANT UPDATE ON public.reviews TO authenticated;
