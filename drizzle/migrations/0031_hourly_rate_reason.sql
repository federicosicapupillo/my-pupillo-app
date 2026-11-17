ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS hourly_rate_reason text;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_hourly_rate_reason_len CHECK (hourly_rate_reason IS NULL OR char_length(hourly_rate_reason) <= 300);

DO $mig$
DECLARE d text; opts text; v text;
BEGIN
  d := pg_get_functiondef('public.update_my_profile(jsonb)'::regprocedure);
  d := replace(d, '''experience_years'',''experience_level'',''hourly_rate'',''is_motorized'',', '''experience_years'',''experience_level'',''hourly_rate'',''hourly_rate_reason'',''is_motorized'',');
  EXECUTE d;
  d := pg_get_functiondef('public.profiles_guard_admin_columns()'::regprocedure);
  d := replace(d, '''languages'',''spoken_languages'',''is_motorized'',''hourly_rate'',', '''languages'',''spoken_languages'',''is_motorized'',''hourly_rate'',''hourly_rate_reason'',');
  EXECUTE d;
  SELECT array_to_string(reloptions, ', ') INTO opts FROM pg_class WHERE oid = 'public.public_profiles'::regclass;
  v := pg_get_viewdef('public.public_profiles'::regclass);
  v := regexp_replace(v, '\s+FROM profiles p', ', hourly_rate_reason FROM profiles p');
  v := regexp_replace(v, ';\s*$', '');
  EXECUTE 'CREATE OR REPLACE VIEW public.public_profiles' || CASE WHEN opts IS NOT NULL THEN ' WITH (' || opts || ')' ELSE '' END || ' AS ' || v;
END $mig$;