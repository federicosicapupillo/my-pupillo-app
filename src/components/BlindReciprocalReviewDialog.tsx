import { useEffect, useState } from "react";
import { Star, Lock, Award } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
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
import { ReviewLabelsDisplay } from "@/components/ReviewLabelsPicker";

/**
 * Blind reciprocal review popup for restaurants.
 *
 * The DB (RLS + blind triggers) guarantees that a locked review row is
 * never returned to the recipient: rating, comment, tags simply do not
 * arrive. This dialog therefore has only two real states:
 *   1. Unlocked → render the received review normally.
 *   2. Locked   → show a "complete your review" CTA that opens the
 *                 reciprocal review form in the chat thread.
 * The inline counter-review form has been removed: submission now happens
 * inside `/messages/<applicationId>?action=review`.
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
  visible_at: string | null;
  is_visible_to_worker: boolean | null;
  is_visible_to_restaurants: boolean | null;
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

export function BlindReciprocalReviewDialog({
  reviewId,
  open,
  onOpenChange,
  onUnlocked,
  fallbackApplicationId,
  fallbackShiftId,
}: {
  reviewId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onUnlocked?: () => void;
  /** Used when RLS hides the locked review row from the recipient. */
  fallbackApplicationId?: string | null;
  fallbackShiftId?: string | null;
}) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [review, setReview] = useState<ReceivedReview | null>(null);
  const [workerName, setWorkerName] = useState<string | null>(null);
  const [shiftDate, setShiftDate] = useState<string | null>(null);
  const [roleLabel, setRoleLabel] = useState<string | null>(null);
  /** Has the reciprocal review been unlocked (both sides reviewed)? */
  const [unlocked, setUnlocked] = useState(false);
  /** Routing target for the "Lascia la tua recensione" CTA. */
  const [ctaAppId, setCtaAppId] = useState<string | null>(null);
  const [ctaShiftId, setCtaShiftId] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !reviewId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        try { console.log("[PUPILLO_BLIND_REVIEW_DIALOG_OPEN]", { reviewId }); } catch { /* */ }
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setError("Devi essere autenticato."); setLoading(false); return; }
        const { data: rData, error: rErr } = await supabase
          .from("reviews")
          .select("id, rating, comment, created_at, shift_id, application_id, announcement_id, author_id, target_id, positive_tags, negative_tags, tags, visible_at, is_visible_to_worker, is_visible_to_restaurants")
          .eq("id", reviewId)
          .maybeSingle();
        if (cancelled) return;
        if (rErr) { setError("Recensione non disponibile."); setLoading(false); return; }

        if (!rData) {
          // Locked + recipient → RLS hides the row entirely. Surface the
          // generic "complete your review" UI using fallback identifiers.
          setReview(null);
          setUnlocked(false);
          setCtaAppId(fallbackApplicationId ?? null);
          setCtaShiftId(fallbackShiftId ?? null);
          try { console.log("[PUPILLO_BLIND_REVIEW_DIALOG_LOCKED_NO_ROW]", { reviewId }); } catch { /* */ }
          setLoading(false);
          return;
        }

        const r = rData as ReceivedReview;
        setReview(r);
        const isUnlocked = r.visible_at !== null;
        setUnlocked(isUnlocked || r.target_id !== user.id);
        setCtaAppId(r.application_id ?? fallbackApplicationId ?? null);
        setCtaShiftId(r.shift_id ?? fallbackShiftId ?? null);

        if (isUnlocked && r.target_id === user.id) {
          // Hydrate display metadata only when we are allowed to show the row.
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
        }
        setLoading(false);
      } catch (e) {
        if (!cancelled) { setError(String(e)); setLoading(false); }
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, reviewId, fallbackApplicationId, fallbackShiftId]);

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

  const fmtDate = (iso: string | null) => {
    if (!iso) return "—";
    try { return new Date(iso).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" }); } catch { return iso; }
  };

  const goLeaveReview = () => {
    if (!ctaAppId) {
      // No application reference available → fall back to the user's
      // chat list so they can pick the right thread manually.
      try { console.log("[PUPILLO_BLIND_REVIEW_DIALOG_CTA_NO_APP]", { reviewId, ctaShiftId }); } catch { /* */ }
      onOpenChange(false);
      setTimeout(() => navigate({ to: "/messages" }), 150);
      return;
    }
    try { console.log("[PUPILLO_BLIND_REVIEW_DIALOG_CTA_OPEN_REVIEW_FORM]", { reviewId, applicationId: ctaAppId }); } catch { /* */ }
    onOpenChange(false);
    setTimeout(
      () =>
        navigate({
          to: "/messages/$id",
          params: { id: ctaAppId },
          search: { action: "review" } as never,
        }),
      150,
    );
    onUnlocked?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {unlocked ? "Hai ricevuto una recensione" : "Completa la tua recensione"}
          </DialogTitle>
          <DialogDescription>
            {unlocked
              ? "Recensione ricevuta dal lavoratore per il turno concluso."
              : "Hai ricevuto una recensione per questo turno. Per mantenere il sistema corretto e trasparente, potrai leggerla solo dopo aver lasciato anche tu la tua recensione."}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Caricamento…</div>
        ) : error ? (
          <div className="py-6 text-sm text-muted-foreground">{error}</div>
        ) : !unlocked ? (
          // Locked state — no review content fetched/exposed. The CTA opens
          // the reciprocal review form in the chat thread.
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
              <Lock className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-300" />
              <div className="space-y-1 text-sm">
                <div className="font-semibold">Recensione in attesa di sblocco</div>
                <p className="text-foreground/80">
                  Appena invii la tua recensione, entrambe diventeranno visibili.
                </p>
              </div>
            </div>
          </div>
        ) : !review ? (
          <div className="py-6 text-sm text-muted-foreground">Recensione non disponibile.</div>
        ) : (
          <div className="space-y-4">
            {/* Received review — unlocked: rating, tags and comment are safe to render. */}
            <div className="relative rounded-xl border bg-card p-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Recensione ricevuta dal lavoratore
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <Stars value={review.rating} />
                  <span className="text-sm font-semibold tabular-nums">{review.rating}/5</span>
                </div>
                <div className="mt-1 text-sm">
                  {workerName ?? "Lavoratore"}{roleLabel ? ` — ${roleLabel}` : ""}
                </div>
                <div className="text-xs text-muted-foreground">
                  Turno del {fmtDate(shiftDate)} · Recensione del {fmtDate(review.created_at)}
                </div>
                {review.comment && review.comment.trim() && (
                  <p className="mt-2 whitespace-pre-wrap text-sm">{review.comment}</p>
                )}
                <div className="mt-2">
                  <ReviewLabelsDisplay positive={review.positive_tags} negative={review.negative_tags} />
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2 rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm">
              <Award className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <p className="text-foreground/90">
                Questa recensione contribuisce al tuo Reputation Score su Pupillo.
              </p>
            </div>
          </div>
        )}

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {!unlocked && !loading && !error ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Annulla</Button>
              <Button onClick={goLeaveReview}>Lascia la tua recensione</Button>
            </>
          ) : (
            <Button onClick={() => onOpenChange(false)}>Chiudi</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}