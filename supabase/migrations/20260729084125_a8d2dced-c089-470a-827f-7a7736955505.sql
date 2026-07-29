CREATE OR REPLACE FUNCTION public._apply_profile_self_patch(_patch jsonb, _allowed text[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  _uid uuid := auth.uid();
  _k text;
  _sets text;
  _sql text;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  IF _patch IS NULL OR jsonb_typeof(_patch) <> 'object' THEN
    RAISE EXCEPTION 'Invalid patch payload' USING ERRCODE = '22023';
  END IF;

  FOR _k IN SELECT t.k FROM jsonb_object_keys(_patch) AS t(k) LOOP
    IF NOT (_k = ANY(_allowed)) THEN
      RAISE EXCEPTION 'Column % is not self-updatable', _k USING ERRCODE = '42501';
    END IF;
  END LOOP;

  SELECT string_agg(format('%I = r.%I', t.k, t.k), ', ')
    INTO _sets
    FROM jsonb_object_keys(_patch) AS t(k);

  IF _sets IS NULL THEN
    RETURN;
  END IF;

  _sql := format(
    'UPDATE public.profiles p SET %s, updated_at = now() FROM (SELECT * FROM jsonb_populate_record(null::public.profiles, $1)) r WHERE p.id = $2',
    _sets
  );
  EXECUTE _sql USING _patch, _uid;
END;
$fn$;

REVOKE ALL ON FUNCTION public._apply_profile_self_patch(jsonb, text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._apply_profile_self_patch(jsonb, text[]) FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.update_my_profile(_patch jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  PERFORM public._apply_profile_self_patch(_patch, ARRAY[
    -- anagrafica / identità
    'full_name','first_name','last_name','birth_date','birth_place','nationality','tax_code',
    'age','representative_age','short_bio','professional_profile','avatar_url',
    -- contatti
    'phone','phone_country_code','phone_number','phone_full',
    -- residenza
    'residence_address','residence_street','residence_number','residence_city',
    'residence_postal_code','residence_province',
    -- documento identità
    'id_document_path','id_document_back_path','id_document_type','id_document_number',
    'id_document_issued_at','id_document_expires_at','id_document_issuer',
    -- area di lavoro / disponibilità
    'work_area_mode','service_area_city','service_area_district','service_area_radius_m',
    'service_area_lat','service_area_lng','selected_zones','all_zones',
    'weekly_availability','hourly_availability',
    -- competenze
    'languages','spoken_languages','primary_role','secondary_roles',
    'experience_years','experience_level','hourly_rate','is_motorized',
    -- attività (ristoratore)
    'business_name','vat_number','venue_type','venue_type_other','price_range',
    'employees_count','opening_hours','busy_days',
    'company_tax_code','registered_office_address','registered_office_city',
    'registered_office_province','registered_office_postal_code','pec_email','sdi_code',
    -- sede / luogo
    'address','street','street_number','neighborhood','city','province','province_code','city_code',
    'postal_code','country','latitude','longitude',
    'access_restrictions','additional_directions','location_notes',
    -- referente
    'contact_person_first_name','contact_person_last_name','contact_person_role',
    'contact_person_role_other','contact_person_phone','contact_person_email',
    -- flag onboarding
    'terms_accepted','profile_completed'
  ]);
END;
$fn$;

REVOKE ALL ON FUNCTION public.update_my_profile(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_my_profile(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_my_profile(jsonb) TO service_role;