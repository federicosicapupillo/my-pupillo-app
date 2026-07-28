-- FASE 3: esecuzione test guard (con cleanup)
DROP FUNCTION IF EXISTS public._tmp_test_profiles_guard();

CREATE TABLE IF NOT EXISTS public._tmp_guard_test_log (
  id serial primary key,
  test text,
  outcome text
);
GRANT INSERT, SELECT ON public._tmp_guard_test_log TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public._tmp_guard_test_log_id_seq TO authenticated;

CREATE TABLE IF NOT EXISTS public._tmp_guard_test_backup AS
SELECT id, city FROM public.profiles WHERE is_deleted = false ORDER BY created_at LIMIT 1;

DO $outer$
DECLARE uid uuid;
BEGIN
  SELECT id INTO uid FROM public._tmp_guard_test_backup LIMIT 1;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, false);
END
$outer$;

SET LOCAL ROLE authenticated;

DO $t$
DECLARE uid uuid := auth.uid();
BEGIN
  BEGIN
    UPDATE public.profiles SET city = '__guard_test__' WHERE id = uid;
    INSERT INTO public._tmp_guard_test_log(test, outcome) VALUES ('1 city (allowlist)', 'consentito');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public._tmp_guard_test_log(test, outcome) VALUES ('1 city (allowlist)', 'bloccato: ' || SQLERRM);
  END;
  BEGIN
    UPDATE public.profiles SET credits = COALESCE(credits,0) + 1000 WHERE id = uid;
    INSERT INTO public._tmp_guard_test_log(test, outcome) VALUES ('2 credits', 'consentito');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public._tmp_guard_test_log(test, outcome) VALUES ('2 credits', 'bloccato: ' || SQLERRM);
  END;
  BEGIN
    UPDATE public.profiles SET plan = 'premium' WHERE id = uid;
    INSERT INTO public._tmp_guard_test_log(test, outcome) VALUES ('3 plan', 'consentito');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public._tmp_guard_test_log(test, outcome) VALUES ('3 plan', 'bloccato: ' || SQLERRM);
  END;
  BEGIN
    UPDATE public.profiles SET moderation_hidden = true WHERE id = uid;
    INSERT INTO public._tmp_guard_test_log(test, outcome) VALUES ('4 moderation_hidden', 'consentito');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public._tmp_guard_test_log(test, outcome) VALUES ('4 moderation_hidden', 'bloccato: ' || SQLERRM);
  END;
  BEGIN
    UPDATE public.profiles SET rating_avg = 5, reputation_score = 100 WHERE id = uid;
    INSERT INTO public._tmp_guard_test_log(test, outcome) VALUES ('5 rating/reputation', 'consentito');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public._tmp_guard_test_log(test, outcome) VALUES ('5 rating/reputation', 'bloccato: ' || SQLERRM);
  END;
  BEGIN
    UPDATE public.profiles SET city = 'X', credits = 999 WHERE id = uid;
    INSERT INTO public._tmp_guard_test_log(test, outcome) VALUES ('6 misto city+credits', 'consentito');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public._tmp_guard_test_log(test, outcome) VALUES ('6 misto city+credits', 'bloccato: ' || SQLERRM);
  END;
  BEGIN
    UPDATE public.profiles SET referral_credits_earned = 50, is_demo = true WHERE id = uid;
    INSERT INTO public._tmp_guard_test_log(test, outcome) VALUES ('7 referral/is_demo', 'consentito');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public._tmp_guard_test_log(test, outcome) VALUES ('7 referral/is_demo', 'bloccato: ' || SQLERRM);
  END;
END
$t$;

RESET ROLE;

-- ripristino dato originale
UPDATE public.profiles p
SET city = b.city
FROM public._tmp_guard_test_backup b
WHERE p.id = b.id AND p.city IS DISTINCT FROM b.city;

SELECT set_config('request.jwt.claims', NULL, false);