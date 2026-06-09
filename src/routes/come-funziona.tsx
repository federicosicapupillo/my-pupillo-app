import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Search,
  UserPlus,
  ClipboardList,
  Inbox,
  ShieldCheck,
  CheckCircle2,
  UserCircle2,
  Compass,
  Send,
  Star,
  Euro,
  MessageCircle,
  CreditCard,
  Sparkles,
  MessagesSquare,
  Users,
} from "lucide-react";

export const Route = createFileRoute("/come-funziona")({
  head: () => ({
    meta: [
      {
        title:
          "Come funziona Pupillo | Turni extra per ristoranti e lavoratori Horeca",
      },
      {
        name: "description",
        content:
          "Scopri come Pupillo aiuta ristoranti, bar e locali a trovare personale extra e permette ai lavoratori Horeca di candidarsi a turni chiari e tracciati.",
      },
      {
        property: "og:title",
        content:
          "Come funziona Pupillo | Turni extra per ristoranti e lavoratori Horeca",
      },
      {
        property: "og:description",
        content:
          "Scopri come Pupillo aiuta ristoranti, bar e locali a trovare personale extra e permette ai lavoratori Horeca di candidarsi a turni chiari e tracciati.",
      },
      { property: "og:url", content: "https://pupillo.life/come-funziona" },
    ],
    links: [
      { rel: "canonical", href: "https://pupillo.life/come-funziona" },
    ],
  }),
  component: ComeFunzionaPage,
});

type StepItem = {
  n: string;
  title: string;
  text: string;
  icon: typeof Search;
};

const RESTAURANT_STEPS: StepItem[] = [
  {
    n: "01",
    title: "Pubblica il turno",
    text: "Indichi ruolo, data, orario, compenso, luogo e dettagli utili.",
    icon: ClipboardList,
  },
  {
    n: "02",
    title: "Ricevi candidature",
    text: "I lavoratori disponibili possono candidarsi o rispondere alle tue proposte.",
    icon: Inbox,
  },
  {
    n: "03",
    title: "Valuti il profilo",
    text: "Controlli esperienze, mansioni, recensioni e reputazione prima di confermare.",
    icon: ShieldCheck,
  },
  {
    n: "04",
    title: "Confermi il lavoratore",
    text: "Paghi solo quando confermi il lavoratore. Messaggi, proposta e conferma restano tracciati dentro Pupillo.",
    icon: CheckCircle2,
  },
];

const WORKER_STEPS: StepItem[] = [
  {
    n: "01",
    title: "Completa il profilo",
    text: "Inserisci ruoli, esperienze, disponibilità, zona e numero di telefono verificato.",
    icon: UserCircle2,
  },
  {
    n: "02",
    title: "Trova turni extra",
    text: "Vedi le opportunità compatibili con le tue mansioni e la tua disponibilità.",
    icon: Compass,
  },
  {
    n: "03",
    title: "Candidati o accetta proposte",
    text: "Puoi candidarti ai turni o rispondere alle proposte dei locali.",
    icon: Send,
  },
  {
    n: "04",
    title: "Costruisci reputazione",
    text: "Dopo ogni turno puoi ricevere recensioni che aumentano la tua affidabilità sulla piattaforma.",
    icon: Star,
  },
];

const PRICING_POINTS = [
  { icon: Inbox, text: "Pubblicare un turno non ha costo." },
  { icon: MessageCircle, text: "I messaggi all’interno di Pupillo non hanno costo." },
  { icon: Users, text: "Il lavoratore usa Pupillo gratuitamente." },
  {
    icon: CheckCircle2,
    text: "Il ristoratore paga solo quando conferma un lavoratore.",
  },
  {
    icon: CreditCard,
    text: "Il sistema a crediti serve a sbloccare e confermare il match operativo.",
  },
];

const FAQS = [
  {
    q: "Pupillo è gratuito per i lavoratori?",
    a: "Sì, i lavoratori possono creare il profilo, candidarsi e ricevere proposte gratuitamente.",
  },
  {
    q: "Il ristoratore paga per pubblicare un turno?",
    a: "No, la pubblicazione del turno e i messaggi sono gratuiti. Il pagamento avviene solo quando viene confermato un lavoratore.",
  },
  {
    q: "I profili sono verificati?",
    a: "Pupillo prevede la verifica del numero di telefono e mostra informazioni di profilo, esperienze, mansioni e recensioni.",
  },
  {
    q: "Pupillo sostituisce un’agenzia interinale?",
    a: "No. Pupillo è una piattaforma per facilitare il contatto e la gestione di turni extra tra locali e lavoratori disponibili.",
  },
  {
    q: "Posso usare Pupillo per urgenze last-minute?",
    a: "Sì, Pupillo è pensato anche per assenze, picchi di lavoro e turni scoperti, ma la disponibilità dipende dai lavoratori attivi nella zona.",
  },
];

function ComeFunzionaPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* HERO */}
      <section className="border-b border-border bg-gradient-to-b from-muted/40 to-background">
        <div className="mx-auto max-w-5xl px-6 py-16 md:py-24">
          <Badge variant="secondary" className="mb-4">
            <Sparkles className="mr-1 h-3 w-3" /> Come funziona
          </Badge>
          <h1 className="text-4xl font-bold tracking-tight md:text-6xl">
            Come funziona <span className="text-primary">Pupillo</span>
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-muted-foreground md:text-xl">
            Pupillo collega ristoratori e lavoratori extra in modo semplice:
            pubblichi un turno, ricevi candidature, scegli il profilo più adatto
            e gestisci tutto dentro la piattaforma.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Button asChild size="lg">
              <Link to="/auth" search={{ role: "restaurant" } as never}>
                <Search className="mr-2 h-4 w-4" /> Trova personale ora
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/auth" search={{ role: "worker" } as never}>
                <UserPlus className="mr-2 h-4 w-4" /> Cerco turni extra
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* PER RISTORATORI */}
      <section className="mx-auto max-w-5xl px-6 py-14 md:py-20">
        <div className="mb-10 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <Badge className="mb-3">Per ristoratori</Badge>
            <h2 className="text-3xl font-bold md:text-4xl">
              Dal turno scoperto al lavoratore confermato
            </h2>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Quattro passaggi semplici per coprire assenze, picchi di lavoro e
              turni scoperti senza inseguire chat sparse.
            </p>
          </div>
          <Button asChild variant="default" className="self-start md:self-auto">
            <Link to="/auth" search={{ role: "restaurant" } as never}>
              <Search className="mr-2 h-4 w-4" /> Trova personale ora
            </Link>
          </Button>
        </div>

        <StepGrid steps={RESTAURANT_STEPS} accent="primary" />
      </section>

      {/* PER LAVORATORI */}
      <section className="border-t border-border bg-muted/30">
        <div className="mx-auto max-w-5xl px-6 py-14 md:py-20">
          <div className="mb-10 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <Badge variant="secondary" className="mb-3">
                Per lavoratori
              </Badge>
              <h2 className="text-3xl font-bold md:text-4xl">
                Trova turni extra e costruisci reputazione
              </h2>
              <p className="mt-2 max-w-2xl text-muted-foreground">
                Profilo chiaro, opportunità in linea con le tue disponibilità,
                recensioni che pesano davvero.
              </p>
            </div>
            <Button asChild variant="outline" className="self-start md:self-auto">
              <Link to="/auth" search={{ role: "worker" } as never}>
                <UserPlus className="mr-2 h-4 w-4" /> Cerco turni extra
              </Link>
            </Button>
          </div>

          <StepGrid steps={WORKER_STEPS} accent="secondary" />
        </div>
      </section>

      {/* QUANTO COSTA */}
      <section className="mx-auto max-w-5xl px-6 py-14 md:py-20">
        <div className="mb-8">
          <Badge className="mb-3">
            <Euro className="mr-1 h-3 w-3" /> Quanto costa
          </Badge>
          <h2 className="text-3xl font-bold md:text-4xl">
            Trasparente per chi pubblica e per chi lavora
          </h2>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Nessun abbonamento per iniziare. Il ristoratore paga solo quando
            ottiene un valore reale: la conferma di un lavoratore.
          </p>
        </div>

        <Card className="overflow-hidden">
          <ul className="divide-y divide-border">
            {PRICING_POINTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3 p-5">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                  <Icon className="h-4 w-4" />
                </div>
                <p className="text-sm leading-relaxed md:text-base">{text}</p>
              </li>
            ))}
          </ul>
        </Card>
      </section>

      {/* PERCHÉ NON BASTA WHATSAPP */}
      <section className="border-t border-border bg-muted/30">
        <div className="mx-auto max-w-5xl px-6 py-14 md:py-20">
          <div className="mb-8">
            <Badge variant="secondary" className="mb-3">
              <MessagesSquare className="mr-1 h-3 w-3" /> Perché non basta WhatsApp
            </Badge>
            <h2 className="text-3xl font-bold md:text-4xl">
              Più chiaro di una chat, più misurabile del passaparola
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card className="p-6">
              <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                WhatsApp e passaparola
              </div>
              <ul className="space-y-3 text-sm leading-relaxed md:text-base">
                <li className="flex gap-2">
                  <span className="text-muted-foreground">•</span>
                  Su WhatsApp perdi tempo tra chat sparse e risposte incomplete.
                </li>
                <li className="flex gap-2">
                  <span className="text-muted-foreground">•</span>
                  Il passaparola è veloce ma poco controllabile.
                </li>
              </ul>
            </Card>

            <Card className="border-primary/40 p-6">
              <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-primary">
                Con Pupillo
              </div>
              <ul className="space-y-3 text-sm leading-relaxed md:text-base">
                <li className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  Profili ordinati, reputazione visibile e conferme tracciate.
                </li>
                <li className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  Un processo più chiaro, misurabile e professionale.
                </li>
              </ul>
            </Card>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-6 py-14 md:py-20">
        <div className="mb-8 text-center">
          <Badge className="mb-3">FAQ</Badge>
          <h2 className="text-3xl font-bold md:text-4xl">Domande frequenti</h2>
        </div>

        <Accordion type="single" collapsible className="w-full">
          {FAQS.map((f, i) => (
            <AccordionItem key={f.q} value={`item-${i}`}>
              <AccordionTrigger className="text-left text-base font-semibold">
                {f.q}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                {f.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      {/* CTA FINALE */}
      <section className="border-t border-border bg-gradient-to-b from-background to-muted/40">
        <div className="mx-auto max-w-3xl px-6 py-16 text-center md:py-20">
          <h2 className="text-3xl font-bold md:text-4xl">
            Pronto a coprire il prossimo turno scoperto?
          </h2>
          <p className="mt-3 text-muted-foreground">
            Pubblica un turno o candidati al prossimo servizio: bastano pochi
            tap e gestisci tutto dentro Pupillo.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row sm:flex-wrap">
            <Button asChild size="lg">
              <Link to="/auth" search={{ role: "restaurant" } as never}>
                <Search className="mr-2 h-4 w-4" /> Trova personale ora
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/auth" search={{ role: "worker" } as never}>
                <UserPlus className="mr-2 h-4 w-4" /> Cerco turni extra
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

function StepGrid({
  steps,
  accent,
}: {
  steps: StepItem[];
  accent: "primary" | "secondary";
}) {
  const dot =
    accent === "primary"
      ? "bg-primary/15 text-primary"
      : "bg-secondary text-secondary-foreground";
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {steps.map(({ n, title, text, icon: Icon }) => (
        <Card key={n} className="p-6">
          <div className="flex items-start gap-4">
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${dot}`}
            >
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Step {n}
              </div>
              <h3 className="mt-1 text-lg font-bold">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {text}
              </p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}