
-- Update handle_new_user to also populate first_name and last_name from signup metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name',''),
    NULLIF(NEW.raw_user_meta_data->>'first_name',''),
    NULLIF(NEW.raw_user_meta_data->>'last_name','')
  );
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'worker'));
  RETURN NEW;
END; $function$;

-- Backfill: split full_name into first/last for legacy profiles missing those fields
UPDATE public.profiles
SET
  first_name = COALESCE(first_name, NULLIF(split_part(trim(full_name), ' ', 1), '')),
  last_name = COALESCE(
    last_name,
    NULLIF(trim(substring(trim(full_name) from position(' ' in trim(full_name)) + 1)), '')
  )
WHERE full_name IS NOT NULL
  AND trim(full_name) <> ''
  AND (first_name IS NULL OR last_name IS NULL OR first_name = '' OR last_name = '');
