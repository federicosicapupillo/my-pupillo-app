
CREATE OR REPLACE FUNCTION public._exec_admin_sql(_sql text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  EXECUTE _sql;
END;
$$;
GRANT EXECUTE ON FUNCTION public._exec_admin_sql(text) TO authenticated, service_role;
