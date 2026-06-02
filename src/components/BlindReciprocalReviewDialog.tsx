import { useEffect, useState } from "react";
import { Star, Lock, Award } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ReviewLabelsPicker, ReviewLabelsDisplay } from "@/components/ReviewLabelsPicker";
import { toast } from "sonner";

/**
 * Blind reciprocal review popup for restaurants.
 *
 * When a worker leaves a review (direction: worker_to_restaurant) the
 * restaurant must first leave their counter-review (restaurant_to_worker)
 * before the received review becomes visible. Stars / tags / comment are
 * blurred until the restaurant submits its own review.
 */

type ReceivedReview = {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  shift_id: string | null;
  application_id: string | null;
  announcement_id: string | null;
  author_id: string;
  target_id: string;
  positive_tags: string[] | null;
  negative_tags: string[] | null;
  tags: string[] | null;
};

function Stars({ value, size = "h-5 w-5" }: { value: number; size?: string }) {
  const v = Math.max(0, Math.min(5, Math.round(value)));
  return (
    <div className="flex items-center gap-0.5" aria-label={`${v} su 5 stelle`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`${size} ${n <= v ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`}
        />
      ))}
    </div>
  );
}

function ratingToRehire(r: number): "yes" | "maybe" | "no" {
  if (r >= 4) return "yes";
  if (r === 3) return "maybe";
  return "no";
}

export function BlindReciprocalReviewDialog({
  reviewId,
  open,
  onOpenChange,
  onUnlocked,
}: {
  reviewId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onUnlocked?: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [review, setReview] = useState<ReceivedReview | null>(null);
  const [workerName, setWorkerName] = useState<string | null>(null);
  const [shiftDate, setShiftDate] = useState<string | null>(null);
  const [roleLabel, setRoleLabel] = useState<string | null>(null);
  /** Has the restaurant already left restaurant_to_worker for this shift+worker? */
  const [alreadyReviewed, setAlreadyReviewed] = useState(false);

  // Counter-review form state
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [positive, setPositive] = useState<string[]>([]);
  const [negative, setNegative] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !reviewId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        try { console.log("[PUPILLO_RESTAURANT_RECEIVED_REVIEW_NOTIFICATION_CLICK]", { reviewId }); } catch { /* */ }
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setError("Devi essere autenticato."); setLoading(false); return; }
        const { data: rData, error: rErr } = await supabase
          .from("reviews")
          .select("id, rating, comment, created_at, shift_id, application_id, announcement_id, author_id, target_id, positive_tags, negative_tags, tags")
          .eq("id", reviewId)
          .maybeSingle();
        if (cancelled) return;
        if (rErr || !rData) { setError("Recensione non disponibile."); setLoading(false); return; }
        const r = rData as ReceivedReview;
        if (r.target_id !== user.id) {
          // Not the recipient — do not expose blind logic for this viewer.
          setReview(r);
          setAlreadyReviewed(true);
          setLoading(false);
          return;
        }
        setReview(r);

        // Check reciprocal restaurant_to_worker review (same shift, same worker as target).
        let reciprocalExists = false;
        if (r.shift_id) {
          const { data: rec } = await supabase
            .from("reviews")
            .select("id")
            .eq("shift_id", r.shift_id)
            .eq("author_id", user.id)
            .eq("target_id", r.author_id)
            .maybeSingle();
          reciprocalExists = !!rec;
        } else if (r.application_id) {
          const { data: rec } = await supabase
            .from("reviews")
            .select("id")
            .eq("application_id", r.application_id)
            .eq("author_id", user.id)
            .eq("target_id", r.author_id)
            .maybeSingle();
          reciprocalExists = !!rec;
        }
        try {
          console.log("[PUPILLO_REVIEW_DIRECTION_BLIND_CHECK]", {
            reviewId,
            shift_id: r.shift_id,
            worker_id: r.author_id,
            restaurant_id: user.id,
            reciprocal_exists: reciprocalExists,
          });
        } catch { /* */ }
        setAlreadyReviewed(reciprocalExists);
        if (!reciprocalExists) {
          try {
            console.log("[PUPILLO_RESTAURANT_RECEIVED_REVIEW_LOCKED]", { reviewId });
            console.log("[PUPILLO_RESTAURANT_TO_WORKER_REVIEW_REQUIRED]", { reviewId, worker_id: r.author_id });
            console.log("[PUPILLO_RESTAURANT_BLIND_REVIEW_MODAL_OPEN]", { reviewId });
          } catch { /* */ }
        } else {
          try { console.log("[PUPILLO_RESTAURANT_RECEIVED_REVIEW_VISIBLE]", { reviewId }); } catch { /* */ }
        }

        // Worker name (privacy: only after both parties have worked together — which is true here)
        const { data: w } = await supabase
          .from("profiles")
          .select("full_name, first_name, last_name, is_deleted")
          .eq("id", r.author_id)
          .maybeSingle();
        if (w) {
          const wp = w as { full_name?: string | null; first_name?: string | null; last_name?: string | null; is_deleted?: boolean | null };
          setWorkerName(wp.is_deleted ? "Utente eliminato" : (wp.full_name ?? [wp.first_name, wp.last_name].filter(Boolean).join(" ") ?? "Lavoratore"));
        }
        if (r.shift_id) {
          const { data: s } = await supabase.from("shifts").select("shift_date").eq("id", r.shift_id).maybeSingle();
          if (s) setShiftDate((s as { shift_date: string | null }).shift_date);
        }
        if (r.announcement_id) {
          const { data: a } = await supabase
            .from("announcements")
            .select("professional_profile, service_date")
            .eq("id", r.announcement_id)
            .maybeSingle();
          if (a) {
            const ann = a as { professional_profile: string | null; service_date: string | null };
            setRoleLabel(ann.professional_profile);
            if (!shiftDate) setShiftDate(ann.service_date);
          }
        }
        setLoading(false);
      } catch (e) {
        if (!cancelled) { setError(String(e)); setLoading(false); }
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, reviewId]);

  // Mark the notification as read when opened.
  useEffect(() => {
    if (!open || !reviewId) return;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        await supabase
          .from("notifications")
          .update({ read: true, read_at: new Date().toISOString() } as never)
          .eq("user_id", user.id)
          .eq("link", `/reviews/${reviewId}`)
          .is("read_at", null);
      } catch { /* */ }
    })();
  }, [open, reviewId]);

  const handleSubmit = async () => {
    if (!review) return;
    if (rating < 1) { toast.error("Seleziona una valutazione da 1 a 5 stelle."); return; }
    setSubmitting(true);
    try {
      try { console.log("[PUPILLO_RESTAURANT_TO_WORKER_REVIEW_SUBMIT]", { reviewId, rating }); } catch { /* */ }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error("Devi essere autenticato."); setSubmitting(false); return; }
      const trimmed = comment.trim();
      if (trimmed.length > 500) { toast.error("Il commento può contenere al massimo 500 caratteri."); setSubmitting(false); return; }

      // Auto-fill sub-ratings with the main rating to keep aggregation consistent
      // with reviews created from the chat dialog (which requires them).
      const sub = rating;
      const wouldRehire = ratingToRehire(rating);

      const { error: insErr } = await supabase.from("reviews").insert({
        author_id: user.id,
        target_id: review.author_id,
        shift_id: review.shift_id,
        application_id: review.application_id,
        announcement_id: review.announcement_id,
        rating,
        comment: trimmed ? trimmed : null,
        tags: [],
        positive_tags: positive,
        negative_tags: negative,
        punctuality: sub,
        professionalism: sub,
        competence: sub,
        reliability: sub,
        teamwork: sub,
        would_rehire: wouldRehire,
        is_visible_to_restaurants: true,
        is_visible_to_worker: true,
      } as never);
      if (insErr) {
        if (String(insErr.message).toLowerCase().includes("uniq_reviews_shift_author") || (insErr as { code?: string }).code === "23505") {
          toast.info("Hai già recensito questo turno. La recensione ricevuta è ora visibile.");
          setAlreadyReviewed(true);
          try { console.log("[PUPILLO_RESTAURANT_RECEIVED_REVIEW_UNLOCKED]", { reviewId }); } catch { /* */ }
          onUnlocked?.();
        } else {
          toast.error(insErr.message);
        }
        setSubmitting(false);
        return;
      }
      try { console.log("[PUPILLO_RESTAURANT_TO_WORKER_REVIEW_SUCCESS]", { reviewId }); } catch { /* */ }
      try { console.log("[PUPILLO_RESTAURANT_RECEIVED_REVIEW_UNLOCKED]", { reviewId }); } catch { /* */ }
      toast.success("Recensione inviata. Ora puoi vedere la recensione ricevuta.");
      setAlreadyReviewed(true);
      onUnlocked?.();
    } finally {
      setSubmitting(false);
    }
  };

  const fmtDate = (iso: string | null) => {
    if (!iso) return "—";
    try { return new Date(iso).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" }); } catch { return iso; }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Hai ricevuto una recensione</DialogTitle>
          <DialogDescription>
            {alreadyReviewed
              ? "Recensione ricevuta dal lavoratore per il turno concluso."
              : "Per vedere la recensione ricevuta, lascia prima la tua recensione al lavoratore."}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Caricamento…</div>
        ) : error || !review ? (
          <div className="py-6 text-sm text-muted-foreground">{error ?? "Recensione non disponibile."}</div>
        ) : (
          <div className="space-y-4">
            {/* Received review preview — blurred until unlocked */}
            <div className="relative rounded-xl border bg-card p-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Recensione ricevuta dal lavoratore
                </div>
                {!alreadyReviewed && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-700 dark:text-amber-300">
                    <Lock className="h-3 w-3" /> Bloccata
                  </span>
                )}
              </div>
              <div className={alreadyReviewed ? "" : "select-none pointer-events-none blur-sm"}>
                <div className="flex items-center gap-2">
                  <Stars value={alreadyReviewed ? review.rating : 5} />
                  <span className="text-sm font-semibold tabular-nums">
                    {alreadyReviewed ? `${review.rating}/5` : "★/5"}
                  </span>
                </div>
                <div className="mt-1 text-sm">
                  {workerName ?? "Lavoratore"}{roleLabel ? ` — ${roleLabel}` : ""}
                </div>
                <div className="text-xs text-muted-foreground">
                  Turno del {fmtDate(shiftDate)} · Recensione del {fmtDate(review.created_at)}
                </div>
                {alreadyReviewed ? (
                  <>
                    {review.comment && review.comment.trim() && (
                      <p className="mt-2 whitespace-pre-wrap text-sm">{review.comment}</p>
                    )}
                    <div className="mt-2">
                      <ReviewLabelsDisplay positive={review.positive_tags} negative={review.negative_tags} />
                    </div>
                  </>
                ) : (
                  <>
                    <p className="mt-2 text-sm italic text-muted-foreground">
                      Commento nascosto fino all'invio della tua recensione.
                    </p>
                    <p className="text-xs italic text-muted-foreground">Tag nascosti</p>
                  </>
                )}
              </div>
              {!alreadyReviewed && (
                <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-2 text-xs">
                  <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700 dark:text-amber-300" />
                  <span className="text-foreground/80">
                    Questa recensione sarà visibile dopo che avrai recensito il lavoratore.
                  </span>
                </div>
              )}
            </div>

            {!alreadyReviewed && (
              <div className="space-y-3 rounded-xl border bg-card p-4">
                <div>
                  <div className="text-sm font-semibold">Lascia la tua recensione al lavoratore</div>
                  <p className="text-xs text-muted-foreground">
                    La tua valutazione è obbligatoria. Tag e commento sono facoltativi.
                  </p>
                </div>
                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-1">Valutazione *</div>
                  <div
                    className="flex items-center gap-1"
                    onMouseLeave={() => setHoverRating(0)}
                  >
                    {[1, 2, 3, 4, 5].map((n) => {
                      const active = (hoverRating || rating) >= n;
                      return (
                        <button
                          key={n}
                          type="button"
                          aria-label={`${n} stelle`}
                          onMouseEnter={() => setHoverRating(n)}
                          onClick={() => setRating(n)}
                          className="p-1 transition-transform hover:scale-110"
                        >
                          <Star className={`h-7 w-7 ${active ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/40"}`} />
                        </button>
                      );
                    })}
                    {rating > 0 && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        {rating === 1 && "Esperienza negativa"}
                        {rating === 2 && "Da migliorare"}
                        {rating === 3 && "Sufficiente"}
                        {rating === 4 && "Buona collaborazione"}
                        {rating === 5 && "Ottima collaborazione"}
                      </span>
                    )}
                  </div>
                </div>

                <ReviewLabelsPicker
                  positive={positive}
                  negative={negative}
                  onChange={({ positive: p, negative: n }) => { setPositive(p); setNegative(n); }}
                  disabled={submitting}
                />

                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-1">Commento (facoltativo)</div>
                  <Textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value.slice(0, 500))}
                    placeholder="Vuoi aggiungere qualcosa sul lavoratore?"
                    rows={3}
                    disabled={submitting}
                  />
                  <div className="mt-1 text-right text-[11px] text-muted-foreground">{comment.length}/500</div>
                </div>
              </div>
            )}

            {alreadyReviewed && (
              <div className="flex items-start gap-2 rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm">
                <Award className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <p className="text-foreground/90">
                  Questa recensione contribuisce al tuo Reputation Score su Pupillo.
                </p>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {!alreadyReviewed ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
                Annulla
              </Button>
              <Button onClick={handleSubmit} disabled={submitting || rating < 1}>
                {submitting ? "Invio…" : "Invia recensione e sblocca"}
              </Button>
            </>
          ) : (
            <Button onClick={() => onOpenChange(false)}>Chiudi</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}