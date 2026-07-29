-- FASE 5: chiusura della SELECT generale su public.profiles.
-- La vista public.public_profiles è security_barrier (NON security_invoker) e
-- appartiene a postgres: continua quindi a leggere la tabella base bypassando
-- RLS, esponendo solo le colonne classificate come pubbliche.

DROP POLICY IF EXISTS "Profiles viewable by all authenticated" ON public.profiles;

CREATE POLICY "Users read own profile"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Admins read any profile"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Grants invariati e ribaditi esplicitamente (nessun DELETE/TRUNCATE/TRIGGER
-- per authenticated; UPDATE resta, protetto dal trigger difensivo
-- trg_00_profiles_guard_admin_columns).
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
GRANT SELECT ON public.public_profiles TO authenticated;
REVOKE SELECT ON public.profiles FROM anon;
REVOKE SELECT ON public.public_profiles FROM anon;