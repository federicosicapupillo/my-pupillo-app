
-- =====================================================================
-- 1. PROFILES: lock down PII columns with column-level privileges.
-- Row-level policies stay broad (USING true) so workers/restaurants can
-- still see business_name, avatar_url, ratings, etc. of other users.
-- The actually sensitive columns are revoked at the column-grant level
-- so they cannot be SELECTed by regular authenticated users.
-- Owners still need their own sensitive data: expose via get_my_profile().
-- =====================================================================

REVOKE SELECT (
  email, phone, phone_full, phone_number, phone_country_code,
  tax_code, birth_date, birth_place,
  id_document_type, id_document_number, id_document_issued_at,
  id_document_expires_at, id_document_issuer,
  id_document_path, id_document_back_path,
  residence_address, residence_city, residence_postal_code, residence_province,
  nationality,
  vat_number, company_tax_code, pec_email, sdi_code,
  registered_office_address, registered_office_city,
  registered_office_province, registered_office_postal_code,
  stripe_customer_id,
  contact_person_phone, contact_person_email,
  street, street_number, postal_code, latitude, longitude,
  address, access_restrictions, additional_directions, location_notes,
  referred_by_user_id
) ON public.profiles FROM anon, authenticated, PUBLIC;

-- Owner-facing RPC: returns the caller's full profile bypassing column grants.
CREATE OR REPLACE FUNCTION public.get_my_profile()
RETURNS public.profiles
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.* FROM public.profiles p WHERE p.id = auth.uid();
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_profile() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_my_profile() TO authenticated;

-- =====================================================================
-- 2. ANNOUNCEMENTS: restrict job contact person to owner + assigned worker.
-- =====================================================================

REVOKE SELECT (
  job_contact_person_name,
  job_contact_person_phone,
  job_contact_person_email
) ON public.announcements FROM anon, authenticated, PUBLIC;

CREATE OR REPLACE FUNCTION public.get_announcement_contact(_announcement_id uuid)
RETURNS TABLE (
  job_contact_person_name  text,
  job_contact_person_phone text,
  job_contact_person_email text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.job_contact_person_name, a.job_contact_person_phone, a.job_contact_person_email
    FROM public.announcements a
   WHERE a.id = _announcement_id
     AND (
       a.restaurant_id = auth.uid()
       OR a.assigned_worker_id = auth.uid()
       OR public.has_role(auth.uid(), 'admin'::app_role)
     );
$$;

REVOKE EXECUTE ON FUNCTION public.get_announcement_contact(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_announcement_contact(uuid) TO authenticated;

-- =====================================================================
-- 3. JOB_REQUESTS: restrict sensitive operational columns to owner only.
-- =====================================================================

REVOKE SELECT (
  contact_person_name,
  contact_person_phone,
  contact_person_email,
  contact_person_role,
  contact_person_role_other,
  latitude, longitude,
  address, district, postal_code,
  access_restrictions, additional_directions,
  worker_notes, operational_notes
) ON public.job_requests FROM anon, authenticated, PUBLIC;

-- Owners need full access; grant back via SECURITY DEFINER reader.
CREATE OR REPLACE FUNCTION public.get_my_job_request(_announcement_id uuid)
RETURNS public.job_requests
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jr.*
    FROM public.job_requests jr
   WHERE jr.announcement_id = _announcement_id
     AND (
       jr.user_id = auth.uid()
       OR jr.restaurant_id = auth.uid()
       OR jr.restaurant_profile_id = auth.uid()
       OR public.has_role(auth.uid(), 'admin'::app_role)
     )
   LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_job_request(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_my_job_request(uuid) TO authenticated;

-- =====================================================================
-- 4. DISCOUNT_CODES: stop exposing the full list to authenticated users.
-- Validation/redemption already go through SECURITY DEFINER functions.
-- =====================================================================

DROP POLICY IF EXISTS "Authenticated read active codes" ON public.discount_codes;

-- =====================================================================
-- 5. WORKER_AVAILABILITY / EXCEPTIONS: scope SELECT to owner + admin
--    + restaurants who already have a confirmed/scheduled shift.
-- =====================================================================

DROP POLICY IF EXISTS "Availability viewable by authenticated" ON public.worker_availability;
CREATE POLICY "Availability viewable by parties"
  ON public.worker_availability
  FOR SELECT
  TO authenticated
  USING (
    worker_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR (
      public.has_role(auth.uid(), 'restaurant'::app_role)
      AND public.has_worker_restaurant_relationship(worker_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "Exceptions viewable by authenticated" ON public.worker_availability_exceptions;
CREATE POLICY "Exceptions viewable by parties"
  ON public.worker_availability_exceptions
  FOR SELECT
  TO authenticated
  USING (
    worker_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR (
      public.has_role(auth.uid(), 'restaurant'::app_role)
      AND public.has_worker_restaurant_relationship(worker_id, auth.uid())
    )
  );

-- =====================================================================
-- 6. REALTIME.MESSAGES: enable RLS so unprotected broadcast/presence
--    channels deny by default. The app uses postgres_changes (which
--    respects source-table RLS) and does not rely on broadcast.
-- =====================================================================

ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;
