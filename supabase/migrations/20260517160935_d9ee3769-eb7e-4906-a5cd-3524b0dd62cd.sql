
DO $$
DECLARE
  v_batch text := 'demo_seed_2026_05_v1';
  v_pwd   text := crypt('Phantom2026!', gen_salt('bf'));
  v_inst  uuid := '00000000-0000-0000-0000-000000000000';
  v_uid uuid;
  v_email text;
  i int;
  cities text[]    := ARRAY['Milano','Roma','Torino','Napoli','Firenze','Bologna','Genova','Verona','Bari','Palermo','Padova','Brescia'];
  provs  text[]    := ARRAY['MI','RM','TO','NA','FI','BO','GE','VR','BA','PA','PD','BS'];
  lats   float[]   := ARRAY[45.4642,41.9028,45.0703,40.8518,43.7696,44.4949,44.4056,45.4384,41.1171,38.1157,45.4064,45.5416];
  lngs   float[]   := ARRAY[ 9.1900,12.4964, 7.6869,14.2681,11.2558,11.3426, 8.9463,10.9916,16.8719,13.3615,11.8768,10.2118];
  venues text[]    := ARRAY['ristorante','osteria','pizzeria','trattoria','bistrot','sushi','enoteca','cocktail_bar','caffetteria','hamburgeria'];
  rnames text[]    := ARRAY['Da Luigi','La Cucina','Il Borgo','Sapori d''Italia','Locanda','Le Tre Sorelle','Antica Trattoria','Vineria','Bar Centrale','Bistrot Moderno','La Vecchia','Osteria Nuova'];
  wfirst text[]    := ARRAY['Marco','Anna','Paolo','Lucia','Roberto','Sofia','Francesco','Giorgia','Antonio','Camilla','Nicola','Elisa','Pietro','Aurora','Vincenzo','Greta','Daniele','Noemi','Alberto','Irene'];
  wlast  text[]    := ARRAY['Bruno','Romano','Ferrari','Galli','Conte','Villa','Riva','Mazza','Sala','Vitale','Longo','Caruso','De Luca','Serra','Palmieri','Rinaldi','Negri','Fabbri','Orlando','Pellegrino'];
  wroles text[]    := ARRAY['cameriere','barista','pizzaiolo','aiuto_cuoco','lavapiatti','chef_de_rang','sommelier','runner','hostess','commis'];
  wlevels text[]   := ARRAY['junior','intermediate','senior'];
  ci int;
BEGIN
  -- ====== 90 PHANTOM RESTAURANTS ======
  FOR i IN 11..100 LOOP
    v_uid := gen_random_uuid();
    v_email := 'phantom-r' || lpad(i::text,3,'0') || '@demo.pupillo.app';
    ci := 1 + ((i-1) % 12);

    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      email_change_token_current, phone_change_token, reauthentication_token
    ) VALUES (
      v_inst, v_uid, 'authenticated', 'authenticated', v_email, v_pwd, now(),
      jsonb_build_object('provider','email','providers',ARRAY['email']),
      jsonb_build_object('full_name', rnames[1 + (i % 12)], 'role','restaurant'),
      now(), now(), '', '', '', '', '', '', ''
    );

    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), v_uid,
      jsonb_build_object('sub', v_uid::text, 'email', v_email, 'email_verified', true),
      'email', v_uid::text, now(), now(), now());

    UPDATE public.profiles SET
      is_demo = true, seed_batch_id = v_batch,
      full_name = rnames[1 + (i % 12)] || ' ' || cities[ci],
      business_name = rnames[1 + (i % 12)] || ' ' || cities[ci],
      venue_type = venues[1 + (i % 10)],
      vat_number = lpad((11000000000 + i*8273)::text, 11, '0'),
      vat_status = 'valid',
      vat_company_name = rnames[1 + (i % 12)] || ' S.R.L.',
      vat_verified_at = now(),
      address = 'Via Demo '||i||', '||cities[ci],
      city = cities[ci], province = provs[ci],
      postal_code = lpad((10000 + i*53)::text,5,'0'),
      country = 'Italia',
      latitude  = lats[ci] + ((i % 7)-3)*0.004,
      longitude = lngs[ci] + ((i % 7)-3)*0.004,
      contact_person_first_name = wfirst[1 + (i % 20)],
      contact_person_last_name  = wlast[1 + (i % 20)],
      contact_person_role = 'titolare',
      contact_person_phone = '+393351' || lpad((100000+i)::text,6,'0'),
      contact_person_email = v_email,
      phone_country_code='+39',
      phone_number = '335' || lpad((1000000+i*11)::text,7,'0'),
      phone_full   = '+39335' || lpad((1000000+i*11)::text,7,'0'),
      phone        = '+39335' || lpad((1000000+i*11)::text,7,'0'),
      phone_verified = true, phone_verified_at = now(),
      terms_accepted = true, profile_completed = true,
      plan = 'free', credits = 5, account_status='active',
      primary_role='restaurant', updated_at=now()
    WHERE id = v_uid;
  END LOOP;

  -- ====== 290 PHANTOM WORKERS (draft, profile_completed=false) ======
  FOR i IN 11..300 LOOP
    v_uid := gen_random_uuid();
    v_email := 'phantom-w' || lpad(i::text,3,'0') || '@demo.pupillo.app';
    ci := 1 + ((i-1) % 12);

    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      email_change_token_current, phone_change_token, reauthentication_token
    ) VALUES (
      v_inst, v_uid, 'authenticated', 'authenticated', v_email, v_pwd, now(),
      jsonb_build_object('provider','email','providers',ARRAY['email']),
      jsonb_build_object('full_name', wfirst[1+(i%20)]||' '||wlast[1+((i*3)%20)], 'role','worker'),
      now(), now(), '', '', '', '', '', '', ''
    );

    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), v_uid,
      jsonb_build_object('sub', v_uid::text, 'email', v_email, 'email_verified', true),
      'email', v_uid::text, now(), now(), now());

    -- profile_completed stays false → strict validators skipped
    UPDATE public.profiles SET
      is_demo = true, seed_batch_id = v_batch,
      full_name = wfirst[1+(i%20)]||' '||wlast[1+((i*3)%20)],
      first_name = wfirst[1+(i%20)],
      last_name  = wlast[1+((i*3)%20)],
      primary_role = wroles[1+(i%10)],
      experience_level = wlevels[1+(i%3)]::experience_level,
      experience_years = (i%10),
      hourly_rate = 10 + (i % 8),
      service_area_city = cities[ci],
      service_area_district = 'Centro',
      service_area_lat = lats[ci], service_area_lng = lngs[ci],
      service_area_radius_m = 10000,
      work_area_mode = 'zones',
      languages = ARRAY['Italiano'],
      profile_completed = false,
      plan = 'free', credits = 0, account_status='active',
      updated_at = now()
    WHERE id = v_uid;
  END LOOP;
END $$;
