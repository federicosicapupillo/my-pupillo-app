
-- Subscriptions table
CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  stripe_subscription_id text NOT NULL UNIQUE,
  stripe_customer_id text NOT NULL,
  product_id text NOT NULL,
  price_id text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean DEFAULT false,
  environment text NOT NULL DEFAULT 'sandbox',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX idx_subscriptions_stripe_id ON public.subscriptions(stripe_subscription_id);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own subscription" ON public.subscriptions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role manages subscriptions" ON public.subscriptions
  FOR ALL USING (auth.role() = 'service_role');

CREATE OR REPLACE FUNCTION public.has_active_subscription(user_uuid uuid, check_env text DEFAULT 'live')
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE user_id = user_uuid AND environment = check_env
    AND (
      (status IN ('active','trialing') AND (current_period_end IS NULL OR current_period_end > now()))
      OR (status = 'canceled' AND current_period_end > now())
    )
  );
$$;

-- Credit transactions ledger
CREATE TYPE public.credit_tx_kind AS ENUM ('purchase','grant','consume','refund','plan_bonus');

CREATE TABLE public.credit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  delta integer NOT NULL,
  balance_after integer NOT NULL,
  kind public.credit_tx_kind NOT NULL,
  reason text,
  reference_id text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_credit_tx_user ON public.credit_transactions(user_id, created_at DESC);

ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own credit tx" ON public.credit_transactions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role manages credit tx" ON public.credit_transactions
  FOR ALL USING (auth.role() = 'service_role');

-- RPC: consume credits atomically (returns true if ok, false if insufficient)
CREATE OR REPLACE FUNCTION public.consume_credits(_amount integer, _reason text, _reference_id text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  current_credits integer;
  new_balance integer;
  has_pro boolean;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;

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
END; $$;

-- RPC for service role to grant credits (called from webhook)
CREATE OR REPLACE FUNCTION public.grant_credits(_user_id uuid, _amount integer, _kind public.credit_tx_kind, _reason text, _reference_id text DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  current_credits integer;
  new_balance integer;
BEGIN
  IF _amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;
  SELECT COALESCE(credits, 0) INTO current_credits FROM public.profiles WHERE id = _user_id FOR UPDATE;
  new_balance := current_credits + _amount;
  UPDATE public.profiles SET credits = new_balance, updated_at = now() WHERE id = _user_id;
  INSERT INTO public.credit_transactions (user_id, delta, balance_after, kind, reason, reference_id)
  VALUES (_user_id, _amount, new_balance, _kind, _reason, _reference_id);
  RETURN new_balance;
END; $$;

REVOKE EXECUTE ON FUNCTION public.grant_credits(uuid, integer, public.credit_tx_kind, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_credits(integer, text, text) TO authenticated;
