CREATE OR REPLACE FUNCTION public.update_my_profile(_patch jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public._apply_profile_self_patch(_patch, ARRAY[
    'full_name','first_name','last_name','birth_date','birth_place','nationality','tax_code',
    'age','representative_age','short_bio','professional_profile','avatar_url',
    'phone','phone_country_code','phone_number','phone_full',
    'residence_address','residence_street','residence_number','residence_city',
    'residence_postal_code','residence_province',
    'id_document_path','id_document_back_path','id_document_type','id_document_number',
    'id_document_issued_at','id_document_expires_at','id_document_issuer',
    'work_area_mode','service_area_city','service_area_district','service_area_radius_m',
    'service_area_lat','service_area_lng','selected_zones','all_zones',
    'weekly_availability','hourly_availability',
    'languages','spoken_languages','primary_role','secondary_roles',
    'experience_years','experience_level','hourly_rate','is_motorized',
    'business_name','vat_number','venue_type','venue_type_other','price_range',
    'employees_count','opening_hours','busy_days',
    'company_tax_code','registered_office_address','registered_office_city',
    'registered_office_province','registered_office_postal_code','pec_email','sdi_code',
    'address','street','street_number','neighborhood','city','province','province_code','city_code',
    'postal_code','country','latitude','longitude',
    'access_restrictions','additional_directions','location_notes',
    'contact_person_first_name','contact_person_last_name','contact_person_role',
    'contact_person_role_other','contact_person_phone','contact_person_email',
    'terms_accepted','terms_version','terms_accepted_at','profile_completed'
  ]);
END;
$function$;