CREATE OR REPLACE FUNCTION public.compute_review_rating()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  vals numeric[] := ARRAY[]::numeric[];
  total numeric;
  n integer;
  author_is_restaurant boolean;
  author_is_worker boolean;
BEGIN
  -- This trigger runs before reviews_blind_before_insert, so resolve the
  -- direction from protected roles rather than the client-supplied column.
  SELECT bool_or(role = 'restaurant'), bool_or(role = 'worker')
    INTO author_is_restaurant, author_is_worker
    FROM public.user_roles WHERE user_id = NEW.author_id;

  IF NOT COALESCE(author_is_restaurant, false) AND
     (COALESCE(author_is_worker, false) OR NEW.direction = 'worker_to_restaurant') THEN
    -- The worker form has a separate explicit overall star selection.
    RETURN NEW;
  END IF;

  IF NEW.punctuality IS NOT NULL THEN vals := vals || NEW.punctuality::numeric; END IF;
  IF NEW.professionalism IS NOT NULL THEN vals := vals || NEW.professionalism::numeric; END IF;
  IF NEW.competence IS NOT NULL THEN vals := vals || NEW.competence::numeric; END IF;
  IF NEW.reliability IS NOT NULL THEN vals := vals || NEW.reliability::numeric; END IF;
  IF NEW.teamwork IS NOT NULL THEN vals := vals || NEW.teamwork::numeric; END IF;
  n := array_length(vals, 1);
  IF n IS NOT NULL AND n > 0 THEN
    SELECT SUM(v) INTO total FROM unnest(vals) AS v;
    NEW.rating := GREATEST(1, LEAST(5, ROUND(total / n)));
  END IF;
  RETURN NEW;
END;
$function$;