CREATE OR REPLACE FUNCTION public.enforce_restaurant_age()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Validazione età referente rimossa: il campo non è più richiesto.
  -- Mantenuta solo come no-op per compatibilità con eventuali trigger esistenti.
  IF NEW.representative_age IS NOT NULL THEN
    IF NEW.representative_age < 18 OR NEW.representative_age > 99 THEN
      NEW.representative_age := NULL;
    ELSE
      NEW.age_verified := true;
      IF NEW.age_verified_at IS NULL THEN
        NEW.age_verified_at := now();
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;