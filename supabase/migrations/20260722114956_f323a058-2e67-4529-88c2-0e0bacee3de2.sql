DROP TABLE IF EXISTS public._pupillo_cf_tests;
CREATE TABLE public._pupillo_cf_tests (n int, name text, result text, detail text);

DO $$
DECLARE
  v_ann uuid := 'eb0ee5bd-d83a-4a29-a57d-6ed001073fcb';
  v_worker1 uuid := '56505036-88e5-42c9-be39-c879bf1bc9f1';
  v_worker2 uuid := '05995d15-750d-4ecd-b1a4-04913d31a85a';
  v_resto uuid := 'd9b17308-d691-4f77-892f-0825f2a6f912';
  v_co_id uuid;
  v_norm_id uuid;
BEGIN
  UPDATE public.feature_flags SET enabled = true WHERE key='counteroffer_enabled';

  INSERT INTO public.applications(announcement_id, worker_id, restaurant_id, status, response_deadline, proposed_tariff)
    VALUES (v_ann, v_worker1, v_resto, 'counter_offer', now() + interval '1 day', 15.0)
    RETURNING id INTO v_co_id;

  INSERT INTO public.applications(announcement_id, worker_id, restaurant_id, status, response_deadline)
    VALUES (v_ann, v_worker2, v_resto, 'pending', now() + interval '1 day')
    RETURNING id INTO v_norm_id;

  UPDATE public.feature_flags SET enabled = false WHERE key='counteroffer_enabled';

  BEGIN UPDATE public.applications SET status='accepted' WHERE id=v_co_id;
    INSERT INTO public._pupillo_cf_tests VALUES (1,'co->accepted','FAIL','update succeeded');
  EXCEPTION WHEN OTHERS THEN INSERT INTO public._pupillo_cf_tests VALUES (1,'co->accepted','PASS',SQLERRM); END;

  BEGIN UPDATE public.applications SET status='rejected' WHERE id=v_co_id;
    INSERT INTO public._pupillo_cf_tests VALUES (2,'co->rejected','FAIL','update succeeded');
  EXCEPTION WHEN OTHERS THEN INSERT INTO public._pupillo_cf_tests VALUES (2,'co->rejected','PASS',SQLERRM); END;

  BEGIN UPDATE public.applications SET status='cancelled' WHERE id=v_co_id;
    INSERT INTO public._pupillo_cf_tests VALUES (3,'co->cancelled','FAIL','update succeeded');
  EXCEPTION WHEN OTHERS THEN INSERT INTO public._pupillo_cf_tests VALUES (3,'co->cancelled','PASS',SQLERRM); END;

  BEGIN UPDATE public.applications SET status='expired' WHERE id=v_co_id;
    INSERT INTO public._pupillo_cf_tests VALUES (4,'co->expired','FAIL','update succeeded');
  EXCEPTION WHEN OTHERS THEN INSERT INTO public._pupillo_cf_tests VALUES (4,'co->expired','PASS',SQLERRM); END;

  BEGIN UPDATE public.applications SET proposed_tariff = 22.5 WHERE id=v_co_id;
    INSERT INTO public._pupillo_cf_tests VALUES (5,'modify proposed_tariff','FAIL','update succeeded');
  EXCEPTION WHEN OTHERS THEN INSERT INTO public._pupillo_cf_tests VALUES (5,'modify proposed_tariff','PASS',SQLERRM); END;

  BEGIN UPDATE public.applications SET last_message_preview='ciao test' WHERE id=v_norm_id;
    INSERT INTO public._pupillo_cf_tests VALUES (6,'normal update last_message_preview','PASS','ok');
  EXCEPTION WHEN OTHERS THEN INSERT INTO public._pupillo_cf_tests VALUES (6,'normal update last_message_preview','FAIL',SQLERRM); END;

  BEGIN UPDATE public.applications SET last_message_at = now() WHERE id=v_norm_id;
    INSERT INTO public._pupillo_cf_tests VALUES (7,'normal update last_message_at','PASS','ok');
  EXCEPTION WHEN OTHERS THEN INSERT INTO public._pupillo_cf_tests VALUES (7,'normal update last_message_at','FAIL',SQLERRM); END;

  DELETE FROM public.applications WHERE id IN (v_co_id, v_norm_id);
  UPDATE public.feature_flags SET enabled = false WHERE key='counteroffer_enabled';
END $$;