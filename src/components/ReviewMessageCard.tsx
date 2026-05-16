import { useEffect, useState } from "react";
import { Star, Trophy, Sparkles } from "lucide-react";
import confetti from "canvas-confetti";

export type ReviewPayload = {
  rating: number;
  comment: string | null;
  restaurantName: string | null;
  role: string | null;
  shiftDate: string | null;
  reputationImproved?: boolean;
  newBadge?: string | null;
};

export function parseReviewBody(body: string): ReviewPayload | null {
  try {
    const idx = body.indexOf("{");
    if (idx < 0) return null;
    const p = JSON.parse(body.slice(idx));
    if (typeof p?.rating !== "number") return null;
    return p as ReviewPayload;
  } catch {
    return null;
  }
}

function fireCelebration(rating: number) {
  const colors = ["#fbbf24", "#f59e0b", "#fde68a", "#fff7cc", "#ffffff"];
  if (rating >= 5) {
    const end = Date.now() + 1800;
    const frame = () => {
      confetti({
        particleCount: 6,
        angle: 60,
        spread: 70,
        origin: { x: 0, y: 0.7 },
        colors,
      });
      confetti({
        particleCount: 6,
        angle: 120,
        spread: 70,
        origin: { x: 1, y: 0.7 },
        colors,
      });
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    frame();
    confetti({
      particleCount: 120,
      spread: 100,
      startVelocity: 45,
      origin: { y: 0.6 },
      colors,
    });
  } else if (rating === 4) {
    confetti({
      particleCount: 60,
      spread: 70,
      origin: { y: 0.7 },
      colors,
      ticks: 120,
    });
  }
}

function formatDate(d: string | null): string {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("it-IT", {
      day: "2-digit", month: "long", year: "numeric",
    });
  } catch { return d; }
}

export function ReviewMessageCard({
  messageId,
  payload,
  isRecipient,
  alreadyRead,
}: {
  messageId: string;
  payload: ReviewPayload;
  isRecipient: boolean;
  alreadyRead: boolean;
}) {
  const { rating, comment, restaurantName, role, shiftDate, reputationImproved, newBadge } = payload;
  const [celebrated, setCelebrated] = useState(false);

  useEffect(() => {
    if (!isRecipient) return;
    if (alreadyRead) return;
    const key = `review-celebrated-${messageId}`;
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(key)) return;
    if (rating >= 4) {
      // Defer slightly so the card mounts before the burst
      const t = window.setTimeout(() => fireCelebration(rating), 200);
      window.localStorage.setItem(key, "1");
      setCelebrated(true);
      return () => window.clearTimeout(t);
    }
    window.localStorage.setItem(key, "1");
  }, [messageId, rating, isRecipient, alreadyRead]);

  const headline =
    rating >= 5 ? "Ottimo lavoro! Hai ricevuto 5 stelle." :
    rating === 4 ? "Bella valutazione! Continua così." :
    rating === 3 ? "Hai ricevuto una nuova valutazione." :
    "Hai ricevuto una valutazione. Leggi il feedback per migliorare.";

  const tone =
    rating >= 4 ? "from-amber-400/20 via-amber-300/10 to-transparent border-amber-400/40" :
    rating === 3 ? "from-muted/40 via-muted/20 to-transparent border-border" :
    "from-destructive/10 via-destructive/5 to-transparent border-destructive/30";

  return (
    <div className={`w-full max-w-[92%] sm:max-w-[80%] rounded-2xl border-2 bg-gradient-to-br ${tone} p-4 sm:p-5 shadow-sm ${celebrated ? "animate-scale-in" : "animate-fade-in"}`}>
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Sparkles className="h-3.5 w-3.5" />
        Hai ricevuto una nuova valutazione
      </div>
      <p className="mt-1 text-sm text-foreground/80">
        Il ristoratore ha valutato il tuo lavoro per il turno svolto.
      </p>

      <div className="mt-3 flex items-center gap-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className={`h-7 w-7 sm:h-8 sm:w-8 ${i < rating ? "text-amber-500" : "text-muted-foreground/30"}`}
            fill={i < rating ? "currentColor" : "none"}
            strokeWidth={1.5}
          />
        ))}
        <span className="ml-2 text-base font-bold">{rating}/5</span>
      </div>

      <div className="mt-3 text-base font-semibold leading-snug">{headline}</div>

      <dl className="mt-3 grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-muted-foreground">Locale</dt>
        <dd className="font-medium truncate">{restaurantName || "—"}</dd>
        <dt className="text-muted-foreground">Ruolo</dt>
        <dd className="font-medium truncate">{role || "—"}</dd>
        <dt className="text-muted-foreground">Data turno</dt>
        <dd className="font-medium">{formatDate(shiftDate)}</dd>
      </dl>

      {comment && (
        <div className="mt-3 rounded-xl bg-background/60 border p-3 text-sm italic">
          “{comment}”
        </div>
      )}

      {(reputationImproved || newBadge) && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {reputationImproved && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 px-3 py-1 text-xs font-semibold">
              <Trophy className="h-3.5 w-3.5" /> La tua reputazione è migliorata
            </span>
          )}
          {newBadge && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 text-primary px-3 py-1 text-xs font-semibold">
              <Sparkles className="h-3.5 w-3.5" /> Nuovo badge sbloccato: {newBadge}
            </span>
          )}
        </div>
      )}
    </div>
  );
}