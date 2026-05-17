ALTER PUBLICATION supabase_realtime ADD TABLE public.proposal_responses;
ALTER TABLE public.proposal_responses REPLICA IDENTITY FULL;