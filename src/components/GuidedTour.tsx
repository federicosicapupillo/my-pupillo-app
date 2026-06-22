import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import {
  TOUR_START_EVENT,
  type TourStartDetail,
  type TourStep,
  getTourForRole,
  isTourCompleted,
  markTourCompleted,
  findVisibleTarget,
} from "@/lib/guided-tour";

type Rect = { top: number; left: number; width: number; height: number };

const PADDING = 8;
const POPOVER_WIDTH = 320;
const POPOVER_OFFSET = 14;

/**
 * GuidedTour — global tour runner mounted inside AppShell.
 *
 * - Auto-starts the role-specific tour the first time the user lands on
 *   an authenticated page, then never auto-runs again (persisted in
 *   localStorage per userId + tour key).
 * - Listens for `pupillo:start-tour` events so the assistant panel and
 *   any future "Rivedi guida" entry point can re-open the tour.
 * - Highlights stable `data-tour` attributes; missing targets are
 *   skipped automatically so the tour never breaks.
 */
export function GuidedTour() {
  const { user, role, extrasLoaded } = useAuth();
  const tour = useMemo(() => getTourForRole(role), [role]);

  const [running, setRunning] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const autoStartedRef = useRef(false);

  /* ---------- start triggers ---------- */

  // Auto-start once per user, after auth + role are loaded.
  useEffect(() => {
    if (!user || !extrasLoaded || !tour) return;
    if (autoStartedRef.current) return;
    if (isTourCompleted(user.id, tour.key)) return;
    autoStartedRef.current = true;
    // Defer a tick so the layout has settled before we measure targets.
    const t = setTimeout(() => {
      setStepIndex(0);
      setRunning(true);
    }, 600);
    return () => clearTimeout(t);
  }, [user, extrasLoaded, tour]);

  // Manual (re)start via event.
  useEffect(() => {
    const onStart = (ev: Event) => {
      const detail = (ev as CustomEvent<TourStartDetail>).detail ?? {};
      const targetTour = getTourForRole(detail.role ?? role ?? null);
      if (!targetTour) return;
      setStepIndex(0);
      setRunning(true);
    };
    window.addEventListener(TOUR_START_EVENT, onStart);
    return () => window.removeEventListener(TOUR_START_EVENT, onStart);
  }, [role]);

  /* ---------- measure target + auto-scroll ---------- */

  const currentStep: TourStep | null = running && tour ? tour.steps[stepIndex] ?? null : null;

  const measure = useCallback(() => {
    if (!currentStep) return;
    if (!currentStep.target || currentStep.placement === "center") {
      setRect(null);
      return;
    }
    const el = findVisibleTarget(currentStep.target);
    if (!el) {
      setRect(null);
      return;
    }
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [currentStep]);

  // When step changes: scroll target into view, then measure (with retries
  // to account for late-rendered elements / hidden mobile nav).
  useEffect(() => {
    if (!running || !currentStep) return;
    let cancelled = false;
    let attempts = 0;
    const tick = () => {
      if (cancelled) return;
      if (currentStep.target && currentStep.placement !== "center") {
        const el = findVisibleTarget(currentStep.target);
        if (el) {
          try {
            el.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
          } catch {
            el.scrollIntoView();
          }
        }
      }
      measure();
      attempts += 1;
      // Retry a few times: scrolling is async, and the layout may shift.
      if (attempts < 6) setTimeout(tick, 120);
    };
    tick();
    return () => {
      cancelled = true;
    };
  }, [running, stepIndex, currentStep, measure]);

  // Re-measure on resize / scroll while running.
  useEffect(() => {
    if (!running) return;
    const onChange = () => measure();
    window.addEventListener("resize", onChange);
    window.addEventListener("scroll", onChange, true);
    return () => {
      window.removeEventListener("resize", onChange);
      window.removeEventListener("scroll", onChange, true);
    };
  }, [running, measure]);

  /* ---------- controls ---------- */

  const finish = useCallback(
    (markCompleted: boolean) => {
      if (markCompleted && tour && user) markTourCompleted(user.id, tour.key);
      setRunning(false);
      setStepIndex(0);
      setRect(null);
    },
    [tour, user],
  );

  const next = useCallback(() => {
    if (!tour) return;
    if (stepIndex >= tour.steps.length - 1) {
      finish(true);
    } else {
      setStepIndex((i) => i + 1);
    }
  }, [tour, stepIndex, finish]);

  const prev = useCallback(() => setStepIndex((i) => Math.max(0, i - 1)), []);

  // ESC = skip
  useEffect(() => {
    if (!running) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        finish(true);
      } else if (e.key === "ArrowRight" || e.key === "Enter") {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        prev();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [running, next, prev, finish]);

  if (!running || !tour || !currentStep) return null;

  const total = tour.steps.length;
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === total - 1;

  /* ---------- popover positioning ---------- */

  const vw = typeof window !== "undefined" ? window.innerWidth : 1024;
  const vh = typeof window !== "undefined" ? window.innerHeight : 768;

  let popoverStyle: React.CSSProperties;
  let centered = false;

  if (!rect || currentStep.placement === "center") {
    centered = true;
    popoverStyle = {
      position: "fixed",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      width: `min(${POPOVER_WIDTH}px, calc(100vw - 32px))`,
    };
  } else {
    // Decide vertical placement based on available room.
    const spaceBelow = vh - (rect.top + rect.height);
    const spaceAbove = rect.top;
    const placeBelow = currentStep.placement === "bottom"
      ? spaceBelow > 180 || spaceBelow > spaceAbove
      : spaceBelow > spaceAbove;
    const top = placeBelow
      ? Math.min(rect.top + rect.height + POPOVER_OFFSET, vh - 220)
      : Math.max(16, rect.top - POPOVER_OFFSET - 200);
    // Horizontal: try to center on the target, clamp to viewport.
    const idealLeft = rect.left + rect.width / 2 - POPOVER_WIDTH / 2;
    const left = Math.max(16, Math.min(idealLeft, vw - POPOVER_WIDTH - 16));
    popoverStyle = {
      position: "fixed",
      top,
      left,
      width: `min(${POPOVER_WIDTH}px, calc(100vw - 32px))`,
    };
  }

  return (
    <div
      aria-live="polite"
      role="dialog"
      aria-label={currentStep.title}
      className="fixed inset-0 z-[80]"
    >
      {/* Dim overlay; click = skip */}
      <button
        type="button"
        aria-label="Chiudi tour"
        onClick={() => finish(true)}
        className="absolute inset-0 h-full w-full cursor-default bg-black/55 backdrop-blur-[1px] outline-none"
      />

      {/* Spotlight cutout via box-shadow trick */}
      {rect && !centered && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute rounded-xl ring-2 ring-primary/80 transition-all duration-200"
          style={{
            top: rect.top - PADDING,
            left: rect.left - PADDING,
            width: rect.width + PADDING * 2,
            height: rect.height + PADDING * 2,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)",
          }}
        />
      )}

      {/* Popover */}
      <div
        style={popoverStyle}
        className="rounded-2xl border border-border bg-card text-card-foreground shadow-2xl p-4 sm:p-5"
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="text-xs font-medium text-muted-foreground">
            {stepIndex + 1} di {total}
          </div>
          <button
            type="button"
            onClick={() => finish(true)}
            aria-label="Chiudi tour"
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <h2 className="text-base sm:text-lg font-semibold leading-tight">{currentStep.title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{currentStep.body}</p>

        {/* Progress dots */}
        <div className="mt-4 flex items-center justify-center gap-1.5" aria-hidden="true">
          {tour.steps.map((s, i) => (
            <span
              key={s.id}
              className={
                "h-1.5 rounded-full transition-all " +
                (i === stepIndex ? "w-5 bg-primary" : "w-1.5 bg-muted-foreground/30")
              }
            />
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => finish(true)}
            className="text-muted-foreground"
          >
            {isLast ? "Chiudi" : "Salta"}
          </Button>
          <div className="flex items-center gap-2">
            {!isFirst && (
              <Button variant="outline" size="sm" onClick={prev} className="gap-1">
                <ChevronLeft className="h-4 w-4" />
                Indietro
              </Button>
            )}
            <Button size="sm" onClick={next} className="gap-1">
              {isLast
                ? role === "restaurant"
                  ? "Inizia"
                  : "Inizia a usare Pupillo"
                : isFirst
                  ? "Inizia"
                  : "Avanti"}
              {!isLast && <ChevronRight className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}