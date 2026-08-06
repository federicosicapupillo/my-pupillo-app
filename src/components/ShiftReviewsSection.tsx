import { emitRestaurantStatsRefresh } from "@/lib/restaurant-dashboard-stats";
import { useCallback, useEffect, useState } from "react";
import { Star, Lock, Award, Clock, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ReviewLabelsPicker, ReviewLabelsDisplay } from "@/components/ReviewLabelsPicker";
import { WouldRehirePicker, type WouldRehireValue } from "@/components/WouldRehirePicker";
import {
  deriveShiftReviewPhase,
  type ShiftReviewStatus,
  type ShiftReviewViewerRole,
} from "@/lib/shift-reviews";

type ReviewRow = {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  author_id: string;
  target_id: string;
  positive_tags: string[] | null;
  negative_tags: string[] | null;
  punctuality: number | null;
  professionalism: number | null;
  competence: number | null;
  reliability: number | null;
  teamwork: number | null;
  communication: number | null;
  staff_collaboration: number | null;
  would_rehire: string | null;
};

const REVIEW_COLS =
  "id, rating, comment, created_at, author_id, target_id, positive_tags, negative_tags, punctuality, professionalism, competence, reliability, teamwork, communication, staff_collaboration, would_rehire";

function Stars({ value, size = "h-5 w-5" }: { value: number; size?: string }) {
  const v = Math.max(0, Math.min(5, Math.round(value || 0)));
  return (
    <div className="flex items-center gap-0.5" aria-label={`${v} su 5 stelle`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`${size} ${n <= v ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`}
          strokeWidth={1.5}
        />
      ))}
    </div>
  );
}

function StarPicker({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm">{label}</span>
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            disabled={disabled}
            onClick={() => onChange(n)}
            aria-label={`${label}: ${n} stelle`}
            className="p-0.5 disabled:opacity-50"
          >
            <Star
              className={`h-5 w-5 ${n <= value ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/40"}`}
              strokeWidth={1.5}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

function fmtTs(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("it-IT", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(iso);
  }
}

function ReviewCard({ title, review, showCriteria }: { title: string; review: ReviewRow; showCriteria?: boolean }) {
  const criteria = showCriteria
    ? ([
        ["Puntualità", review.punctuality],
        ["Professionalità", review.professionalism],
        ["Competenza", review.competence],
        ["Affidabilità", review.reliability],
        ["Collaborazione", review.teamwork],
        ["Comunicazione", review.communication],
        ["Ambiente di lavoro", review.staff_collaboration],
      ] as const).filter(([, v]) => typeof v === "number" && v !== null)
    : [];
  return (
    <div className="rounded-xl border bg-card p-4 space-y-2">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</div>
      <div className="flex items-center gap-2">
        <Stars value={review.rating} />
        <span className="text-sm font-semibold tabular-nums">{review.rating}/5</span>
      </div>
      {criteria.length > 0 && (
        <ul className="grid gap-x-6 gap-y-0.5 text-xs text-muted-foreground sm:grid-cols-2">
          {criteria.map(([label, v]) => (
            <li key={label} className="flex items-center justify-between gap-2">
              <span>{label}</span>
              <span className="tabular-nums text-foreground">{v}/5</span>
            </li>
          ))}
        </ul>
      )}
      {review.comment?.trim() && <p className="whitespace-pre-wrap text-sm">{review.comment}</p>}
      <ReviewLabelsDisplay positive={review.positive_tags} negative={review.negative_tags} />
      <div className="text-[11px] text-muted-foreground">Inviata il {fmtTs(review.created_at)}</div>
    </div>
  );
}

export function ShiftReviewsSection({
  id = "shift-reviews",
  shiftId,
  shiftStatus,
  shiftEnded,
  role,
  targetId,
  targetName,
  announcementId,
  applicationId,
  autoOpen,
  className = "",
  onSubmitted,
}: {
  id?: string;
  shiftId: string;
  shiftStatus: string | null;
  shiftEnded: boolean;
  role: ShiftReviewViewerRole;
  targetId: string;
  targetName: string | null;
  announcementId: string | null;
  applicationId: string | null;
  autoOpen?: boolean;
  className?: string;
  /**
   * Chiamata SOLO dopo un invio recensione riuscito a backend: permette alla
   * pagina contenitore di ricaricare i dati autorevoli (turno, candidatura,
   * CTA) senza refresh manuale dell'utente.
   */
  onSubmitted?: () => void | Promise<void>;
}) {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<ShiftReviewStatus | null>(null);
  const [mine, setMine] = useState<ReviewRow | null>(null);
  const [received, setReceived] = useState<ReviewRow | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form state — preserved on failure (never reset unless submit succeeded).
  const [comment, setComment] = useState("");
  const [workerCriteria, setWorkerCriteria] = useState({
    overall: 5,
    communication: 5,
    clarity: 5,
    payment_fairness: 5,
    work_environment: 5,
  });
  const [restaurantCriteria, setRestaurantCriteria] = useState({
    punctuality: 5,
    professionalism: 5,
    competence: 5,
    reliability: 5,
    teamwork: 5,
  });
  const [positiveLabels, setPositiveLabels] = useState<string[]>([]);
  const [negativeLabels, setNegativeLabels] = useState<string[]>([]);
  const [wouldRehire, setWouldRehire] = useState<WouldRehireValue>(null);

  const load = useCallback(async () => {
    if (!shiftId) return;
    const { data: rpc, error: rpcErr } = await supabase.rpc("get_shift_review_status", {
      _shift_id: shiftId,
    });
    if (rpcErr) {
      if (import.meta.env.DEV) console.error("[shift-reviews] status rpc failed", rpcErr);
    }
    const row = Array.isArray(rpc) ? (rpc[0] as Record<string, unknown> | undefined) : undefined;
    const next: ShiftReviewStatus = {
      viewerRole: (row?.viewer_role as ShiftReviewViewerRole | undefined) ?? null,
      shiftStatus: (row?.shift_status as string | undefined) ?? shiftStatus,
      mineExists: !!row?.mine_exists,
      mineReviewId: (row?.mine_review_id as string | null | undefined) ?? null,
      otherExists: !!row?.other_exists,
      otherReviewId: (row?.other_review_id as string | null | undefined) ?? null,
      unlocked: !!row?.unlocked,
    };
    setStatus(next);

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const [{ data: mineRow }, { data: recvRow }] = await Promise.all([
        supabase.from("reviews").select(REVIEW_COLS).eq("shift_id", shiftId).eq("author_id", user.id).maybeSingle(),
        // RLS returns the received review ONLY when the blind unlock happened.
        next.unlocked
          ? supabase.from("reviews").select(REVIEW_COLS).eq("shift_id", shiftId).eq("target_id", user.id).maybeSingle()
          : Promise.resolve({ data: null } as { data: null }),
      ]);
      setMine((mineRow as ReviewRow | null) ?? null);
      setReceived((recvRow as ReviewRow | null) ?? null);
    }
    setLoading(false);
  }, [shiftId, shiftStatus]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    load().catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [load]);

  const phase = deriveShiftReviewPhase({
    shiftStatus: status?.shiftStatus ?? shiftStatus,
    shiftEnded,
    status: {
      mineExists: status?.mineExists ?? false,
      otherExists: status?.otherExists ?? false,
      unlocked: status?.unlocked ?? false,
    },
  });

  const submit = async () => {
    if (submitting) return;
    setFormError(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setFormError("Devi essere autenticato per inviare la recensione.");
      return;
    }
    if (role === "restaurant" && !wouldRehire) {
      setFormError("Indica se richiameresti questo lavoratore.");
      return;
    }
    const rating =
      role === "worker"
        ? Math.max(1, Math.min(5, Math.round(workerCriteria.overall)))
        : Math.max(
            1,
            Math.min(
              5,
              Math.round(
                (restaurantCriteria.punctuality +
                  restaurantCriteria.professionalism +
                  restaurantCriteria.competence +
                  restaurantCriteria.reliability +
                  restaurantCriteria.teamwork) / 5,
              ),
            ),
          );
    const payload =
      role === "worker"
        ? {
            author_id: user.id,
            target_id: targetId,
            shift_id: shiftId,
            announcement_id: announcementId,
            application_id: applicationId,
            rating,
            comment: comment.trim().slice(0, 500) || null,
            communication: workerCriteria.communication,
            professionalism: workerCriteria.clarity,
            reliability: workerCriteria.payment_fairness,
            staff_collaboration: workerCriteria.work_environment,
          }
        : {
            author_id: user.id,
            target_id: targetId,
            shift_id: shiftId,
            announcement_id: announcementId,
            application_id: applicationId,
            rating,
            comment: comment.trim().slice(0, 500) || null,
            punctuality: restaurantCriteria.punctuality,
            professionalism: restaurantCriteria.professionalism,
            competence: restaurantCriteria.competence,
            reliability: restaurantCriteria.reliability,
            teamwork: restaurantCriteria.teamwork,
            positive_tags: positiveLabels,
            negative_tags: negativeLabels,
            would_rehire: wouldRehire,
          };

    setSubmitting(true);
    try {
      const { error } = await supabase.from("reviews").insert(payload as never);
      if (error) {
        if (import.meta.env.DEV) {
          console.error("[shift-reviews] insert failed", {
            message: error.message,
            code: (error as { code?: string }).code,
            details: (error as { details?: string }).details,
            hint: (error as { hint?: string }).hint,
          });
        }
        const code = (error as { code?: string }).code;
        const msg =
          code === "23505"
            ? "Hai già lasciato una recensione per questo turno."
            : code === "42501"
              ? "Non hai i permessi per recensire questo turno."
              : "Non è stato possibile inviare la recensione. Riprova.";
        setFormError(msg);
        toast.error(msg);
        return; // form stays open, values preserved
      }
      toast.success("Recensione inviata");
      setComment("");
      setPositiveLabels([]);
      setNegativeLabels([]);
      setWouldRehire(null);
      // Re-read from DB: recompute the reciprocal state (may unlock now).
      await load();
      // Refresh autorevole della pagina contenitore SOLO dopo successo backend.
      try { await onSubmitted?.(); } catch { /* non bloccante */ }
      // Invalida gli aggregati autorevoli della dashboard ristoratore.
      emitRestaurantStatsRefresh();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      if (import.meta.env.DEV) console.error("[shift-reviews] insert threw", { message });
      setFormError("Non è stato possibile inviare la recensione. Riprova.");
      toast.error("Non è stato possibile inviare la recensione. Riprova.");
    } finally {
      setSubmitting(false);
    }
  };

  const formTitle = role === "worker" ? "Recensisci il ristoratore" : "Recensisci il lavoratore";
  const counterpart = targetName?.trim() || (role === "worker" ? "il ristoratore" : "il lavoratore");

  const form = (
    <div className="space-y-4 rounded-xl border bg-card p-4">
      <div>
        <h3 className="text-sm font-semibold">{formTitle}</h3>
        <p className="text-xs text-muted-foreground">
          Raccontaci com'è andato il turno e valuta la tua esperienza.
        </p>
      </div>
      <div className="space-y-1.5">
        {role === "worker" ? (
          <>
            <StarPicker label="Valutazione complessiva" value={workerCriteria.overall} disabled={submitting} onChange={(v) => setWorkerCriteria((c) => ({ ...c, overall: v }))} />
            <StarPicker label="Comunicazione" value={workerCriteria.communication} disabled={submitting} onChange={(v) => setWorkerCriteria((c) => ({ ...c, communication: v }))} />
            <StarPicker label="Chiarezza delle istruzioni" value={workerCriteria.clarity} disabled={submitting} onChange={(v) => setWorkerCriteria((c) => ({ ...c, clarity: v }))} />
            <StarPicker label="Correttezza del compenso" value={workerCriteria.payment_fairness} disabled={submitting} onChange={(v) => setWorkerCriteria((c) => ({ ...c, payment_fairness: v }))} />
            <StarPicker label="Ambiente di lavoro" value={workerCriteria.work_environment} disabled={submitting} onChange={(v) => setWorkerCriteria((c) => ({ ...c, work_environment: v }))} />
          </>
        ) : (
          <>
            <StarPicker label="Puntualità" value={restaurantCriteria.punctuality} disabled={submitting} onChange={(v) => setRestaurantCriteria((c) => ({ ...c, punctuality: v }))} />
            <StarPicker label="Professionalità" value={restaurantCriteria.professionalism} disabled={submitting} onChange={(v) => setRestaurantCriteria((c) => ({ ...c, professionalism: v }))} />
            <StarPicker label="Competenza" value={restaurantCriteria.competence} disabled={submitting} onChange={(v) => setRestaurantCriteria((c) => ({ ...c, competence: v }))} />
            <StarPicker label="Affidabilità" value={restaurantCriteria.reliability} disabled={submitting} onChange={(v) => setRestaurantCriteria((c) => ({ ...c, reliability: v }))} />
            <StarPicker label="Collaborazione" value={restaurantCriteria.teamwork} disabled={submitting} onChange={(v) => setRestaurantCriteria((c) => ({ ...c, teamwork: v }))} />
          </>
        )}
      </div>
      {role === "restaurant" && (
        <>
          <ReviewLabelsPicker
            positive={positiveLabels}
            negative={negativeLabels}
            onChange={({ positive, negative }) => { setPositiveLabels(positive); setNegativeLabels(negative); }}
            disabled={submitting}
          />
          <WouldRehirePicker value={wouldRehire} onChange={setWouldRehire} disabled={submitting} />
        </>
      )}
      <Textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        maxLength={500}
        disabled={submitting}
        placeholder={role === "worker" ? `Com'è andata con ${counterpart}?` : "Come è andato il servizio?"}
        className="min-h-24"
      />
      {formError && <p className="text-sm text-destructive">{formError}</p>}
      <Button onClick={submit} disabled={submitting} className="w-full sm:w-auto">
        {submitting ? "Invio in corso…" : "Invia recensione"}
      </Button>
    </div>
  );

  return (
    <section id={id} className={`rounded-2xl border bg-card p-4 ${className}`} aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <Award className="h-4 w-4 text-primary" />
        Recensioni del turno
      </h2>

      {loading ? (
        <p className="text-sm text-muted-foreground">Caricamento…</p>
      ) : phase === "not_reviewable" ? (
        <p className="text-sm text-muted-foreground">
          Il turno è stato annullato o non svolto: non è possibile lasciare una recensione.
        </p>
      ) : phase === "not_ended" ? (
        <div className="flex items-start gap-2 text-sm text-muted-foreground">
          <Clock className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Potrai lasciare una recensione al termine del turno.</span>
        </div>
      ) : phase === "can_review" ? (
        form
      ) : phase === "received_locked" ? (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
            <Lock className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-300" />
            <div className="space-y-1 text-sm">
              <div className="font-semibold">Hai ricevuto una recensione</div>
              <p className="text-foreground/80">
                Per mantenere imparziale la valutazione, potrai leggerla dopo aver inviato la tua recensione.
              </p>
            </div>
          </div>
          {form}
        </div>
      ) : phase === "sent_waiting" ? (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
            <div className="space-y-1 text-sm">
              <div className="font-semibold">Recensione inviata</div>
              <p className="text-foreground/80">
                La recensione ricevuta sarà visibile quando anche l'altra parte avrà completato la propria valutazione.
              </p>
            </div>
          </div>
          {mine && <ReviewCard title="La tua recensione" review={mine} showCriteria />}
        </div>
      ) : (
        <div className="space-y-3">
          {mine && <ReviewCard title="La tua recensione" review={mine} showCriteria />}
          {received ? (
            <ReviewCard
              title={`Recensione ricevuta${targetName ? ` da ${targetName}` : ""}`}
              review={received}
              showCriteria
            />
          ) : (
            <p className="text-sm text-muted-foreground">Recensione ricevuta non disponibile.</p>
          )}
        </div>
      )}
      {autoOpen ? <span className="sr-only" data-review-autoopen="1" /> : null}
    </section>
  );
}