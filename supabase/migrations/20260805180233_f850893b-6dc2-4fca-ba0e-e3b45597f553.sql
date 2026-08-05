ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS arrival_advance_minutes integer,
  ADD COLUMN IF NOT EXISTS arrival_advance_reason text;

ALTER TABLE public.job_requests
  ADD COLUMN IF NOT EXISTS arrival_advance_minutes integer,
  ADD COLUMN IF NOT EXISTS arrival_advance_reason text;

ALTER TABLE public.announcements
  ADD CONSTRAINT announcements_arrival_advance_minutes_range
  CHECK (arrival_advance_minutes IS NULL OR (arrival_advance_minutes >= 0 AND arrival_advance_minutes <= 480));

ALTER TABLE public.job_requests
  ADD CONSTRAINT job_requests_arrival_advance_minutes_range
  CHECK (arrival_advance_minutes IS NULL OR (arrival_advance_minutes >= 0 AND arrival_advance_minutes <= 480));

-- Backfill: "Presentarsi almeno N minuti prima del turno." -> N.
-- Il caso storico "oltre 15 minuti" non indica il valore esatto: resta NULL
-- e conserva soltanto la motivazione.
UPDATE public.job_requests
SET arrival_advance_minutes = NULLIF((regexp_match(access_restrictions, 'almeno\s+(\d{1,3})\s*minut', 'i'))[1], '')::int
WHERE arrival_advance_minutes IS NULL
  AND access_restrictions ~* 'almeno\s+\d{1,3}\s*minut';

UPDATE public.announcements a
SET arrival_advance_minutes = NULLIF((regexp_match(a.job_access_restrictions, 'almeno\s+(\d{1,3})\s*minut', 'i'))[1], '')::int
WHERE a.arrival_advance_minutes IS NULL
  AND a.job_access_restrictions ~* 'almeno\s+\d{1,3}\s*minut';

UPDATE public.announcements a
SET arrival_advance_minutes = jr.arrival_advance_minutes,
    arrival_advance_reason = COALESCE(a.arrival_advance_reason, jr.arrival_advance_reason)
FROM public.job_requests jr
WHERE jr.announcement_id = a.id
  AND a.arrival_advance_minutes IS NULL
  AND jr.arrival_advance_minutes IS NOT NULL;

CREATE OR REPLACE VIEW public.announcements_public AS
 SELECT id,
    restaurant_id,
    service_date,
    service_time,
    end_time,
    end_date,
    duration_hours,
    speed,
    tariff_type,
    tariff_amount,
    location_address,
    location_lat,
    location_lng,
    professional_profile,
    languages,
    deposit_paid,
    status,
    expires_at,
    assigned_worker_id,
    created_at,
    notes,
    license_requirement,
    language_requirements,
    tattoos_allowed,
    piercings_allowed,
    beard_allowed,
    required_skills,
    dress_code_items,
    dress_code_notes,
    job_city,
    job_province,
    job_postal_code,
    job_country,
    seed_batch_id,
    is_demo,
    reused_from_announcement_id,
    long_shift_reason,
    is_long_shift,
    shift_duration_hours,
    job_location_notes,
    shift_start_at,
    arrival_advance_minutes,
    arrival_advance_reason
   FROM announcements a
  WHERE location_is_in_operational_area(job_city, job_province, COALESCE(job_latitude, location_lat), COALESCE(job_longitude, location_lng))
    AND shift_start_at > now();