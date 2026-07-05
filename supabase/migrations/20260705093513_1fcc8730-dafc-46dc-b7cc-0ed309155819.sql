-- Fix #2: announcements has no Data API grants → "permission denied for table announcements"
GRANT SELECT, INSERT, UPDATE, DELETE ON public.announcements TO authenticated;
GRANT ALL ON public.announcements TO service_role;

-- Fix #1: notifications INSERT policy blocked cross-user (counterparty) notifications
DROP POLICY IF EXISTS "Users insert own notifications" ON public.notifications;
CREATE POLICY "Authenticated can create notifications"
  ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
