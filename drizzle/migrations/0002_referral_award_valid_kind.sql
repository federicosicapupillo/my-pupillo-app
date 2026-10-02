DO $$
DECLARE d text;
BEGIN
  d := pg_get_functiondef('public.award_referral_credits(uuid)'::regprocedure);
  d := replace(d, '''referral''::credit_tx_kind', '''grant''::credit_tx_kind');
  EXECUTE d;
END $$;