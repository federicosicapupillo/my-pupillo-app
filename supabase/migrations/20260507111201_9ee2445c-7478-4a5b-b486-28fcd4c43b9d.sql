DO $$ BEGIN
  CREATE TYPE public.vat_status AS ENUM ('pending', 'valid', 'invalid', 'error');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS vat_status public.vat_status,
  ADD COLUMN IF NOT EXISTS vat_company_name text,
  ADD COLUMN IF NOT EXISTS vat_verified_at timestamptz;