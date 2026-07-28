-- FASE 3 / migration 5: correzione bypass guard
-- Rollback: ripristinare la versione precedente della funzione e rimuovere le ALTER FUNCTION ... SET.

CREATE OR REPLACE FUNCTION public.profiles_guard_admin_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  allowed CONSTANT text[] := ARRAY[
    'full_name','first_name','last_name','birth_date','birth_place','nationality',
    'tax_code','age','avatar_url','professional_profile',
    'phone','phone_country_code','phone_number','phone_full','email',
    'residence_address','residence_street','residence_number','residence_city',
    'residence_postal_code','residence_province',
    'address','street','street_number','postal_code','province','province_code',
    'city','city_code','neighborhood','country','latitude','longitude',
    'access_restrictions','additional_directions','location_notes',
    'id_document_type','id_document_number','id_document_issuer',
    'id_document_issued_at','id_document_expires_at',
    'id_document_path','id_document_back_path',
    'primary_role','secondary_roles','experience_years','experience_level',
    'languages','spoken_languages','is_motorized','hourly_rate',
    'weekly_availability','hourly_availability','available_now_until',
    'work_area_mode','selected_zones','all_zones',
    'service_area_city','service_area_district','service_area_lat',
    'service_area_lng','service_area_radius_m',
    'business_name','venue_type','venue_type_other','price_range','employees_count',
    'opening_hours','busy_days','representative_age',
    'vat_number','vat_company_name','company_tax_code',
    'registered_office_address','registered_office_city',
    'registered_office_province','registered_office_postal_code',
    'business_status','pec_email','sdi_code',
    'contact_person_first_name','contact_person_last_name','contact_person_role',
    'contact_person_role_other','contact_person_phone','contact_person_email',
    'default_contact_person_name','default_license_requirement',
    'default_language_requirements','default_tattoos_allowed',
    'default_piercings_allowed','default_beard_allowed','default_required_skills',
    'default_dress_code_items','default_dress_code_notes',
    'default_arrival_advance_minutes','default_arrival_advance_reason',
    'default_settings_updated_at',
    'terms_accepted','profile_completed','updated_at','last_active_at',
    'whatsapp_connected'
  ];
  changed text[];
  blocked text[];
  jwt_role text;
BEGIN
  -- 1) funzioni backend autorizzate presenti nello stack di chiamata
  DECLARE stack text;
  BEGIN
    GET DIAGNOSTICS stack = PG_CONTEXT;
    IF stack ~ '(consume_credits|grant_credits|award_referral_credits|register_referral|delete_my_account|recompute_review_block|recompute_worker_penalty|recompute_worker_reputation|send_required_review_reminders|admin_set_moderation_hidden|handle_new_review|trg_clean_shift_after_penalty)\(' THEN
      RETURN NEW;
    END IF;
  END;

  -- 2) cascata da altri trigger backend
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  -- 3) service role / contesto senza utente (cron, backend, migrazioni)
  jwt_role := NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role';
  IF auth.uid() IS NULL OR jwt_role = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- 4) amministratori
  IF public.has_role(auth.uid(), 'admin') THEN
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
