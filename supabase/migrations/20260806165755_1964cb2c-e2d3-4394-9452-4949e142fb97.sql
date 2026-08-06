CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  meta jsonb := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  v_full  text := NULLIF(btrim(COALESCE(meta->>'full_name', meta->>'name', '')), '');
  v_first text := NULLIF(btrim(COALESCE(meta->>'first_name', meta->>'given_name', '')), '');
  v_last  text := NULLIF(btrim(COALESCE(meta->>'last_name',  meta->>'family_name', '')), '');
  v_provider text := lower(COALESCE(NEW.raw_app_meta_data->>'provider', 'email'));
  v_signup text;
  v_role_meta text := lower(NULLIF(btrim(COALESCE(meta->>'role','')), ''));
  v_role public.app_role;
BEGIN
  IF v_first IS NULL AND v_full IS NOT NULL THEN
    v_first := NULLIF(split_part(v_full, ' ', 1), '');
  END IF;
  IF v_last IS NULL AND v_full IS NOT NULL AND position(' ' in v_full) > 0 THEN
    v_last := NULLIF(btrim(substring(v_full from position(' ' in v_full) + 1)), '');
  END IF;

  v_signup := CASE
    WHEN v_provider IN ('email','google','apple','facebook') THEN v_provider
    WHEN v_provider = 'phone' THEN 'email'
    ELSE 'oauth'
  END;

  -- Solo ruoli applicativi scelti esplicitamente. 'admin' non è mai
  -- assegnabile dai metadati pubblici della registrazione.
  IF v_role_meta IN ('restaurant','worker') THEN
    v_role := v_role_meta::public.app_role;
  ELSE
    v_role := NULL;
  END IF;

  INSERT INTO public.profiles (id, email, full_name, first_name, last_name, signup_method, primary_role, role_claimed_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(v_full, btrim(concat_ws(' ', v_first, v_last)), ''),
    v_first,
    v_last,
    v_signup,
    v_role::text,
    CASE WHEN v_role IS NOT NULL THEN now() ELSE NULL END
  );

  -- Nessun fallback: senza ruolo esplicito l'account nasce SENZA riga in
  -- user_roles e deve passare dalla scelta ruolo esplicita.
  IF v_role IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, v_role);
  END IF;
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.claim_signup_role(_role text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_role public.app_role;
  v_existing public.app_role;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF lower(btrim(COALESCE(_role,''))) NOT IN ('restaurant','worker') THEN
    RAISE EXCEPTION 'invalid_role';
  END IF;
  v_role := lower(btrim(_role))::public.app_role;

  PERFORM 1 FROM public.profiles WHERE id = v_uid FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile_not_found';
  END IF;

  -- Il DB vince sempre: se esiste già un ruolo canonico non viene mai
  -- sovrascritto, il pending role del client viene semplicemente ignorato.
  SELECT role INTO v_existing
  FROM public.user_roles
  WHERE user_id = v_uid AND role IN ('admin','restaurant','worker')
  ORDER BY CASE role WHEN 'admin' THEN 0 WHEN 'restaurant' THEN 1 ELSE 2 END
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    UPDATE public.profiles
       SET role_claimed_at = COALESCE(role_claimed_at, now())
     WHERE id = v_uid;
    RETURN v_existing::text;
  END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (v_uid, v_role)
    ON CONFLICT (user_id, role) DO NOTHING;

  UPDATE public.profiles
     SET primary_role = COALESCE(primary_role, v_role::text),
         role_claimed_at = now(),
         updated_at = now()
   WHERE id = v_uid;

  RETURN v_role::text;
END; $function$;

REVOKE ALL ON FUNCTION public.claim_signup_role(text) FROM public;
GRANT EXECUTE ON FUNCTION public.claim_signup_role(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.enforce_profile_identity_complete()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF COALESCE(NEW.profile_completed, false) IS TRUE
     AND NOT public.has_role(NEW.id, 'admin')
     AND (NULLIF(btrim(COALESCE(NEW.first_name,'')), '') IS NULL
          OR NULLIF(btrim(COALESCE(NEW.last_name,'')), '') IS NULL) THEN
    RAISE EXCEPTION 'identity_incomplete: nome e cognome sono obbligatori per completare il profilo';
  END IF;
  RETURN NEW;
END; $function$;

DROP TRIGGER IF EXISTS trg_enforce_profile_identity_complete ON public.profiles;
CREATE TRIGGER trg_enforce_profile_identity_complete
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.enforce_profile_identity_complete();