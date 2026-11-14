ALTER TABLE public.profiles ADD COLUMN email_otp_verified_at timestamptz, ADD COLUMN email_otp_verified_address text;
COMMENT ON COLUMN public.profiles.email_otp_verified_at IS 'Server-only completion of Cloud Auth email OTP; never verifies phone ownership.';
REVOKE UPDATE (email_otp_verified_at, email_otp_verified_address) ON public.profiles FROM anon, authenticated;
CREATE OR REPLACE FUNCTION public.guard_onboarding_email_otp() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    NEW.email_otp_verified_at := NULL;
    NEW.email_otp_verified_address := NULL;
  END IF;
  IF NEW.profile_completed IS TRUE AND OLD.profile_completed IS NOT TRUE AND NOT public.has_role(NEW.id, 'admin') AND NOT COALESCE(NEW.phone_verified, false) AND (NEW.email_otp_verified_at IS NULL OR NEW.email_otp_verified_address IS DISTINCT FROM NEW.email) THEN
    RAISE EXCEPTION 'Conferma il codice ricevuto via email prima di completare il profilo.';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_guard_onboarding_email_otp BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.guard_onboarding_email_otp();
REVOKE ALL ON FUNCTION public.guard_onboarding_email_otp() FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE FUNCTION public.get_counterparty_phone(other_user_id uuid) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_phone text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.shifts WHERE restaurant_id=auth.uid() AND worker_id=other_user_id AND status IN ('scheduled','completed')) THEN RETURN NULL; END IF;
  SELECT p.phone_full INTO v_phone FROM public.profiles p WHERE p.id=other_user_id AND p.is_deleted IS NOT TRUE AND (p.phone_verified IS TRUE OR (p.profile_completed IS TRUE AND p.email_otp_verified_at IS NOT NULL AND p.email_otp_verified_address=p.email)) AND p.phone_full IS NOT NULL;
  RETURN v_phone;
END; $$;