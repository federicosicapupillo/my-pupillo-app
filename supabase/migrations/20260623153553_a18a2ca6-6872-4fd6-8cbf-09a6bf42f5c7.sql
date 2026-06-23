-- ============================================================
-- Phase 3: Tighten RLS on public.reviews
-- ============================================================

-- 1) Helper function — determine if a given user can see a review.
CREATE OR REPLACE FUNCTION public.is_review_visible_to(_review_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    -- Admins always see everything.
    public.has_role(_user_id, 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1
      FROM public.reviews r
      WHERE r.id = _review_id
        AND (
          -- Author always sees what they wrote.
          r.author_id = _user_id
          OR (
            -- Target sees it only after the blind unlock.
            r.target_id = _user_id
            AND (
              (public.has_role(_user_id, 'worker'::public.app_role)     AND r.is_visible_to_worker)
              OR (public.has_role(_user_id, 'restaurant'::public.app_role) AND r.is_visible_to_restaurants)
            )
          )
        )
    );
$$;

REVOKE EXECUTE ON FUNCTION public.is_review_visible_to(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_review_visible_to(uuid, uuid) TO authenticated, service_role;

-- 2) Replace the permissive SELECT policy.
DROP POLICY IF EXISTS "Reviews viewable by authenticated" ON public.reviews;
DROP POLICY IF EXISTS "Reviews visible per blind logic" ON public.reviews;

CREATE POLICY "Reviews visible per blind logic"
  ON public.reviews
  FOR SELECT
  TO authenticated
  USING (public.is_review_visible_to(id, auth.uid()));

-- 3) Column-level lockdown on visibility/unlock columns.
--    Postgres RLS has no per-column USING for UPDATE, so we use column GRANTs.
--    Authors keep UPDATE on content fields; only the SECURITY DEFINER
--    trigger functions (which run as the function owner) can flip
--    is_visible_to_worker / is_visible_to_restaurants / visible_at.
REVOKE UPDATE ON public.reviews FROM authenticated;

GRANT UPDATE (
  comment,
  rating,
  tags,
  positive_tags,
  negative_tags,
  punctuality,
  professionalism,
  competence,
  reliability,
  teamwork,
  communication,
  staff_collaboration,
  appearance,
  would_rehire,
  seen_by_worker_at,
  updated_at
) ON public.reviews TO authenticated;

-- service_role retains full privileges for admin/maintenance paths.
GRANT ALL ON public.reviews TO service_role;

-- Existing UPDATE policies ("Authors update own reviews", "Worker marks own review seen"),
-- INSERT policy ("Users create own reviews"), and any DELETE policy remain untouched.