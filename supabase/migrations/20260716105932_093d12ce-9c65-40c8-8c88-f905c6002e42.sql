-- Seed dei due flag (idempotente, non sovrascrive configurazioni esistenti)
INSERT INTO public.feature_flags (key, enabled, scope, description) VALUES
  ('worker_referral_enabled', true, 'global',
   'Mostra o nasconde la funzionalità "Presenta un amico" per gli utenti con ruolo lavoratore.'),
  ('restaurant_referral_enabled', true, 'global',
   'Mostra o nasconde la funzionalità "Presenta un amico" per gli utenti con ruolo ristoratore.')
ON CONFLICT (key) DO NOTHING;

-- Helper: flag "referral" abilitato per l'utente indicato (in base al suo ruolo)
CREATE OR REPLACE FUNCTION public.is_referral_enabled_for_user(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_worker boolean;
  v_restaurant boolean;
BEGIN
  IF _user_id IS NULL THEN
    RETURN false;
  END IF;

  v_worker := public.has_role(_user_id, 'worker'::app_role);
  v_restaurant := public.has_role(_user_id, 'restaurant'::app_role);

  IF v_worker THEN
    RETURN COALESCE((SELECT enabled FROM public.feature_flags WHERE key = 'worker_referral_enabled'), false);
  ELSIF v_restaurant THEN
    RETURN COALESCE((SELECT enabled FROM public.feature_flags WHERE key = 'restaurant_referral_enabled'), false);
  END IF;

  -- Ruoli diversi (admin o non definito): nessun referral consumer
  RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_referral_enabled_for_user(uuid) TO authenticated, anon, service_role;

-- Blocca la registrazione del referral quando il flag del ruolo del referente è OFF.
-- Il link continua a portare alla registrazione: l'account viene creato normalmente,
-- ma non viene creato alcun invito né alcun bonus verrà accreditato.
CREATE OR REPLACE FUNCTION public.register_referral(_new_user uuid, _code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referrer uuid;
  v_normalized text := upper(trim(_code));
BEGIN
  IF _new_user IS NULL OR _code IS NULL OR length(v_normalized) < 3 THEN
    RETURN NULL;
  END IF;

  SELECT id INTO v_referrer FROM public.profiles WHERE upper(referral_code) = v_normalized LIMIT 1;
  IF v_referrer IS NULL OR v_referrer = _new_user THEN
    RETURN NULL;
  END IF;

  -- Feature flag gate lato server, basato sul ruolo del REFERENTE
  IF NOT public.is_referral_enabled_for_user(v_referrer) THEN
    RETURN NULL;
  END IF;

  UPDATE public.profiles
     SET referred_by_user_id = v_referrer
   WHERE id = _new_user AND referred_by_user_id IS NULL;

  INSERT INTO public.referral_invites (referrer_user_id, referred_user_id, referral_code, status)
  VALUES (v_referrer, _new_user, v_normalized, 'registered')
  ON CONFLICT (referred_user_id) DO NOTHING;

  RETURN v_referrer;
END;
$$;

-- Blocca l'accredito dei crediti bonus quando il flag del ruolo del referente è OFF.
-- Non modifica gli inviti/i crediti già assegnati in passato.
CREATE OR REPLACE FUNCTION public.award_referral_credits(_referred_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referrer uuid;
  v_already boolean;
  v_invite_id uuid;
  v_amount integer := 5;
  v_complete boolean;
BEGIN
  SELECT referred_by_user_id,
         (COALESCE(profile_completed,false) AND COALESCE(phone_verified,false))
    INTO v_referrer, v_complete
    FROM public.profiles WHERE id = _referred_user_id;

  IF v_referrer IS NULL OR NOT v_complete OR v_referrer = _referred_user_id THEN
    RETURN;
  END IF;

  -- Feature flag gate lato server, basato sul ruolo del REFERENTE
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
$$;
