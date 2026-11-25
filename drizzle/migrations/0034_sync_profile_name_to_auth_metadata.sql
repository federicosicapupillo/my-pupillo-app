CREATE OR REPLACE FUNCTION public.sync_profile_name_to_auth()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_first text := NULLIF(btrim(COALESCE(NEW.first_name,'')), '');
  v_last  text := NULLIF(btrim(COALESCE(NEW.last_name,'')), '');
  v_full  text := NULLIF(btrim(concat_ws(' ', v_first, v_last)), '');
BEGIN
  IF v_full IS NULL THEN v_full := NULLIF(btrim(COALESCE(NEW.full_name,'')), ''); END IF;
  IF v_full IS NULL THEN RETURN NEW; END IF;
  UPDATE auth.users SET raw_user_meta_data = COALESCE(raw_user_meta_data,'{}'::jsonb)
    || jsonb_strip_nulls(jsonb_build_object('name', v_full, 'full_name', v_full,
         'given_name', v_first, 'family_name', v_last))
  WHERE id = NEW.id;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.sync_profile_name_to_auth() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS profiles_sync_name_to_auth ON public.profiles;
CREATE TRIGGER profiles_sync_name_to_auth AFTER INSERT OR UPDATE OF first_name, last_name, full_name ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.sync_profile_name_to_auth();
UPDATE auth.users u SET raw_user_meta_data = COALESCE(u.raw_user_meta_data,'{}'::jsonb)
  || jsonb_strip_nulls(jsonb_build_object('name', x.full, 'full_name', x.full, 'given_name', x.f, 'family_name', x.l))
FROM (SELECT id, NULLIF(btrim(first_name),'') f, NULLIF(btrim(last_name),'') l,
        COALESCE(NULLIF(btrim(concat_ws(' ', NULLIF(btrim(first_name),''), NULLIF(btrim(last_name),''))),''), NULLIF(btrim(full_name),'')) full
      FROM public.profiles) x
WHERE x.id = u.id AND x.full IS NOT NULL;