CREATE TABLE public.auth_hook_invocations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  hook text NOT NULL,
  user_id uuid,
  signup_method text,
  decision text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.auth_hook_invocations TO authenticated;
GRANT ALL ON public.auth_hook_invocations TO service_role;
GRANT INSERT, SELECT ON public.auth_hook_invocations TO supabase_auth_admin;

ALTER TABLE public.auth_hook_invocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read auth hook invocations"
  ON public.auth_hook_invocations
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.password_verification_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid;
  _method text;
  _decision text;
BEGIN
  BEGIN
    _user_id := (event ->> 'user_id')::uuid;
  EXCEPTION WHEN others THEN
    _user_id := NULL;
  END;

  IF _user_id IS NOT NULL THEN
    SELECT signup_method INTO _method FROM public.profiles WHERE id = _user_id;
  END IF;

  -- Fail closed: solo gli account nati con email/password possono
  -- autenticarsi con password.
  IF _method = 'email' THEN
    _decision := 'continue';
  ELSE
    _decision := 'reject';
  END IF;

  INSERT INTO public.auth_hook_invocations (hook, user_id, signup_method, decision)
  VALUES ('password_verification_hook', _user_id, _method, _decision);

  IF _decision = 'continue' THEN
    RETURN jsonb_build_object('decision', 'continue');
  END IF;

  RETURN jsonb_build_object(
    'decision', 'reject',
    'message', 'Metodo di accesso non valido o credenziali non corrette.'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.password_verification_hook(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.password_verification_hook(jsonb) TO supabase_auth_admin;