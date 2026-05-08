ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS default_settings_updated_at timestamptz;