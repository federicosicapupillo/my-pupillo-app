
DO $$
DECLARE
  v_batch text := 'demo_seed_2026_05_v1';
  v_rest_ids uuid[]; v_work_complete_ids uuid[]; v_work_all_ids uuid[];
  v_ann_ids uuid[]; v_app_ids uuid[];
  v_app record;
  v_rest uuid; v_work uuid; v_ann uuid;
  v_app_id uuid; v_shift_id uuid;
  i int; n int;
  v_status text; v_date date; v_rating int;
  roles text[] := ARRAY['cameriere','barista','pizzaiolo','aiuto_cuoco','lavapiatti','chef_de_rang','sommelier','runner'];
  pos_tags text[] := ARRAY['puntuale','sorridente','rapido','professionale','ordinato','collaborativo','curato','flessibile'];
  neg_tags text[] := ARRAY['lento','distratto'];
  rehire_options text[] := ARRAY['yes','yes','yes','yes','maybe','no'];
BEGIN
  SELECT array_agg(id) INTO v_rest_ids
  FROM public.profiles WHERE is_demo=true AND seed_batch_id=v_batch AND primary_role='restaurant';
  SELECT array_agg(id) INTO v_work_complete_ids
  FROM public.profiles WHERE is_demo=true AND seed_batch_id=v_batch AND primary_role <> 'restaurant' AND profile_completed=true;
  SELECT array_agg(id) INTO v_work_all_ids
  FROM public.profiles WHERE is_demo=true AND seed_batch_id=v_batch AND primary_role <> 'restaurant';

  v_ann_ids := ARRAY[]::uuid[];
  FOR i IN 1..180 LOOP
    v_rest := v_rest_ids[1 + ((i-1) % array_length(v_rest_ids,1))];
    v_date := CURRENT_DATE + ((i % 60) - 20);
    v_status := (ARRAY['active','active','active','assigned','completed','expired'])[1 + (i % 6)];
    v_ann := gen_random_uuid();
    INSERT INTO public.announcements (
      id, restaurant_id, service_date, service_time, duration_hours,
      tariff_amount, tariff_type, speed, location_address,
      professional_profile, required_skills, language_requirements,
      job_city, job_province, status, expires_at,
      is_demo, seed_batch_id, created_at
    )
    SELECT v_ann, v_rest, v_date, '19:00'::time, 5,
           14 + (i % 10), 'hourly'::tariff_type, 'normal'::service_speed,
           p.address, roles[1 + (i % array_length(roles,1))],
           ARRAY['servizio sala','cassa'], ARRAY['italiano'],
           p.city, p.province, v_status::announcement_status,
           now() + interval '14 days', true, v_batch, now() - (i || ' hours')::interval
    FROM public.profiles p WHERE p.id = v_rest;
    v_ann_ids := array_append(v_ann_ids, v_ann);
  END LOOP;

  v_app_ids := ARRAY[]::uuid[];
  FOR i IN 1..500 LOOP
    v_ann := v_ann_ids[1 + ((i-1) % array_length(v_ann_ids,1))];
    SELECT restaurant_id INTO v_rest FROM public.announcements WHERE id = v_ann;
    v_work := v_work_all_ids[1 + ((i*7) % array_length(v_work_all_ids,1))];
    IF EXISTS (SELECT 1 FROM public.applications WHERE announcement_id=v_ann AND worker_id=v_work) THEN
      CONTINUE;
    END IF;
    v_status := (ARRAY['pending','interested','interested','accepted','accepted','rejected','counter_offer','not_interested'])[1 + (i % 8)];
    v_app_id := gen_random_uuid();
    INSERT INTO public.applications (
      id, announcement_id, worker_id, restaurant_id, status,
      proposed_tariff, response_deadline, is_demo, seed_batch_id, created_at
    ) VALUES (
      v_app_id, v_ann, v_work, v_rest, v_status::application_status,
      14 + (i % 10), now() + interval '24 hours', true, v_batch,
      now() - (i || ' hours')::interval
    );
    v_app_ids := array_append(v_app_ids, v_app_id);
  END LOOP;

  FOR i IN 1..250 LOOP
    SELECT id, announcement_id, worker_id, restaurant_id INTO v_app
    FROM public.applications
    WHERE is_demo=true AND seed_batch_id=v_batch
    ORDER BY (id::text || i::text) LIMIT 1 OFFSET (i % 400);
    IF v_app.id IS NULL THEN CONTINUE; END IF;
    IF EXISTS (SELECT 1 FROM public.shifts WHERE announcement_id=v_app.announcement_id AND worker_id=v_app.worker_id) THEN
      CONTINUE;
    END IF;
    v_status := (ARRAY['completed','completed','completed','completed','completed','completed','scheduled','scheduled','no_show','cancelled'])[1 + (i % 10)];
    v_date := CURRENT_DATE - ((i % 90) - 5);
    v_shift_id := gen_random_uuid();
    INSERT INTO public.shifts (
      id, announcement_id, restaurant_id, worker_id, shift_date,
      hours, amount, status, completed_at, is_demo, seed_batch_id, created_at
    ) VALUES (
      v_shift_id, v_app.announcement_id, v_app.restaurant_id, v_app.worker_id, v_date,
      5, 70 + (i % 30), v_status::shift_status,
      CASE WHEN v_status='completed' THEN (v_date + time '23:00') AT TIME ZONE 'Europe/Rome' ELSE NULL END,
      true, v_batch, now() - (i || ' hours')::interval
    );
  END LOOP;

  FOR i IN 1..600 LOOP
    IF (i % 10) < 7 THEN
      v_work := v_work_complete_ids[1 + (i % array_length(v_work_complete_ids,1))];
    ELSE
      v_work := v_work_all_ids[1 + ((i*3) % array_length(v_work_all_ids,1))];
    END IF;
    v_rest := v_rest_ids[1 + ((i*5) % array_length(v_rest_ids,1))];
    v_rating := 3 + (i % 3);
    INSERT INTO public.reviews (
      author_id, target_id, rating,
      punctuality, professionalism, competence, reliability, teamwork,
      communication, staff_collaboration, appearance,
      would_rehire, positive_tags, negative_tags, tags,
      comment, is_demo, seed_batch_id, created_at
    ) VALUES (
      v_rest, v_work, v_rating,
      LEAST(5, v_rating + (i % 2))::smallint,
      LEAST(5, v_rating + ((i+1) % 2))::smallint,
      LEAST(5, v_rating + ((i+2) % 2))::smallint,
      LEAST(5, v_rating + (i % 2))::smallint,
      LEAST(5, v_rating + ((i+1) % 2))::smallint,
      LEAST(5, v_rating + (i % 2))::smallint,
      LEAST(5, v_rating + ((i+1) % 2))::smallint,
      LEAST(5, v_rating + ((i+2) % 2))::smallint,
      rehire_options[1 + (i % array_length(rehire_options,1))],
      ARRAY[pos_tags[1 + (i % array_length(pos_tags,1))], pos_tags[1 + ((i+3) % array_length(pos_tags,1))]],
      CASE WHEN v_rating < 4 THEN ARRAY[neg_tags[1 + (i % array_length(neg_tags,1))]] ELSE ARRAY[]::text[] END,
      ARRAY[]::text[],
      'Servizio demo. Ottima esperienza complessiva.',
      true, v_batch, now() - (i || ' hours')::interval
    );
  END LOOP;

  FOR i IN 1..250 LOOP
    v_rest := v_rest_ids[1 + (i % array_length(v_rest_ids,1))];
    v_work := v_work_complete_ids[1 + ((i*3) % array_length(v_work_complete_ids,1))];
    IF NOT EXISTS (SELECT 1 FROM public.restaurant_worker_favorites WHERE restaurant_id=v_rest AND worker_id=v_work) THEN
      INSERT INTO public.restaurant_worker_favorites (restaurant_id, worker_id, is_demo, seed_batch_id)
      VALUES (v_rest, v_work, true, v_batch);
    END IF;
  END LOOP;

  n := array_length(v_app_ids,1);
  FOR i IN 1..600 LOOP
    v_app_id := v_app_ids[1 + ((i-1) % n)];
    SELECT worker_id, restaurant_id INTO v_work, v_rest FROM public.applications WHERE id=v_app_id;
    INSERT INTO public.messages (
      application_id, sender_id, receiver_id, body,
      message_type, is_demo, seed_batch_id, created_at
    ) VALUES (
      v_app_id,
      CASE WHEN i % 2 = 0 THEN v_rest ELSE v_work END,
      CASE WHEN i % 2 = 0 THEN v_work ELSE v_rest END,
      (ARRAY[
        'Ciao, sei disponibile per il turno?',
        'Confermo la disponibilità, grazie.',
        'A che ora arrivo esattamente?',
        'Perfetto, ci vediamo domani.',
        'Posso proporre una tariffa diversa?',
        'Va bene, ti aspettiamo.'
      ])[1 + (i % 6)],
      'free_text', true, v_batch, now() - (i || ' minutes')::interval
    );
  END LOOP;

  FOR i IN 1..15 LOOP
    v_rest := v_rest_ids[1 + (i % array_length(v_rest_ids,1))];
    v_work := v_work_all_ids[1 + ((i*11) % array_length(v_work_all_ids,1))];
    INSERT INTO public.worker_incidents (
      worker_id, restaurant_id, kind, description, status,
      is_demo, seed_batch_id, created_at
    ) VALUES (
      v_work, v_rest,
      (ARRAY['no_show','abandoned','misconduct','other'])[1 + (i % 4)],
      'Segnalazione demo per finalità di test.',
      (ARRAY['pending','pending','verified','dismissed'])[1 + (i % 4)],
      true, v_batch, now() - (i || ' days')::interval
    );
  END LOOP;
END $$;
