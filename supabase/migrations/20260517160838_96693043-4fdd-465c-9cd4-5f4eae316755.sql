
-- ============================================================
-- BLOCK A: 20 loggable demo accounts (10 restaurants + 10 workers)
-- Batch id: demo_seed_2026_05_v1
-- ============================================================
DO $$
DECLARE
  v_batch text := 'demo_seed_2026_05_v1';
  v_pwd   text := crypt('Pupillo2026!', gen_salt('bf'));
  v_inst  uuid := '00000000-0000-0000-0000-000000000000';
  v_uid   uuid;
  v_email text;
  i int;
  -- Restaurant data arrays
  r_names text[]   := ARRAY['Trattoria Da Mario','Osteria del Borgo','Ristorante La Pergola','Pizzeria Bella Napoli','Sushi Zen','Bistrot Le Petit','Hamburgheria 1985','Enoteca del Centro','Cocktail Bar Aurora','Caffè Letterario'];
  r_venues text[]  := ARRAY['ristorante','osteria','ristorante','pizzeria','sushi','bistrot','hamburgeria','enoteca','cocktail_bar','caffetteria'];
  r_addr text[]    := ARRAY['Via Brera 12','Corso Como 8','Via Torino 45','Piazza Duomo 5','Via Solferino 22','Via Savona 33','Corso Buenos Aires 90','Via Montenapoleone 7','Navigli 15','Via Dante 18'];
  r_first text[]   := ARRAY['Marco','Giulia','Andrea','Francesca','Luca','Chiara','Davide','Sara','Matteo','Elena'];
  r_last text[]    := ARRAY['Rossi','Bianchi','Verdi','Esposito','Romano','Russo','Ferrari','Marino','Greco','Conti'];
  -- Worker data arrays
  w_first text[]   := ARRAY['Alessandro','Federica','Giovanni','Martina','Stefano','Alessia','Riccardo','Valentina','Lorenzo','Beatrice'];
  w_last text[]    := ARRAY['Colombo','Ricci','Marini','Costa','Galli','Lombardi','Moretti','Barbieri','Fontana','Santoro'];
  w_roles text[]   := ARRAY['cameriere','barista','pizzaiolo','aiuto_cuoco','lavapiatti','cameriere','barista','chef_de_rang','sommelier','runner'];
  w_levels text[]  := ARRAY['intermediate','senior','intermediate','junior','intermediate','senior','intermediate','senior','senior','junior'];
  w_zones text[]   := ARRAY['Brera','Navigli','Isola','Porta Venezia','Sempione','Lambrate','Bovisa','Cinque Vie','Porta Romana','Città Studi'];
BEGIN
  -- ============ 10 RESTAURANTS ============
  FOR i IN 1..10 LOOP
    v_uid := gen_random_uuid();
    v_email := 'ristoratore' || lpad(i::text,2,'0') || '@demo.pupillo.app';

    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      email_change_token_current, phone_change_token, reauthentication_token
    ) VALUES (
      v_inst, v_uid, 'authenticated', 'authenticated', v_email, v_pwd, now(),
      jsonb_build_object('provider','email','providers',ARRAY['email']),
      jsonb_build_object('full_name', r_first[i]||' '||r_last[i], 'role','restaurant'),
      now(), now(), '', '', '', '', '', '', ''
    );

    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), v_uid,
      jsonb_build_object('sub', v_uid::text, 'email', v_email, 'email_verified', true),
      'email', v_uid::text, now(), now(), now());

    -- handle_new_user trigger has created the profile + role; update with full demo data
    UPDATE public.profiles SET
      is_demo = true,
      seed_batch_id = v_batch,
      full_name = r_first[i]||' '||r_last[i],
      business_name = r_names[i],
      venue_type = r_venues[i],
      vat_number = lpad((10000000000 + i*7913)::text, 11, '0'),
      vat_status = 'valid',
      vat_company_name = r_names[i]||' S.R.L.',
      vat_verified_at = now(),
      address = r_addr[i]||', Milano',
      city = 'Milano',
      province = 'MI',
      postal_code = '201' || lpad(i::text,2,'0'),
      country = 'Italia',
      latitude  = 45.4642 + (i-5)*0.005,
      longitude = 9.1900  + (i-5)*0.006,
      contact_person_first_name = r_first[i],
      contact_person_last_name  = r_last[i],
      contact_person_role = 'titolare',
      contact_person_phone = '+393331' || lpad((100000+i)::text,6,'0'),
      contact_person_email = v_email,
      phone_country_code = '+39',
      phone_number = '333' || lpad((1000000+i*7)::text,7,'0'),
      phone_full   = '+39333' || lpad((1000000+i*7)::text,7,'0'),
      phone = '+39333' || lpad((1000000+i*7)::text,7,'0'),
      phone_verified = true,
      phone_verified_at = now(),
      terms_accepted = true,
      profile_completed = true,
      plan = 'free',
      credits = 10,
      account_status = 'active',
      primary_role = 'restaurant',
      updated_at = now()
    WHERE id = v_uid;
  END LOOP;

  -- ============ 10 WORKERS ============
  FOR i IN 1..10 LOOP
    v_uid := gen_random_uuid();
    v_email := 'lavoratore' || lpad(i::text,2,'0') || '@demo.pupillo.app';

    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      email_change_token_current, phone_change_token, reauthentication_token
    ) VALUES (
      v_inst, v_uid, 'authenticated', 'authenticated', v_email, v_pwd, now(),
      jsonb_build_object('provider','email','providers',ARRAY['email']),
      jsonb_build_object('full_name', w_first[i]||' '||w_last[i], 'role','worker'),
      now(), now(), '', '', '', '', '', '', ''
    );

    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), v_uid,
      jsonb_build_object('sub', v_uid::text, 'email', v_email, 'email_verified', true),
      'email', v_uid::text, now(), now(), now());

    -- Build a valid Italian CF-like code (pattern: 6L + 2D + 1L + 2D + 1L + 3D + 1L)
    UPDATE public.profiles SET
      is_demo = true,
      seed_batch_id = v_batch,
      full_name = w_first[i]||' '||w_last[i],
      first_name = w_first[i],
      last_name  = w_last[i],
      birth_date = (DATE '1995-01-01') - (i*37),
      birth_place = 'Milano',
      tax_code = upper(substr(w_last[i],1,3)) || upper(substr(w_first[i],1,3))
                 || lpad((85+i)::text,2,'0') || 'M' || lpad((i+10)::text,2,'0')
                 || 'H' || lpad((500+i)::text,3,'0') || chr(65 + ((i*3) % 26)),
      nationality = 'Italiana',
      residence_address = 'Via Demo '||i,
      residence_city = 'Milano',
      residence_postal_code = '201' || lpad(i::text,2,'0'),
      residence_province = 'MI',
      id_document_type = 'carta_identita',
      id_document_number = 'CA' || lpad((10000+i*113)::text,5,'0') || 'AB',
      id_document_issued_at = CURRENT_DATE - interval '2 years',
      id_document_expires_at = CURRENT_DATE + interval '7 years',
      id_document_issuer = 'Comune di Milano',
      id_document_path = 'demo/documents/'||v_uid||'_front.jpg',
      id_document_back_path = 'demo/documents/'||v_uid||'_back.jpg',
      avatar_url = 'https://api.dicebear.com/7.x/avataaars/svg?seed=' || v_uid,
      phone_country_code = '+39',
      phone_number = '349' || lpad((2000000+i*13)::text,7,'0'),
      phone_full   = '+39349' || lpad((2000000+i*13)::text,7,'0'),
      phone = '+39349' || lpad((2000000+i*13)::text,7,'0'),
      phone_verified = true,
      phone_verified_at = now(),
      primary_role = w_roles[i],
      experience_level = w_levels[i]::experience_level,
      experience_years = CASE w_levels[i] WHEN 'junior' THEN 1 WHEN 'intermediate' THEN 4 ELSE 8 END,
      hourly_rate = 12 + (i % 5),
      is_motorized = (i % 2 = 0),
      short_bio = 'Lavoratore demo della piattaforma Pupillo. Esperienza nel settore HoReCa.',
      languages = ARRAY['Italiano','Inglese'],
      spoken_languages = '[{"language":"Italiano","level":"madrelingua"},{"language":"Inglese","level":"intermedio"}]'::jsonb,
      service_area_city = 'Milano',
      service_area_district = w_zones[i],
      service_area_lat = 45.4642 + (i-5)*0.004,
      service_area_lng = 9.1900  + (i-5)*0.004,
      service_area_radius_m = 10000,
      work_area_mode = 'zones',
      selected_zones = ARRAY[w_zones[i]],
      all_zones = false,
      weekly_availability = ARRAY['lun','mar','mer','gio','ven','sab'],
      hourly_availability = '18:00-24:00',
      terms_accepted = true,
      profile_completed = true,
      plan = 'free',
      credits = 5,
      account_status = 'active',
      updated_at = now()
    WHERE id = v_uid;
  END LOOP;

  RAISE NOTICE 'Block A complete: 20 demo users created in batch %', v_batch;
END $$;
