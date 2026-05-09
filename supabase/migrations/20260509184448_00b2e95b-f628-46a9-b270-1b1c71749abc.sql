-- Ensure completing a shift creates/updates the required review record.
DROP TRIGGER IF EXISTS trg_create_required_review_on_shift_complete ON public.shifts;
CREATE TRIGGER trg_create_required_review_on_shift_complete
AFTER INSERT OR UPDATE OF status ON public.shifts
FOR EACH ROW
EXECUTE FUNCTION public.create_required_review_on_shift_complete();

-- Ensure completed/cancelled shifts keep the connected announcement status in sync.
DROP TRIGGER IF EXISTS trg_sync_announcement_on_shift_status ON public.shifts;
CREATE TRIGGER trg_sync_announcement_on_shift_status
AFTER UPDATE OF status ON public.shifts
FOR EACH ROW
EXECUTE FUNCTION public.sync_announcement_on_shift_status();

-- Ensure required-review counters/blocking flags are recomputed after every required-review change.
DROP TRIGGER IF EXISTS trg_required_reviews_recompute ON public.required_reviews;
CREATE TRIGGER trg_required_reviews_recompute
AFTER INSERT OR UPDATE OR DELETE ON public.required_reviews
FOR EACH ROW
EXECUTE FUNCTION public.required_reviews_recompute_after_change();

-- Ensure a newly inserted review completes the linked required review.
DROP TRIGGER IF EXISTS trg_complete_required_review_on_review ON public.reviews;
CREATE TRIGGER trg_complete_required_review_on_review
AFTER INSERT ON public.reviews
FOR EACH ROW
EXECUTE FUNCTION public.complete_required_review_on_review();

-- Ensure a newly inserted review updates worker rating, shift review fields, completed shifts, and notifies the worker.
DROP TRIGGER IF EXISTS trg_handle_new_review ON public.reviews;
CREATE TRIGGER trg_handle_new_review
AFTER INSERT ON public.reviews
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_review();