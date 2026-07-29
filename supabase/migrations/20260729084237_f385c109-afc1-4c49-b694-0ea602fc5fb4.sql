CREATE OR REPLACE FUNCTION public.update_my_announcement_defaults(_patch jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  PERFORM public._apply_profile_self_patch(
    coalesce(_patch, '{}'::jsonb) || jsonb_build_object('default_settings_updated_at', now()),
    ARRAY[
      -- luogo predefinito
      'address','city','neighborhood','province','postal_code','country','latitude','longitude',
      'access_restrictions','additional_directions','location_notes',
      -- referente predefinito
      'contact_person_first_name','contact_person_last_name','contact_person_phone',
      'contact_person_email','contact_person_role','contact_person_role_other',
      'default_contact_person_name','default_arrival_advance_minutes','default_arrival_advance_reason',
      -- requisiti / dress code predefiniti
      'default_license_requirement','default_language_requirements','default_tattoos_allowed',
      'default_piercings_allowed','default_beard_allowed','default_required_skills',
      'default_dress_code_items','default_dress_code_notes',
      -- tipologia locale
      'venue_type','venue_type_other','price_range',
      'default_settings_updated_at'
    ]
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.update_my_announcement_defaults(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_my_announcement_defaults(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_my_announcement_defaults(jsonb) TO service_role;