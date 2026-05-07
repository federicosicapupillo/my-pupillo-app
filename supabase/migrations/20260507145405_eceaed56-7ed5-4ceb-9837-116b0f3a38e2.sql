
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS street text,
  ADD COLUMN IF NOT EXISTS street_number text,
  ADD COLUMN IF NOT EXISTS province text,
  ADD COLUMN IF NOT EXISTS postal_code text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision,
  ADD COLUMN IF NOT EXISTS access_restrictions text,
  ADD COLUMN IF NOT EXISTS additional_directions text,
  ADD COLUMN IF NOT EXISTS location_notes text,
  ADD COLUMN IF NOT EXISTS contact_person_first_name text,
  ADD COLUMN IF NOT EXISTS contact_person_last_name text,
  ADD COLUMN IF NOT EXISTS contact_person_role text,
  ADD COLUMN IF NOT EXISTS contact_person_phone text,
  ADD COLUMN IF NOT EXISTS contact_person_email text;

ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS job_address text,
  ADD COLUMN IF NOT EXISTS job_city text,
  ADD COLUMN IF NOT EXISTS job_province text,
  ADD COLUMN IF NOT EXISTS job_postal_code text,
  ADD COLUMN IF NOT EXISTS job_country text,
  ADD COLUMN IF NOT EXISTS job_latitude double precision,
  ADD COLUMN IF NOT EXISTS job_longitude double precision,
  ADD COLUMN IF NOT EXISTS job_access_restrictions text,
  ADD COLUMN IF NOT EXISTS job_additional_directions text,
  ADD COLUMN IF NOT EXISTS job_location_notes text,
  ADD COLUMN IF NOT EXISTS job_contact_person_name text,
  ADD COLUMN IF NOT EXISTS job_contact_person_phone text,
  ADD COLUMN IF NOT EXISTS job_contact_person_email text;
