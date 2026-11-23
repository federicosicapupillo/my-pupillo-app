import * as React from "react";
import mascot from "@/assets/demo-pupillo/pupillo-posa-mano-alzata.webp.asset.json";
import { computePose, stopScrolls, findLane, hatRelease, MASCOT, type Rect, type Stop } from "@/lib/pupillo-path";

type Regia = "cappello" | "semplice";

function docRect(el: Element): Rect {
  const r = el.getBoundingClientRect();
  return { x: r.left + window.scrollX, y: r.top + window.scrollY, w: r.width, h: r.height };
}
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
/** Contenuti che Pupillo non deve attraversare (le righe di sosta sono riservate a lui). */
const OBSTACLES = "main :is(h1,h2,h3,p,a,button,video,img,li,article,ol,[role=group],[data-obstacle])";

/**
 * Pupillo animato allo scroll (fase A, una posa 2D della tavola approvata).
 * Legge appoggi ([data-perch]), logo ([data-hat-logo]) e ostacoli reali dal DOM;
 * aggiunge lo spazio necessario alle soste. Solo transform/opacity; rAF fermo quando stabile.
 */
export function PupilloDirector({ regia, rootRef }: { regia: Regia; rootRef: React.RefObject<HTMLDivElement | null> }) {
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
    const rows = () => Array.from(root.querySelectorAll<HTMLElement>("[data-stop-row]"));
    const spacer = root.querySelector<HTMLElement>("[data-tail-spacer]");
    const resetSpace = () => { rows().forEach((r) => { r.style.paddingTop = ""; r.dataset["pad"] = "0"; }); if (spacer) spacer.style.height = "0px"; };
    if (!motion) { resetSpace(); bubbleEls().forEach((b) => { b.style.opacity = "1"; b.style.transform = ""; }); return; }
    const fig = figRef.current, layer = layerRef.current;
    if (!fig || !layer) return;

    let stops: Stop[] = [];
    let lanes: (number | null)[] = [];
    let logo: Rect | null = null;
    let pin: { start: number; length: number } | undefined;
    let figW = 100, figH = 131, dwell = 120;
    let shown = -1, target = 0, raf = 0, lastPhase = "";

    const measure = () => {
      const vh = window.innerHeight;
      const all = Array.from(root.querySelectorAll<HTMLElement>("[data-perch]"));
      const visible = all.filter((p) => p.offsetParent !== null && p.getBoundingClientRect().width > 0);
      all.filter((p) => !visible.includes(p)).forEach((p) => { const r = p.closest<HTMLElement>("[data-stop-row]"); if (r) { r.style.paddingTop = ""; r.dataset["pad"] = "0"; } });
      figW = visible[0]?.getBoundingClientRect().width ?? 100;
      figH = figW * (MASCOT.h / MASCOT.w);
      fig.style.width = `${figW}px`; fig.style.height = `${figH}px`;
      dwell = Math.min(140, vh * 0.16);

      const logoEl = root.querySelector("[data-hat-logo]");
      logo = logoEl ? docRect(logoEl) : null;
      const runway = root.querySelector<HTMLElement>("[data-hat-runway]");
      const section = runway?.firstElementChild ?? null;
      pin = undefined;
      if (runway && logo && logoEl && section) {
        const start = docRect(runway).y;
        const length = Number(runway.dataset["hatRunway"]) || 0;
        logo = { ...logo, y: start + logoEl.getBoundingClientRect().top - section.getBoundingClientRect().top };
        pin = { start, length };
      }

      // Layout di base: tolgo lo spazio già aggiunto, calcolo quello necessario.
      let cum = 0;
      const base = visible.map((p) => {
        const row = p.closest<HTMLElement>("[data-stop-row]");
        cum += Number(row?.dataset["pad"] ?? 0);
        const r = docRect(p);
        return { id: p.dataset["perch"]!, perch: { ...r, y: r.y - cum }, row };
      });
      const curExtra = spacer ? spacer.getBoundingClientRect().height : 0;
      const maxBase = document.documentElement.scrollHeight - vh - cum - curExtra;
      const minFirst = pin ? pin.start + pin.length + dwell + 520 : 0;
      const res = stopScrolls(base, vh, maxBase, dwell, minFirst);
      let changed = false;
      base.forEach((b, i) => {
        const pad = res.pads[i] ?? 0;
        if (b.row && Math.abs(Number(b.row.dataset["pad"] ?? 0) - pad) > 1) { b.row.dataset["pad"] = String(pad); b.row.style.paddingTop = `${pad}px`; changed = true; }
      });
      if (spacer && Math.abs(curExtra - res.extra) > 1) { spacer.style.height = `${res.extra}px`; changed = true; }
      if (changed) { requestAnimationFrame(measure); return; }
      stops = res.stops;

      // Corsie libere calcolate sui rettangoli reali dei contenuti.
      const curShift = pin ? clamp(window.scrollY - pin.start, 0, pin.length) : 0;
      const obstacles = Array.from(root.querySelectorAll<HTMLElement>(OBSTACLES))
        .filter((el) => !el.closest("[data-stop-row]") && el.getClientRects().length > 0)
        .map((el) => { const r = docRect(el); if (pin && section?.contains(el)) r.y += pin.length - curShift; return r; })
        .filter((r) => r.w > 0 && r.h > 0);
      const docW = root.clientWidth;
      const need = figW * 1.3 + 8;
      lanes = stops.map((st, i) => {
        const b = { x: st.perch.x + st.perch.w / 2, y: st.perch.y + st.perch.h };
        let a: { x: number; y: number } | null = null;
        if (i > 0) { const pr = stops[i - 1]!.perch; a = { x: pr.x + pr.w / 2, y: pr.y + pr.h }; }
        else if (regia === "cappello" && logo && pin) a = hatRelease({ ...logo, y: logo.y + pin.length }, figW, figH);
        if (!a) return null;
        const top = Math.min(a.y, b.y) - figH * 1.12 - 50, bottom = Math.max(a.y, b.y) + 6;
        // Dal cappello (decentrato a destra) si esce dal lato del cappello, senza attraversare il logo.
        const prefer = i === 0 ? "right" : b.x < docW / 2 ? "left" : "right";
        return findLane(obstacles, top, bottom, need, docW, prefer);
      });
      root.dataset["lanes"] = lanes.map((l, i) => (i === 0 && regia === "semplice" ? "-" : l === null ? "dissolvenza" : Math.round(l))).join(",");
      shown = -1;
      schedule();
    };

    const apply = (scroll: number) => {
      const { pose, bubbles } = computePose({ scroll, stops, dwell, figW, figH, regia, logo, lanes, ...(pin ? { pin } : {}) });
      const sx = pose.s * pose.sx, sy = pose.s * pose.sy;
      fig.style.transform = `translate3d(${pose.fx - figW / 2}px, ${pose.fy - figH}px, 0) rotate(${pose.rot}deg) scale(${sx}, ${sy})`;
      fig.style.opacity = String(pose.opacity);
      if (pose.clip) {
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
      if (pose.phase !== lastPhase) { lastPhase = pose.phase; fig.dataset["phase"] = pose.phase; }
    };

    const frame = () => {
      raf = 0;
      if (shown < 0) shown = target;
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
      resetSpace();
    };
  }, [motion, regia, rootRef]);

  if (!motion) return null;
  return (
    <div ref={layerRef} aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden" style={{ zIndex: 10 }}>
      <div ref={figRef} data-testid="pupillo-figure" className="absolute left-0 top-0 will-change-transform" style={{ transformOrigin: "50% 100%" }}>
        <img src={mascot.url} alt="" width={MASCOT.w} height={MASCOT.h} className="h-full w-full select-none object-contain" draggable={false} />
      </div>
    </div>
  );
}

/** Rapporto bocca/larghezza: la coda del fumetto è all'altezza della bocca reale. */
const MOUTH_Y = MASCOT.mouth.y / MASCOT.w;

/** Sosta con spazio riservato: appoggio per Pupillo e fumetto accanto, mai sopra il volto o i contenuti. */
export function PupilloStop({ id, side, sideMd, children, className = "" }: { id: string; side: "left" | "right"; sideMd?: "left" | "right"; children: React.ReactNode; className?: string }) {
  const md = sideMd ?? side;
  const dir = `${side === "right" ? "flex-row-reverse" : "flex-row"} ${md === "right" ? "md:flex-row-reverse" : "md:flex-row"}`;
  const L = "-left-[9px] right-auto border-r-0 border-t-0 border-l-2 border-b-2";
  const R = "-right-[9px] left-auto border-l-0 border-b-0 border-r-2 border-t-2";
  const mdL = "md:-left-[9px] md:right-auto md:border-r-0 md:border-t-0 md:border-l-2 md:border-b-2";
  const mdR = "md:-right-[9px] md:left-auto md:border-l-0 md:border-b-0 md:border-r-2 md:border-t-2";
  const tail = `${side === "right" ? R : L} ${md === "right" ? mdR : mdL}`;
  return (
    <div data-stop-row className={`mx-auto my-6 flex max-w-3xl items-start gap-3 [--pw:72px] sm:[--pw:88px] md:gap-5 md:[--pw:112px] ${dir} ${className}`}>
      <div data-perch={id} className="relative w-[var(--pw)] shrink-0" style={{ aspectRatio: `${MASCOT.w} / ${MASCOT.h}` }}>
        <img src={mascot.url} alt="" aria-hidden width={MASCOT.w} height={MASCOT.h} className="h-full w-full object-contain group-data-[motion=on]:invisible" />
      </div>
      <p
        data-bubble={id}
        className="relative min-w-0 flex-1 rounded-2xl border-2 bg-card px-4 py-3 text-sm font-semibold leading-snug text-card-foreground shadow-sm md:text-base"
        style={{ borderColor: "var(--neon-violet)", marginTop: `calc(var(--pw) * ${MOUTH_Y} - 28px)`, minHeight: "48px" }}
      >
        <span aria-hidden className={`absolute h-4 w-4 rotate-45 bg-card ${tail}`} style={{ borderColor: "var(--neon-violet)", top: "18px" }} />
        <span className="sr-only">Pupillo dice: </span>
        {children}
      </p>
    </div>
  );
}
