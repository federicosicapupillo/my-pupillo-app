-- SECURITY DEFINER function to list user_ids that are workers
-- (have role 'worker' and are NOT 'restaurant' or 'admin'),
-- bypassing the restrictive RLS on user_roles which only lets a user see their own role.
CREATE OR REPLACE FUNCTION public.list_worker_user_ids()
RETURNS TABLE(user_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ur.user_id
  FROM public.user_roles ur
  WHERE ur.role = 'worker'
    AND NOT EXISTS (
      SELECT 1 FROM public.user_roles ur2
      WHERE ur2.user_id = ur.user_id
        AND ur2.role IN ('restaurant', 'admin')
    )
  GROUP BY ur.user_id;
$$;

REVOKE ALL ON FUNCTION public.list_worker_user_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_worker_user_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_worker_user_ids() TO service_role;