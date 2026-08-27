-- 1) Fix mutable search_path on public functions
ALTER FUNCTION public.application_status_is_active(application_status) SET search_path = public;
ALTER FUNCTION public.application_status_is_assigned(application_status) SET search_path = public;
ALTER FUNCTION public.server_now() SET search_path = public;
ALTER FUNCTION public.shift_buffer_minutes() SET search_path = public;

-- 2) announcements_public: enforce caller RLS instead of view-owner privileges
CREATE POLICY "Anon can browse active announcements"
  ON public.announcements
  FOR SELECT
  TO anon
  USING (
    status = 'active'::announcement_status
    AND NOT EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = announcements.restaurant_id
        AND COALESCE(p.is_deleted, false) = true
    )
  );

ALTER VIEW public.announcements_public SET (security_invoker = on);

-- 3) notifications: block spoofed notifications to unrelated users
CREATE OR REPLACE FUNCTION public.can_notify_user(_target uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    _target IS NOT NULL
    AND auth.uid() IS NOT NULL
    AND (
      _target = auth.uid()
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.applications a
        WHERE (a.worker_id = auth.uid() AND a.restaurant_id = _target)
           OR (a.restaurant_id = auth.uid() AND a.worker_id = _target)
      )
      OR EXISTS (
        SELECT 1 FROM public.shifts s
        WHERE (s.worker_id = auth.uid() AND s.restaurant_id = _target)
           OR (s.restaurant_id = auth.uid() AND s.worker_id = _target)
      )
      OR EXISTS (
        SELECT 1 FROM public.announcements an
        WHERE an.restaurant_id = auth.uid() AND an.assigned_worker_id = _target
      )
    )
$$;

REVOKE ALL ON FUNCTION public.can_notify_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_notify_user(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Authenticated can create notifications" ON public.notifications;

CREATE POLICY "Users notify self or their counterparties"
  ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (public.can_notify_user(user_id));