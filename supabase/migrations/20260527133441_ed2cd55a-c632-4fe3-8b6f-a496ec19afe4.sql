
CREATE OR REPLACE FUNCTION public.block_messages_on_closed_chat()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_app_status text;
  v_ann_status text;
  v_shift_status text;
  v_worker_id uuid;
  v_restaurant_id uuid;
  v_announcement_id uuid;
BEGIN
  -- Always allow system messages (closure notices, review system messages, etc.)
  IF NEW.message_type = 'system' THEN
    RETURN NEW;
  END IF;
  IF NEW.template_id IN ('chat_closed_completed', 'chat_closed_cancelled', 'shift_closed_with_review') THEN
    RETURN NEW;
  END IF;

  SELECT a.status::text, a.worker_id, a.restaurant_id, a.announcement_id
    INTO v_app_status, v_worker_id, v_restaurant_id, v_announcement_id
  FROM public.applications a
  WHERE a.id = NEW.application_id;

  IF v_app_status IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_app_status IN ('expired', 'cancelled', 'rejected') THEN
    RAISE EXCEPTION 'chat_closed: questa chat è chiusa, non puoi inviare nuovi messaggi.'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_announcement_id IS NOT NULL THEN
    SELECT an.status::text INTO v_ann_status
    FROM public.announcements an
    WHERE an.id = v_announcement_id;
    IF v_ann_status IN ('cancelled', 'completed') THEN
      RAISE EXCEPTION 'chat_closed: il turno è stato chiuso o annullato.'
        USING ERRCODE = 'P0001';
    END IF;

    SELECT s.status::text INTO v_shift_status
    FROM public.shifts s
    WHERE s.announcement_id = v_announcement_id
      AND s.worker_id = v_worker_id
      AND s.restaurant_id = v_restaurant_id
    ORDER BY s.created_at DESC
    LIMIT 1;
    IF v_shift_status IN ('completed', 'cancelled') THEN
      RAISE EXCEPTION 'chat_closed: il turno è stato chiuso o annullato.'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_block_messages_on_closed_chat ON public.messages;
CREATE TRIGGER trg_block_messages_on_closed_chat
BEFORE INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.block_messages_on_closed_chat();
