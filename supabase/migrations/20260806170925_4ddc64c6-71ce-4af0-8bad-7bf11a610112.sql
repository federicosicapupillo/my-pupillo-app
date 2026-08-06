CREATE OR REPLACE FUNCTION public.resolve_current_user_role()
 RETURNS TABLE(user_id uuid, email text, profile_role text, user_role text, metadata_role text, final_role text, final_route text, profile_error text, user_roles_error text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _email text := NULL;
  _profile_role text := NULL;
  _user_role text := NULL;
  _metadata_role text := NULL;
  _final_role text := NULL;
BEGIN
  IF _uid IS NULL THEN
    RETURN;
  END IF;

  SELECT au.email, au.raw_user_meta_data->>'role'
    INTO _email, _metadata_role
    FROM auth.users au
   WHERE au.id = _uid;

  SELECT p.primary_role
    INTO _profile_role
    FROM public.profiles p
   WHERE p.id = _uid;

  SELECT ur.role::text
    INTO _user_role
    FROM public.user_roles ur
   WHERE ur.user_id = _uid
   ORDER BY CASE ur.role::text
      WHEN 'admin' THEN 1
      WHEN 'restaurant' THEN 2
      WHEN 'worker' THEN 3
      ELSE 4
    END
   LIMIT 1;

  _final_role := CASE lower(trim(coalesce(_user_role, '')))
    WHEN 'admin' THEN 'admin'
    WHEN 'restaurant' THEN 'restaurant'
    WHEN 'ristoratore' THEN 'restaurant'
    WHEN 'worker' THEN 'worker'
    WHEN 'lavoratore' THEN 'worker'
    ELSE NULL
  END;

  -- Seconda (e ultima) fonte: primary_role, scritto solo da handle_new_user /
  -- claim_signup_role. I metadati pubblici della registrazione NON sono una
  -- fonte di verita': sono controllabili dal client e permetterebbero di
  -- auto-dichiararsi 'admin'. Restano esposti solo a fini diagnostici.
  IF _final_role IS NULL THEN
    _final_role := CASE lower(trim(coalesce(_profile_role, '')))
      WHEN 'admin' THEN 'admin'
      WHEN 'restaurant' THEN 'restaurant'
      WHEN 'ristoratore' THEN 'restaurant'
      WHEN 'worker' THEN 'worker'
      WHEN 'lavoratore' THEN 'worker'
      ELSE NULL
    END;
  END IF;

  RETURN QUERY SELECT
    _uid,
    _email,
    _profile_role,
    _user_role,
    _metadata_role,
    _final_role,
    CASE _final_role
      WHEN 'admin' THEN '/admin'
      WHEN 'restaurant' THEN '/dashboard'
      WHEN 'worker' THEN '/jobs'
      ELSE '/choose-role'
    END,
    NULL::text,
    NULL::text;
END;
$function$;