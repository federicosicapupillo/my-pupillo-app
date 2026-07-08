
-- Update list_worker_user_ids: add moderation filter
CREATE OR REPLACE FUNCTION public.list_worker_user_ids()
RETURNS TABLE(user_id uuid)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id AS user_id
  FROM public.profiles p
  LEFT JOIN public.user_roles ur ON ur.user_id = p.id
  GROUP BY p.id
  HAVING (
      bool_or(ur.role = 'worker')
      OR lower(coalesce(p.primary_role, '')) = 'worker'
    )
    AND NOT bool_or(coalesce(ur.role::text, '') IN ('admin', 'restaurant'))
    AND lower(coalesce(p.primary_role, '')) NOT IN ('admin', 'restaurant', 'ristoratore')
    AND coalesce(p.is_deleted, false) = false
    AND p.deleted_at IS NULL
    AND coalesce(p.account_status::text, 'active') = 'active'
    AND coalesce(p.profile_completed, false) = true
    AND coalesce(p.is_demo, false) = false
    AND p.seed_batch_id IS NULL
    AND coalesce(bool_or(p.moderation_hidden), false) = false;
$$;

REVOKE ALL ON FUNCTION public.list_worker_user_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_worker_user_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_worker_user_ids() TO service_role;

-- New BEFORE INSERT trigger on applications to block hidden users
CREATE OR REPLACE FUNCTION public.block_application_on_moderation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id IN (NEW.worker_id, NEW.restaurant_id)
      AND coalesce(moderation_hidden, false) = true
  ) THEN
    RAISE EXCEPTION 'moderation_blocked';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_block_application_on_moderation ON public.applications;
CREATE TRIGGER trg_block_application_on_moderation
BEFORE INSERT ON public.applications
FOR EACH ROW EXECUTE FUNCTION public.block_application_on_moderation();
