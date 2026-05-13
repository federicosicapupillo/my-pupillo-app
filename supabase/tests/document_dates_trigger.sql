-- Integration test for the worker ID document date rules enforced by
-- the `enforce_worker_personal_data` trigger on `public.profiles`.
--
-- Asserts the three Italian error messages used in the UI:
--   * "La data di rilascio non può essere futura."
--   * "Il documento risulta scaduto."
--   * "La data di scadenza deve essere successiva alla data di rilascio."
--
-- Run with:  psql -v ON_ERROR_STOP=1 -f supabase/tests/document_dates_trigger.sql
-- Safe to re-run: everything happens inside a ROLLBACKed transaction.

BEGIN;

-- Isolated test fixture: a worker profile with all required fields set,
-- so we only exercise the date branches of the trigger.
DO $$
DECLARE
  v_uid uuid := gen_random_uuid();
  v_msg text;
  v_caught boolean;
BEGIN
  -- Seed: insert a row directly (handle_new_user trigger needs auth.users,
  -- so we bypass it here and insert into profiles + user_roles manually).
  INSERT INTO public.profiles (id, email, full_name) VALUES (v_uid, 't@example.com', 'Test');
  INSERT INTO public.user_roles (user_id, role) VALUES (v_uid, 'worker');

  -- Helper: set every other required field once so subsequent UPDATEs
  -- only need to touch the date columns.
  UPDATE public.profiles SET
    first_name = 'Mario', last_name = 'Rossi', birth_date = DATE '1990-01-01',
    birth_place = 'Roma', tax_code = 'RSSMRA90A01H501Z', nationality = 'Italiana',
    residence_address = 'Via Roma 1', residence_city = 'Roma',
    residence_postal_code = '00100', residence_province = 'RM',
    phone_full = '+390000000', email = 't@example.com',
    id_document_type = 'carta_identita', id_document_number = 'AB1234567',
    id_document_issuer = 'Comune di Roma',
    id_document_path = 'docs/x.pdf', avatar_url = 'avatars/x.jpg',
    id_document_issued_at = DATE '2024-01-01',
    id_document_expires_at = DATE '2030-01-01'
  WHERE id = v_uid;

  -- Sanity: a fully valid profile completes without error.
  UPDATE public.profiles SET profile_completed = true WHERE id = v_uid;
  UPDATE public.profiles SET profile_completed = false WHERE id = v_uid;

  -- 1) Future issue date → must raise the exact Italian message.
  v_caught := false;
  BEGIN
    UPDATE public.profiles SET
      id_document_issued_at = CURRENT_DATE + INTERVAL '1 day',
      id_document_expires_at = CURRENT_DATE + INTERVAL '2 years',
      profile_completed = true
    WHERE id = v_uid;
  EXCEPTION WHEN OTHERS THEN
    v_msg := SQLERRM; v_caught := true;
  END;
  IF NOT v_caught OR v_msg <> 'La data di rilascio non può essere futura.' THEN
    RAISE EXCEPTION 'TEST FAIL [future issue]: expected "La data di rilascio non può essere futura.", got "%"', v_msg;
  END IF;

  -- Reset the row so the next UPDATE can run.
  UPDATE public.profiles SET
    id_document_issued_at = DATE '2024-01-01',
    id_document_expires_at = DATE '2030-01-01',
    profile_completed = false
  WHERE id = v_uid;

  -- 2) Expired document → must raise the exact Italian message.
  v_caught := false;
  BEGIN
    UPDATE public.profiles SET
      id_document_issued_at = DATE '2010-01-01',
      id_document_expires_at = CURRENT_DATE - INTERVAL '1 day',
      profile_completed = true
    WHERE id = v_uid;
  EXCEPTION WHEN OTHERS THEN
    v_msg := SQLERRM; v_caught := true;
  END;
  IF NOT v_caught OR v_msg <> 'Il documento risulta scaduto.' THEN
    RAISE EXCEPTION 'TEST FAIL [expired]: expected "Il documento risulta scaduto.", got "%"', v_msg;
  END IF;

  UPDATE public.profiles SET
    id_document_issued_at = DATE '2024-01-01',
    id_document_expires_at = DATE '2030-01-01',
    profile_completed = false
  WHERE id = v_uid;

  -- 3) Expiry <= issue → must raise the exact Italian message.
  v_caught := false;
  BEGIN
    UPDATE public.profiles SET
      id_document_issued_at = DATE '2024-06-01',
      id_document_expires_at = DATE '2024-06-01',
      profile_completed = true
    WHERE id = v_uid;
  EXCEPTION WHEN OTHERS THEN
    v_msg := SQLERRM; v_caught := true;
  END;
  IF NOT v_caught OR v_msg <> 'La data di scadenza deve essere successiva alla data di rilascio.' THEN
    RAISE EXCEPTION 'TEST FAIL [expires<=issued]: expected "La data di scadenza deve essere successiva alla data di rilascio.", got "%"', v_msg;
  END IF;

  RAISE NOTICE 'OK: enforce_worker_personal_data date rules verified.';
END $$;

ROLLBACK;