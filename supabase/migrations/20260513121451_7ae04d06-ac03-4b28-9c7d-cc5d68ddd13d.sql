-- Calendar-range and consistency CHECK constraints on profiles. Added as
-- NOT VALID so existing rows are not retroactively rejected; new writes
-- and updates are enforced. The DATE column type already guarantees that
-- saved values are real calendar days; these checks add bounded ranges
-- and a cross-field consistency guarantee.
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_birth_date_range_chk
  CHECK (
    birth_date IS NULL
    OR (birth_date BETWEEN DATE '1900-01-01' AND DATE '2100-01-01')
  ) NOT VALID;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_id_doc_issued_range_chk
  CHECK (
    id_document_issued_at IS NULL
    OR (id_document_issued_at BETWEEN DATE '1900-01-01' AND DATE '2100-01-01')
  ) NOT VALID;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_id_doc_expires_range_chk
  CHECK (
    id_document_expires_at IS NULL
    OR (id_document_expires_at BETWEEN DATE '1900-01-01' AND DATE '2100-01-01')
  ) NOT VALID;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_id_doc_expires_after_issued_chk
  CHECK (
    id_document_expires_at IS NULL
    OR id_document_issued_at IS NULL
    OR id_document_expires_at > id_document_issued_at
  ) NOT VALID;

-- Helper to log a failed date-validation attempt to activity_logs from
-- application code (server function). RLS on activity_logs already
-- restricts inserts to the user's own user_id.
CREATE OR REPLACE FUNCTION public.log_profile_date_validation_failure(
  _reason text,
  _payload jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_id  uuid;
BEGIN
  IF v_uid IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, metadata)
  VALUES (
    v_uid,
    'profile_date_validation_failed',
    'profile',
    v_uid,
    jsonb_build_object(
      'reason', _reason,
      'payload', COALESCE(_payload, '{}'::jsonb),
      'at', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
    )
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.log_profile_date_validation_failure(text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_profile_date_validation_failure(text, jsonb) TO authenticated;
