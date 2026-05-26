
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
  has_pro boolean;
  already_charged boolean;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;

  -- Anti double-charge: if a previous transaction exists for the same
  -- user/reason/reference, treat the call as a no-op success (idempotent).
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

  -- Pro/Business plans bypass credit consumption
  SELECT plan IN ('pro','business') INTO has_pro FROM public.profiles WHERE id = uid;
  IF has_pro THEN
    INSERT INTO public.credit_transactions (user_id, delta, balance_after, kind, reason, reference_id, metadata)
    SELECT uid, 0, COALESCE(credits, 0), 'plan_bonus', _reason, _reference_id, jsonb_build_object('plan_covered', true)
    FROM public.profiles WHERE id = uid;
    RETURN true;
  END IF;

  SELECT COALESCE(credits, 0) INTO current_credits FROM public.profiles WHERE id = uid FOR UPDATE;
  IF current_credits < _amount THEN RETURN false; END IF;
  new_balance := current_credits - _amount;
  UPDATE public.profiles SET credits = new_balance, updated_at = now() WHERE id = uid;
  INSERT INTO public.credit_transactions (user_id, delta, balance_after, kind, reason, reference_id)
  VALUES (uid, -_amount, new_balance, 'consume', _reason, _reference_id);
  RETURN true;
END; $function$;
