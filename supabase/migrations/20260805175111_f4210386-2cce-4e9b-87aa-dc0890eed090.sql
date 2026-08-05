CREATE OR REPLACE FUNCTION public.profiles_guard_signup_method()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.signup_method IS DISTINCT FROM OLD.signup_method THEN
    -- Blocca qualunque scrittura proveniente dalla Data API (anon,
    -- authenticated, service_role) e qualunque ruolo applicativo.
    IF current_setting('request.jwt.claims', true) IS NOT NULL
       OR current_user IN ('anon', 'authenticated', 'service_role', 'authenticator') THEN
      RAISE EXCEPTION 'signup_method is immutable' USING ERRCODE = '42501';
    END IF;
    IF current_user NOT IN ('postgres', 'supabase_admin') THEN
      RAISE EXCEPTION 'signup_method is immutable' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- ripristina il valore canonico dell'account di audit alterato durante i test
UPDATE public.profiles
SET signup_method = 'google'
WHERE id = '37e29f81-43c4-485e-975a-0ce2b216acf0';