ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS email_status text;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS email_sent_at timestamptz;
UPDATE public.notifications SET email_status = 'skipped_legacy' WHERE email_status IS NULL;
CREATE INDEX IF NOT EXISTS notifications_email_pending_idx ON public.notifications (created_at) WHERE email_status IS NULL;

CREATE TABLE public.notification_email_preferences (
  user_id uuid PRIMARY KEY DEFAULT auth.uid(),
  messages boolean NOT NULL DEFAULT true,
  applications boolean NOT NULL DEFAULT true,
  shifts boolean NOT NULL DEFAULT true,
  reviews boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.notification_email_preferences TO authenticated;
GRANT ALL ON public.notification_email_preferences TO service_role;
ALTER TABLE public.notification_email_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own email prefs read" ON public.notification_email_preferences FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Own email prefs insert" ON public.notification_email_preferences FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Own email prefs update" ON public.notification_email_preferences FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());