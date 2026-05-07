
REVOKE EXECUTE ON FUNCTION public.has_active_subscription(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.consume_credits(integer, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.grant_credits(uuid, integer, public.credit_tx_kind, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_active_subscription(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.consume_credits(integer, text, text) TO authenticated;
