-- FASE 3: harness temporaneo di test (verrà rimosso)
CREATE OR REPLACE FUNCTION public._tmp_test_profiles_guard()
RETURNS TABLE(test text, outcome text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid;
  old_city text;
BEGIN
  SELECT id, city INTO uid, old_city FROM public.profiles WHERE is_deleted = false ORDER BY created_at LIMIT 1;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);

  SET LOCAL ROLE authenticated;

  BEGIN
    UPDATE public.profiles SET city = '__guard_test__' WHERE id = uid;
    test := '1 city (allowlist)'; outcome := 'OK consentito'; RETURN NEXT;
  EXCEPTION WHEN OTHERS THEN test := '1 city (allowlist)'; outcome := 'BLOCCATO: ' || SQLERRM; RETURN NEXT;
  END;

  BEGIN
    UPDATE public.profiles SET credits = COALESCE(credits,0) + 1000 WHERE id = uid;
    test := '2 credits'; outcome := 'FALLITO: consentito'; RETURN NEXT;
  EXCEPTION WHEN OTHERS THEN test := '2 credits'; outcome := 'OK bloccato: ' || SQLERRM; RETURN NEXT;
  END;

  BEGIN
    UPDATE public.profiles SET plan = 'premium' WHERE id = uid;
    test := '3 plan'; outcome := 'FALLITO: consentito'; RETURN NEXT;
  EXCEPTION WHEN OTHERS THEN test := '3 plan'; outcome := 'OK bloccato: ' || SQLERRM; RETURN NEXT;
  END;

  BEGIN
    UPDATE public.profiles SET moderation_hidden = true WHERE id = uid;
    test := '4 moderation_hidden'; outcome := 'FALLITO: consentito'; RETURN NEXT;
  EXCEPTION WHEN OTHERS THEN test := '4 moderation_hidden'; outcome := 'OK bloccato: ' || SQLERRM; RETURN NEXT;
  END;

  BEGIN
    UPDATE public.profiles SET rating_avg = 5, reputation_score = 100 WHERE id = uid;
    test := '5 rating/reputation'; outcome := 'FALLITO: consentito'; RETURN NEXT;
  EXCEPTION WHEN OTHERS THEN test := '5 rating/reputation'; outcome := 'OK bloccato: ' || SQLERRM; RETURN NEXT;
  END;

  BEGIN
    UPDATE public.profiles SET city = 'X', credits = 999 WHERE id = uid;
    test := '6 misto city+credits'; outcome := 'FALLITO: consentito'; RETURN NEXT;
  EXCEPTION WHEN OTHERS THEN test := '6 misto city+credits'; outcome := 'OK bloccato: ' || SQLERRM; RETURN NEXT;
  END;

  BEGIN
    UPDATE public.profiles SET account_status = 'active', is_demo = false WHERE id = uid;
    test := '7 account_status/is_demo'; outcome := 'nessuna modifica reale o consentito'; RETURN NEXT;
  EXCEPTION WHEN OTHERS THEN test := '7 account_status/is_demo'; outcome := 'OK bloccato: ' || SQLERRM; RETURN NEXT;
  END;

  RESET ROLE;
  UPDATE public.profiles SET city = old_city WHERE id = uid;
  test := '8 cleanup city ripristinata'; outcome := COALESCE(old_city, 'NULL'); RETURN NEXT;
  RETURN;
END;
$$;

REVOKE ALL ON FUNCTION public._tmp_test_profiles_guard() FROM PUBLIC, anon, authenticated;