DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_read_only_user') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.announcement_not_started(uuid) TO supabase_read_only_user';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.announcement_is_applicable(uuid) TO supabase_read_only_user';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.announcement_offer_acceptable(uuid) TO supabase_read_only_user';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.announcement_is_open(uuid) TO supabase_read_only_user';
  END IF;
END $$;