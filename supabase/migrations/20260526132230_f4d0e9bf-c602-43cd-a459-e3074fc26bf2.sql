CREATE TABLE public.review_revision_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL,
  requester_id uuid NOT NULL,
  target_id uuid NOT NULL,
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 30 AND 2000),
  status text NOT NULL DEFAULT 'pending',
  support_ticket_id uuid,
  admin_notes text,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (review_id, requester_id)
);

GRANT SELECT, INSERT ON public.review_revision_requests TO authenticated;
GRANT ALL ON public.review_revision_requests TO service_role;

ALTER TABLE public.review_revision_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Requester creates own revision request"
ON public.review_revision_requests
FOR INSERT TO authenticated
WITH CHECK (
  requester_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.reviews r
    WHERE r.id = review_id AND r.target_id = auth.uid()
  )
);

CREATE POLICY "Parties view own revision requests"
ON public.review_revision_requests
FOR SELECT TO authenticated
USING (
  requester_id = auth.uid()
  OR target_id = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins manage revision requests"
ON public.review_revision_requests
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_review_revision_requests_review ON public.review_revision_requests(review_id);
CREATE INDEX idx_review_revision_requests_status ON public.review_revision_requests(status);