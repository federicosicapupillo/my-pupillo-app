
-- 1) Profile soft-delete flags
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_profiles_is_deleted ON public.profiles(is_deleted);

-- 2) account_deletion_feedback table
CREATE TABLE IF NOT EXISTS public.account_deletion_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  profile_id uuid,
  role text,
  reason text,
  custom_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.account_deletion_feedback TO authenticated;
GRANT ALL ON public.account_deletion_feedback TO service_role;

ALTER TABLE public.account_deletion_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own deletion feedback"
ON public.account_deletion_feedback
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "Admins read deletion feedback"
ON public.account_deletion_feedback
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 3) delete_my_account RPC
CREATE OR REPLACE FUNCTION public.delete_my_account(
  _reason text DEFAULT NULL,
  _custom_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _role text;
  _active_shifts int;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'unauthorized', 'message', 'Utente non autenticato.');
  END IF;

  -- Block deletion if active/future shifts exist (as worker or restaurant)
  SELECT count(*) INTO _active_shifts
  FROM public.shifts s
  WHERE (s.worker_id = _uid OR s.restaurant_id = _uid)
    AND s.status = 'scheduled'
    AND s.shift_date >= CURRENT_DATE;

  IF _active_shifts > 0 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error_code', 'active_shifts',
      'message', 'Hai ancora turni attivi o in corso. Potrai eliminare l''account dopo la chiusura dei turni.'
    );
  END IF;

  -- Determine user role for feedback
  SELECT ur.role::text INTO _role FROM public.user_roles ur
   WHERE ur.user_id = _uid
   ORDER BY CASE ur.role::text WHEN 'admin' THEN 0 WHEN 'restaurant' THEN 1 WHEN 'worker' THEN 2 ELSE 3 END
   LIMIT 1;

  -- Save deletion feedback (always, even if empty)
  INSERT INTO public.account_deletion_feedback (user_id, profile_id, role, reason, custom_reason)
  VALUES (
    _uid,
    _uid,
    _role,
    NULLIF(trim(coalesce(_reason, '')), ''),
    NULLIF(left(trim(coalesce(_custom_reason, '')), 500), '')
  );

  -- Anonymize profile (keep row for FK integrity with reviews/shifts/etc.)
  UPDATE public.profiles SET
    is_deleted = true,
    deleted_at = now(),
    account_status = 'suspended',
    profile_completed = false,
    full_name = NULL,
    first_name = NULL,
    last_name = NULL,
    email = NULL,
    phone = NULL,
    phone_full = NULL,
    phone_country_code = NULL,
    phone_number = NULL,
    phone_verified = false,
    whatsapp_connected = false,
    avatar_url = NULL,
    business_name = NULL,
    vat_number = NULL,
    vat_company_name = NULL,
    tax_code = NULL,
    company_tax_code = NULL,
    address = NULL,
    street = NULL,
    street_number = NULL,
    city = NULL,
    province = NULL,
    postal_code = NULL,
    country = NULL,
    latitude = NULL,
    longitude = NULL,
    residence_address = NULL,
    residence_city = NULL,
    residence_postal_code = NULL,
    residence_province = NULL,
    birth_place = NULL,
    birth_date = NULL,
    nationality = NULL,
    id_document_path = NULL,
    id_document_back_path = NULL,
    id_document_number = NULL,
    id_document_type = NULL,
    id_document_issued_at = NULL,
    id_document_expires_at = NULL,
    id_document_issuer = NULL,
    contact_person_first_name = NULL,
    contact_person_last_name = NULL,
    contact_person_phone = NULL,
    contact_person_email = NULL,
    contact_person_role = NULL,
    service_area_lat = NULL,
    service_area_lng = NULL,
    short_bio = NULL,
    professional_profile = NULL,
    pec_email = NULL,
    sdi_code = NULL,
    registered_office_address = NULL,
    registered_office_city = NULL,
    registered_office_province = NULL,
    registered_office_postal_code = NULL
  WHERE id = _uid;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.delete_my_account(text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.delete_my_account(text, text) TO authenticated;
