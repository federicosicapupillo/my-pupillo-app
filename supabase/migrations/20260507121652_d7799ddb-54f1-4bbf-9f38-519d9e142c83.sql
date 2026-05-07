
CREATE TABLE public.favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  announcement_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, announcement_id)
);

ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own favorites" ON public.favorites
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users add own favorites" ON public.favorites
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users remove own favorites" ON public.favorites
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE INDEX idx_favorites_user ON public.favorites(user_id);
