CREATE TABLE public.worker_avatar_moderations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  path text,
  sha256 text NOT NULL,
  status text NOT NULL CHECK (status IN ('approved','rejected','error')),
  reason_code text,
  model text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT worker_avatar_moderations_path_required CHECK (status <> 'approved' OR path IS NOT NULL)
);
CREATE UNIQUE INDEX worker_avatar_moderations_path_uidx ON public.worker_avatar_moderations(path) WHERE path IS NOT NULL;
CREATE INDEX worker_avatar_moderations_user_idx ON public.worker_avatar_moderations(user_id, created_at DESC);

GRANT SELECT ON public.worker_avatar_moderations TO authenticated;
GRANT ALL ON public.worker_avatar_moderations TO service_role;
ALTER TABLE public.worker_avatar_moderations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Workers read own avatar moderations" ON public.worker_avatar_moderations
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.is_approved_worker_avatar(_user_id uuid, _path text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _path IS NOT NULL AND _path LIKE (_user_id::text || '/moderated/%') AND EXISTS (
    SELECT 1 FROM public.worker_avatar_moderations m
    WHERE m.user_id = _user_id AND m.path = _path AND m.status = 'approved')
$$;
REVOKE ALL ON FUNCTION public.is_approved_worker_avatar(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_approved_worker_avatar(uuid, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.enforce_worker_avatar()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE
  is_worker boolean;
  jwt_role text;
  avatar_changed boolean;
  completing boolean;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = NEW.id AND role = 'worker')
    INTO is_worker;
  IF NOT is_worker THEN RETURN NEW; END IF;

  IF COALESCE(NEW.profile_completed, false) = true
     AND (NEW.avatar_url IS NULL OR length(btrim(NEW.avatar_url)) = 0) THEN
    RAISE EXCEPTION 'Carica una foto profilo per completare il profilo.';
  END IF;

  -- Operazioni di sistema (service role / nessun utente) restano invariate.
  jwt_role := NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role';
  IF auth.uid() IS NULL OR jwt_role = 'service_role' THEN RETURN NEW; END IF;

  avatar_changed := TG_OP = 'INSERT' OR NEW.avatar_url IS DISTINCT FROM OLD.avatar_url;
  completing := COALESCE(NEW.profile_completed, false)
    AND (TG_OP = 'INSERT' OR NOT COALESCE(OLD.profile_completed, false));

  IF (avatar_changed AND NEW.avatar_url IS NOT NULL AND length(btrim(NEW.avatar_url)) > 0)
     OR completing THEN
    IF NOT public.is_approved_worker_avatar(NEW.id, NEW.avatar_url) THEN
      RAISE EXCEPTION 'La foto profilo deve essere approvata dal controllo automatico prima di essere usata.'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE POLICY "Approved worker avatars are immutable (update)" ON storage.objects
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (NOT (bucket_id = 'avatars' AND name LIKE '%/moderated/%'))
  WITH CHECK (NOT (bucket_id = 'avatars' AND name LIKE '%/moderated/%'));
CREATE POLICY "Approved worker avatars are immutable (delete)" ON storage.objects
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (NOT (bucket_id = 'avatars' AND name LIKE '%/moderated/%'));
CREATE POLICY "Approved worker avatars are server-written (insert)" ON storage.objects
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (NOT (bucket_id = 'avatars' AND name LIKE '%/moderated/%'));