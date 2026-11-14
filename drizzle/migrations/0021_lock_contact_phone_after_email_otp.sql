ALTER TABLE public.profiles ADD COLUMN contact_phone_locked_at timestamptz;
COMMENT ON COLUMN public.profiles.contact_phone_locked_at IS 'Server-only permanent contact phone lock after email OTP; does not verify phone ownership.';
REVOKE UPDATE (contact_phone_locked_at) ON public.profiles FROM anon, authenticated;
UPDATE public.profiles SET contact_phone_locked_at = email_otp_verified_at WHERE email_otp_verified_at IS NOT NULL;
CREATE OR REPLACE FUNCTION public.enforce_phone_immutable_after_verification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF current_setting('pupillo.account_deletion', true) = 'on' AND NEW.is_deleted = true AND NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF COALESCE(OLD.phone_verified, false) OR OLD.contact_phone_locked_at IS NOT NULL OR OLD.email_otp_verified_at IS NOT NULL THEN
    IF COALESCE(NEW.phone_full, '') IS DISTINCT FROM COALESCE(OLD.phone_full, '')
       OR COALESCE(NEW.phone_number, '') IS DISTINCT FROM COALESCE(OLD.phone_number, '')
       OR COALESCE(NEW.phone_country_code, '') IS DISTINCT FROM COALESCE(OLD.phone_country_code, '')
       OR COALESCE(NEW.phone, '') IS DISTINCT FROM COALESCE(OLD.phone, '') THEN
      IF auth.role() = 'service_role' OR public.has_role(auth.uid(), 'admin'::public.app_role) THEN
        RETURN NEW;
      END IF;
      RAISE EXCEPTION 'Il numero di cellulare non può essere modificato dopo la conferma del codice.' USING ERRCODE = '42501';
    END IF;
  END IF;
  IF COALESCE(OLD.phone_verified, false) AND NEW.phone_verified = false THEN
    IF NOT (auth.role() = 'service_role' OR public.has_role(auth.uid(), 'admin'::public.app_role)) THEN
      NEW.phone_verified := OLD.phone_verified;
      NEW.phone_verified_at := OLD.phone_verified_at;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;