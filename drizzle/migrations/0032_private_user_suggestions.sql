CREATE TABLE public.user_suggestions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL,
 message text NOT NULL CHECK (char_length(btrim(message)) BETWEEN 1 AND 2000),
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.user_suggestions TO authenticated;
GRANT ALL ON public.user_suggestions TO service_role;
ALTER TABLE public.user_suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users submit their own suggestions" ON public.user_suggestions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins read suggestions" ON public.user_suggestions FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX user_suggestions_created_idx ON public.user_suggestions (created_at DESC);