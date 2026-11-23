import { useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { MapPin } from "lucide-react";
import logoHero from "@/assets/demo-pupillo/pupillo-logo-hero.webp.asset.json";
import hatFront from "@/assets/demo-pupillo/pupillo-logo-cappello.webp.asset.json";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { AudienceVideo } from "@/components/home/AudienceVideo";
import { HomeReviews } from "@/components/home/HomeReviews";
import { AcademyHomeWorker } from "@/components/academy/AcademyBlocks";
import { HOME_VIDEOS } from "@/lib/home-videos";
import { HAT, LOGO_SIZE } from "@/lib/pupillo-path";
import { PupilloDirector, PupilloStop } from "@/components/demo-pupillo/PupilloDirector";
import { Button } from "@/components/ui/button";

type Regia = "cappello" | "semplice";

export const Route = createFileRoute("/demo-pupillo")({
  validateSearch: (s: Record<string, unknown>): { regia: Regia } => ({ regia: s["regia"] === "semplice" ? "semplice" : "cappello" }),
  head: () => ({
    meta: [
      { title: "Prova regia Pupillo allo scroll — interna" },
      { name: "description", content: "Prova interna della mascotte Pupillo che accompagna la homepage durante lo scroll." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Prova regia Pupillo allo scroll" },
      { property: "og:description", content: "Prova interna, non è la homepage pubblica." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DemoPupillo,
});

const LIME = "var(--neon-lime)";
const VIOLET = "var(--neon-violet)";
type Audience = "worker" | "restaurant";
/** Scroll (px) in cui la hero resta ferma mentre Pupillo esce dal cappello. */
const RUNWAY = 520;
const pct = (v: number, t: number) => `${(v / t) * 100}%`;

const STEPS: Record<Audience, { title: string; text: string }[]> = {
  worker: [
    { title: "Crea il tuo profilo", text: "Indica mansioni, esperienza e disponibilità." },
    { title: "Candidati ai turni", text: "Scegli i turni che ti interessano e invia la candidatura." },
    { title: "Ricevi la conferma del locale", text: "Il turno è tuo quando il locale accetta la candidatura." },
  ],
  restaurant: [
    { title: "Registra il tuo locale", text: "Inserisci i dati del locale e del referente." },
    { title: "Pubblica il turno", text: "Indica mansione, orario e compenso." },
    { title: "Scegli tra le candidature", text: "Valuta i profili e conferma la persona giusta." },
  ],
};

function DemoPupillo() {
  const { regia } = Route.useSearch();
  const [audience, setAudience] = useState<Audience>("worker");
  const rootRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={rootRef} className="group relative min-h-screen overflow-x-clip bg-background text-foreground" data-motion="off">
      <div className="relative z-40 flex flex-wrap items-center justify-center gap-2 bg-muted px-4 py-2 text-xs font-semibold text-muted-foreground">
        <span>Prova interna · non è la homepage pubblica · regia:</span>
        {(["cappello", "semplice"] as const).map((r) => (
          <Link key={r} to="/demo-pupillo" search={{ regia: r }} aria-current={regia === r ? "page" : undefined}
            className={`rounded-full border px-3 py-0.5 ${regia === r ? "border-foreground text-foreground" : "border-border"}`}>
            {r === "cappello" ? "Dal cappello" : "Semplice"}
          </Link>
        ))}
      </div>

      {/* Solo demo: corsie laterali riservate a Pupillo (destra da md, entrambe da lg). */}
      <main key={regia} className="mx-auto max-w-[1200px] px-4 md:pr-[156px] lg:px-[156px]">
        <div data-hat-runway={regia === "cappello" ? RUNWAY : undefined}>
        <section className={`pb-4 pt-6 text-center md:pt-8 ${regia === "cappello" ? "sticky top-0 z-20 motion-reduce:static" : ""}`}>
          <div data-hat-logo className="relative mx-auto mb-5 w-64 max-w-full sm:w-80 md:w-96">
            <img src={logoHero.url} alt="Pupillo" width={LOGO_SIZE.w} height={LOGO_SIZE.h} className="block w-full" />
            {regia === "cappello" && (
              <img src={hatFront.url} alt="" aria-hidden className="pointer-events-none absolute group-data-[motion=off]:hidden"
                style={{ zIndex: 20, left: pct(HAT.crop.x, LOGO_SIZE.w), top: pct(HAT.crop.y, LOGO_SIZE.h), width: pct(HAT.crop.w, LOGO_SIZE.w), height: pct(HAT.crop.h, LOGO_SIZE.h) }} />
            )}
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs font-semibold text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" aria-hidden /> Torino e provincia
          </span>
          <h1 className="mx-auto mt-5 max-w-4xl text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl md:text-7xl">
            Il turno giusto. <span className="pupillo-headline-yellow block">La persona giusta.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground md:text-lg">
            Pupillo mette in contatto locali e lavoratori per i turni nella ristorazione.
            <br />
            Sala, cucina, bar e pizzeria.
          </p>
        </section>
        {regia === "cappello" && <div aria-hidden className="motion-reduce:hidden group-data-[motion=off]:hidden" style={{ height: RUNWAY }} />}
        </div>

        {regia === "semplice" && (
          <PupilloStop id="hero" side="right">Ciao, sono Pupillo! Scorri la pagina: ti accompagno sezione per sezione.</PupilloStop>
        )}

        <div role="group" aria-label="Scegli il tuo profilo" className="mx-auto mb-2 grid max-w-md grid-cols-2 gap-2 rounded-full border border-border p-1 md:hidden">
          {(["worker", "restaurant"] as const).map((a) => (
            <Button key={a} type="button" variant="ghost" aria-pressed={audience === a} aria-controls={a === "worker" ? "per-lavoratori" : "per-locali"} onClick={() => setAudience(a)}
              className="rounded-full px-3 py-2 text-sm font-bold"
              style={audience === a ? { background: a === "worker" ? "var(--primary)" : VIOLET, color: a === "worker" ? "var(--primary-foreground)" : "var(--accent-foreground)" } : undefined}>
              {a === "worker" ? "Cerco turni" : "Cerco personale"}
            </Button>
          ))}
        </div>

        <PupilloStop id="pubblico" side="left">
          <span className={audience === "worker" ? "md:inline" : "hidden md:inline"}>Cerchi un turno extra? Scopri i turni, consulta orari e compensi e invia la tua candidatura.</span>
          <span className={audience === "restaurant" ? "md:hidden" : "hidden"}>Paghi una sola volta per sbloccare un nuovo contatto; poi puoi ricontattarlo senza costi aggiuntivi.</span>
        </PupilloStop>

        <section className="grid gap-5 md:grid-cols-2">
          <AudienceCard id="per-lavoratori" hidden={audience !== "worker"} label="Per i lavoratori" title="Cerchi un turno extra?"
            text="Scopri i turni, consulta orari e compensi e invia la tua candidatura." accent={LIME}
            cta={<Link to="/auth" search={{ role: "worker" } as never} className="inline-flex w-full items-center justify-center rounded-2xl px-6 py-3.5 font-extrabold sm:w-auto" style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}>Cerco turni</Link>}
            note="Sempre gratuito per i lavoratori" video={<AudienceVideo video={HOME_VIDEOS.worker} accent={LIME} />} videoCaption="Per te che cerchi lavoro." extra={<AcademyHomeWorker />} />
          <AudienceCard id="per-locali" hidden={audience !== "restaurant"} label="Per ristoranti, bar e locali" title="Ti serve personale?"
            text="Pubblica un turno e ricevi le candidature delle persone interessate." accent={VIOLET}
            cta={<Link to="/auth" search={{ role: "restaurant" } as never} className="inline-flex w-full items-center justify-center rounded-2xl px-6 py-3.5 font-extrabold text-accent-foreground sm:w-auto" style={{ background: VIOLET }}>Cerco personale</Link>}
            note={null} video={<AudienceVideo video={HOME_VIDEOS.restaurant} accent={VIOLET} />} videoCaption="Per te che cerchi personale per il tuo locale." />
        </section>

        <PupilloStop id="locali" side="right" className="hidden md:flex">
          Paghi una sola volta per sbloccare un nuovo contatto; poi puoi ricontattarlo senza costi aggiuntivi.
        </PupilloStop>

        <PupilloStop id="come-funziona" side="right" sideMd="left">
          La candidatura non è una conferma: il turno è assegnato solo quando il locale la accetta.
        </PupilloStop>
        <section id="come-funziona" className="pb-12">
          <h2 className="text-center text-3xl font-black md:text-5xl">Come funziona, in pratica.</h2>
          <div className="mt-10 grid gap-8 md:grid-cols-2">
            {(["worker", "restaurant"] as const).map((a) => (
              <div key={a} className={audience !== a ? "hidden md:block" : ""}>
                <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: a === "worker" ? LIME : VIOLET }}>{a === "worker" ? "Per chi cerca turni" : "Per i locali"}</h3>
                <ol className="mt-4 space-y-3">
                  {STEPS[a].map((s, i) => (
                    <li key={s.title} className="flex gap-4 rounded-2xl border border-border p-4">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm font-black" style={{ borderColor: a === "worker" ? LIME : VIOLET }}>{i + 1}</span>
                      <div className="min-w-0"><div className="font-bold">{s.title}</div><p className="text-sm text-muted-foreground">{s.text}</p></div>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </section>

        <PupilloStop id="faq" side="left" sideMd="right">Hai dei dubbi? Qui sotto trovi le risposte alle domande più frequenti.</PupilloStop>
        <section aria-labelledby="faq" className="mx-auto max-w-3xl pb-12">
          <h2 id="faq" className="text-center text-2xl font-black md:text-3xl">Domande frequenti</h2>
          <Accordion type="single" collapsible className="mt-6">
            <AccordionItem value="gratis">
              <AccordionTrigger>Pupillo è gratuito?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">Per i lavoratori Pupillo è sempre gratuito. Per ristoranti, bar e locali il servizio parte a pagamento, senza un periodo di lancio gratuito.</AccordionContent>
            </AccordionItem>
            <AccordionItem value="dove">
              <AccordionTrigger>Dove è disponibile?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">Per ora Pupillo è attivo a Torino e in tutta la Città metropolitana di Torino.</AccordionContent>
            </AccordionItem>
          </Accordion>
        </section>

        <PupilloStop id="arrivo" side="right" sideMd="left">Qui sotto trovi alcuni esempi di recensioni. Grazie per aver scorso con me!</PupilloStop>
        <HomeReviews />
        <div data-tail-spacer aria-hidden />
        <div className="h-24" />
      </main>
      <PupilloDirector key={regia} regia={regia} rootRef={rootRef} />
    </div>
  );
}

function AudienceCard(props: { id: string; hidden: boolean; label: string; title: string; text: string; cta: React.ReactNode; note: string | null; accent: string; video: React.ReactNode; videoCaption: string; extra?: React.ReactNode }) {
  return (
    <article id={props.id} aria-labelledby={`${props.id}-title`} className={`flex-col gap-4 rounded-3xl border bg-card/40 p-6 md:flex md:p-8 ${props.hidden ? "hidden" : "flex"}`} style={{ borderColor: "color-mix(in oklab, var(--neon-violet) 35%, transparent)" }}>
      <span className="self-start rounded-full border px-3 py-1 text-sm font-extrabold uppercase tracking-wider" style={{ color: props.accent, borderColor: props.accent, background: `color-mix(in oklab, ${props.accent} 12%, transparent)` }}>{props.label}</span>
      <h2 id={`${props.id}-title`} className="text-2xl font-black md:text-3xl">{props.title}</h2>
      <p className="text-muted-foreground">{props.text}</p>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        {props.cta}
        {props.note && <span className="text-sm font-semibold text-muted-foreground">{props.note}</span>}
      </div>
      <div className="mt-2 flex flex-col gap-3">
        <div><h3 className="text-lg font-extrabold">Scopri come funziona</h3><p className="text-sm text-muted-foreground">{props.videoCaption}</p></div>
        {props.video}
      </div>
      {props.extra}
    </article>
  );
}
