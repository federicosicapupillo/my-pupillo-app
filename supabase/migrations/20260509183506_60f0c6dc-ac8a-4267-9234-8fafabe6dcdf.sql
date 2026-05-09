-- Remove eventuali duplicati prima di creare il vincolo
DELETE FROM public.required_reviews a
USING public.required_reviews b
WHERE a.ctid < b.ctid
  AND a.shift_id IS NOT NULL
  AND a.shift_id = b.shift_id;

CREATE UNIQUE INDEX IF NOT EXISTS required_reviews_shift_id_unique
  ON public.required_reviews (shift_id)
  WHERE shift_id IS NOT NULL;