
-- 1. Colonne moderazione su profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS moderation_hidden boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS moderation_hidden_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS moderation_hidden_by uuid NULL,
  ADD COLUMN IF NOT EXISTS moderation_reason text NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_moderation_hidden
  ON public.profiles(moderation_hidden)
  WHERE moderation_hidden = true;

-- 2. admin_audit_log
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor uuid NOT NULL,
  action text NOT NULL,
  target_user uuid NULL,
  reason text NULL,
  metadata jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.admin_audit_log TO authenticated;
GRANT ALL ON public.admin_audit_log TO service_role;

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can read audit log"
  ON public.admin_audit_log
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at
  ON public.admin_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_target_user
  ON public.admin_audit_log(target_user);

-- 3. RPC admin_set_moderation_hidden
CREATE OR REPLACE FUNCTION public.admin_set_moderation_hidden(
  _user_id uuid,
  _hidden boolean,
  _reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  IF v_actor IS NULL OR NOT public.has_role(v_actor, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'user_id_required' USING ERRCODE = '22004';
  END IF;

  IF _hidden AND (_reason IS NULL OR btrim(_reason) = '') THEN
    RAISE EXCEPTION 'reason_required_when_hiding' USING ERRCODE = '22004';
  END IF;

  IF _hidden THEN
    UPDATE public.profiles
       SET moderation_hidden = true,
           moderation_hidden_at = now(),
           moderation_hidden_by = v_actor,
           moderation_reason = _reason,
           updated_at = now()
     WHERE id = _user_id;
  ELSE
    UPDATE public.profiles
       SET moderation_hidden = false,
           moderation_hidden_at = NULL,
           moderation_hidden_by = NULL,
           moderation_reason = NULL,
           updated_at = now()
     WHERE id = _user_id;
  END IF;

  INSERT INTO public.admin_audit_log (actor, action, target_user, reason)
  VALUES (
    v_actor,
    CASE WHEN _hidden THEN 'moderation_hide' ELSE 'moderation_unhide' END,
    _user_id,
    _reason
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_set_moderation_hidden(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_moderation_hidden(uuid, boolean, text) TO authenticated;
