-- ============================================================
-- Demo seed infrastructure: additive only, never touches real data.
-- All demo rows will carry is_demo = true and seed_batch_id.
-- ============================================================

-- 1) Add columns (idempotent)
ALTER TABLE public.profiles                     ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles                     ADD COLUMN IF NOT EXISTS seed_batch_id text;
ALTER TABLE public.announcements                ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.announcements                ADD COLUMN IF NOT EXISTS seed_batch_id text;
ALTER TABLE public.applications                 ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.applications                 ADD COLUMN IF NOT EXISTS seed_batch_id text;
ALTER TABLE public.shifts                       ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.shifts                       ADD COLUMN IF NOT EXISTS seed_batch_id text;
ALTER TABLE public.reviews                      ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.reviews                      ADD COLUMN IF NOT EXISTS seed_batch_id text;
ALTER TABLE public.messages                     ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.messages                     ADD COLUMN IF NOT EXISTS seed_batch_id text;
ALTER TABLE public.worker_badges                ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.worker_badges                ADD COLUMN IF NOT EXISTS seed_batch_id text;
ALTER TABLE public.worker_incidents             ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.worker_incidents             ADD COLUMN IF NOT EXISTS seed_batch_id text;
ALTER TABLE public.notifications                ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.notifications                ADD COLUMN IF NOT EXISTS seed_batch_id text;
ALTER TABLE public.job_requests                 ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.job_requests                 ADD COLUMN IF NOT EXISTS seed_batch_id text;
ALTER TABLE public.restaurant_worker_favorites  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.restaurant_worker_favorites  ADD COLUMN IF NOT EXISTS seed_batch_id text;
ALTER TABLE public.favorites                    ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.favorites                    ADD COLUMN IF NOT EXISTS seed_batch_id text;

-- 2) Indexes (partial, only on demo rows so production queries are unaffected)
CREATE INDEX IF NOT EXISTS profiles_is_demo_idx                     ON public.profiles (seed_batch_id)                     WHERE is_demo = true;
CREATE INDEX IF NOT EXISTS announcements_is_demo_idx                ON public.announcements (seed_batch_id)                WHERE is_demo = true;
CREATE INDEX IF NOT EXISTS applications_is_demo_idx                 ON public.applications (seed_batch_id)                 WHERE is_demo = true;
CREATE INDEX IF NOT EXISTS shifts_is_demo_idx                       ON public.shifts (seed_batch_id)                       WHERE is_demo = true;
CREATE INDEX IF NOT EXISTS reviews_is_demo_idx                      ON public.reviews (seed_batch_id)                      WHERE is_demo = true;
CREATE INDEX IF NOT EXISTS messages_is_demo_idx                     ON public.messages (seed_batch_id)                     WHERE is_demo = true;
CREATE INDEX IF NOT EXISTS worker_badges_is_demo_idx                ON public.worker_badges (seed_batch_id)                WHERE is_demo = true;
CREATE INDEX IF NOT EXISTS worker_incidents_is_demo_idx             ON public.worker_incidents (seed_batch_id)             WHERE is_demo = true;
CREATE INDEX IF NOT EXISTS notifications_is_demo_idx                ON public.notifications (seed_batch_id)                WHERE is_demo = true;
CREATE INDEX IF NOT EXISTS job_requests_is_demo_idx                 ON public.job_requests (seed_batch_id)                 WHERE is_demo = true;
CREATE INDEX IF NOT EXISTS restaurant_worker_favorites_is_demo_idx  ON public.restaurant_worker_favorites (seed_batch_id)  WHERE is_demo = true;
CREATE INDEX IF NOT EXISTS favorites_is_demo_idx                    ON public.favorites (seed_batch_id)                    WHERE is_demo = true;

-- 3) Safe cleanup helper: deletes demo rows of a given batch + the auth.users we created for it.
-- Restricted to rows where is_demo = true AND seed_batch_id matches.
-- Real data is never touched (is_demo defaults to false for every existing row).
CREATE OR REPLACE FUNCTION public.unseed_demo(_batch text)
RETURNS TABLE (
  step text,
  rows_affected bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_demo_user_ids uuid[];
  v_n bigint;
BEGIN
  IF _batch IS NULL OR length(btrim(_batch)) = 0 THEN
    RAISE EXCEPTION 'unseed_demo requires a non-empty batch id';
  END IF;

  -- Snapshot of demo user ids (so we can also remove their auth.users at the end)
  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO v_demo_user_ids
    FROM public.profiles
   WHERE is_demo = true AND seed_batch_id = _batch;

  -- Delete in dependency order. Each statement is scoped to the batch only.
  DELETE FROM public.messages                    WHERE is_demo = true AND seed_batch_id = _batch;
  GET DIAGNOSTICS v_n = ROW_COUNT; step := 'messages';                    rows_affected := v_n; RETURN NEXT;

  DELETE FROM public.proposal_responses pr
    USING public.applications a
   WHERE pr.application_id = a.id AND a.is_demo = true AND a.seed_batch_id = _batch;
  GET DIAGNOSTICS v_n = ROW_COUNT; step := 'proposal_responses';          rows_affected := v_n; RETURN NEXT;

  DELETE FROM public.reviews                     WHERE is_demo = true AND seed_batch_id = _batch;
  GET DIAGNOSTICS v_n = ROW_COUNT; step := 'reviews';                     rows_affected := v_n; RETURN NEXT;

  DELETE FROM public.required_reviews rr
    USING public.profiles p
   WHERE (rr.restaurant_user_id = p.id OR rr.worker_user_id = p.id)
     AND p.is_demo = true AND p.seed_batch_id = _batch;
  GET DIAGNOSTICS v_n = ROW_COUNT; step := 'required_reviews';            rows_affected := v_n; RETURN NEXT;

  DELETE FROM public.worker_incidents            WHERE is_demo = true AND seed_batch_id = _batch;
  GET DIAGNOSTICS v_n = ROW_COUNT; step := 'worker_incidents';            rows_affected := v_n; RETURN NEXT;

  DELETE FROM public.worker_badges               WHERE is_demo = true AND seed_batch_id = _batch;
  GET DIAGNOSTICS v_n = ROW_COUNT; step := 'worker_badges';               rows_affected := v_n; RETURN NEXT;

  DELETE FROM public.shifts                      WHERE is_demo = true AND seed_batch_id = _batch;
  GET DIAGNOSTICS v_n = ROW_COUNT; step := 'shifts';                      rows_affected := v_n; RETURN NEXT;

  DELETE FROM public.applications                WHERE is_demo = true AND seed_batch_id = _batch;
  GET DIAGNOSTICS v_n = ROW_COUNT; step := 'applications';                rows_affected := v_n; RETURN NEXT;

  DELETE FROM public.favorites                   WHERE is_demo = true AND seed_batch_id = _batch;
  GET DIAGNOSTICS v_n = ROW_COUNT; step := 'favorites';                   rows_affected := v_n; RETURN NEXT;

  DELETE FROM public.restaurant_worker_favorites WHERE is_demo = true AND seed_batch_id = _batch;
  GET DIAGNOSTICS v_n = ROW_COUNT; step := 'restaurant_worker_favorites'; rows_affected := v_n; RETURN NEXT;

  DELETE FROM public.job_requests                WHERE is_demo = true AND seed_batch_id = _batch;
  GET DIAGNOSTICS v_n = ROW_COUNT; step := 'job_requests';                rows_affected := v_n; RETURN NEXT;

  DELETE FROM public.announcements               WHERE is_demo = true AND seed_batch_id = _batch;
  GET DIAGNOSTICS v_n = ROW_COUNT; step := 'announcements';               rows_affected := v_n; RETURN NEXT;

  DELETE FROM public.notifications               WHERE is_demo = true AND seed_batch_id = _batch;
  GET DIAGNOSTICS v_n = ROW_COUNT; step := 'notifications';               rows_affected := v_n; RETURN NEXT;

  DELETE FROM public.user_roles
   WHERE user_id = ANY(v_demo_user_ids);
  GET DIAGNOSTICS v_n = ROW_COUNT; step := 'user_roles';                  rows_affected := v_n; RETURN NEXT;

  DELETE FROM public.profiles                    WHERE is_demo = true AND seed_batch_id = _batch;
  GET DIAGNOSTICS v_n = ROW_COUNT; step := 'profiles';                    rows_affected := v_n; RETURN NEXT;

  -- Finally remove auth.users we created for the demo batch (if any).
  DELETE FROM auth.identities
   WHERE user_id = ANY(v_demo_user_ids);
  GET DIAGNOSTICS v_n = ROW_COUNT; step := 'auth.identities';             rows_affected := v_n; RETURN NEXT;

  DELETE FROM auth.users
   WHERE id = ANY(v_demo_user_ids);
  GET DIAGNOSTICS v_n = ROW_COUNT; step := 'auth.users';                  rows_affected := v_n; RETURN NEXT;

  RETURN;
END;
$$;

COMMENT ON FUNCTION public.unseed_demo(text) IS
  'Safely removes all rows tagged with is_demo=true AND seed_batch_id=<batch>, plus the auth.users they belong to. Never touches real data.';
