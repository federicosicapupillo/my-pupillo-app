ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_code_submitted_at timestamptz;
COMMENT ON COLUMN public.profiles.referral_code_submitted_at IS 'Quando l''utente si è iscritto con un codice invito (indicatore per il monitoraggio, anche se il collegamento è stato scartato).';

CREATE OR REPLACE FUNCTION public._link_referral(_new_user uuid, _code text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_norm text := upper(btrim(COALESCE(_code,'')));
  v_ref public.profiles%ROWTYPE;
  v_me public.profiles%ROWTYPE;
BEGIN
  IF _new_user IS NULL THEN RETURN 'no_session'; END IF;
  IF length(v_norm) < 3 OR length(v_norm) > 64 THEN RETURN 'invalid_code'; END IF;
  SELECT * INTO v_me FROM public.profiles WHERE id = _new_user;
  IF NOT FOUND THEN RETURN 'no_profile'; END IF;
  UPDATE public.profiles SET referral_code_submitted_at = COALESCE(referral_code_submitted_at, now()) WHERE id = _new_user;
  IF v_me.referred_by_user_id IS NOT NULL THEN RETURN 'already_linked'; END IF;
  IF v_me.created_at < now() - interval '24 hours' THEN RETURN 'too_late'; END IF;
  SELECT * INTO v_ref FROM public.profiles WHERE upper(referral_code) = v_norm LIMIT 1;
  IF NOT FOUND THEN RETURN 'invalid_code'; END IF;
  IF v_ref.id = _new_user THEN RETURN 'self'; END IF;
  IF COALESCE(v_ref.is_deleted,false) OR v_ref.account_status::text IN ('suspended','banned','deleted') THEN RETURN 'referrer_inactive'; END IF;
  IF v_me.email IS NOT NULL AND v_ref.email IS NOT NULL AND lower(btrim(v_me.email)) = lower(btrim(v_ref.email)) THEN RETURN 'self'; END IF;
  IF v_me.phone_full IS NOT NULL AND v_ref.phone_full IS NOT NULL AND v_me.phone_full = v_ref.phone_full THEN RETURN 'self'; END IF;
  IF EXISTS (SELECT 1 FROM public.referral_invites WHERE referred_user_id = _new_user) THEN RETURN 'already_linked'; END IF;
  UPDATE public.profiles SET referred_by_user_id = v_ref.id WHERE id = _new_user AND referred_by_user_id IS NULL;
  INSERT INTO public.referral_invites (referrer_user_id, referred_user_id, referral_code, status)
  VALUES (v_ref.id, _new_user, v_norm, 'registered') ON CONFLICT (referred_user_id) DO NOTHING;
  RETURN 'ok';
END; $$;
REVOKE ALL ON FUNCTION public._link_referral(uuid, text) FROM PUBLIC, anon, authenticated;

DROP FUNCTION IF EXISTS public.register_referral(uuid, text);
CREATE FUNCTION public.register_referral(_new_user uuid, _code text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_caller uuid := auth.uid();
BEGIN
  IF v_caller IS NULL THEN RETURN 'no_session'; END IF;
  IF _new_user IS NOT NULL AND _new_user <> v_caller THEN RETURN 'no_session'; END IF;
  RETURN public._link_referral(v_caller, _code);
END; $$;
REVOKE ALL ON FUNCTION public.register_referral(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_referral(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
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
  v_ref_code text := NULLIF(btrim(COALESCE(meta->>'referral_code','')), '');
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

  IF v_role_meta IN ('restaurant','worker') THEN
    v_role := v_role_meta::public.app_role;
  ELSE
    v_role := NULL;
  END IF;

  INSERT INTO public.profiles (id, email, full_name, first_name, last_name, signup_method, primary_role, role_claimed_at)
  VALUES (
    NEW.id, NEW.email,
    COALESCE(v_full, btrim(concat_ws(' ', v_first, v_last)), ''),
    v_first, v_last, v_signup, v_role::text,
    CASE WHEN v_role IS NOT NULL THEN now() ELSE NULL END
  );

  IF v_role IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, v_role);
  END IF;

  -- Presenta un amico: il collegamento non deve MAI bloccare l'iscrizione.
  IF v_ref_code IS NOT NULL THEN
    BEGIN
      PERFORM public._link_referral(NEW.id, v_ref_code);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '[referral] link failed for %: %', NEW.id, SQLERRM;
    END;
  END IF;
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.award_referral_credits(_referred_user_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_referrer uuid;
  v_already boolean;
  v_invite_id uuid;
  v_amount integer := 5;
  v_complete boolean;
  v_my_phone text;
BEGIN
  SELECT referred_by_user_id,
         (COALESCE(profile_completed,false) AND COALESCE(phone_verified,false)),
         phone_full
    INTO v_referrer, v_complete, v_my_phone
    FROM public.profiles WHERE id = _referred_user_id;

  IF v_referrer IS NULL OR NOT v_complete OR v_referrer = _referred_user_id THEN
    RETURN;
  END IF;

  -- Account doppio: stesso telefono dell'invitante.
  IF v_my_phone IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.profiles WHERE id = v_referrer AND phone_full = v_my_phone
  ) THEN
    RETURN;
  END IF;

  IF NOT public.is_referral_enabled_for_user(v_referrer) THEN
    RETURN;
  END IF;

  SELECT id, credits_awarded INTO v_invite_id, v_already
    FROM public.referral_invites WHERE referred_user_id = _referred_user_id LIMIT 1;

  IF v_already THEN RETURN; END IF;

  IF v_invite_id IS NULL THEN
    INSERT INTO public.referral_invites (referrer_user_id, referred_user_id, referral_code, status, credits_awarded, credits_amount, completed_at)
    VALUES (v_referrer, _referred_user_id,
           COALESCE((SELECT referral_code FROM public.profiles WHERE id = v_referrer), 'UNKNOWN'),
           'completed', true, v_amount, now())
    RETURNING id INTO v_invite_id;
  ELSE
    UPDATE public.referral_invites
       SET status = 'completed', credits_awarded = true, completed_at = now()
     WHERE id = v_invite_id;
  END IF;

  PERFORM public.grant_credits(v_referrer, v_amount, 'referral'::credit_tx_kind, 'Bonus presenta un amico', v_invite_id::text);

  UPDATE public.profiles
     SET referral_credits_earned = COALESCE(referral_credits_earned,0) + v_amount
   WHERE id = v_referrer;
END;
$function$;