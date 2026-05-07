ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS default_license_requirement text,
  ADD COLUMN IF NOT EXISTS default_language_requirements text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS default_tattoos_allowed text,
  ADD COLUMN IF NOT EXISTS default_piercings_allowed text,
  ADD COLUMN IF NOT EXISTS default_beard_allowed text,
  ADD COLUMN IF NOT EXISTS default_required_skills text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS default_dress_code_items text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS default_dress_code_notes text;