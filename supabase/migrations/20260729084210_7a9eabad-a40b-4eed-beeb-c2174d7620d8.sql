CREATE OR REPLACE FUNCTION public.set_my_avatar(_path text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  PERFORM public._apply_profile_self_patch(jsonb_build_object('avatar_url', _path), ARRAY['avatar_url']);
END;
$fn$;

REVOKE ALL ON FUNCTION public.set_my_avatar(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_my_avatar(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_my_avatar(text) TO service_role;

CREATE OR REPLACE FUNCTION public.set_my_available_now(_until timestamptz)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  _uid uuid := auth.uid();
  _v timestamptz := _until;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  IF _v IS NOT NULL THEN
    IF _v <= now() THEN
      _v := NULL;
    ELSIF _v > now() + interval '24 hours' THEN
      _v := now() + interval '24 hours';
    END IF;
  END IF;
  UPDATE public.profiles
     SET available_now_until = _v, updated_at = now()
   WHERE id = _uid;
  RETURN _v;
END;
$fn$;

REVOKE ALL ON FUNCTION public.set_my_available_now(timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_my_available_now(timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_my_available_now(timestamptz) TO service_role;