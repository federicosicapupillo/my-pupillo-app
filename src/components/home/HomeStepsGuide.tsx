import { useEffect, useRef, useState } from "react";
import mascotAsset from "@/assets/demo-pupillo/pupillo-posa-mano-alzata.webp.asset.json";

type Audience = "worker" | "restaurant";
type Step = { title: string; text: string; bubble: string };

const STEPS: Record<Audience, Step[]> = {
  worker: [
    { title: "Crea il tuo profilo", text: "Indica mansioni, esperienza e disponibilità.", bubble: "Indica le mansioni che svolgi, la tua esperienza e quando sei disponibile. Aiuterai i locali a capire cosa sai fare." },
    { title: "Candidati ai turni", text: "Scegli i turni che ti interessano e invia la candidatura.", bubble: "Scegli un turno adatto a te, controlla orari e compenso e invia la candidatura." },
    { title: "Ricevi la conferma del locale", text: "Il turno è tuo quando il locale accetta la candidatura.", bubble: "Il turno è confermato solo quando il locale accetta la tua candidatura. Fino a quel momento non è ancora assegnato a te." },
  ],
  restaurant: [
    { title: "Registra il tuo locale", text: "Inserisci i dati del locale e del referente.", bubble: "Inserisci i dati del locale e del referente: è il primo passo per iniziare a cercare le persone giuste." },
    { title: "Pubblica il turno", text: "Indica mansione, orario e compenso.", bubble: "Indica la mansione, gli orari e il compenso. Le persone interessate potranno candidarsi al tuo turno." },
    { title: "Scegli tra le candidature", text: "Valuta i profili e conferma la persona giusta.", bubble: "Valuta i profili, scegli la persona adatta e conferma la candidatura per assegnare il turno." },
  ],
};

// Geometria dell'asset 474×622, bocca in (244,272).
const MOUTH_Y = 272 / 622;
const ASPECT = 622 / 474;
const ACCENT: Record<Audience, string> = { worker: "var(--primary)", restaurant: "var(--neon-violet)" };

const smooth = (t: number) => t * t * (3 - 2 * t);

/** Posizione pura dallo scroll: fascia di sosta attorno a ogni fumetto, trasferimento morbido tra le fasce. */
export function guidePose(anchor: number, stops: number[], band: number): { y: number; tilt: number; stop: number } {
  const n = stops.length;
  if (!n) return { y: 0, tilt: 0, stop: -1 };
  const first = stops[0];
  const last = stops[n - 1];
  if (first === undefined || last === undefined) return { y: 0, tilt: 0, stop: -1 };
  if (anchor <= first + band) return { y: first, tilt: 0, stop: anchor >= first - band ? 0 : -1 };
  if (anchor >= last - band) return { y: last, tilt: 0, stop: anchor <= last + band ? n - 1 : -1 };
  for (let i = 0; i < n - 1; i++) {
    const a = stops[i];
    const b = stops[i + 1];
    if (a === undefined || b === undefined) continue;
    if (anchor <= a + band) return { y: a, tilt: 0, stop: i };
    if (anchor < b - band) {
      const u = (anchor - (a + band)) / (b - a - 2 * band);
      const s = Math.sin(Math.PI * u);
      return { y: a + (b - a) * smooth(u), tilt: 7 * s * s, stop: -1 };
    }
  }
  return { y: last, tilt: 0, stop: n - 1 };
}

export function HomeStepsGuide({ audience, setAudience }: { audience: Audience; setAudience: (a: Audience) => void }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const figRef = useRef<HTMLDivElement>(null);
  const bubbleRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [active, setActive] = useState(0);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const upd = () => setReduced(mq.matches);
    upd();
    mq.addEventListener("change", upd);
    return () => mq.removeEventListener("change", upd);
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    const fig = figRef.current;
    if (!root || !fig) return;
    let stops: number[] = []; // centro fumetto, relativo al contenitore
    let rootTop = 0;
    let figH = 0;
    let raf = 0;
    let last = -2;
    let displayed = 0;
    let previousTime = 0;
    let alive = true;

    const target = () => window.scrollY + window.innerHeight * 0.55 - rootTop;

    const measure = () => {
      const r = root.getBoundingClientRect();
      rootTop = r.top + window.scrollY;
      figH = fig.offsetHeight;
      stops = bubbleRefs.current.slice(0, 3).map((b) => {
        if (!b) return 0;
        const br = b.getBoundingClientRect();
        return br.top - r.top + br.height / 2;
      });
    };
    const paint = () => {
      if (reduced) {
        fig.style.transform = `translate3d(0, ${(stops[0] ?? 0) - figH * MOUTH_Y}px, 0)`;
        return;
      }
      const band = Math.min(70, window.innerHeight * 0.09);
      const p = guidePose(displayed, stops, band);
      fig.style.transform = `translate3d(0, ${p.y - figH * MOUTH_Y}px, 0) rotate(${p.tilt.toFixed(2)}deg)`;
      if (p.stop !== last) {
        last = p.stop;
        setActive(p.stop);
      }
    };
    const render = (time: number) => {
      raf = 0;
      if (!alive || document.hidden) return;
      const destination = target();
      const dt = Math.max(0, time - previousTime);
      previousTime = time;
      // Smorzamento esponenziale: indipendente dal frame rate, senza overshoot.
      displayed += (destination - displayed) * (1 - Math.exp(-dt / 90));
      const settled = Math.abs(destination - displayed) < 0.1;
      if (settled) displayed = destination;
      paint();
      if (!settled) raf = requestAnimationFrame(render);
    };
    const schedule = () => {
      if (!alive || reduced || document.hidden || raf) return;
      previousTime = performance.now();
      raf = requestAnimationFrame(render);
    };
    const remeasure = () => {
      if (!alive) return;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      measure();
      displayed = target();
      paint();
    };
    const visibility = () => {
      if (document.hidden) {
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
      } else remeasure();
    };

    remeasure();
    const ro = new ResizeObserver(remeasure);
    ro.observe(root);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", remeasure);
    window.addEventListener("load", remeasure);
    document.addEventListener("visibilitychange", visibility);
    document.fonts?.ready.then(() => { if (alive) remeasure(); });
    return () => {
      alive = false;
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", remeasure);
      window.removeEventListener("load", remeasure);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [audience, reduced]);

  const accent = ACCENT[audience];

  return (
    <div className="mx-auto mt-8 max-w-3xl">
      <div role="group" aria-label="Scegli per chi vedere i passi" className="mx-auto grid max-w-md grid-cols-2 gap-2 rounded-full border border-border p-1">
        {(["worker", "restaurant"] as const).map((a) => (
          <button
            key={a}
            type="button"
            aria-pressed={audience === a}
            onClick={() => setAudience(a)}
            className="rounded-full px-3 py-2 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
            style={audience === a ? { background: ACCENT[a], color: a === "worker" ? "var(--primary-foreground)" : "var(--accent-foreground)" } : undefined}
          >
            {a === "worker" ? "Cerco turni" : "Cerco personale"}
          </button>
        ))}
      </div>

      <h3 className="mt-8 text-sm font-bold uppercase tracking-wider" style={{ color: audience === "worker" ? "var(--neon-lime)" : "var(--neon-violet)" }}>
        {audience === "worker" ? "Per chi cerca turni" : "Per i locali"}
      </h3>

      {/* Corsia destra riservata alla mascotte: nessun testo la attraversa. */}
      <div ref={rootRef} className="relative mt-4 pr-[72px] md:pr-[132px]">
        <ol className="space-y-6">
          {STEPS[audience].map((s, i) => {
            const shown = reduced || active === i;
            return (
              <li key={s.title}>
                <div className="flex gap-4 rounded-2xl border border-border p-4">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-sm font-black" style={{ borderColor: accent }}>{i + 1}</span>
                  <div className="min-w-0">
                    <div className="font-bold">{s.title}</div>
                    <p className="text-sm text-muted-foreground">{s.text}</p>
                  </div>
                </div>
                <div
                  ref={(el) => { bubbleRefs.current[i] = el; }}
                  className="relative mt-3 rounded-2xl border-2 bg-card px-4 py-3 text-base leading-snug text-card-foreground shadow-sm transition-opacity motion-reduce:transition-none"
                  style={{ borderColor: accent, opacity: shown ? 1 : 0, transitionDuration: shown ? "150ms" : "0ms" }}
                >
                  {s.bubble}
                  <span aria-hidden className="absolute -right-[9px] top-1/2 h-4 w-4 -translate-y-1/2 rotate-45 border-r-2 border-t-2 bg-card" style={{ borderColor: accent }} />
                </div>
              </li>
            );
          })}
        </ol>
        <div
          ref={figRef}
          aria-hidden
          className="pointer-events-none absolute right-1 top-0 w-[56px] origin-[50%_10%] will-change-transform md:right-4 md:w-[100px]"
          style={{ aspectRatio: `1 / ${ASPECT}` }}
        >
          <img src={mascotAsset.url} alt="" className="h-full w-full select-none object-contain" draggable={false} />
        </div>
      </div>
    </div>
  );
}
