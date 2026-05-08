
DO $$ BEGIN
  CREATE TYPE public.discount_type AS ENUM ('percentage','fixed_amount','free_credits');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.discount_applies_to AS ENUM ('credits','premium','all');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.discount_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  description text,
  discount_type public.discount_type NOT NULL,
  discount_value numeric NOT NULL,
  max_uses integer,
  used_count integer NOT NULL DEFAULT 0,
  valid_from timestamptz,
  valid_until timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  applies_to public.discount_applies_to NOT NULL DEFAULT 'all',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_discount_codes_code ON public.discount_codes (upper(code));

ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read active codes" ON public.discount_codes;
CREATE POLICY "Authenticated read active codes" ON public.discount_codes
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins manage discount codes" ON public.discount_codes;
CREATE POLICY "Admins manage discount codes" ON public.discount_codes
  FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "Service role manages discount codes" ON public.discount_codes;
CREATE POLICY "Service role manages discount codes" ON public.discount_codes
  FOR ALL TO public USING (auth.role()='service_role') WITH CHECK (auth.role()='service_role');

DROP TRIGGER IF EXISTS discount_codes_updated_at ON public.discount_codes;
CREATE TRIGGER discount_codes_updated_at BEFORE UPDATE ON public.discount_codes
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.discount_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  discount_code_id uuid NOT NULL REFERENCES public.discount_codes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  order_id text,
  used_at timestamptz NOT NULL DEFAULT now(),
  discount_amount numeric
);

CREATE INDEX IF NOT EXISTS idx_redemptions_user ON public.discount_redemptions(user_id);
CREATE INDEX IF NOT EXISTS idx_redemptions_code ON public.discount_redemptions(discount_code_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_redemption_user_code ON public.discount_redemptions(user_id, discount_code_id);

ALTER TABLE public.discount_redemptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own redemptions" ON public.discount_redemptions;
CREATE POLICY "Users view own redemptions" ON public.discount_redemptions
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "Service role manages redemptions" ON public.discount_redemptions;
CREATE POLICY "Service role manages redemptions" ON public.discount_redemptions
  FOR ALL TO public USING (auth.role()='service_role') WITH CHECK (auth.role()='service_role');

CREATE OR REPLACE FUNCTION public.validate_discount_code(_code text, _applies_to text DEFAULT 'all')
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row public.discount_codes;
  v_already boolean;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'message', 'Devi essere autenticato.');
  END IF;
  IF _code IS NULL OR length(trim(_code)) = 0 THEN
    RETURN jsonb_build_object('valid', false, 'message', 'Codice mancante.');
  END IF;

  SELECT * INTO v_row FROM public.discount_codes
   WHERE upper(code) = upper(trim(_code)) LIMIT 1;

  IF v_row.id IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'message', 'Codice sconto non valido.');
  END IF;
  IF NOT v_row.is_active THEN
    RETURN jsonb_build_object('valid', false, 'message', 'Codice sconto non valido.');
  END IF;
  IF v_row.valid_from IS NOT NULL AND v_row.valid_from > now() THEN
    RETURN jsonb_build_object('valid', false, 'message', 'Codice non ancora attivo.');
  END IF;
  IF v_row.valid_until IS NOT NULL AND v_row.valid_until < now() THEN
    RETURN jsonb_build_object('valid', false, 'message', 'Questo codice sconto è scaduto.');
  END IF;
  IF v_row.max_uses IS NOT NULL AND v_row.used_count >= v_row.max_uses THEN
    RETURN jsonb_build_object('valid', false, 'message', 'Codice esaurito.');
  END IF;
  IF v_row.applies_to <> 'all'::discount_applies_to AND v_row.applies_to::text <> _applies_to THEN
    RETURN jsonb_build_object('valid', false, 'message', 'Questo codice non è valido per il prodotto selezionato.');
  END IF;

  SELECT EXISTS(SELECT 1 FROM public.discount_redemptions
                 WHERE user_id = v_uid AND discount_code_id = v_row.id) INTO v_already;
  IF v_already THEN
    RETURN jsonb_build_object('valid', false, 'message', 'Hai già utilizzato questo codice sconto.');
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'id', v_row.id,
    'code', v_row.code,
    'type', v_row.discount_type,
    'value', v_row.discount_value,
    'applies_to', v_row.applies_to,
    'message', 'Codice sconto applicato correttamente.'
  );
END; $$;

CREATE OR REPLACE FUNCTION public.redeem_discount_code(_code text, _applies_to text, _order_id text, _discount_amount numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.discount_codes; v_uid uuid := auth.uid(); v_validation jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  v_validation := public.validate_discount_code(_code, _applies_to);
  IF (v_validation->>'valid')::boolean = false THEN RETURN v_validation; END IF;

  SELECT * INTO v_row FROM public.discount_codes WHERE upper(code) = upper(trim(_code)) LIMIT 1;

  INSERT INTO public.discount_redemptions (discount_code_id, user_id, order_id, discount_amount)
  VALUES (v_row.id, v_uid, _order_id, _discount_amount);

  UPDATE public.discount_codes SET used_count = used_count + 1 WHERE id = v_row.id;

  -- For free_credits: grant credits immediately
  IF v_row.discount_type = 'free_credits' THEN
    PERFORM public.grant_credits(v_uid, v_row.discount_value::int, 'promo'::credit_tx_kind, 'Codice sconto: ' || v_row.code, v_row.id::text);
  END IF;

  RETURN jsonb_build_object('valid', true, 'redeemed', true, 'message', 'Codice sconto applicato correttamente.');
END; $$;

-- Demo codes
INSERT INTO public.discount_codes (code, description, discount_type, discount_value, applies_to, is_active)
VALUES
  ('PUPILLO10', 'Sconto 10% su tutto', 'percentage', 10, 'all', true),
  ('START20', 'Sconto 20% sui piani premium', 'percentage', 20, 'premium', true),
  ('CREDITI5', '5 crediti omaggio', 'free_credits', 5, 'credits', true)
ON CONFLICT (code) DO NOTHING;
