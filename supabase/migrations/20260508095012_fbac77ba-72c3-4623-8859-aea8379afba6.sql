ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS contact_person_role_other text;

ALTER TABLE public.job_requests
  ADD COLUMN IF NOT EXISTS contact_person_role text,
  ADD COLUMN IF NOT EXISTS contact_person_role_other text;