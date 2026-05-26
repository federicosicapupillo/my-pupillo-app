import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Star, Award } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RequireAuth } from "@/components/RequireAuth";
import { ReviewLabelsDisplay } from "@/components/ReviewLabelsPicker";
import { RequestReviewRevisionDialog } from "@/components/RequestReviewRevisionDialog";
import { Flag } from "lucide-react";

export const Route = createFileRoute("/reviews/$id")({
  head: () => ({ meta: [{ title: "Recensione ricevuta — Pupillo" }] }),
  component: () => (
    <RequireAuth>
      <ReviewPopupPage />
    </RequireAuth>
  ),
});

type ReviewRow = {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  shift_id: string | null;
  announcement_id: string | null;
  punctuality: number | null;
  professionalism: number | null;
  competence: number | null;
  reliability: number | null;
  positive_tags: string[] | null;
  negative_tags: string[] | null;
  author_id?: string;
  target_id?: string;
};

type AnnouncementLite = {
  professional_profile: string | null;
  service_date: string | null;
};

function motivational(rating: number): string {
  if (rating >= 4) {
    return "Ottimo lavoro! Continua così: puntualità, affidabilità e professionalità aumentano la tua reputazione e ti rendono più visibile ai ristoratori.";
  }
  if (rating >= 3) {
    return "Buon lavoro. Puoi migliorare ancora: cura puntualità, comunicazione e attenzione alle istruzioni per aumentare il tuo punteggio reputazionale.";
  }
  return "Questa recensione è un'occasione per migliorare. Rivedi i punti segnalati e lavora su puntualità, precisione e comunicazione: ogni turno può aiutarti a crescere.";
}

function Stars({ value, size = "h-5 w-5" }: { value: number | null | undefined; size?: string }) {
  const v = Math.max(0, Math.min(5, Math.round(Number(value ?? 0))));
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`${size} ${n <= v ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`}
        />
      ))}
    </div>
  );
}

function Criterion({ label, value }: { label: string; value: number | null }) {
  if (value == null) return null;
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <Stars value={value} size="h-4 w-4" />
    </div>
  );
}

function ReviewPopupPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [open, setOpen] = useState(true);
  const [review, setReview] = useState<ReviewRow | null>(null);
  const [ann, setAnn] = useState<AnnouncementLite | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revisionOpen, setRevisionOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("reviews")
        .select("id, rating, comment, created_at, shift_id, announcement_id, punctuality, professionalism, competence, reliability, positive_tags, negative_tags, author_id, target_id")
        .eq("id", id)
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        setError("Recensione non trovata.");
        setLoading(false);
        return;
      }
      setReview(data as ReviewRow);
      if ((data as ReviewRow).announcement_id) {
        const { data: a } = await supabase
          .from("announcements")
          .select("professional_profile, service_date")
          .eq("id", (data as ReviewRow).announcement_id!)
          .maybeSingle();
        if (!cancelled) setAnn((a as AnnouncementLite) ?? null);
      }
      // Marca la notifica review_received come letta
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase
            .from("notifications")
            .update({ read: true, read_at: new Date().toISOString() } as never)
            .eq("user_id", user.id)
            .eq("link", `/reviews/${id}`)
            .is("read_at", null);
        }
      } catch {/* non bloccante */}
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleClose = () => {
    setOpen(false);
    setTimeout(() => navigate({ to: "/dashboard" }), 150);
  };

  const handleGoReputation = () => {
    setOpen(false);
    setTimeout(() => navigate({ to: "/dashboard" }), 150);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Hai ricevuto una recensione</DialogTitle>
          <DialogDescription>
            Questa recensione contribuisce alla tua reputazione su Pupillo.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Caricamento…</div>
        ) : error || !review ? (
          <div className="py-6 text-sm text-muted-foreground">{error ?? "Recensione non disponibile."}</div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-xl border bg-card px-4 py-3">
              <div>
                <div className="text-xs text-muted-foreground">Valutazione generale</div>
                <div className="mt-1 flex items-center gap-2">
                  <Stars value={review.rating} />
                  <span className="text-sm font-semibold tabular-nums">{review.rating}/5</span>
                </div>
              </div>
              <div className="text-right text-xs text-muted-foreground">
                {new Date(review.created_at).toLocaleDateString("it-IT")}
                {ann?.professional_profile && (
                  <div className="mt-0.5 text-foreground/80">{ann.professional_profile}</div>
                )}
                {ann?.service_date && (
                  <div>Turno del {new Date(ann.service_date).toLocaleDateString("it-IT")}</div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Criterion label="Affidabilità" value={review.reliability} />
              <Criterion label="Puntualità" value={review.punctuality} />
              <Criterion label="Professionalità" value={review.professionalism} />
              <Criterion label="Qualità del servizio" value={review.competence} />
            </div>

            <ReviewLabelsDisplay positive={review.positive_tags} negative={review.negative_tags} />

            {review.comment && review.comment.trim().length > 0 && (
              <div className="rounded-xl border bg-muted/30 p-3 text-sm">
                <div className="mb-1 text-xs font-semibold text-muted-foreground">Commento del ristoratore</div>
                <p className="whitespace-pre-wrap">{review.comment}</p>
              </div>
            )}

            <div className="flex items-start gap-2 rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm">
              <Award className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <p className="text-foreground/90">{motivational(review.rating)}</p>
            </div>
          </div>
        )}

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {review && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setRevisionOpen(true)}
              className="gap-1 text-muted-foreground hover:text-destructive sm:mr-auto"
            >
              <Flag className="h-4 w-4" /> Richiedi revisione
            </Button>
          )}
          <Button variant="outline" onClick={handleClose}>Ho capito</Button>
          <Button onClick={handleGoReputation}>Vai alla mia reputazione</Button>
        </DialogFooter>
      </DialogContent>
      {review && review.author_id && review.target_id && (
        <RequestReviewRevisionDialog
          open={revisionOpen}
          onOpenChange={setRevisionOpen}
          reviewId={review.id}
          targetId={review.target_id}
          authorId={review.author_id}
          reviewSummary={`Recensione del ${new Date(review.created_at).toLocaleDateString("it-IT")} — valutazione ${review.rating}/5`}
        />
      )}
    </Dialog>
  );
}