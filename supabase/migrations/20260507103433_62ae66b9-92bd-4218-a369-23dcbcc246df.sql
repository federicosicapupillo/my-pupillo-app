CREATE OR REPLACE FUNCTION public.log_application_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, metadata)
  VALUES (
    NEW.restaurant_id,
    'created',
    'application',
    NEW.id,
    jsonb_build_object('by_role', 'restaurant')
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_application_created ON public.applications;
CREATE TRIGGER trg_log_application_created
AFTER INSERT ON public.applications
FOR EACH ROW
EXECUTE FUNCTION public.log_application_created();