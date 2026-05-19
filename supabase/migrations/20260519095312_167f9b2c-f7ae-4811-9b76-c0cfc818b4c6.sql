
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS default_contact_person_name text,
  ADD COLUMN IF NOT EXISTS default_arrival_advance_minutes integer,
  ADD COLUMN IF NOT EXISTS default_arrival_advance_reason text;
