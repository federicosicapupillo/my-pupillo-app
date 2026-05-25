
-- Tighten activity_logs INSERT policy: require user_id = auth.uid()
DROP POLICY IF EXISTS "Anyone log own activity" ON public.activity_logs;
CREATE POLICY "Users insert own activity"
  ON public.activity_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Fix mutable search_path on normalize_vat
ALTER FUNCTION public.normalize_vat(text) SET search_path = 'public';
