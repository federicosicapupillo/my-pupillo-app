
CREATE OR REPLACE FUNCTION public.enforce_phone_immutable_after_verification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only block changes when the user's phone is currently verified
  IF COALESCE(OLD.phone_verified, false) = true THEN
    IF COALESCE(NEW.phone_full, '') IS DISTINCT FROM COALESCE(OLD.phone_full, '')
       OR COALESCE(NEW.phone_number, '') IS DISTINCT FROM COALESCE(OLD.phone_number, '')
       OR COALESCE(NEW.phone_country_code, '') IS DISTINCT FROM COALESCE(OLD.phone_country_code, '')
       OR COALESCE(NEW.phone, '') IS DISTINCT FROM COALESCE(OLD.phone, '') THEN
      -- Allow service role / admin to bypass (for support requests)
      IF auth.role() = 'service_role' OR public.has_role(auth.uid(), 'admin'::app_role) THEN
        RETURN NEW;
      END IF;
      RAISE EXCEPTION 'Il numero è già verificato. Per modificarlo contatta il supporto clienti.';
    END IF;

    -- Also prevent unsetting the verification flag from the client
    IF NEW.phone_verified = false THEN
      IF NOT (auth.role() = 'service_role' OR public.has_role(auth.uid(), 'admin'::app_role)) THEN
        NEW.phone_verified := OLD.phone_verified;
        NEW.phone_verified_at := OLD.phone_verified_at;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_enforce_phone_immutable ON public.profiles;
CREATE TRIGGER profiles_enforce_phone_immutable
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.enforce_phone_immutable_after_verification();
