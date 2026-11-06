CREATE OR REPLACE FUNCTION public.save_my_availability_dates(_entries jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_user uuid := auth.uid(); v_date date; v_entry jsonb;
BEGIN
 IF v_user IS NULL OR NOT public.has_role(v_user,'worker') THEN RAISE EXCEPTION 'Operazione non autorizzata'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=v_user AND profile_completed AND NOT is_deleted AND NOT moderation_hidden) THEN RAISE EXCEPTION 'Completa il profilo prima di salvare'; END IF;
 IF jsonb_typeof(_entries)<>'array' OR jsonb_array_length(_entries)>62 THEN RAISE EXCEPTION 'Seleziona al massimo 62 date'; END IF;
 PERFORM 1 FROM public.profiles WHERE id=v_user FOR UPDATE;
 FOR v_entry IN SELECT value FROM jsonb_array_elements(_entries) LOOP
  v_date := (v_entry->>'date')::date;
  IF v_date IS NULL OR v_date < (now() AT TIME ZONE 'Europe/Rome')::date THEN RAISE EXCEPTION 'Seleziona una data futura'; END IF;
  IF jsonb_typeof(v_entry->'slots') IS DISTINCT FROM 'array' OR jsonb_array_length(v_entry->'slots')=0 THEN RAISE EXCEPTION 'Seleziona una disponibilità'; END IF;
  DELETE FROM public.worker_availability_exceptions WHERE worker_id=v_user AND date=v_date;
  INSERT INTO public.worker_availability_exceptions(worker_id,date,is_available,time_slot,start_time,end_time,notes,city,province,district,radius_km)
  SELECT v_user,v_date,x.is_available,x.time_slot,x.start_time,x.end_time,x.notes,x.city,x.province,x.district,x.radius_km
  FROM jsonb_to_recordset(v_entry->'slots') AS x(is_available boolean,time_slot text,start_time time,end_time time,notes text,city text,province text,district text,radius_km integer);
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.save_my_availability_dates(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_my_availability_dates(jsonb) TO authenticated;
COMMENT ON FUNCTION public.save_my_availability_dates(jsonb) IS 'Atomically replaces only explicitly selected owner dates; weekly recurring availability remains unchanged.';