import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ACADEMY_EXTERNAL_URL } from "@/lib/academy";

/* Scene sincronizzate allo scroll: solo transform/opacity, stato finale statico con reduced motion. */
function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e && setOn(e.isIntersecting), { threshold: 0.45 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return [ref, on] as const;
}

const ease = "transition-all duration-700 ease-out motion-reduce:transition-none";
const VIOLET = "var(--neon-violet)";

function Phone({ tilted, children }: { tilted: boolean; children: React.ReactNode }) {
  return (
    <div className="[perspective:1200px]">
      <div
        className={`${ease} mx-auto w-56 rounded-[2.2rem] border-[10px] border-foreground bg-background p-3 shadow-2xl sm:w-64 motion-reduce:!transform-none`}
        style={{ transform: tilted ? "rotateY(-22deg) rotateZ(6deg) translateX(20px)" : "none" }}
      >
        <div className="mx-auto mb-3 h-1.5 w-16 rounded-full bg-muted" />
        <div className="min-h-80 space-y-2">{children}</div>
      </div>
    </div>
  );
}

const CARDS = [
  { k: "Mansione", v: "Cameriere di sala" },
  { k: "Zona", v: "Torino centro" },
  { k: "Esperienza", v: "3 anni" },
];

export function ScrollStory() {
  const [s2, on2] = useReveal<HTMLElement>();
  const [s3, on3] = useReveal<HTMLElement>();
  const [s4, on4] = useReveal<HTMLElement>();

  return (
    <main>
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 md:grid-cols-2 md:py-20">
        <div>
          <h1 className="text-4xl font-black leading-tight md:text-6xl">
            Il turno giusto.<br /><span className="italic" style={{ color: "var(--brand-yellow)", WebkitTextStroke: "1px var(--foreground)" }}>La persona giusta.</span>
          </h1>
          <p className="mt-4 max-w-md text-muted-foreground">Pupillo mette in contatto locali e lavoratori per i turni nella ristorazione.</p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link to="/auth" search={{ role: "restaurant" } as never} className="rounded-2xl px-6 py-3.5 text-center font-extrabold text-accent-foreground" style={{ background: VIOLET }}>Cerco personale</Link>
            <Link to="/auth" search={{ role: "worker" } as never} className="rounded-2xl bg-primary px-6 py-3.5 text-center font-extrabold text-primary-foreground">Cerco lavoro</Link>
          </div>
        </div>
        <div className="relative">
          <div aria-hidden className="absolute -left-2 bottom-0 z-10 grid h-24 w-24 place-items-center rounded-full border-2 border-dashed border-border bg-muted text-center text-[10px] font-bold text-muted-foreground">Mascotte<br />posa 1</div>
          <Phone tilted><div className="h-full rounded-xl bg-muted p-4 text-sm text-muted-foreground">Turni vicino a te…</div></Phone>
        </div>
      </section>

      <section ref={s2} className="mx-auto max-w-6xl px-4 py-16 text-center">
        <h2 className="text-3xl font-black">Il tuo profilo, una scheda alla volta.</h2>
        <div className="mt-10">
          <Phone tilted={false}>
            <p className="text-xs font-bold uppercase text-muted-foreground">Profilo di esempio</p>
            {CARDS.map((c, i) => (
              <div key={c.k} className={`${ease} rounded-xl border border-border bg-card p-3 text-left motion-reduce:!opacity-100 motion-reduce:!transform-none`}
                style={{ opacity: on2 ? 1 : 0, transform: on2 ? "none" : `translateX(${i % 2 ? 60 : -60}px)`, transitionDelay: `${i * 180}ms` }}>
                <p className="text-[11px] text-muted-foreground">{c.k}</p>
                <p className="font-bold">{c.v}</p>
              </div>
            ))}
          </Phone>
        </div>
      </section>

      <section ref={s3} className="px-4 py-20 text-accent-foreground" style={{ background: VIOLET }}>
        <div className="mx-auto grid max-w-6xl items-center gap-10 md:grid-cols-2">
          <div>
            <h2 className="text-3xl font-black">Sblocchi un nuovo contatto una sola volta.</h2>
            <p className="mt-3 text-lg opacity-90">Poi ricontatti la stessa persona senza costi di sblocco. Pacchetto unico da 29,70 € (7 crediti).</p>
          </div>
          <div className="relative h-56">
            <div className={`${ease} absolute left-0 top-0 w-48 rounded-xl bg-background p-3 text-foreground shadow-xl motion-reduce:!transform-none`}
              style={{ transform: on3 ? "translate(120px, 110px) scale(0.85)" : "none" }}>
              <p className="text-[11px] text-muted-foreground">Esempio</p><p className="font-bold">Cameriere di sala</p>
            </div>
            <div className="absolute bottom-0 right-0 w-56 rounded-2xl border-2 border-dashed border-accent-foreground/60 p-4 text-right font-extrabold">I miei contatti</div>
          </div>
        </div>
      </section>

      <section ref={s4} className={`${ease} mx-auto max-w-3xl px-4 py-16 text-center motion-reduce:!opacity-100`} style={{ opacity: on4 ? 1 : 0.3 }}>
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Pupillo Academy · Gratuita e facoltativa</p>
        <h2 className="mt-2 text-2xl font-black">Impara, ripassa, mettiti alla prova.</h2>
        <p className="mt-2 text-muted-foreground">Oggi sono disponibili due moduli in anteprima. L’Academy è facoltativa: non è un requisito per usare Pupillo.</p>
        <a href={ACADEMY_EXTERNAL_URL ?? "/academy"} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block font-bold underline">Scopri l’Academy gratuita<span className="sr-only"> (si apre in una nuova scheda)</span></a>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-24 text-center">
        <h2 className="text-3xl font-black">Pronto a iniziare?</h2>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <Link to="/auth" search={{ role: "restaurant" } as never} className="rounded-2xl px-6 py-3.5 font-extrabold text-accent-foreground" style={{ background: VIOLET }}>Cerco personale</Link>
          <Link to="/auth" search={{ role: "worker" } as never} className="rounded-2xl bg-primary px-6 py-3.5 font-extrabold text-primary-foreground">Cerco lavoro</Link>
        </div>
      </section>
    </main>
  );
}
