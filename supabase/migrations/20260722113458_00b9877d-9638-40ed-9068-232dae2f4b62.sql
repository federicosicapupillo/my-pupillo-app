DO $test$
DECLARE
  ann uuid := 'eb0ee5bd-d83a-4a29-a57d-6ed001073fcb';
  rest uuid := '63b103ba-12b8-4f04-a39a-fb99892e5493';
  w1 uuid := '56505036-88e5-42c9-be39-c879bf1bc9f1';
  w2 uuid := '05995d15-750d-4ecd-b1a4-04913d31a85a';
  co uuid := '11111111-1111-1111-1111-111111111111';
  no uuid := '22222222-2222-2222-2222-222222222222';
  prev_flag boolean;
  sstate text;
  smsg text;
BEGIN
  SELECT enabled INTO prev_flag FROM public.feature_flags WHERE key='counteroffer_enabled';
  RAISE NOTICE '--- flag prima: %', prev_flag;

  UPDATE public.feature_flags SET enabled=true WHERE key='counteroffer_enabled';
  INSERT INTO public.applications (id, announcement_id, worker_id, restaurant_id, status, proposed_tariff)
  VALUES (co, ann, w1, rest, 'counter_offer', 15.50);
  INSERT INTO public.applications (id, announcement_id, worker_id, restaurant_id, status)
  VALUES (no, ann, w2, rest, 'pending');

  UPDATE public.feature_flags SET enabled=false WHERE key='counteroffer_enabled';
  RAISE NOTICE '--- flag durante test: %', public.is_feature_enabled('counteroffer_enabled');

  -- TEST 1: accepted
  BEGIN
    UPDATE public.applications SET status='accepted' WHERE id=co;
    RAISE NOTICE 'TEST1 FAIL (accepted allowed)';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS sstate = RETURNED_SQLSTATE, smsg = MESSAGE_TEXT;
    RAISE NOTICE 'TEST1 PASS (blocked, sqlstate=%): %', sstate, smsg;
  END;

  -- TEST 2: rejected
  BEGIN
    UPDATE public.applications SET status='rejected' WHERE id=co;
    RAISE NOTICE 'TEST2 FAIL (rejected allowed)';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS sstate = RETURNED_SQLSTATE, smsg = MESSAGE_TEXT;
    RAISE NOTICE 'TEST2 PASS (blocked, sqlstate=%): %', sstate, smsg;
  END;

  -- TEST 3: cancelled
  BEGIN
    UPDATE public.applications SET status='cancelled' WHERE id=co;
    RAISE NOTICE 'TEST3 FAIL (cancelled allowed)';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS sstate = RETURNED_SQLSTATE, smsg = MESSAGE_TEXT;
    RAISE NOTICE 'TEST3 PASS (blocked, sqlstate=%): %', sstate, smsg;
  END;

  -- TEST 4: expired
  BEGIN
    UPDATE public.applications SET status='expired' WHERE id=co;
    RAISE NOTICE 'TEST4 FAIL (expired allowed)';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS sstate = RETURNED_SQLSTATE, smsg = MESSAGE_TEXT;
    RAISE NOTICE 'TEST4 PASS (blocked, sqlstate=%): %', sstate, smsg;
  END;

  -- TEST 5: proposed_tariff
  BEGIN
    UPDATE public.applications SET proposed_tariff=20.00 WHERE id=co;
    RAISE NOTICE 'TEST5 FAIL (proposed_tariff change allowed)';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS sstate = RETURNED_SQLSTATE, smsg = MESSAGE_TEXT;
    RAISE NOTICE 'TEST5 PASS (blocked, sqlstate=%): %', sstate, smsg;
  END;

  -- TEST 6: unrelated update on normal app
  BEGIN
    UPDATE public.applications SET last_message_preview='ciao-test' WHERE id=no;
    RAISE NOTICE 'TEST6 PASS (unrelated update succeeded)';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS sstate = RETURNED_SQLSTATE, smsg = MESSAGE_TEXT;
    RAISE NOTICE 'TEST6 FAIL (sqlstate=%): %', sstate, smsg;
  END;

  DELETE FROM public.applications WHERE id IN (co, no);
  UPDATE public.feature_flags SET enabled=COALESCE(prev_flag,false) WHERE key='counteroffer_enabled';
  RAISE NOTICE '--- flag ripristinato: %', (SELECT enabled FROM public.feature_flags WHERE key='counteroffer_enabled');
  RAISE NOTICE '--- righe residue: %', (SELECT count(*) FROM public.applications WHERE id IN (co, no));
END
$test$;