import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { MapPin } from "lucide-react";
import pupilloLogo from "@/assets/pupillo-logo.png";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { AudienceVideo } from "@/components/home/AudienceVideo";
import { HOME_VIDEOS } from "@/lib/home-videos";
import { isBolognaLaunchActive } from "@/lib/launch-campaign";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Pupillo — Turni nella ristorazione a Bologna" },
      {
        name: "description",
        content:
          "Pupillo mette in contatto locali e lavoratori per i turni nella ristorazione: sala, cucina, bar e pizzeria. Bologna e provincia.",
      },
      { property: "og:title", content: "Pupillo — Il turno giusto. La persona giusta." },
      {
        property: "og:description",
        content: "Locali e lavoratori per i turni nella ristorazione a Bologna e provincia.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

const LIME = "var(--neon-lime)";
const VIOLET = "var(--neon-violet)";
type Audience = "worker" | "restaurant";

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

function Index() {
  const [audience, setAudience] = useState<Audience>("worker");
  const promoActive = isBolognaLaunchActive();

  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <header className="mx-auto flex max-w-[1200px] items-center justify-between gap-3 px-4 py-4">
        <Link to="/" aria-label="Home Pupillo" className="shrink-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <img src={pupilloLogo} alt="Pupillo" className="h-9 w-auto md:h-11" />
        </Link>
        <nav aria-label="Principale" className="flex min-w-0 items-center gap-1 text-sm sm:gap-4">
          <a href="#come-funziona" className="hidden rounded-md px-2 py-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:inline">Come funziona</a>
          <a href="#per-lavoratori" className="hidden rounded-md px-2 py-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:inline">Per chi cerca turni</a>
          <a href="#per-locali" className="hidden rounded-md px-2 py-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:inline">Per i locali</a>
          <Link to="/auth" className="rounded-full border border-border px-4 py-1.5 font-semibold hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Accedi</Link>
        </nav>
      </header>

      <main className="mx-auto max-w-[1200px] px-4">
        <section className="pb-8 pt-6 text-center md:pt-14">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs font-semibold text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" aria-hidden /> Bologna e provincia
          </span>
          <h1 className="mx-auto mt-5 max-w-4xl text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl md:text-7xl">
            Il turno giusto. <span style={{ color: LIME }}>La persona giusta.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground md:text-lg">
            Pupillo mette in contatto locali e lavoratori per i turni nella ristorazione.
            <br />
            Sala, cucina, bar e pizzeria.
          </p>
        </section>

        {/* Selettore mobile */}
        <div role="group" aria-label="Scegli il tuo profilo" className="mx-auto mb-5 grid max-w-md grid-cols-2 gap-2 rounded-full border border-border p-1 md:hidden">
          {(["worker", "restaurant"] as const).map((a) => (
            <button
              key={a}
              type="button"
              aria-pressed={audience === a}
              aria-controls={a === "worker" ? "per-lavoratori" : "per-locali"}
              onClick={() => setAudience(a)}
              className="rounded-full px-3 py-2 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
              style={audience === a ? { background: a === "worker" ? LIME : VIOLET, color: a === "worker" ? "var(--background)" : "var(--foreground)" } : undefined}
            >
              {a === "worker" ? "Cerco turni" : "Cerco personale"}
            </button>
          ))}
        </div>

        <section className="grid gap-5 md:grid-cols-2">
          <AudienceCard
            id="per-lavoratori"
            hidden={audience !== "worker"}
            label="Per i lavoratori"
            title="Cerchi un turno extra?"
            text="Scopri i turni, consulta orari e compensi e invia la tua candidatura."
            cta={
              <Link to="/auth" search={{ role: "worker" } as never} className="inline-flex w-full items-center justify-center rounded-2xl px-6 py-3.5 font-extrabold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:w-auto" style={{ background: LIME, color: "var(--background)" }}>
                Cerco turni
              </Link>
            }
            note="Sempre gratuito per i lavoratori"
            accent={LIME}
            video={<AudienceVideo video={HOME_VIDEOS.worker} accent={LIME} />}
            videoCaption="Per te che cerchi lavoro."
          />
          <AudienceCard
            id="per-locali"
            hidden={audience !== "restaurant"}
            label="Per ristoranti, bar e locali"
            title="Ti serve personale?"
            text="Pubblica un turno e ricevi le candidature delle persone interessate."
            cta={
              <Link to="/auth" search={{ role: "restaurant" } as never} className="inline-flex w-full items-center justify-center rounded-2xl px-6 py-3.5 font-extrabold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:w-auto" style={{ background: VIOLET }}>
                Cerco personale
              </Link>
            }
            note={promoActive ? "Gratis fino al 31/12/2026" : null}
            accent={VIOLET}
            video={<AudienceVideo video={HOME_VIDEOS.restaurant} accent={VIOLET} />}
            videoCaption="Per te che cerchi personale per il tuo locale."
          />
        </section>

        <section id="come-funziona" className="scroll-mt-6 py-16 md:py-24">
          <h2 className="text-center text-3xl font-black md:text-5xl">Come funziona, in pratica.</h2>
          <div className="mt-10 grid gap-8 md:grid-cols-2">
            {(["worker", "restaurant"] as const).map((a) => (
              <div key={a} className={audience !== a ? "hidden md:block" : ""}>
                <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: a === "worker" ? LIME : VIOLET }}>
                  {a === "worker" ? "Per chi cerca turni" : "Per i locali"}
                </h3>
                <ol className="mt-4 space-y-3">
                  {STEPS[a].map((s, i) => (
                    <li key={s.title} className="flex gap-4 rounded-2xl border border-border p-4">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm font-black" style={{ borderColor: a === "worker" ? LIME : VIOLET }}>{i + 1}</span>
                      <div className="min-w-0">
                        <div className="font-bold">{s.title}</div>
                        <p className="text-sm text-muted-foreground">{s.text}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
          <p className="mx-auto mt-6 max-w-2xl text-center text-sm text-muted-foreground">
            La candidatura non è una conferma: il turno è assegnato solo quando il locale la accetta.
          </p>
        </section>

        <section aria-labelledby="faq" className="mx-auto max-w-3xl pb-20">
          <h2 id="faq" className="text-center text-2xl font-black md:text-3xl">Domande frequenti</h2>
          <Accordion type="single" collapsible className="mt-6">
            <AccordionItem value="gratis">
              <AccordionTrigger>Pupillo è gratuito?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Per i lavoratori Pupillo è sempre gratuito.
                {promoActive ? " Per ristoranti, bar e locali è gratuito fino al 31/12/2026, nel periodo di lancio." : ""}
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="dove">
              <AccordionTrigger>Dove è disponibile?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Per ora Pupillo è attivo a Bologna e in tutta la Città metropolitana di Bologna.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </section>
      </main>

      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        © 2026 Pupillo. Marketplace per la ristorazione. ·{" "}
        <Link to="/terms" className="underline-offset-4 hover:underline">Termini</Link>
      </footer>
    </div>
  );
}

function AudienceCard(props: {
  id: string;
  hidden: boolean;
  label: string;
  title: string;
  text: string;
  cta: React.ReactNode;
  note: string | null;
  accent: string;
  video: React.ReactNode;
  videoCaption: string;
}) {
  return (
    <article
      id={props.id}
      aria-labelledby={`${props.id}-title`}
      className={`scroll-mt-6 flex-col gap-4 rounded-3xl border bg-card/40 p-6 md:flex md:p-8 ${props.hidden ? "hidden" : "flex"}`}
      style={{ borderColor: "color-mix(in oklab, var(--neon-violet) 35%, transparent)" }}
    >
      <span
        className="self-start rounded-full border px-3 py-1 text-sm font-extrabold uppercase tracking-wider"
        style={{ color: props.accent, borderColor: props.accent, background: `color-mix(in oklab, ${props.accent} 12%, transparent)` }}
      >
        {props.label}
      </span>
      <h2 id={`${props.id}-title`} className="text-2xl font-black md:text-3xl">{props.title}</h2>
      <p className="text-muted-foreground">{props.text}</p>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        {props.cta}
        {props.note && <span className="text-sm font-semibold text-muted-foreground">{props.note}</span>}
      </div>
      <div className="mt-2 flex flex-col gap-3">
        <div>
          <h3 className="text-lg font-extrabold">Scopri come funziona</h3>
          <p className="text-sm text-muted-foreground">{props.videoCaption}</p>
        </div>
        {props.video}
      </div>
    </article>
  );
}
