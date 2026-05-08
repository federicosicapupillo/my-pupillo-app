
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referral_code text UNIQUE,
  ADD COLUMN IF NOT EXISTS referred_by_user_id uuid,
  ADD COLUMN IF NOT EXISTS referral_credits_earned integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_profiles_referred_by ON public.profiles(referred_by_user_id);

CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE candidate text; exists_already boolean;
BEGIN
  LOOP
    candidate := 'PUPILLO-' || upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 6));
    SELECT EXISTS(SELECT 1 FROM public.profiles WHERE referral_code = candidate) INTO exists_already;
    EXIT WHEN NOT exists_already;
  END LOOP;
  RETURN candidate;
END; $$;

-- Backfill bypassing other before-update triggers (provincia/age/vat) for existing rows.
SET LOCAL session_replication_role = 'replica';
UPDATE public.profiles
SET referral_code = public.generate_referral_code()
WHERE referral_code IS NULL;
SET LOCAL session_replication_role = 'origin';

CREATE OR REPLACE FUNCTION public.set_referral_code_on_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := public.generate_referral_code();
  END IF;
  IF NEW.referred_by_user_id IS NOT NULL AND NEW.referred_by_user_id = NEW.id THEN
    NEW.referred_by_user_id := NULL;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS profiles_set_referral_code ON public.profiles;
CREATE TRIGGER profiles_set_referral_code
BEFORE INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_referral_code_on_insert();

DO $$ BEGIN
  CREATE TYPE public.referral_status AS ENUM ('pending','registered','verified','completed','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.referral_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id uuid NOT NULL,
  referred_user_id uuid,
  referral_code text NOT NULL,
  referred_email text,
  status public.referral_status NOT NULL DEFAULT 'pending',
  credits_awarded boolean NOT NULL DEFAULT false,
  credits_amount integer NOT NULL DEFAULT 5,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_referral_invites_referred_user
  ON public.referral_invites(referred_user_id) WHERE referred_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_referral_invites_referrer ON public.referral_invites(referrer_user_id);

ALTER TABLE public.referral_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own referrals" ON public.referral_invites;
CREATE POLICY "Users view own referrals" ON public.referral_invites
  FOR SELECT TO authenticated
  USING (referrer_user_id = auth.uid() OR referred_user_id = auth.uid() OR has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "Service role manages referrals" ON public.referral_invites;
CREATE POLICY "Service role manages referrals" ON public.referral_invites
  FOR ALL TO public USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Admins manage referrals" ON public.referral_invites;
CREATE POLICY "Admins manage referrals" ON public.referral_invites
  FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.award_referral_credits(_referred_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_referrer uuid; v_already boolean; v_invite_id uuid; v_amount integer := 5; v_complete boolean;
BEGIN
  SELECT referred_by_user_id,
         (COALESCE(profile_completed,false) AND COALESCE(phone_verified,false))
    INTO v_referrer, v_complete
    FROM public.profiles WHERE id = _referred_user_id;

  IF v_referrer IS NULL OR NOT v_complete OR v_referrer = _referred_user_id THEN RETURN; END IF;

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
END; $$;

CREATE OR REPLACE FUNCTION public.trigger_referral_award()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.referred_by_user_id IS NOT NULL
     AND COALESCE(NEW.profile_completed,false) = true
     AND COALESCE(NEW.phone_verified,false) = true
     AND (
        COALESCE(OLD.profile_completed,false) IS DISTINCT FROM NEW.profile_completed
        OR COALESCE(OLD.phone_verified,false) IS DISTINCT FROM NEW.phone_verified
     ) THEN
    PERFORM public.award_referral_credits(NEW.id);
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS profiles_referral_award ON public.profiles;
CREATE TRIGGER profiles_referral_award
AFTER UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.trigger_referral_award();

CREATE OR REPLACE FUNCTION public.register_referral(_new_user uuid, _code text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_referrer uuid; v_normalized text := upper(trim(_code));
BEGIN
  IF _new_user IS NULL OR _code IS NULL OR length(v_normalized) < 3 THEN RETURN NULL; END IF;
  SELECT id INTO v_referrer FROM public.profiles WHERE upper(referral_code) = v_normalized LIMIT 1;
  IF v_referrer IS NULL OR v_referrer = _new_user THEN RETURN NULL; END IF;

  UPDATE public.profiles
     SET referred_by_user_id = v_referrer
   WHERE id = _new_user AND referred_by_user_id IS NULL;

  INSERT INTO public.referral_invites (referrer_user_id, referred_user_id, referral_code, status)
  VALUES (v_referrer, _new_user, v_normalized, 'registered')
  ON CONFLICT (referred_user_id) DO NOTHING;

  RETURN v_referrer;
END; $$;
