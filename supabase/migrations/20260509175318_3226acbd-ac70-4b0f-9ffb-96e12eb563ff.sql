
CREATE OR REPLACE FUNCTION public.send_required_review_reminders()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  r record;
  v_count integer := 0;
BEGIN
  FOR r IN
    SELECT rr.*
      FROM public.required_reviews rr
     WHERE rr.status = 'pending'
       AND rr.due_date > now()
       AND rr.due_date < now() + interval '24 hours'
  LOOP
    -- Skip if a reminder was already sent in the last 20 hours
    IF EXISTS (
      SELECT 1 FROM public.profiles p
       WHERE p.id = r.restaurant_user_id
         AND p.last_review_reminder_at IS NOT NULL
         AND p.last_review_reminder_at > now() - interval '20 hours'
    ) THEN
      CONTINUE;
    END IF;

    INSERT INTO public.notifications (user_id, title, body, link)
    VALUES (
      r.restaurant_user_id,
      'Promemoria recensione',
      'Manca poco alla scadenza: completa la recensione del lavoratore.',
      CASE WHEN r.application_id IS NOT NULL THEN '/messages/' || r.application_id::text ELSE '/shifts' END
    );
    UPDATE public.profiles SET last_review_reminder_at = now() WHERE id = r.restaurant_user_id;
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END; $$;
