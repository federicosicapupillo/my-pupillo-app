-- FASE 3: test #2
TRUNCATE public._tmp_guard_test_log;

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
    UPDATE public.profiles SET city = 'Y', credits = 999 WHERE id = uid;
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
  BEGIN
    UPDATE public.profiles SET is_deleted = true, account_status = 'suspended' WHERE id = uid;
    INSERT INTO public._tmp_guard_test_log(test, outcome) VALUES ('8 is_deleted/account_status', 'consentito');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public._tmp_guard_test_log(test, outcome) VALUES ('8 is_deleted/account_status', 'bloccato: ' || SQLERRM);
  END;
  BEGIN
    UPDATE public.profiles SET full_name = full_name, hourly_rate = hourly_rate WHERE id = uid;
    INSERT INTO public._tmp_guard_test_log(test, outcome) VALUES ('9 update senza modifiche', 'consentito');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public._tmp_guard_test_log(test, outcome) VALUES ('9 update senza modifiche', 'bloccato: ' || SQLERRM);
  END;
  BEGIN
    UPDATE public.profiles SET credits = COALESCE(credits,0) + 5 WHERE id <> uid;
    INSERT INTO public._tmp_guard_test_log(test, outcome) VALUES ('10 credits su altri profili (RLS)', 'nessuna riga o consentito');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public._tmp_guard_test_log(test, outcome) VALUES ('10 credits su altri profili (RLS)', 'bloccato: ' || SQLERRM);
  END;
END
$t$;

RESET ROLE;

-- funzioni backend autorizzate: devono continuare a funzionare
DO $b$
DECLARE uid uuid; bal integer;
BEGIN
  SELECT id INTO uid FROM public._tmp_guard_test_backup LIMIT 1;
  BEGIN
    bal := public.grant_credits(uid, 1, 'grant', '__guard_test__', NULL);
    INSERT INTO public._tmp_guard_test_log(test, outcome) VALUES ('11 grant_credits (backend)', 'OK, saldo=' || bal);
    PERFORM public.grant_credits(uid, -1, 'refund', '__guard_test_revert__', NULL);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public._tmp_guard_test_log(test, outcome) VALUES ('11 grant_credits (backend)', 'FALLITO: ' || SQLERRM);
  END;
  BEGIN
    PERFORM public.recompute_worker_reputation(uid);
    INSERT INTO public._tmp_guard_test_log(test, outcome) VALUES ('12 recompute_worker_reputation', 'OK');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public._tmp_guard_test_log(test, outcome) VALUES ('12 recompute_worker_reputation', 'FALLITO: ' || SQLERRM);
  END;
END
$b$;

-- ripristino
UPDATE public.profiles p SET city = b.city
FROM public._tmp_guard_test_backup b
WHERE p.id = b.id AND p.city IS DISTINCT FROM b.city;

DELETE FROM public.credit_transactions WHERE reason IN ('__guard_test__','__guard_test_revert__');

SELECT set_config('request.jwt.claims', NULL, false);