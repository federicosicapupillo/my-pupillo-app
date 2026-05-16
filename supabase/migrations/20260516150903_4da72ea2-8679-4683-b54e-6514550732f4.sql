-- Per-proposal response so each proposal card has its own state,
-- decoupled from the application's overall status.
CREATE TABLE public.proposal_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL UNIQUE,
  application_id uuid NOT NULL,
  responder_id uuid NOT NULL,
  status text NOT NULL CHECK (status IN ('accepted','rejected')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_proposal_responses_application
  ON public.proposal_responses (application_id);

ALTER TABLE public.proposal_responses ENABLE ROW LEVEL SECURITY;

-- Parties of the underlying application (worker or restaurant) and admins can read.
CREATE POLICY "Parties view proposal responses"
ON public.proposal_responses
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.applications a
    WHERE a.id = proposal_responses.application_id
      AND (a.worker_id = auth.uid() OR a.restaurant_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
  )
);

-- The worker on the application can record their response to a proposal addressed to them.
CREATE POLICY "Worker records own proposal response"
ON public.proposal_responses
FOR INSERT
TO authenticated
WITH CHECK (
  responder_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.applications a
    JOIN public.messages m ON m.id = proposal_responses.message_id
    WHERE a.id = proposal_responses.application_id
      AND m.application_id = a.id
      AND a.worker_id = auth.uid()
  )
);
