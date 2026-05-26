REVOKE ALL ON FUNCTION public.enforce_phone_immutable_after_verification() FROM public;
REVOKE ALL ON FUNCTION public.enforce_phone_immutable_after_verification() FROM anon;
REVOKE ALL ON FUNCTION public.enforce_phone_immutable_after_verification() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_phone_immutable_after_verification() TO service_role;