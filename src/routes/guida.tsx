import { createFileRoute, Link } from "@tanstack/react-router";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { WorkerOnboardingChecklist } from "@/components/WorkerOnboardingChecklist";
import {
  User,
  Camera,
  Briefcase,
  CalendarDays,
  Clock,
  MapPin,
  Search,
  Inbox,
  MessageSquare,
  Star,
  ArrowRight,
  Lightbulb,
  Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export const Route = createFileRoute("/guida")({
  head: () => ({
    meta: [
      { title: "Guida iniziale — Pupillo" },
      {
        name: "description",
        content:
          "Completa il tuo profilo e imposta le disponibilità per iniziare a ricevere proposte di lavoro su Pupillo.",
      },
    ],
  }),
  component: () => (
    <RequireAuth>
      <GuidePage />
    </RequireAuth>
  ),
});

type Step = {
  n: number;
  icon: LucideIcon;
  title: string;
  text: string;
  tip?: ReactNode;
  cta: { label: string; href: string };
  extras?: ReactNode;
};

const STEPS: Step[] = [
  {
    n: 1,
    icon: User,
    title: "Completa il tuo profilo",
    text: "Il tuo profilo è il tuo biglietto da visita. I ristoratori scelgono più facilmente lavoratori con foto, ruoli, esperienza e disponibilità complete.",
    cta: { label: "Vai al profilo", href: "/profile" },
    extras: (
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-sm text-muted-foreground list-disc list-inside">
        <li>Aggiungi foto profilo</li>
        <li>Inserisci ruoli lavorativi</li>
        <li>Aggiungi esperienza</li>
        <li>Inserisci città e zona</li>
        <li>Completa telefono/WhatsApp</li>
        <li>Salva il profilo</li>
      </ul>
    ),
  },
  {
    n: 2,
    icon: Camera,
    title: "Aggiungi una foto profilo",
    text: "Una foto chiara aumenta la fiducia e rende il tuo profilo più professionale. Usa una foto semplice, luminosa e adatta al lavoro.",
    tip: "Evita foto sfocate, di gruppo o poco riconoscibili.",
    cta: { label: "Carica foto", href: "/profile" },
  },
  {
    n: 3,
    icon: Briefcase,
    title: "Scegli i ruoli che puoi svolgere",
    text: "Seleziona i ruoli per cui vuoi ricevere offerte: cameriere, bartender, chef, lavapiatti, runner o altri extra.",
    cta: { label: "Imposta ruoli", href: "/onboarding" },
    extras: (
      <div className="flex flex-wrap gap-2">
        {["Cameriere", "Bartender", "Chef", "Aiuto cucina", "Lavapiatti", "Runner", "Addetto sala"].map((r) => (
          <span key={r} className="text-xs rounded-full border bg-muted/40 px-2.5 py-1">
            {r}
          </span>
        ))}
      </div>
    ),
  },
  {
    n: 4,
    icon: CalendarDays,
    title: "Imposta quando sei disponibile",
    text: "Indica i giorni, le fasce orarie e le città in cui puoi lavorare. Così riceverai proposte più adatte a te. Puoi scegliere disponibilità ricorrenti, come tutti i venerdì sera, oppure disponibilità speciali per date specifiche.",
    cta: { label: "Imposta disponibilità", href: "/availability" },
    extras: (
      <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
        <li>Lunedì cena a Bologna</li>
        <li>Venerdì serale a Milano</li>
        <li>Sabato aperitivo e cena</li>
        <li>Disponibile last minute oggi</li>
      </ul>
    ),
  },
  {
    n: 5,
    icon: Clock,
    title: "Scegli la fascia giusta",
    text: "Puoi indicare disponibilità per pranzo, aperitivo, cena, serale, intera giornata o last minute.",
    cta: { label: "Modifica fasce", href: "/availability" },
    extras: (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
        {[
          ["Pranzo", "11:00 – 15:00"],
          ["Aperitivo", "17:00 – 21:00"],
          ["Cena", "18:00 – 23:30"],
          ["Serale", "21:00 – 02:00"],
          ["Intera giornata", "09:00 – 23:00"],
          ["Personalizzata", "Scegli tu dalle/alle"],
        ].map(([k, v]) => (
          <div key={k} className="flex items-center justify-between rounded-lg border bg-background/60 px-3 py-2">
            <span className="font-medium">{k}</span>
            <span className="text-muted-foreground">{v}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    n: 6,
    icon: MapPin,
    title: "Indica dove sei disponibile",
    text: "Puoi essere disponibile in città diverse in giorni diversi. Per esempio, se studi a Bologna ma nel weekend sei a Milano, puoi indicarlo nelle disponibilità.",
    cta: { label: "Imposta città e zone", href: "/availability" },
    extras: (
      <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
        <li>Dal lunedì al venerdì: Bologna</li>
        <li>Sabato e domenica: Milano</li>
      </ul>
    ),
  },
  {
    n: 7,
    icon: Search,
    title: "Candidati ai turni disponibili",
    text: "Nella pagina Trova offerte puoi vedere i turni attivi vicino a te. Prima di candidarti controlla ruolo, orario, compenso, dress code e zona.",
    cta: { label: "Vai a Trova offerte", href: "/jobs" },
  },
  {
    n: 8,
    icon: Inbox,
    title: "Rispondi alle proposte dei ristoratori",
    text: "Quando un ristoratore ti propone un turno, lo trovi in Offerte ricevute. Puoi accettare, rifiutare o chattare prima di decidere.",
    tip: "Nome locale e indirizzo completo vengono mostrati solo dopo l’accettazione della proposta.",
    cta: { label: "Vai a Offerte ricevute", href: "/announcements" },
  },
  {
    n: 9,
    icon: MessageSquare,
    title: "Controlla sempre la chat",
    text: "Quando vieni confermato per un turno, riceverai in chat tutti i dettagli: indirizzo, referente, orario di ingresso, anticipo richiesto, dress code e istruzioni operative.",
    tip: "Dopo aver letto le istruzioni, conferma la presa visione.",
    cta: { label: "Vai ai messaggi", href: "/messages" },
  },
  {
    n: 10,
    icon: Star,
    title: "Costruisci la tua reputazione",
    text: "Ogni turno completato può aiutarti a migliorare il tuo profilo. Puntualità, affidabilità, professionalità e buone recensioni aumentano la tua visibilità verso i ristoratori.",
    cta: { label: "Vedi la mia reputazione", href: "/profile" },
    extras: (
      <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
        <li>Arriva puntuale</li>
        <li>Rispetta il dress code</li>
        <li>Leggi bene le istruzioni</li>
        <li>Comunica in chat se hai dubbi</li>
        <li>Completa i turni con serietà</li>
      </ul>
    ),
  },
];

const MOTIVATIONAL = [
  "Più il tuo profilo è completo, più aumentano le possibilità di essere scelto.",
  "Le disponibilità aggiornate aiutano i ristoratori a proporti turni davvero compatibili.",
  "Una buona reputazione nasce da puntualità, comunicazione e professionalità.",
];

function GuidePage() {
  return (
    <AppShell>
      <PageHeader
        title="Benvenuto su Pupillo"
        subtitle="Completa il tuo profilo e imposta le disponibilità per iniziare a ricevere proposte di lavoro dai ristoratori."
      />

      <div className="mb-6">
        <WorkerOnboardingChecklist />
      </div>

      <ol className="space-y-4">
        {STEPS.map((s) => (
          <StepCard key={s.n} step={s} />
        ))}
      </ol>

      <section className="mt-8 rounded-2xl border bg-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">Ricorda</h2>
        </div>
        <ul className="space-y-2">
          {MOTIVATIONAL.map((m) => (
            <li key={m} className="text-sm text-muted-foreground flex gap-2">
              <span className="text-primary">•</span>
              <span>{m}</span>
            </li>
          ))}
        </ul>
      </section>
    </AppShell>
  );
}

function StepCard({ step }: { step: Step }) {
  const Icon = step.icon;
  return (
    <li className="rounded-2xl border bg-card p-5 sm:p-6">
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
            Step {step.n} di {STEPS.length}
          </div>
          <h3 className="text-lg font-semibold mt-0.5">{step.title}</h3>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{step.text}</p>

          {step.extras && <div className="mt-3">{step.extras}</div>}

          {step.tip && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
              <Lightbulb className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{step.tip}</span>
            </div>
          )}

          <div className="mt-4">
            <Link to={step.cta.href as never}>
              <Button size="sm" className="gap-1">
                {step.cta.label} <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </li>
  );
}
