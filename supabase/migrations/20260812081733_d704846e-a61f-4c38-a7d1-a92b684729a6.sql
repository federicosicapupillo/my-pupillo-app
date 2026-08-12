CREATE OR REPLACE FUNCTION public.tmp_test_overlap_notifications()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_rest uuid := 'd9126dd3-2460-41fd-b2be-3e226395749b';
  v_work uuid := '533b9158-58fa-4c7b-88e9-2691488c77bb';
  v_batch text := 'test_overlap_notif_' || substr(gen_random_uuid()::text, 1, 8);
  v_runner_app uuid;
  v_apps jsonb;
  v_notifs jsonb;
  v_app_ids uuid[];
BEGIN
  PERFORM set_config('pupillo.application_origin', 'worker_application', true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_rest, 'role', 'authenticated')::text, true);

  INSERT INTO public.announcements (id, restaurant_id, service_date, service_time, end_time, duration_hours,
    speed, tariff_type, tariff_amount, location_address, professional_profile, status, expires_at,
    is_demo, seed_batch_id, job_city, job_province)
  SELECT gen_random_uuid(), v_rest, current_date + 20, '19:00', '23:00', 4, 'normal', 'hourly', 12,
         a.location_address, r.role, 'active', now() + interval '10 days', true, v_batch, a.job_city, a.job_province
  FROM (SELECT location_address, job_city, job_province FROM public.announcements
        WHERE restaurant_id = v_rest ORDER BY created_at DESC LIMIT 1) a,
       (VALUES ('runner'), ('addetto_sala')) r(role);

  INSERT INTO public.applications (announcement_id, worker_id, restaurant_id, status, response_deadline, is_demo, seed_batch_id)
  SELECT id, v_work, v_rest, 'pending', now() + interval '2 days', true, v_batch
  FROM public.announcements WHERE seed_batch_id = v_batch;

  SELECT ap.id INTO v_runner_app
  FROM public.applications ap JOIN public.announcements an ON an.id = ap.announcement_id
  WHERE ap.seed_batch_id = v_batch AND an.professional_profile = 'runner';

  PERFORM public.accept_application_atomic(v_runner_app);

  SELECT array_agg(id) INTO v_app_ids FROM public.applications WHERE seed_batch_id = v_batch;

  SELECT jsonb_agg(jsonb_build_object('role', an.professional_profile, 'application_id', ap.id,
                                      'status', ap.status, 'closed_reason', ap.closed_reason) ORDER BY an.professional_profile)
  INTO v_apps
  FROM public.applications ap JOIN public.announcements an ON an.id = ap.announcement_id
  WHERE ap.seed_batch_id = v_batch;

  SELECT jsonb_agg(jsonb_build_object('user', CASE WHEN n.user_id = v_work THEN 'worker' ELSE 'restaurant' END,
                                      'title', n.title, 'body', n.body, 'link', n.link,
                                      'application_id', n.metadata->>'application_id',
                                      'kind', n.metadata->>'kind',
                                      'has_dedupe', n.dedupe_key IS NOT NULL) ORDER BY n.created_at)
  INTO v_notifs
  FROM public.notifications n
  WHERE (n.metadata->>'application_id')::uuid = ANY(v_app_ids);

  DELETE FROM public.notifications WHERE (metadata->>'application_id')::uuid = ANY(v_app_ids);
  DELETE FROM public.activity_logs WHERE entity_id = ANY(v_app_ids);
  DELETE FROM public.required_reviews WHERE application_id = ANY(v_app_ids);
  DELETE FROM public.credit_transactions WHERE reference_id = ANY(SELECT x::text FROM unnest(v_app_ids) x);
  DELETE FROM public.shifts WHERE seed_batch_id = v_batch
     OR announcement_id IN (SELECT id FROM public.announcements WHERE seed_batch_id = v_batch);
  DELETE FROM public.messages WHERE application_id = ANY(v_app_ids);
  DELETE FROM public.applications WHERE seed_batch_id = v_batch;
  DELETE FROM public.announcements WHERE seed_batch_id = v_batch;

  RETURN jsonb_build_object('batch', v_batch, 'applications', v_apps, 'notifications', v_notifs);
END;
$$;