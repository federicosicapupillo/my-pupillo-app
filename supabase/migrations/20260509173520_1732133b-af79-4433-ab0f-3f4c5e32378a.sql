
-- Estendi reviews con tag e flag visibilità
ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS application_id uuid,
  ADD COLUMN IF NOT EXISTS announcement_id uuid,
  ADD COLUMN IF NOT EXISTS is_visible_to_restaurants boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_visible_to_worker boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Anti-duplicato: una sola recensione per turno + autore
CREATE UNIQUE INDEX IF NOT EXISTS uniq_reviews_shift_author
  ON public.reviews(shift_id, author_id)
  WHERE shift_id IS NOT NULL;

-- Estendi shifts
ALTER TABLE public.shifts
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by_restaurant_user_id uuid;

-- Estendi profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_review_at timestamptz;

-- Trigger: dopo insert recensione aggiorna profilo lavoratore + notifica
CREATE OR REPLACE FUNCTION public.handle_new_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_avg numeric;
  v_count integer;
BEGIN
  -- ricalcola media e conteggio recensioni del target (lavoratore)
  SELECT ROUND(AVG(rating)::numeric, 2), COUNT(*)
    INTO v_avg, v_count
    FROM public.reviews
   WHERE target_id = NEW.target_id;

  UPDATE public.profiles
     SET rating_avg = COALESCE(v_avg, 0),
         reviews_count = v_count,
         last_review_at = NEW.created_at,
         updated_at = now()
   WHERE id = NEW.target_id;

  -- aggiorna shift come recensito + completato se collegato
  IF NEW.shift_id IS NOT NULL THEN
    UPDATE public.shifts
       SET reviewed_at = NEW.created_at,
           reviewed_by_restaurant_user_id = NEW.author_id,
           status = CASE WHEN status <> 'completed'::shift_status THEN 'completed'::shift_status ELSE status END,
           completed_at = COALESCE(completed_at, NEW.created_at)
     WHERE id = NEW.shift_id;

    -- incrementa completed_shifts (idempotente per shift)
    UPDATE public.profiles
       SET completed_shifts = COALESCE(completed_shifts, 0) + 1
     WHERE id = NEW.target_id
       AND NOT EXISTS (
         SELECT 1 FROM public.reviews r2
          WHERE r2.shift_id = NEW.shift_id
            AND r2.id <> NEW.id
       );
  END IF;

  -- notifica al lavoratore
  INSERT INTO public.notifications (user_id, title, body, link, metadata)
  VALUES (
    NEW.target_id,
    'Hai ricevuto una nuova recensione',
    'Un ristoratore ha lasciato una recensione sul turno completato.',
    CASE WHEN NEW.application_id IS NOT NULL THEN '/messages/' || NEW.application_id::text ELSE '/profile' END,
    jsonb_build_object(
      'review_id', NEW.id,
      'rating', NEW.rating,
      'shift_id', NEW.shift_id,
      'application_id', NEW.application_id,
      'author_id', NEW.author_id
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_handle_new_review ON public.reviews;
CREATE TRIGGER trg_handle_new_review
AFTER INSERT ON public.reviews
FOR EACH ROW EXECUTE FUNCTION public.handle_new_review();

-- Trigger updated_at su reviews
DROP TRIGGER IF EXISTS trg_reviews_updated_at ON public.reviews;
CREATE TRIGGER trg_reviews_updated_at
BEFORE UPDATE ON public.reviews
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
