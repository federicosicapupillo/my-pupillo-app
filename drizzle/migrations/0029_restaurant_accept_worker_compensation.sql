CREATE OR REPLACE FUNCTION public.enforce_counteroffer_flag()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
 enabled boolean := public.is_feature_enabled('counteroffer_enabled');
 worker_rate numeric;
 ann_rate numeric;
 ann_type text;
BEGIN
 IF enabled THEN RETURN NEW; END IF;
 -- A restaurant accepting the worker's existing desired rate is not a worker counteroffer.
 IF TG_OP = 'UPDATE' AND auth.uid() = NEW.restaurant_id
    AND public.has_role(auth.uid(), 'restaurant')
    AND NEW.status = 'pending' AND OLD.status = 'pending'
    AND NEW.worker_id = OLD.worker_id AND NEW.restaurant_id = OLD.restaurant_id
    AND NEW.announcement_id IS NOT DISTINCT FROM OLD.announcement_id
    AND NEW.proposed_tariff IS NOT NULL AND OLD.proposed_tariff IS NULL THEN
   SELECT hourly_rate INTO worker_rate FROM public.profiles WHERE id = NEW.worker_id;
   SELECT tariff_amount, tariff_type INTO ann_rate, ann_type FROM public.announcements
     WHERE id = NEW.announcement_id AND restaurant_id = auth.uid();
   IF ann_type = 'hourly' AND worker_rate > ann_rate AND worker_rate < 31
      AND NEW.proposed_tariff = worker_rate THEN RETURN NEW; END IF;
 END IF;
 IF TG_OP = 'INSERT' THEN
   IF NEW.status = 'counter_offer' THEN
     RAISE EXCEPTION 'La funzione controfferta è disattivata.' USING ERRCODE = 'check_violation';
   END IF;
   IF NEW.proposed_tariff IS NOT NULL THEN
     RAISE EXCEPTION 'La funzione controfferta è disattivata: non è possibile proporre una tariffa alternativa.' USING ERRCODE = 'check_violation';
   END IF;
   RETURN NEW;
 END IF;
 IF NEW.status = 'counter_offer' AND OLD.status IS DISTINCT FROM NEW.status THEN
   RAISE EXCEPTION 'La funzione controfferta è disattivata.' USING ERRCODE = 'check_violation';
 END IF;
 IF NEW.proposed_tariff IS NOT NULL AND NEW.proposed_tariff IS DISTINCT FROM OLD.proposed_tariff THEN
   RAISE EXCEPTION 'La funzione controfferta è disattivata: non è possibile modificare la tariffa proposta.' USING ERRCODE = 'check_violation';
 END IF;
 RETURN NEW;
END;
$function$;