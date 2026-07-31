
DO $$
DECLARE
  w uuid;
  ok boolean;
BEGIN
  SELECT id INTO w FROM public.profiles WHERE coalesce(is_deleted,false)=false LIMIT 1;
  IF w IS NULL THEN RAISE NOTICE 'nessun profilo: test saltato'; RETURN; END IF;

  -- TEST 1: disponibilità fuori area deve essere rifiutata
  ok := false;
  BEGIN
    INSERT INTO public.worker_availability(worker_id, day_of_week, time_slot, city, province)
    VALUES (w, 1, 'cena', 'Milano', 'MI');
    RAISE EXCEPTION 'TEST1_FAILED_NO_BLOCK';
  EXCEPTION
    WHEN check_violation THEN ok := true;
  END;
  IF NOT ok THEN RAISE EXCEPTION 'TEST 1 fallito: disponibilità fuori area non bloccata'; END IF;

  -- TEST 2: comune valido + coordinate manipolate (Milano) deve essere rifiutato
  ok := false;
  BEGIN
    INSERT INTO public.worker_availability(worker_id, day_of_week, time_slot, city, province, latitude, longitude)
    VALUES (w, 1, 'cena', 'Bologna', 'BO', 45.4642, 9.1900);
    RAISE EXCEPTION 'TEST2_FAILED_NO_BLOCK';
  EXCEPTION
    WHEN check_violation THEN ok := true;
  END;
  IF NOT ok THEN RAISE EXCEPTION 'TEST 2 fallito: coordinate fuori area non bloccate'; END IF;

  -- TEST 3: profilo con comune fuori area deve essere rifiutato
  ok := false;
  BEGIN
    UPDATE public.profiles SET city = 'Torino', province = 'TO' WHERE id = w;
    RAISE EXCEPTION 'TEST3_FAILED_NO_BLOCK';
  EXCEPTION
    WHEN check_violation THEN ok := true;
  END;
  IF NOT ok THEN RAISE EXCEPTION 'TEST 3 fallito: profilo fuori area non bloccato'; END IF;

  RAISE NOTICE 'Tutti i test di enforcement territoriale superati';
END $$;
