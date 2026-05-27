
CREATE OR REPLACE FUNCTION public.block_proposal_response_on_closed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_app_status text;
  v_ann_status text;
  v_announcement_id uuid;
  v_shift_terminal boolean;
BEGIN
  SELECT a.status::text, a.announcement_id
    INTO v_app_status, v_announcement_id
  FROM public.applications a
  WHERE a.id = NEW.application_id;

  IF v_app_status IN ('cancelled','expired','rejected') THEN
    RAISE EXCEPTION 'Non puoi rispondere a questa proposta: la candidatura è stata chiusa.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_announcement_id IS NOT NULL THEN
    SELECT an.status::text INTO v_ann_status
    FROM public.announcements an
    WHERE an.id = v_announcement_id;

    IF v_ann_status IN ('cancelled','completed','expired') THEN
      RAISE EXCEPTION 'Non puoi rispondere a questa proposta: l''annuncio è stato annullato o concluso.'
        USING ERRCODE = 'check_violation';
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM public.shifts s
      WHERE s.announcement_id = v_announcement_id
        AND s.status::text IN ('cancelled','completed')
    ) INTO v_shift_terminal;

    IF v_shift_terminal THEN
      RAISE EXCEPTION 'Non puoi rispondere a questa proposta: il turno è stato annullato o concluso.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_block_proposal_response_on_closed ON public.proposal_responses;
CREATE TRIGGER trg_block_proposal_response_on_closed
BEFORE INSERT ON public.proposal_responses
FOR EACH ROW
EXECUTE FUNCTION public.block_proposal_response_on_closed();
