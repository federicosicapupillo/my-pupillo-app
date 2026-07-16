CREATE OR REPLACE FUNCTION public.register_referral(_new_user uuid, _code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referrer uuid;
  v_normalized text := upper(trim(_code));
  v_caller uuid := auth.uid();
BEGIN
  -- Sicurezza: usiamo SEMPRE l'utente autenticato come "referred".
  -- L'argomento _new_user è mantenuto per compatibilità di firma ma ignorato
  -- se non coincide col chiamante, così un utente non può registrare un referral
  -- a nome di un altro.
  IF v_caller IS NULL THEN
    RETURN NULL;
  END IF;
  IF _new_user IS NOT NULL AND _new_user <> v_caller THEN
    RETURN NULL;
  END IF;

  IF _code IS NULL OR length(v_normalized) < 3 THEN
    RETURN NULL;
  END IF;

  SELECT id INTO v_referrer FROM public.profiles WHERE upper(referral_code) = v_normalized LIMIT 1;
  IF v_referrer IS NULL OR v_referrer = v_caller THEN
    RETURN NULL;
  END IF;

  IF NOT public.is_referral_enabled_for_user(v_referrer) THEN
    RETURN NULL;
  END IF;

  UPDATE public.profiles
     SET referred_by_user_id = v_referrer
   WHERE id = v_caller AND referred_by_user_id IS NULL;

  INSERT INTO public.referral_invites (referrer_user_id, referred_user_id, referral_code, status)
  VALUES (v_referrer, v_caller, v_normalized, 'registered')
  ON CONFLICT (referred_user_id) DO NOTHING;

  RETURN v_referrer;
END;
$$;

REVOKE ALL ON FUNCTION public.register_referral(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_referral(uuid, text) TO authenticated, service_role;