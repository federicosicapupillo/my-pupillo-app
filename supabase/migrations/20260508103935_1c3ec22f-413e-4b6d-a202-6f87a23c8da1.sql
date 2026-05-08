-- Add phone verification + whatsapp + email summary fields to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS phone_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS whatsapp_confirmation_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS whatsapp_confirmation_status text,
  ADD COLUMN IF NOT EXISTS email_summary_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS email_summary_status text;

-- Status enum for phone_verifications
DO $$ BEGIN
  CREATE TYPE public.phone_verification_status AS ENUM ('pending','sent','verified','expired','failed');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS public.phone_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  phone_full text NOT NULL,
  otp_code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts_count integer NOT NULL DEFAULT 0,
  verified_at timestamptz,
  status public.phone_verification_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_phone_verifications_user ON public.phone_verifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_phone_verifications_phone ON public.phone_verifications(phone_full);

ALTER TABLE public.phone_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own phone verifications"
  ON public.phone_verifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Service role manages phone verifications"
  ON public.phone_verifications FOR ALL
  USING (auth.role() = 'service_role');
