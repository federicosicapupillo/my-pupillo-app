-- FASE 3 / migration 2: trigger difensivo BEFORE UPDATE su public.profiles (allowlist)
-- Rollback:
--   DROP TRIGGER IF EXISTS trg_00_profiles_guard_admin_columns ON public.profiles;
--   DROP FUNCTION IF EXISTS public.profiles_guard_admin_columns();

CREATE OR REPLACE FUNCTION public.profiles_guard_admin_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  allowed CONSTANT text[] := ARRAY[
    -- anagrafica / identita'
    'full_name','first_name','last_name','birth_date','birth_place','nationality',
    'tax_code','age','avatar_url','professional_profile',
    -- contatti (il telefono resta protetto dal trigger di immutabilita' post-verifica)
    'phone','phone_country_code','phone_number','phone_full','email',
    -- residenza / indirizzo
    'residence_address','residence_street','residence_number','residence_city',
    'residence_postal_code','residence_province',
    'address','street','street_number','postal_code','province','province_code',
    'city','city_code','neighborhood','country','latitude','longitude',
    'access_restrictions','additional_directions','location_notes',
    -- documento
    'id_document_type','id_document_number','id_document_issuer',
    'id_document_issued_at','id_document_expires_at',
    'id_document_path','id_document_back_path',
    -- profilo lavoratore
    'primary_role','secondary_roles','experience_years','experience_level',
    'languages','spoken_languages','is_motorized','hourly_rate',
    'weekly_availability','hourly_availability','available_now_until',
    'work_area_mode','selected_zones','all_zones',
    'service_area_city','service_area_district','service_area_lat',
    'service_area_lng','service_area_radius_m',
    -- profilo ristoratore
    'business_name','venue_type','venue_type_other','price_range','employees_count',
    'opening_hours','busy_days','representative_age',
    'vat_number','vat_company_name','company_tax_code',
    'registered_office_address','registered_office_city',
    'registered_office_province','registered_office_postal_code',
    'business_status','pec_email','sdi_code',
    'contact_person_first_name','contact_person_last_name','contact_person_role',
    'contact_person_role_other','contact_person_phone','contact_person_email',
    -- impostazioni default annunci
    'default_contact_person_name','default_license_requirement',
    'default_language_requirements','default_tattoos_allowed',
    'default_piercings_allowed','default_beard_allowed','default_required_skills',
    'default_dress_code_items','default_dress_code_notes',
    'default_arrival_advance_minutes','default_arrival_advance_reason',
    'default_settings_updated_at',
    -- stato onboarding / housekeeping consentito
    'terms_accepted','profile_completed','updated_at','last_active_at',
    'whatsapp_connected'
  ];
  changed text[];
  blocked text[];
BEGIN
  -- Bypass: service role, backend (SECURITY DEFINER: current_user = owner) e admin
  IF current_user IN ('postgres','service_role','supabase_admin','supabase_auth_admin')
     OR session_user IN ('postgres','service_role','supabase_admin','supabase_auth_admin')
     OR auth.uid() IS NULL
     OR public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  SELECT array_agg(o.key ORDER BY o.key)
    INTO changed
  FROM jsonb_each(to_jsonb(OLD)) o
  JOIN jsonb_each(to_jsonb(NEW)) n ON n.key = o.key
  WHERE o.value IS DISTINCT FROM n.value;

  IF changed IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT array_agg(c ORDER BY c) INTO blocked
  FROM unnest(changed) AS c
  WHERE c <> ALL (allowed);

  IF blocked IS NOT NULL THEN
    RAISE EXCEPTION 'Modifica non consentita sui campi protetti del profilo: %',
      array_to_string(blocked, ', ')
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.profiles_guard_admin_columns() IS
  'Fase 3: allowlist difensiva BEFORE UPDATE su profiles. Blocca ai non-admin la scrittura di colonne amministrative/derivate. Bypass per service_role, backend SECURITY DEFINER e admin.';

DROP TRIGGER IF EXISTS trg_00_profiles_guard_admin_columns ON public.profiles;
CREATE TRIGGER trg_00_profiles_guard_admin_columns
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.profiles_guard_admin_columns();