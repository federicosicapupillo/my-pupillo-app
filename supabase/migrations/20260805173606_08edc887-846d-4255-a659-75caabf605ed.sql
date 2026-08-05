ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS signup_method text;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_signup_method_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_signup_method_check
  CHECK (signup_method IS NULL OR signup_method IN ('email','google','apple','facebook','oauth'));

-- Backfill dalla prima identità creata (fonte: metodo originario di registrazione)
WITH first_identity AS (
  SELECT DISTINCT ON (i.user_id) i.user_id, lower(i.provider) AS provider
  FROM auth.identities i
  ORDER BY i.user_id, i.created_at ASC
)
UPDATE public.profiles p
SET signup_method = CASE
  WHEN fi.provider IN ('email','google','apple','facebook') THEN fi.provider
  WHEN fi.provider = 'phone' THEN 'email'
  ELSE 'oauth'
END
FROM first_identity fi
WHERE fi.user_id = p.id AND p.signup_method IS NULL;

-- Fallback per profili senza identità: usa il provider registrato su auth.users
UPDATE public.profiles p
SET signup_method = CASE
  WHEN lower(COALESCE(u.raw_app_meta_data->>'provider','email')) IN ('email','google','apple','facebook')
    THEN lower(COALESCE(u.raw_app_meta_data->>'provider','email'))
  ELSE 'oauth'
END
FROM auth.users u
WHERE u.id = p.id AND p.signup_method IS NULL;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  meta jsonb := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  v_full  text := NULLIF(btrim(COALESCE(meta->>'full_name', meta->>'name', '')), '');
  v_first text := NULLIF(btrim(COALESCE(meta->>'first_name', meta->>'given_name', '')), '');
  v_last  text := NULLIF(btrim(COALESCE(meta->>'last_name',  meta->>'family_name', '')), '');
  v_provider text := lower(COALESCE(NEW.raw_app_meta_data->>'provider', 'email'));
  v_signup text;
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

  INSERT INTO public.profiles (id, email, full_name, first_name, last_name, signup_method)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(v_full, btrim(concat_ws(' ', v_first, v_last)), ''),
    v_first,
    v_last,
    v_signup
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, COALESCE((meta->>'role')::public.app_role, 'worker'));
  RETURN NEW;
END; $function$;