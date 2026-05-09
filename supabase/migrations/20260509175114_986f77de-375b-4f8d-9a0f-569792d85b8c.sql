
CREATE OR REPLACE FUNCTION public.required_reviews_recompute_after_change()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM public.recompute_review_block(COALESCE(NEW.restaurant_user_id, OLD.restaurant_user_id));
  RETURN COALESCE(NEW, OLD);
END; $$;

DROP TRIGGER IF EXISTS trg_required_reviews_recompute ON public.required_reviews;
CREATE TRIGGER trg_required_reviews_recompute
AFTER INSERT OR UPDATE OR DELETE ON public.required_reviews
FOR EACH ROW EXECUTE FUNCTION public.required_reviews_recompute_after_change();
