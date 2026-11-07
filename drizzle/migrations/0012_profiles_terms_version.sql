ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS terms_version text, ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz;
COMMENT ON COLUMN public.profiles.terms_version IS 'Versione delle Condizioni d''uso accettate dall''utente';
COMMENT ON COLUMN public.profiles.terms_accepted_at IS 'Momento dell''accettazione esplicita delle Condizioni d''uso';