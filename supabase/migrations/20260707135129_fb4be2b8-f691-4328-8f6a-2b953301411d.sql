CREATE OR REPLACE FUNCTION public.consume_credits(_amount integer, _reason text, _reference_id text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  current_credits integer;
  new_balance integer;
  already_charged boolean;
  payments_on boolean;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;

  -- Anti double-charge: MUST stay first, before the payments branch, so
  -- retries in either mode (paid or free) never duplicate a transaction.
  IF _reference_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.credit_transactions
      WHERE user_id = uid
        AND reason = _reason
        AND reference_id = _reference_id
        AND kind IN ('consume','plan_bonus')
    ) INTO already_charged;
    IF already_charged THEN
      RETURN true;
    END IF;
  END IF;

  -- Payments gate: when the 'payments_enabled' feature flag is OFF, the
  -- action is free — do not check balance, do not decrement credits, but
  -- still write a delta=0 audit row so the idempotency guard above works
  -- across future retries (including after payments are re-enabled).
  payments_on := public.is_feature_enabled('payments_enabled');

  IF payments_on IS NOT TRUE THEN
    SELECT COALESCE(credits, 0) INTO current_credits FROM public.profiles WHERE id = uid;
    INSERT INTO public.credit_transactions
      (user_id, delta, balance_after, kind, reason, reference_id, metadata)
    VALUES
      (uid, 0, current_credits, 'consume', _reason, _reference_id,
       jsonb_build_object('free_period', true, 'requested_amount', _amount));
    RETURN true;
  END IF;

  -- Paid mode: bit-identical to the previous behavior.
  SELECT COALESCE(credits, 0) INTO current_credits FROM public.profiles WHERE id = uid FOR UPDATE;
  IF current_credits < _amount THEN RETURN false; END IF;
  new_balance := current_credits - _amount;
  UPDATE public.profiles SET credits = new_balance, updated_at = now() WHERE id = uid;
  INSERT INTO public.credit_transactions (user_id, delta, balance_after, kind, reason, reference_id)
  VALUES (uid, -_amount, new_balance, 'consume', _reason, _reference_id);
  RETURN true;
END; $function$;