
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS spoken_languages jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_profiles_spoken_languages ON public.profiles USING gin (spoken_languages);
