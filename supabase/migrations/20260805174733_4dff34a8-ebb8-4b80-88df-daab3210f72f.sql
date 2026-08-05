-- 1) Immutabilità di signup_method: nessuna scrittura applicativa può cambiarlo.
CREATE OR REPLACE FUNCTION public.profiles_guard_signup_method()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.signup_method IS DISTINCT FROM OLD.signup_method THEN
    IF current_user NOT IN ('postgres', 'supabase_admin') THEN
      RAISE EXCEPTION 'signup_method is immutable' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_00_profiles_guard_signup_method ON public.profiles;
CREATE TRIGGER trg_00_profiles_guard_signup_method
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.profiles_guard_signup_method();

-- 2) Password Verification Hook: blocca il login con password per gli account social.
CREATE OR REPLACE FUNCTION public.password_verification_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_method text;
BEGIN
  BEGIN
    v_uid := (event->>'user_id')::uuid;
  EXCEPTION WHEN others THEN
    v_uid := NULL;
  END;

  IF v_uid IS NULL THEN
    RETURN jsonb_build_object(
      'decision', 'reject',
      'message', 'Metodo di accesso non valido o credenziali non corrette.'
    );
  END IF;

  SELECT lower(btrim(coalesce(p.signup_method, ''))) INTO v_method
  FROM public.profiles p
  WHERE p.id = v_uid;

  -- fail closed: metodo assente, ambiguo o social => nessun login con password
  IF v_method IS DISTINCT FROM 'email' THEN
    RETURN jsonb_build_object(
      'decision', 'reject',
      'message', 'Metodo di accesso non valido o credenziali non corrette.'
    );
  END IF;

  RETURN jsonb_build_object('decision', 'continue');
END;
$$;

REVOKE ALL ON FUNCTION public.password_verification_hook(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.password_verification_hook(jsonb) TO supabase_auth_admin;

-- 3) RPC minima e sicura per l'app: solo il proprio metodo di registrazione.
CREATE OR REPLACE FUNCTION public.my_signup_method()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT lower(btrim(coalesce(p.signup_method, '')))
  FROM public.profiles p
  WHERE p.id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.my_signup_method() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_signup_method() TO authenticated;