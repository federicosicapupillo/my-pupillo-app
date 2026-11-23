import * as React from "react";
import mascot from "@/assets/demo-pupillo/pupillo-mascotte-ritaglio.webp.asset.json";
import { computePose, stopScrolls, MASCOT, type Rect, type Stop } from "@/lib/pupillo-path";

type Regia = "cappello" | "semplice";

function docRect(el: Element): Rect {
  const r = el.getBoundingClientRect();
  return { x: r.left + window.scrollX, y: r.top + window.scrollY, w: r.width, h: r.height };
}

/**
 * Pupillo animato allo scroll (fase A, immagine 2D ritagliata).
 * Legge gli appoggi reali ([data-perch]) e il logo grande ([data-hat-logo]) dal DOM.
 * Solo transform/opacity; il rAF si ferma quando la posa è stabile.
 */
export function PupilloDirector({ regia, rootRef, onPhase }: { regia: Regia; rootRef: React.RefObject<HTMLDivElement | null>; onPhase?: (p: string) => void }) {
  const figRef = React.useRef<HTMLDivElement>(null);
  const layerRef = React.useRef<HTMLDivElement>(null);
  const [motion, setMotion] = React.useState(false);

  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const upd = () => setMotion(!mq.matches);
    upd();
    mq.addEventListener("change", upd);
    return () => mq.removeEventListener("change", upd);
  }, []);

  React.useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    root.dataset["motion"] = motion ? "on" : "off";
    const bubbleEls = () => Array.from(root.querySelectorAll<HTMLElement>("[data-bubble]"));
    if (!motion) { bubbleEls().forEach((b) => { b.style.opacity = "1"; }); return; }
    const fig = figRef.current, layer = layerRef.current;
    if (!fig || !layer) return;

    let stops: Stop[] = [];
    let logo: Rect | null = null;
    let pin: { start: number; length: number } | undefined;
    let figW = 100, figH = 123, dwell = 120;
    let shown = -1, target = 0, raf = 0, lastPhase = "";

    const measure = () => {
      const perches = Array.from(root.querySelectorAll<HTMLElement>("[data-perch]"))
        .filter((p) => p.offsetParent !== null && p.getBoundingClientRect().width > 0)
        .map((p) => ({ id: p.dataset["perch"]!, perch: docRect(p) }));
      const first = perches[0];
      figW = first?.perch.w ?? 100;
      figH = figW * (MASCOT.h / MASCOT.w);
      fig.style.width = `${figW}px`; fig.style.height = `${figH}px`;
      const vh = window.innerHeight;
      dwell = Math.min(140, vh * 0.16);
      const logoEl = root.querySelector("[data-hat-logo]");
      logo = logoEl ? docRect(logoEl) : null;
      const runway = root.querySelector<HTMLElement>("[data-hat-runway]");
      pin = undefined;
      if (runway && logo && logoEl) {
        const start = docRect(runway).y;
        const length = Number(runway.dataset["hatRunway"]) || 0;
        const section = runway.firstElementChild!;
        const offset = logoEl.getBoundingClientRect().top - section.getBoundingClientRect().top;
        logo = { ...logo, y: start + offset };
        pin = { start, length };
      }
      const maxScroll = document.documentElement.scrollHeight - vh;
      stops = stopScrolls(perches, vh, maxScroll, dwell, pin ? pin.start + pin.length + dwell + 220 : 0);
      shown = -1;
      schedule();
    };

    const apply = (scroll: number) => {
      const { pose, bubbles } = computePose({ scroll, stops, dwell, figW, figH, regia, logo, ...(pin ? { pin } : {}) });
      const sx = pose.s * pose.sx, sy = pose.s * pose.sy;
      fig.style.transform = `translate3d(${pose.fx - figW / 2}px, ${pose.fy - figH}px, 0) rotate(${pose.rot}deg) scale(${sx}, ${sy})`;
      fig.style.opacity = String(pose.opacity);
      if (pose.clip) {
        // Ritaglio in coordinate locali (origine 50% 100%): il cappello copre la parte bassa.
        const toLocalY = (y: number) => figH + (y - pose.fy) / sy;
        const toLocalX = (x: number) => figW / 2 + (x - pose.fx) / sx;
        const bottom = Math.max(0, figH - toLocalY(pose.clip.bottom));
        const left = Math.max(0, toLocalX(pose.clip.left));
        const right = Math.max(0, figW - toLocalX(pose.clip.right));
        fig.style.clipPath = `inset(0px ${right}px ${bottom}px ${left}px)`;
      } else fig.style.clipPath = "none";
      layer.style.zIndex = pose.front ? "30" : "10";
      for (const b of bubbleEls()) {
        const o = bubbles[b.dataset["bubble"]!] ?? 0;
        b.style.opacity = String(o);
        b.style.transform = `translateY(${(1 - o) * 6}px)`;
      }
      if (pose.phase !== lastPhase) { lastPhase = pose.phase; fig.dataset["phase"] = pose.phase; onPhase?.(pose.phase); }
    };

    const frame = () => {
      raf = 0;
      if (shown < 0) shown = target;
      // Leggero inseguimento: converge sullo stesso valore, poi si ferma.
      shown += (target - shown) * 0.35;
      if (Math.abs(target - shown) < 0.5) shown = target;
      apply(shown);
      if (shown !== target) raf = requestAnimationFrame(frame);
    };
    function schedule() { target = window.scrollY; if (!raf) raf = requestAnimationFrame(frame); }

    measure();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", measure);
    window.addEventListener("load", measure);
    const onVis = () => { if (document.visibilityState === "visible") measure(); };
    document.addEventListener("visibilitychange", onVis);
    document.fonts?.ready.then(measure).catch(() => {});
    const ro = new ResizeObserver(() => measure());
    ro.observe(root);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", measure);
      window.removeEventListener("load", measure);
      document.removeEventListener("visibilitychange", onVis);
      ro.disconnect();
    };
  }, [motion, regia, rootRef, onPhase]);

  if (!motion) return null;
  return (
    <div ref={layerRef} aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden" style={{ zIndex: 10 }}>
      <div ref={figRef} data-testid="pupillo-figure" className="absolute left-0 top-0 will-change-transform" style={{ transformOrigin: "50% 100%" }}>
        <img src={mascot.url} alt="" width={MASCOT.w} height={MASCOT.h} className="h-full w-full select-none object-contain" draggable={false} />
      </div>
    </div>
  );
}

/** Sosta con spazio riservato: appoggio per Pupillo e fumetto accanto, mai sopra i contenuti. */
export function PupilloStop({ id, side, sideMd, children, className = "" }: { id: string; side: "left" | "right"; sideMd?: "left" | "right"; children: React.ReactNode; className?: string }) {
  const md = sideMd ?? side;
  const dir = `${side === "right" ? "flex-row-reverse" : "flex-row"} ${md === "right" ? "md:flex-row-reverse" : "md:flex-row"}`;
  const L = "-left-[9px] right-auto border-r-0 border-t-0 border-l-2 border-b-2";
  const R = "-right-[9px] left-auto border-l-0 border-b-0 border-r-2 border-t-2";
  const mdL = "md:-left-[9px] md:right-auto md:border-r-0 md:border-t-0 md:border-l-2 md:border-b-2";
  const mdR = "md:-right-[9px] md:left-auto md:border-l-0 md:border-b-0 md:border-r-2 md:border-t-2";
  const tail = `${side === "right" ? R : L} ${md === "right" ? mdR : mdL}`;
  return (
    <div className={`mx-auto my-6 flex max-w-3xl items-start gap-3 md:gap-5 ${dir} ${className}`}>
      <div data-perch={id} className="relative aspect-[478/588] w-[72px] shrink-0 sm:w-[88px] md:w-[112px]">
        <img src={mascot.url} alt="" aria-hidden width={MASCOT.w} height={MASCOT.h} className="h-full w-full object-contain group-data-[motion=on]:invisible" />
      </div>
      <p
        data-bubble={id}
        className={`relative mt-3 min-w-0 flex-1 rounded-2xl border-2 bg-card px-4 py-3 text-sm font-semibold leading-snug text-card-foreground shadow-sm md:mt-6 md:text-base`}
        style={{ borderColor: "var(--neon-violet)" }}
      >
        <span aria-hidden className={`absolute top-5 h-4 w-4 rotate-45 bg-card ${tail}`} style={{ borderColor: "var(--neon-violet)" }} />
        <span className="sr-only">Pupillo dice: </span>
        {children}
      </p>
    </div>
  );
}
