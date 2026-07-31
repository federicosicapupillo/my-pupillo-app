DO $$
DECLARE
  app_id uuid;
  ok boolean;
BEGIN
  BEGIN
    -- sandbox: everything in this block is rolled back at the end
    SELECT id INTO app_id FROM public.applications WHERE status = 'pending' LIMIT 1;
    IF app_id IS NULL THEN
      RAISE NOTICE 'TEST SKIPPED: no pending application available';
      RAISE EXCEPTION 'ROLLBACK_TESTS';
    END IF;

    -- flag is OFF (global): creating a new counteroffer must fail
    ok := false;
    BEGIN
      UPDATE public.applications SET status = 'counter_offer', proposed_tariff = 99 WHERE id = app_id;
    EXCEPTION WHEN check_violation THEN ok := true;
    END;
    RAISE NOTICE 'TEST create-counteroffer-blocked-when-OFF: %', CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END;

    -- seed a legacy counteroffer with the flag temporarily ON
    UPDATE public.feature_flags SET enabled = true WHERE key = 'counteroffer_enabled';
    UPDATE public.applications SET status = 'counter_offer', proposed_tariff = 99 WHERE id = app_id;
    UPDATE public.feature_flags SET enabled = false WHERE key = 'counteroffer_enabled';

    -- reject an existing counteroffer with the flag OFF
    ok := true;
    BEGIN
      UPDATE public.applications SET status = 'rejected' WHERE id = app_id;
    EXCEPTION WHEN OTHERS THEN ok := false;
    END;
    RAISE NOTICE 'TEST reject-existing-counteroffer-when-OFF: %', CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END;

    -- cancel an existing counteroffer with the flag OFF
    UPDATE public.feature_flags SET enabled = true WHERE key = 'counteroffer_enabled';
    UPDATE public.applications SET status = 'counter_offer' WHERE id = app_id;
    UPDATE public.feature_flags SET enabled = false WHERE key = 'counteroffer_enabled';
    ok := true;
    BEGIN
      UPDATE public.applications SET status = 'cancelled' WHERE id = app_id;
    EXCEPTION WHEN OTHERS THEN ok := false;
    END;
    RAISE NOTICE 'TEST cancel-existing-counteroffer-when-OFF: %', CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END;

    -- clearing the proposed tariff (resolution) must be allowed when OFF
    UPDATE public.feature_flags SET enabled = true WHERE key = 'counteroffer_enabled';
    UPDATE public.applications SET status = 'counter_offer', proposed_tariff = 99 WHERE id = app_id;
    UPDATE public.feature_flags SET enabled = false WHERE key = 'counteroffer_enabled';
    ok := true;
    BEGIN
      UPDATE public.applications SET status = 'pending', proposed_tariff = NULL WHERE id = app_id;
    EXCEPTION WHEN OTHERS THEN ok := false;
    END;
    RAISE NOTICE 'TEST clear-proposed-tariff-when-OFF: %', CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END;

    RAISE EXCEPTION 'ROLLBACK_TESTS';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'ROLLBACK_TESTS' THEN
      RAISE NOTICE 'TEST HARNESS ERROR: %', SQLERRM;
    END IF;
    RAISE NOTICE 'All test writes rolled back.';
  END;
END $$;