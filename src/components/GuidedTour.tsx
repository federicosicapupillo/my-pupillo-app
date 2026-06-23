import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

const PANEL_MAX_WIDTH = 420;
const PANEL_MARGIN = 16;
const PANEL_ESTIMATED_HEIGHT = 280;
const HIGHLIGHT_CLASS = "pupillo-tour-active";
const TARGET_ACTIVE_CLASS = "tour-target-active";
const STACK_LIFT_CLASS = "pupillo-tour-stack-lift";

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
  const liftedAncestorsRef = useRef<HTMLElement[]>([]);
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

  const clearActiveTarget = useCallback(() => {
    if (highlightedRef.current) {
      highlightedRef.current.classList.remove(HIGHLIGHT_CLASS);
      highlightedRef.current.classList.remove(TARGET_ACTIVE_CLASS);
      highlightedRef.current = null;
    }
    liftedAncestorsRef.current.forEach((node) => node.classList.remove(STACK_LIFT_CLASS));
    liftedAncestorsRef.current = [];
  }, []);

  const liftStackingAncestors = useCallback((el: HTMLElement) => {
    const lifted: HTMLElement[] = [];
    let node = el.parentElement;
    while (node && node !== document.body && node !== document.documentElement) {
      const style = window.getComputedStyle(node);
      const createsStack =
        (style.position !== "static" && style.zIndex !== "auto") ||
        style.transform !== "none" ||
        style.filter !== "none" ||
        style.backdropFilter !== "none" ||
        Number(style.opacity) < 1;
      if (createsStack || node.tagName.toLowerCase() === "header") {
        node.classList.add(STACK_LIFT_CLASS);
        lifted.push(node);
      }
      node = node.parentElement;
    }
    liftedAncestorsRef.current = lifted;
  }, []);

  // Apply / clean up the highlight class on the current target element.
  useEffect(() => {
    if (!running || !currentStep) return;
    let cancelled = false;
    let attempts = 0;
    const apply = () => {
      if (cancelled) return;
      // Clear previous
      clearActiveTarget();
      if (!currentStep.target || currentStep.placement === "center") return;
      const el = findVisibleTarget(currentStep.target);
      if (el) {
        el.classList.add(HIGHLIGHT_CLASS);
        el.classList.add(TARGET_ACTIVE_CLASS);
        liftStackingAncestors(el);
        highlightedRef.current = el;
      } else if (attempts < 8) {
        attempts += 1;
        setTimeout(apply, 150);
      }
    };
    apply();
    return () => {
      cancelled = true;
      clearActiveTarget();
    };
  }, [running, stepIndex, currentStep, clearActiveTarget, liftStackingAncestors]);

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

  // (vw/vh available for future use; spotlight halo/badge/connector layers removed.)
  void vw;
  void vh;

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
        className="fixed inset-0 h-full w-full cursor-default outline-none animate-in fade-in duration-200"
        style={{ zIndex: 9998, background: "rgba(0,0,0,0.88)" }}
      />

      {/* Global styles for highlight + lifted ancestors + keyframes */}
      <style>{`
        .${HIGHLIGHT_CLASS} {
          position: relative !important;
          z-index: 10001 !important;
          outline: 2px solid #D4FF00 !important;
          outline-offset: 6px !important;
          border-radius: 14px !important;
          box-shadow:
            0 0 0 6px rgba(212,255,0,0.10),
            0 0 32px rgba(212,255,0,0.30),
            0 0 80px rgba(212,255,0,0.12) !important;
          animation: tourHighlightPulse 1.8s ease-in-out infinite !important;
          transform: none !important;
        }
        .${TARGET_ACTIVE_CLASS} { /* hook for external styling */ }
        .${STACK_LIFT_CLASS} {
          position: relative !important;
          z-index: 10000 !important;
          isolation: auto !important;
        }
        @keyframes tourHighlightPulse {
          0%, 100% {
            box-shadow:
              0 0 0 6px rgba(212,255,0,0.10),
              0 0 32px rgba(212,255,0,0.30),
              0 0 80px rgba(212,255,0,0.12);
          }
          50% {
            box-shadow:
              0 0 0 10px rgba(212,255,0,0.06),
              0 0 50px rgba(212,255,0,0.45),
              0 0 100px rgba(212,255,0,0.18);
          }
        }
        @keyframes tourCardIn {
          from { opacity: 0; transform: translate(-50%, 8px); }
          to   { opacity: 1; transform: translate(-50%, 0);   }
        }
        @keyframes tourCardInCenter {
          from { opacity: 0; transform: translate(-50%, calc(-50% + 8px)) scale(.98); }
          to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
      `}</style>

      {/* Fixed guide panel */}
      <div
        style={{
          ...panelStyle,
          zIndex: 10002,
          background: "#1a1a24",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 22,
          padding: 28,
          color: "#ffffff",
          boxShadow:
            "0 24px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(212,255,0,0.06)",
          animation: isCenterStep
            ? "tourCardIn .22s ease-out"
            : "tourCardIn .22s ease-out",
        }}
        className="fixed"
      >
        {/* [A] Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <span
            style={{
              fontSize: 11,
              color: "#D4FF00",
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            Step {stepIndex + 1} di {total}
          </span>
          <button
            type="button"
            onClick={() => finish(true)}
            aria-label="Chiudi tour"
            className="tour-close-btn"
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: "transparent",
              border: "none",
              color: "#7a7a8c",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 20,
              lineHeight: 1,
              transition: "color .2s ease, background-color .2s ease",
            }}
          >
            ×
          </button>
        </div>

        {/* [B] Title */}
        <h2
          style={{
            fontSize: 22,
            fontWeight: 800,
            color: "#ffffff",
            marginTop: 16,
            lineHeight: 1.2,
          }}
        >
          {currentStep.title}
        </h2>

        {/* [C] Body */}
        <p
          style={{
            fontSize: 14,
            color: "#7a7a8c",
            marginTop: 10,
            lineHeight: 1.6,
          }}
        >
          {currentStep.body}
        </p>

        {/* [D] Progress dots */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginTop: 24,
          }}
        >
          {tour.steps.map((_, i) => {
            const active = i === stepIndex;
            return (
              <span
                key={i}
                style={{
                  width: active ? 26 : 7,
                  height: 7,
                  background: active ? "#D4FF00" : "#2e2e3e",
                  borderRadius: active ? 999 : "50%",
                  transition:
                    "width .3s cubic-bezier(0.4,0,0.2,1), background-color .3s ease",
                }}
              />
            );
          })}
        </div>

        {/* [E] Footer CTA */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            marginTop: 24,
          }}
        >
          <div style={{ minWidth: 0 }}>
            {!isLast && (
              <button
                type="button"
                onClick={() => finish(true)}
                className="tour-skip-btn"
                style={{
                  color: "#7a7a8c",
                  fontSize: 13,
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  padding: 0,
                  transition: "color .2s ease",
                }}
              >
                Salta
              </button>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {!isFirst && !isCenterStep && (
              <button
                type="button"
                onClick={prev}
                className="tour-back-btn"
                style={{
                  border: "1.5px solid rgba(255,255,255,0.15)",
                  borderRadius: 999,
                  padding: "10px 20px",
                  color: "#ffffff",
                  background: "transparent",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "border-color .2s ease",
                }}
              >
                ‹ Indietro
              </button>
            )}
            <button
              type="button"
              onClick={next}
              className="tour-next-btn"
              style={{
                background: "#D4FF00",
                color: "#13131a",
                border: "none",
                borderRadius: 999,
                padding: "12px 22px",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                boxShadow:
                  "0 8px 24px rgba(212,255,0,0.25), 0 0 0 1px rgba(212,255,0,0.15)",
                transition: "transform .15s ease, box-shadow .2s ease",
              }}
            >
              {isLast ? "Inizia a usare Pupillo" : isFirst ? "Inizia il tour ›" : "Avanti ›"}
            </button>
          </div>
        </div>

        {/* hover states for raw buttons (no Tailwind hover for inline-styled) */}
        <style>{`
          .tour-close-btn:hover { color: #fff !important; background: rgba(255,255,255,0.05) !important; }
          .tour-skip-btn:hover  { color: #fff !important; }
          .tour-back-btn:hover  { border-color: rgba(255,255,255,0.35) !important; }
          .tour-next-btn:hover  { transform: translateY(-1px); box-shadow: 0 12px 32px rgba(212,255,0,0.35), 0 0 0 1px rgba(212,255,0,0.25) !important; }
        `}</style>
      </div>
    </div>
  );
}