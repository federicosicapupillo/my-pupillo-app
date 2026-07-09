
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
BEGIN
  -- Se abbiamo solo full_name/name (tipico OAuth Google), deriva first/last splittando sul primo spazio.
  IF v_first IS NULL AND v_full IS NOT NULL THEN
    v_first := NULLIF(split_part(v_full, ' ', 1), '');
  END IF;
  IF v_last IS NULL AND v_full IS NOT NULL AND position(' ' in v_full) > 0 THEN
    v_last := NULLIF(btrim(substring(v_full from position(' ' in v_full) + 1)), '');
  END IF;

  INSERT INTO public.profiles (id, email, full_name, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(v_full, btrim(concat_ws(' ', v_first, v_last)), ''),
    v_first,
    v_last
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, COALESCE((meta->>'role')::public.app_role, 'worker'));
  RETURN NEW;
END; $function$;

-- Backfill profili esistenti privi di nome/cognome usando i metadati Google/OAuth
UPDATE public.profiles p
SET
  first_name = COALESCE(
    p.first_name,
    NULLIF(btrim(u.raw_user_meta_data->>'first_name'), ''),
    NULLIF(btrim(u.raw_user_meta_data->>'given_name'), ''),
    NULLIF(split_part(btrim(COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', '')), ' ', 1), '')
  ),
  last_name = COALESCE(
    p.last_name,
    NULLIF(btrim(u.raw_user_meta_data->>'last_name'), ''),
    NULLIF(btrim(u.raw_user_meta_data->>'family_name'), ''),
    CASE
      WHEN position(' ' in btrim(COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', ''))) > 0
        THEN NULLIF(btrim(substring(btrim(COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', '')) from position(' ' in btrim(COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', ''))) + 1)), '')
      ELSE NULL
    END
  ),
  full_name = COALESCE(
    NULLIF(btrim(p.full_name), ''),
    NULLIF(btrim(u.raw_user_meta_data->>'full_name'), ''),
    NULLIF(btrim(u.raw_user_meta_data->>'name'), ''),
    p.full_name
  )
FROM auth.users u
WHERE u.id = p.id
  AND (p.first_name IS NULL OR p.first_name = '' OR p.last_name IS NULL OR p.last_name = '');
