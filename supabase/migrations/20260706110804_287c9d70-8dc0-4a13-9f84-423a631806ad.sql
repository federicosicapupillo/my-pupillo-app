CREATE TABLE public.feature_flags (
  key         text PRIMARY KEY,
  enabled     boolean NOT NULL DEFAULT false,
  scope       text NOT NULL DEFAULT 'global'
              CHECK (scope IN ('global','city')),
  description text,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.feature_flags TO authenticated;
GRANT ALL ON public.feature_flags TO service_role;

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "feature_flags read: admin only"
  ON public.feature_flags FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "feature_flags write: admin only"
  ON public.feature_flags FOR ALL TO authenticated
  USING      (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE public.feature_flag_cities (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_key  text NOT NULL REFERENCES public.feature_flags(key) ON DELETE CASCADE,
  city      text NOT NULL,
  UNIQUE (flag_key, city)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.feature_flag_cities TO authenticated;
GRANT ALL ON public.feature_flag_cities TO service_role;

ALTER TABLE public.feature_flag_cities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "feature_flag_cities read: admin only"
  ON public.feature_flag_cities FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "feature_flag_cities write: admin only"
  ON public.feature_flag_cities FOR ALL TO authenticated
  USING      (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.is_feature_enabled(_key text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
BEGIN
  SELECT enabled, scope INTO r FROM public.feature_flags WHERE key = _key;

  IF NOT FOUND THEN
    RETURN _key LIKE 'require\_%' ESCAPE '\';
  END IF;

  IF r.scope = 'city' THEN
    RETURN false;
  END IF;

  RETURN r.enabled;
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_feature_enabled(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_feature_enabled_for_city(_key text, _city text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
BEGIN
  SELECT enabled, scope INTO r FROM public.feature_flags WHERE key = _key;

  IF NOT FOUND THEN
    RETURN _key LIKE 'require\_%' ESCAPE '\';
  END IF;

  IF r.scope = 'global' THEN
    RETURN r.enabled;
  END IF;

  RETURN r.enabled AND EXISTS (
    SELECT 1 FROM public.feature_flag_cities
    WHERE flag_key = _key AND city = _city
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_feature_enabled_for_city(text, text) TO authenticated;

INSERT INTO public.feature_flags (key, enabled, scope, description)
VALUES (
  'require_id_document',
  false,
  'global',
  'Richiedi il documento d''identità durante l''onboarding del lavoratore'
)
ON CONFLICT (key) DO NOTHING;