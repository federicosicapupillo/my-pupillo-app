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
  _normalized_reason text := NULLIF(trim(coalesce(_reason, '')), '');
  _normalized_custom text := NULLIF(left(trim(coalesce(_custom_reason, '')), 500), '');
  _allowed_reasons text[] := ARRAY[
    'non_uso_piu',
    'lavoro_altro_modo',
    'problemi_piattaforma',
    'problemi_notifiche_chat',
    'problemi_pagamenti_crediti',
    'cancellare_dati',
    'altro'
  ];
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'unauthorized');
  END IF;

  IF _normalized_reason IS NULL OR NOT (_normalized_reason = ANY(_allowed_reasons)) THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'missing_reason');
  END IF;

  IF _normalized_reason = 'altro' AND _normalized_custom IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'missing_custom_reason');
  END IF;

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

  SELECT ur.role::text INTO _role
  FROM public.user_roles ur
  WHERE ur.user_id = _uid
  ORDER BY CASE ur.role::text WHEN 'admin' THEN 0 WHEN 'restaurant' THEN 1 WHEN 'worker' THEN 2 ELSE 3 END
  LIMIT 1;

  INSERT INTO public.account_deletion_feedback (user_id, profile_id, role, reason, custom_reason)
  VALUES (_uid, _uid, _role, _normalized_reason, _normalized_custom);

  PERFORM set_config('pupillo.account_deletion', 'on', true);

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
    phone_verified_at = NULL,
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
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'delete_my_account failed for user %: %', _uid, SQLERRM;
  RETURN jsonb_build_object('ok', false, 'error_code', 'delete_failed');
END;
$$;

REVOKE ALL ON FUNCTION public.delete_my_account(text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.delete_my_account(text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.enforce_phone_immutable_after_verification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('pupillo.account_deletion', true) = 'on'
     AND NEW.is_deleted = true
     AND NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF COALESCE(OLD.phone_verified, false) = true THEN
    IF COALESCE(NEW.phone_full, '') IS DISTINCT FROM COALESCE(OLD.phone_full, '')
       OR COALESCE(NEW.phone_number, '') IS DISTINCT FROM COALESCE(OLD.phone_number, '')
       OR COALESCE(NEW.phone_country_code, '') IS DISTINCT FROM COALESCE(OLD.phone_country_code, '')
       OR COALESCE(NEW.phone, '') IS DISTINCT FROM COALESCE(OLD.phone, '') THEN
      IF auth.role() = 'service_role' OR public.has_role(auth.uid(), 'admin'::app_role) THEN
        RETURN NEW;
      END IF;
      RAISE EXCEPTION 'Il numero è già verificato. Per modificarlo contatta il supporto clienti.';
    END IF;

    IF NEW.phone_verified = false THEN
      IF NOT (auth.role() = 'service_role' OR public.has_role(auth.uid(), 'admin'::app_role)) THEN
        NEW.phone_verified := OLD.phone_verified;
        NEW.phone_verified_at := OLD.phone_verified_at;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;