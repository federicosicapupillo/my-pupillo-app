CREATE OR REPLACE FUNCTION public.sync_profile_name_to_auth()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_first text := NULLIF(btrim(COALESCE(NEW.first_name,'')), '');
  v_last  text := NULLIF(btrim(COALESCE(NEW.last_name,'')), '');
  v_full  text := NULLIF(btrim(concat_ws(' ', v_first, v_last)), '');
  v_pic   text := NULL;
BEGIN
  IF v_full IS NULL THEN v_full := NULLIF(btrim(COALESCE(NEW.full_name,'')), ''); END IF;
  IF NEW.avatar_url IS NOT NULL AND NEW.avatar_url ~* ('^' || NEW.id::text || '/(avatar-[0-9]+|moderated/[0-9a-f-]{36})\.(jpe?g|png|webp)$') THEN
    v_pic := 'https://pupillo.life/api/public/avatar/' || NEW.id::text;
  END IF;
  IF v_full IS NULL AND v_pic IS NULL THEN RETURN NEW; END IF;
  UPDATE auth.users SET raw_user_meta_data = COALESCE(raw_user_meta_data,'{}'::jsonb)
    || jsonb_strip_nulls(jsonb_build_object('name', v_full, 'full_name', v_full,
         'given_name', v_first, 'family_name', v_last, 'picture', v_pic, 'avatar_url', v_pic))
  WHERE id = NEW.id;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.sync_profile_name_to_auth() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS profiles_sync_name_to_auth ON public.profiles;
CREATE TRIGGER profiles_sync_name_to_auth AFTER INSERT OR UPDATE OF first_name, last_name, full_name, avatar_url ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.sync_profile_name_to_auth();
UPDATE auth.users u SET raw_user_meta_data = COALESCE(u.raw_user_meta_data,'{}'::jsonb)
  || jsonb_strip_nulls(jsonb_build_object('name', x.full, 'full_name', x.full, 'given_name', x.f, 'family_name', x.l, 'picture', x.pic, 'avatar_url', x.pic))
FROM (SELECT id, NULLIF(btrim(first_name),'') f, NULLIF(btrim(last_name),'') l,
        COALESCE(NULLIF(btrim(concat_ws(' ', NULLIF(btrim(first_name),''), NULLIF(btrim(last_name),''))),''), NULLIF(btrim(full_name),'')) full,
        CASE WHEN avatar_url ~* ('^' || id::text || '/(avatar-[0-9]+|moderated/[0-9a-f-]{36})\.(jpe?g|png|webp)$')
             THEN 'https://pupillo.life/api/public/avatar/' || id::text END pic
      FROM public.profiles) x
WHERE x.id = u.id AND (x.full IS NOT NULL OR x.pic IS NOT NULL);