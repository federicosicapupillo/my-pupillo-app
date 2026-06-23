CREATE OR REPLACE FUNCTION public.get_counterparty_phone(other_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.shifts
    WHERE restaurant_id = auth.uid()
      AND worker_id = other_user_id
      AND status IN ('scheduled', 'completed')
  ) THEN
    RETURN NULL;
  END IF;

  SELECT p.phone_full
  INTO v_phone
  FROM public.profiles p
  WHERE p.id = other_user_id
    AND p.is_deleted IS NOT TRUE
    AND p.phone_verified = true
    AND p.phone_full IS NOT NULL;

  RETURN v_phone;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_counterparty_phone(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_counterparty_phone(uuid) TO authenticated;