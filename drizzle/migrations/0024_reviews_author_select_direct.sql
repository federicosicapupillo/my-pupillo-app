DROP POLICY IF EXISTS "Reviews visible per blind logic" ON public.reviews;
CREATE POLICY "Reviews visible per blind logic" ON public.reviews
  FOR SELECT TO authenticated
  USING (author_id = auth.uid() OR public.is_review_visible_to(id, auth.uid()));