CREATE TABLE IF NOT EXISTS public.restaurant_worker_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL,
  worker_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, worker_id)
);

ALTER TABLE public.restaurant_worker_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Restaurant manages own favorites"
ON public.restaurant_worker_favorites
FOR ALL
TO authenticated
USING (restaurant_id = auth.uid())
WITH CHECK (restaurant_id = auth.uid() AND public.has_role(auth.uid(), 'restaurant'::app_role));

CREATE INDEX IF NOT EXISTS idx_rwf_restaurant ON public.restaurant_worker_favorites(restaurant_id);