
-- =========================================================================
-- ANNOUNCEMENTS: restrict base-table reads to parties; expose safe view
-- =========================================================================

DROP POLICY IF EXISTS "Announcements viewable by authenticated" ON public.announcements;

CREATE POLICY "Announcements full row visible to parties only"
ON public.announcements
FOR SELECT
TO authenticated
USING (
  restaurant_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.applications a
    WHERE a.announcement_id = announcements.id
      AND (a.worker_id = auth.uid() OR a.restaurant_id = auth.uid())
  )
  OR EXISTS (
    SELECT 1 FROM public.shifts s
    WHERE s.announcement_id = announcements.id
      AND (s.worker_id = auth.uid() OR s.restaurant_id = auth.uid())
  )
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Safe browsing view: excludes PII (contact_person_*, job_latitude/longitude,
-- job_address, additional_directions, access_restrictions). Runs as view
-- owner so it bypasses the base-table RLS for general browsing — but only
-- exposes non-sensitive columns.
DROP VIEW IF EXISTS public.announcements_public;
CREATE VIEW public.announcements_public AS
SELECT
  id, restaurant_id, service_date, service_time, end_time, end_date,
  duration_hours, speed, tariff_type, tariff_amount,
  location_address, location_lat, location_lng,
  professional_profile, languages, deposit_paid, status,
  expires_at, assigned_worker_id, created_at, notes,
  license_requirement, language_requirements,
  tattoos_allowed, piercings_allowed, beard_allowed,
  required_skills, dress_code_items, dress_code_notes,
  job_city, job_province, job_postal_code, job_country,
  seed_batch_id, is_demo, reused_from_announcement_id,
  long_shift_reason, is_long_shift, shift_duration_hours,
  job_location_notes
FROM public.announcements;

GRANT SELECT ON public.announcements_public TO authenticated, anon;

-- =========================================================================
-- JOB_REQUESTS: drop broad worker SELECT; expose safe published view
-- =========================================================================

DROP POLICY IF EXISTS "Workers view published job requests" ON public.job_requests;

DROP VIEW IF EXISTS public.job_requests_public;
CREATE VIEW public.job_requests_public AS
SELECT
  id, restaurant_id, user_id, restaurant_profile_id, announcement_id,
  restaurant_name, status, title, role_required, workers_needed,
  description, tasks, shift_date, end_date, start_time, end_time,
  hourly_rate, break_included, operational_notes,
  is_long_shift, long_shift_reason, shift_duration_hours,
  piercings_allowed, tattoos_allowed, language_requirements, license_requirement,
  worker_notes,
  city, district, province, postal_code, country,
  dress_code_notes, dress_code_items, required_skills, beard_allowed,
  contact_person_role, contact_person_role_other,
  is_demo, seed_batch_id, created_at, updated_at
FROM public.job_requests
WHERE status = 'pubblicato';

GRANT SELECT ON public.job_requests_public TO authenticated;
