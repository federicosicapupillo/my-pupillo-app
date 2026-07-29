CREATE OR REPLACE FUNCTION public.admin_set_account_status(_user_id uuid, _status text, _reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  _actor uuid := auth.uid();
BEGIN
  IF _actor IS NULL OR NOT public.has_role(_actor, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Admin role required' USING ERRCODE = '42501';
  END IF;
  IF _status NOT IN ('active','suspended','pending') THEN
    RAISE EXCEPTION 'Invalid account status %', _status USING ERRCODE = '22023';
  END IF;

  UPDATE public.profiles
     SET account_status = _status::account_status, updated_at = now()
   WHERE id = _user_id;

  INSERT INTO public.admin_audit_log (actor, action, target_user, reason, metadata)
  VALUES (_actor, 'set_account_status', _user_id, _reason, jsonb_build_object('status', _status));
END;
$fn$;

REVOKE ALL ON FUNCTION public.admin_set_account_status(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_account_status(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_account_status(uuid, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_set_vat_verified(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  _actor uuid := auth.uid();
BEGIN
  IF _actor IS NULL OR NOT public.has_role(_actor, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Admin role required' USING ERRCODE = '42501';
  END IF;

  UPDATE public.profiles
     SET vat_status = 'valid'::vat_status, vat_verified_at = now(), updated_at = now()
   WHERE id = _user_id;

  INSERT INTO public.admin_audit_log (actor, action, target_user, metadata)
  VALUES (_actor, 'set_vat_verified', _user_id, '{}'::jsonb);
END;
$fn$;

REVOKE ALL ON FUNCTION public.admin_set_vat_verified(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_vat_verified(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_vat_verified(uuid) TO service_role;