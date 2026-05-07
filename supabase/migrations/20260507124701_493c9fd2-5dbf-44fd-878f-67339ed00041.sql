
REVOKE EXECUTE ON FUNCTION public.create_shift_on_accept() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_application_insert() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_application_status() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_shift_status() FROM public, anon, authenticated;
