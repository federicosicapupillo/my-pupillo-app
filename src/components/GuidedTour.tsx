import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Sparkles, X, Check } from "lucide-react";
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

const PANEL_MAX_WIDTH = 460;
const PANEL_MARGIN = 16;
const PANEL_ESTIMATED_HEIGHT = 260;
const HIGHLIGHT_CLASS = "pupillo-tour-active";
const SPOTLIGHT_PADDING = 8;

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
  const tourRole = role === "worker" || role === "restaurant" ? role : null;
  const tour = useMemo(() => getTourForRole(tourRole), [tourRole]);

  const [running, setRunning] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const highlightedRef = useRef<HTMLElement | null>(null);
  const [viewport, setViewport] = useState<{ w: number; h: number }>(() => ({
    w: typeof window !== "undefined" ? window.innerWidth : 1024,
    h: typeof window !== "undefined" ? window.innerHeight : 768,
  }));
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
      const targetTour = getTourForRole(detail.role ?? tourRole);
      if (!targetTour) return;
      setStepIndex(0);
      setRunning(true);
    };
    window.addEventListener(TOUR_START_EVENT, onStart);
    return () => window.removeEventListener(TOUR_START_EVENT, onStart);
  }, [tourRole]);

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

  // Apply / clean up the highlight class on the current target element.
  useEffect(() => {
    if (!running || !currentStep) return;
    let cancelled = false;
    let attempts = 0;
    const apply = () => {
      if (cancelled) return;
      // Clear previous
      if (highlightedRef.current) {
        highlightedRef.current.classList.remove(HIGHLIGHT_CLASS);
        highlightedRef.current = null;
      }
      if (!currentStep.target || currentStep.placement === "center") return;
      const el = findVisibleTarget(currentStep.target);
      if (el) {
        el.classList.add(HIGHLIGHT_CLASS);
        highlightedRef.current = el;
      } else if (attempts < 8) {
        attempts += 1;
        setTimeout(apply, 150);
      }
    };
    apply();
    return () => {
      cancelled = true;
      if (highlightedRef.current) {
        highlightedRef.current.classList.remove(HIGHLIGHT_CLASS);
        highlightedRef.current = null;
      }
    };
  }, [running, stepIndex, currentStep]);

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
    const onChange = () => {
      setViewport({ w: window.innerWidth, h: window.innerHeight });
      measure();
    };
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

  /* ---------- fixed panel positioning ----------
   * The panel always sits at the bottom-center of the viewport.
   * If the highlighted target would be covered by the panel, we flip
   * the panel to the top instead. The target itself never moves the
   * panel around — only top/bottom flip happens.
   */

  const { w: vw, h: vh } = viewport;
  const hasTarget = !!rect && currentStep.placement !== "center";
  const isCenterStep = currentStep.placement === "center" || !hasTarget;

  // Decide if panel sits at bottom (default) or flips to top when the
  // target sits in the lower half of the viewport.
  // Center steps (welcome / done) get a perfectly centered modal.
  // Other steps get a stable bottom-or-top panel that flips if it would
  // cover the target.
  const panelAtBottom = isCenterStep
    ? true
    : (rect!.top + rect!.height / 2) < vh - PANEL_ESTIMATED_HEIGHT - 40;

  const panelStyle: React.CSSProperties = isCenterStep
    ? {
        position: "fixed",
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
        width: `min(${PANEL_MAX_WIDTH}px, calc(100vw - ${PANEL_MARGIN * 2}px))`,
      }
    : {
        position: "fixed",
        left: "50%",
        transform: "translateX(-50%)",
        width: `min(${PANEL_MAX_WIDTH}px, calc(100vw - ${PANEL_MARGIN * 2}px))`,
        ...(panelAtBottom
          ? { bottom: `max(${PANEL_MARGIN}px, env(safe-area-inset-bottom, 0px))` }
          : { top: `${PANEL_MARGIN}px` }),
      };

  // Spotlight rectangle (a transparent box with a glowing ring) drawn
  // exactly over the target. The actual element gets z-index 10001 via
  // the highlight class so it visually pops above the overlay.
  const spotlight = hasTarget
    ? {
        top: rect!.top - SPOTLIGHT_PADDING,
        left: rect!.left - SPOTLIGHT_PADDING,
        width: rect!.width + SPOTLIGHT_PADDING * 2,
        height: rect!.height + SPOTLIGHT_PADDING * 2,
      }
    : null;

  // Connector line from panel edge to the target center.
  let connector: { x1: number; y1: number; x2: number; y2: number } | null = null;
  if (hasTarget && !isCenterStep) {
    const panelCenterX = vw / 2;
    const panelEdgeY = panelAtBottom
      ? vh - PANEL_ESTIMATED_HEIGHT - PANEL_MARGIN
      : PANEL_MARGIN + PANEL_ESTIMATED_HEIGHT;
    const tx = rect!.left + rect!.width / 2;
    const ty = panelAtBottom
      ? rect!.top + rect!.height + 8
      : rect!.top - 8;
    connector = { x1: panelCenterX, y1: panelEdgeY, x2: tx, y2: ty };
  }

  return (
    <div
      aria-live="polite"
      role="dialog"
      aria-label={currentStep.title}
      className="pupillo-tour-root"
    >
      {/* Dim overlay; click = skip. Sits BELOW the highlighted target. */}
      <button
        type="button"
        aria-label="Chiudi tour"
        onClick={() => finish(true)}
        className="fixed inset-0 h-full w-full cursor-default bg-black/70 backdrop-blur-[3px] outline-none animate-in fade-in duration-200"
        style={{ zIndex: 9998 }}
      />

      {/* Spotlight ring drawn over the target (under the target itself
          so the target stays interactive-looking and on top). */}
      {spotlight && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed rounded-2xl transition-all duration-300 ease-out"
          style={{
            ...spotlight,
            zIndex: 9999,
            boxShadow:
              "0 0 0 2px hsl(var(--primary) / 0.9), 0 0 0 7px hsl(var(--primary) / 0.25), 0 0 32px 4px hsl(var(--primary) / 0.45)",
            animation: "pupillo-tour-pulse 2.4s ease-in-out infinite",
          }}
        />
      )}

      {/* Connector line from panel to target (above overlay, below panel) */}
      {connector && (
        <svg
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 h-full w-full"
          style={{ overflow: "visible", zIndex: 10001 }}
        >
          <line
            x1={connector.x1}
            y1={connector.y1}
            x2={connector.x2}
            y2={connector.y2}
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            strokeDasharray="5 6"
            strokeLinecap="round"
            opacity={0.7}
          />
          <circle
            cx={connector.x2}
            cy={connector.y2}
            r={4}
            fill="hsl(var(--primary))"
          />
        </svg>
      )}

      {/* Global styles for the highlighted target.
          The target sits above overlay+spotlight (z 10001) so it stays
          fully legible; the spotlight ring around it (z 9999) sits below
          it but above the overlay (z 9998) to create the focus halo. */}
      <style>{`
        .${HIGHLIGHT_CLASS} {
          position: relative !important;
          z-index: 10001 !important;
          border-radius: 12px;
          background: hsl(var(--background)) !important;
          transform: scale(1.04);
          transform-origin: center;
          transition: transform 260ms cubic-bezier(.2,.8,.2,1), box-shadow 260ms ease-out;
          will-change: transform;
        }
        .${HIGHLIGHT_CLASS} > * {
          position: relative;
          z-index: 1;
        }
        @keyframes pupillo-tour-pulse {
          0%, 100% {
            box-shadow:
              0 0 0 2px hsl(var(--primary) / 0.9),
              0 0 0 7px hsl(var(--primary) / 0.22),
              0 0 28px 4px hsl(var(--primary) / 0.40);
          }
          50% {
            box-shadow:
              0 0 0 2px hsl(var(--primary)),
              0 0 0 11px hsl(var(--primary) / 0.14),
              0 0 40px 8px hsl(var(--primary) / 0.55);
          }
        }
        @keyframes pupillo-tour-card-in {
          from { opacity: 0; transform: translateX(-50%) translateY(8px) scale(.98); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0)   scale(1);   }
        }
      `}</style>

      {/* Fixed guide panel */}
      <div
        style={{ ...panelStyle, zIndex: 10002 }}
        className="fixed rounded-3xl border border-primary/15 bg-card/95 text-card-foreground shadow-[0_24px_60px_-12px_hsl(var(--primary)/0.45),0_8px_24px_-8px_rgba(0,0,0,0.55)] backdrop-blur-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Decorative gradient top accent */}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-px"
          style={{
            background:
              "linear-gradient(90deg, transparent, hsl(var(--primary) / 0.6), transparent)",
          }}
        />

        {/* Top progress bar */}
        <div className="h-1 w-full bg-muted/40">
          <div
            className="h-full bg-gradient-to-r from-primary/70 via-primary to-primary/70 transition-all duration-500 ease-out"
            style={{ width: `${((stepIndex + 1) / total) * 100}%` }}
          />
        </div>

        <div className="p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2 min-w-0">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary">
                {isLast && !isCenterStep ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <Sparkles className="h-3 w-3" />
                )}
                Passo {stepIndex + 1} / {total}
              </span>
              {/* step dots */}
              <div className="hidden sm:flex items-center gap-1 ml-1">
                {tour.steps.map((_, i) => (
                  <span
                    key={i}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      i === stepIndex
                        ? "w-4 bg-primary"
                        : i < stepIndex
                          ? "w-1.5 bg-primary/60"
                          : "w-1.5 bg-muted-foreground/25"
                    }`}
                  />
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={() => finish(true)}
              aria-label="Chiudi tour"
              className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <h2 className="text-lg sm:text-xl font-semibold leading-tight tracking-tight">
            {currentStep.title}
          </h2>
          <p className="mt-2 text-sm sm:text-[15px] leading-relaxed text-muted-foreground">
            {currentStep.body}
          </p>

          {/* Footer actions */}
          <div className="mt-6 flex items-center justify-between gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => finish(true)}
              className="text-muted-foreground hover:text-foreground -ml-2"
            >
              {isLast ? "Chiudi" : "Salta"}
            </Button>
            <div className="flex items-center gap-2 min-w-0">
              {!isFirst && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={prev}
                  className="gap-1"
                  aria-label="Indietro"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span className="hidden sm:inline">Indietro</span>
                </Button>
              )}
              <Button
                size="sm"
                onClick={next}
                className="gap-1 max-w-full shadow-md shadow-primary/30"
              >
                <span className="truncate">
                  {isLast
                    ? "Inizia a usare Pupillo"
                    : isFirst
                      ? "Inizia il tour"
                      : "Avanti"}
                </span>
                {!isLast && <ChevronRight className="h-4 w-4 shrink-0" />}
                {isLast && <Check className="h-4 w-4 shrink-0" />}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}