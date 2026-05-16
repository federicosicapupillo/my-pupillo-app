import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import confetti from "canvas-confetti";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell, PageHeader } from "@/components/AppShell";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { markReviewSeen } from "@/lib/reviews.functions";
import {
  CRITERION_LABEL,
  REVIEW_CRITERIA,
  TIER_TEXT,
  celebrationTier,
  computeOverallRating,
} from "@/lib/reviews";
import { Star, ArrowLeft, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/reviews/$reviewId")({
  head: () => ({ meta: [{ title: "La tua valutazione — Pupillo" }] }),
  component: () => (
    <RequireAuth>
      <ReviewPage />
    </RequireAuth>
  ),
});

type ReviewRow = {
  id: string;
  rating: number;
  comment: string | null;
  punctuality: number | null;
  professionalism: number | null;
  competence: number | null;
  reliability: number | null;
  teamwork: number | null;
  created_at: string;
  author_id: string;
  target_id: string;
  shift_id: string | null;
  announcement_id: string | null;
  application_id: string | null;
};

function ReviewPage() {
  const { reviewId } = Route.useParams();
  const { user, loading: authLoading } = useAuth();
  const markSeen = useServerFn(markReviewSeen);
  const [review, setReview] = useState<ReviewRow | null>(null);
  const [authorName, setAuthorName] = useState<string | null>(null);
  const [shiftMeta, setShiftMeta] = useState<{ role: string | null; date: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [tierShown, setTierShown] = useState<null | ReturnType<typeof celebrationTier>>(null);

  useEffect(() => {
    if (authLoading || !user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: r } = await supabase
        .from("reviews")
        .select(
          "id, rating, comment, punctuality, professionalism, competence, reliability, teamwork, created_at, author_id, target_id, shift_id, announcement_id, application_id",
        )
        .eq("id", reviewId)
        .maybeSingle();
      if (cancelled) return;
      if (!r) {
        setLoading(false);
        return;
      }
      if (r.target_id !== user.id) {
        setForbidden(true);
        setLoading(false);
        return;
      }
      setReview(r as ReviewRow);

      // Dettagli locale + turno (best effort)
      const [{ data: prof }, ann] = await Promise.all([
        supabase
          .from("profiles")
          .select("business_name, full_name")
          .eq("id", r.author_id)
          .maybeSingle(),
        r.announcement_id
          ? supabase
              .from("announcements")
              .select("professional_profile, service_date")
              .eq("id", r.announcement_id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      if (!cancelled) {
        setAuthorName(prof?.business_name || prof?.full_name || "Ristoratore");
        setShiftMeta(
          ann.data
            ? { role: ann.data.professional_profile, date: ann.data.service_date }
            : null,
        );
      }

      // Mark-as-seen one-shot: l'effetto celebrativo parte solo
      // se questa è la prima apertura sul backend.
      const overall = computeOverallRating({
        punctuality: r.punctuality ?? undefined,
        professionalism: r.professionalism ?? undefined,
        competence: r.competence ?? undefined,
        reliability: r.reliability ?? undefined,
        teamwork: r.teamwork ?? undefined,
      });
      try {
        const res = await markSeen({ data: { reviewId } });
        if (!cancelled && res.wasFirstOpen) {
          const tier = celebrationTier(overall);
          setTierShown(tier);
          if (tier === "excellent") {
            launchConfetti("excellent");
          } else if (tier === "good") {
            launchConfetti("good");
          }
        }
      } catch {
        /* ignore: nessun effetto, contenuto visibile comunque */
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, user, reviewId, markSeen]);

  if (loading) {
    return (
      <AppShell>
        <PageHeader title="Valutazione" />
        <p className="text-muted-foreground">Caricamento…</p>
      </AppShell>
    );
  }
  if (forbidden) {
    return (
      <AppShell>
        <PageHeader title="Valutazione" />
        <p className="text-muted-foreground">Non hai accesso a questa recensione.</p>
      </AppShell>
    );
  }
  if (!review) {
    return (
      <AppShell>
        <PageHeader title="Valutazione" />
        <p className="text-muted-foreground">Recensione non trovata.</p>
      </AppShell>
    );
  }

  const scores = {
    punctuality: review.punctuality ?? undefined,
    professionalism: review.professionalism ?? undefined,
    competence: review.competence ?? undefined,
    reliability: review.reliability ?? undefined,
    teamwork: review.teamwork ?? undefined,
  };
  const overall = computeOverallRating(scores) ?? review.rating;
  const tier = tierShown ?? celebrationTier(overall);
  const t = TIER_TEXT[tier];

  return (
    <AppShell>
      <PageHeader title="Hai ricevuto una nuova valutazione" subtitle={authorName ?? undefined} />

      <section
        className={`mb-5 rounded-2xl border p-5 ${
          tier === "excellent"
            ? "border-amber-300 bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 dark:from-amber-500/15 dark:via-yellow-500/10 dark:to-orange-500/10 shadow-[0_10px_40px_-15px_rgba(245,158,11,0.45)]"
            : tier === "good"
              ? "border-emerald-300 bg-emerald-50/60 dark:bg-emerald-500/10"
              : tier === "constructive"
                ? "border-muted bg-muted/40"
                : "border-muted bg-card"
        } ${tierShown ? "animate-scale-in" : ""}`}
      >
        <h2 className="text-xl font-semibold">{t.title}</h2>
        <p className="text-sm text-muted-foreground">{t.subtitle}</p>
        <div className="mt-4 flex items-center gap-3">
          <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <Star
                key={n}
                className={`h-7 w-7 ${n <= Math.round(overall) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/40"} ${tier === "excellent" && tierShown ? "drop-shadow-[0_0_10px_rgba(250,204,21,0.7)]" : ""}`}
                strokeWidth={1.5}
              />
            ))}
          </div>
          <div className="text-2xl font-bold tabular-nums">
            {overall.toFixed(1)} <span className="text-base font-normal text-muted-foreground">/ 5</span>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-5 space-y-4">
        <dl className="grid gap-3 text-sm">
          {authorName && (
            <Row label="Locale" value={authorName} />
          )}
          {shiftMeta?.role && <Row label="Ruolo" value={shiftMeta.role} />}
          {shiftMeta?.date && (
            <Row
              label="Data turno"
              value={new Date(shiftMeta.date).toLocaleDateString("it-IT", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            />
          )}
          <Row label="Valutazione complessiva" value={`${overall.toFixed(1)} / 5`} />
        </dl>

        <div className="border-t pt-4">
          <h3 className="mb-2 text-sm font-semibold">Dettaglio per parametro</h3>
          <ul className="space-y-2">
            {REVIEW_CRITERIA.map((c) => {
              const v = scores[c];
              return (
                <li key={c} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">{CRITERION_LABEL[c]}</span>
                  <span className="flex items-center gap-0.5" aria-label={`${v ?? 0} su 5`}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star
                        key={n}
                        className={`h-4 w-4 ${v && n <= v ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`}
                        strokeWidth={1.5}
                      />
                    ))}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        {review.comment && (
          <div className="border-t pt-4">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <MessageSquare className="h-4 w-4" /> Commento del ristoratore
            </h3>
            <p className="rounded-lg bg-muted/40 p-3 text-sm italic">“{review.comment}”</p>
          </div>
        )}
      </section>

      <div className="mt-5 flex flex-wrap gap-2">
        {review.application_id && (
          <Link to="/messages/$id" params={{ id: review.application_id }}>
            <Button variant="outline" className="gap-1">
              <MessageSquare className="h-4 w-4" /> Apri la conversazione
            </Button>
          </Link>
        )}
        <Link to="/shifts">
          <Button variant="ghost" className="gap-1">
            <ArrowLeft className="h-4 w-4" /> Torna ai turni
          </Button>
        </Link>
      </div>
    </AppShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function launchConfetti(tier: "excellent" | "good") {
  const palette = tier === "excellent"
    ? ["#facc15", "#fbbf24", "#f59e0b", "#fde68a", "#fff7ed"]
    : ["#34d399", "#10b981", "#a7f3d0"];
  const burst = (origin: { x: number; y: number }) =>
    confetti({
      particleCount: tier === "excellent" ? 90 : 45,
      spread: tier === "excellent" ? 80 : 55,
      startVelocity: 45,
      ticks: 200,
      origin,
      colors: palette,
      scalar: tier === "excellent" ? 1 : 0.8,
    });
  burst({ x: 0.3, y: 0.3 });
  burst({ x: 0.7, y: 0.3 });
  if (tier === "excellent") {
    setTimeout(() => burst({ x: 0.5, y: 0.4 }), 250);
  }
}