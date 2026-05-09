import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  ChefHat,
  FileText,
  Users,
  Inbox,
  ShieldCheck,
  Star,
  CreditCard,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Clock,
  MapPin,
  UserPlus,
  Send,
  Bell,
  Euro,
} from "lucide-react";
import pupilloLogo from "@/assets/pupillo-logo.png";

export const Route = createFileRoute("/ristoratori")({
  head: () => ({
    meta: [
      { title: "Pupillo per ristoratori — Trova personale extra Horeca" },
      {
        name: "description",
        content:
          "Pubblica annunci, ricevi candidature in pochi minuti e seleziona personale extra qualificato per ristoranti, bar, hotel ed eventi. Gestisci turni, recensioni e crediti dall'app Pupillo.",
      },
    ],
  }),
  component: RistoratoriPage,
});

function RistoratoriPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3">
          <Link to="/" aria-label="Home Pupillo" className="inline-flex items-center">
            <img src={pupilloLogo} alt="Logo Pupillo" className="h-9 w-auto md:h-10" />
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/auth">
              <Button variant="ghost" size="sm">Accedi</Button>
            </Link>
            <Link to="/auth" search={{ role: "restaurant" } as never}>
              <Button size="sm" className="gap-1">
                Registrati <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 -z-10 opacity-60"
          style={{
            background:
              "radial-gradient(800px 400px at 90% 0%, color-mix(in oklab, var(--primary) 18%, transparent), transparent 60%), radial-gradient(600px 300px at 10% 10%, color-mix(in oklab, var(--primary) 10%, transparent), transparent 60%)",
          }}
        />
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 md:grid-cols-2 md:py-20">
          <div className="flex flex-col justify-center">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium">
              <Sparkles className="h-3.5 w-3.5 text-primary" /> Per ristoranti, bar, hotel ed eventi
            </div>
            <h1 className="mt-5 text-4xl font-bold leading-tight tracking-tight md:text-6xl">
              Trova personale extra <span className="text-primary">in pochi minuti.</span>
            </h1>
            <p className="mt-5 max-w-xl text-base text-muted-foreground md:text-lg">
              Pubblica un annuncio su Pupillo e ricevi candidature da camerieri, bartender, chef e
              aiuti cucina disponibili nella tua zona. Scegli i profili più adatti, gestisci turni,
              recensioni e crediti — tutto in un'unica app.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link to="/auth" search={{ role: "restaurant" } as never}>
                <Button size="lg" className="gap-2 shadow-lg shadow-primary/20">
                  <ChefHat className="h-4 w-4" /> Registrati come ristoratore
                </Button>
              </Link>
              <a href="#vantaggi">
                <Button size="lg" variant="outline" className="gap-2">
                  Scopri i vantaggi
                </Button>
              </a>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-primary" /> Profili verificati</span>
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-primary" /> Candidature in tempo reale</span>
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-primary" /> Solo personale in zona</span>
            </div>
          </div>

          {/* Mockup annuncio */}
          <div className="relative mx-auto flex w-full max-w-sm items-center justify-center">
            <div className="relative w-full rounded-2xl border bg-card p-5 shadow-2xl">
              <div className="flex items-center justify-between">
                <div className="text-xs font-medium uppercase tracking-wide text-primary">Annuncio attivo</div>
                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase text-primary">Live</span>
              </div>
              <div className="mt-2 text-lg font-bold">Cameriere — Sabato sera</div>
              <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" /> Trattoria Da Marco · Milano
                <Clock className="ml-2 h-3.5 w-3.5" /> 19:00 – 24:00
              </div>
              <div className="mt-4 rounded-xl border bg-muted/40 p-3">
                <div className="mb-2 text-xs font-semibold text-muted-foreground">Candidature ricevute</div>
                {[
                  { name: "Luca M.", rating: "4.9", exp: "3 anni · cameriere" },
                  { name: "Sara R.", rating: "4.8", exp: "Bartender · italiano, inglese" },
                  { name: "Davide P.", rating: "5.0", exp: "Extra weekend" },
                ].map((c) => (
                  <div key={c.name} className="mt-2 flex items-center justify-between rounded-lg bg-background p-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{c.name}</div>
                      <div className="truncate text-[11px] text-muted-foreground">{c.exp}</div>
                    </div>
                    <div className="flex items-center gap-1 text-xs font-semibold">
                      <Star className="h-3 w-3 fill-primary text-primary" />
                      {c.rating}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Vantaggi */}
      <section id="vantaggi" className="mx-auto max-w-6xl px-4 py-14 md:py-20">
        <div className="mb-10 text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Perché scegliere Pupillo</h2>
          <p className="mt-3 text-muted-foreground">Tutto quello che serve al tuo locale per trovare personale.</p>
        </div>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {[
            { icon: FileText, title: "Pubblica annunci", text: "Crea un annuncio in pochi minuti: ruolo, orari, compenso e mansioni richieste." },
            { icon: Users, title: "Trova personale extra", text: "Lavoratori Horeca disponibili nella tua zona, anche per turni urgenti dell'ultimo minuto." },
            { icon: Inbox, title: "Ricevi candidature", text: "Le candidature arrivano in tempo reale. Niente telefonate, niente scambi infiniti." },
            { icon: ShieldCheck, title: "Profili verificati", text: "Esperienze, lingue parlate e mansioni: tutto chiaro prima di scegliere." },
            { icon: Star, title: "Recensioni e badge", text: "Seleziona i lavoratori più affidabili grazie a recensioni e badge di affidabilità." },
            { icon: CreditCard, title: "Gestione semplice", text: "Turni, candidature e crediti: tutto sotto controllo dalla stessa app." },
          ].map(({ icon: Icon, title, text }) => (
            <div
              key={title}
              className="group relative overflow-hidden rounded-2xl border bg-card p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
            >
              <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-primary/5 transition group-hover:scale-125" />
              <div className="relative">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-lg font-bold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Come funziona */}
      <section className="border-y bg-muted/30 py-14 md:py-20">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mb-10 text-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              Come funziona
            </div>
            <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
              Dal locale al turno coperto in 3 mosse
            </h2>
          </div>
          <div className="relative grid gap-6 md:grid-cols-3">
            {[
              { n: "01", icon: FileText, title: "Pubblica l'annuncio", text: "Indica ruolo, orari, compenso e zona del tuo locale." },
              { n: "02", icon: Users, title: "Ricevi candidature", text: "I lavoratori in zona si candidano: tu vedi profili e recensioni." },
              { n: "03", icon: CheckCircle2, title: "Scegli e conferma", text: "Selezioni il candidato giusto e confermi il turno dall'app." },
            ].map(({ n, icon: Icon, title, text }, i) => (
              <div key={n} className="relative rounded-2xl border bg-card p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-4xl font-black text-primary/15">{n}</span>
                  <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md">
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
                <h3 className="mt-3 text-lg font-bold">{title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{text}</p>
                {i < 2 && (
                  <ArrowRight className="absolute -right-3 top-1/2 hidden h-6 w-6 -translate-y-1/2 text-primary/40 md:block" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 py-16 md:py-24">
        <div className="relative overflow-hidden rounded-3xl border bg-gradient-to-br from-primary to-primary/70 p-8 text-primary-foreground shadow-xl md:p-14">
          <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -bottom-20 -left-10 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
          <div className="relative max-w-2xl">
            <h2 className="text-3xl font-bold tracking-tight md:text-5xl">
              Pronto a trovare personale per il tuo locale?
            </h2>
            <p className="mt-4 text-base opacity-90 md:text-lg">
              Registra il tuo locale su Pupillo e pubblica il primo annuncio. Bastano pochi minuti
              per ricevere candidature qualificate nella tua zona.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link to="/auth" search={{ role: "restaurant" } as never}>
                <Button size="lg" variant="secondary" className="gap-2 font-semibold">
                  <ChefHat className="h-4 w-4" /> Registrati come ristoratore
                </Button>
              </Link>
              <Link to="/">
                <Button
                  size="lg"
                  variant="outline"
                  className="gap-2 border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground hover:text-primary"
                >
                  <UserPlus className="h-4 w-4" /> Sei un lavoratore?
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        © 2026 Pupillo. Marketplace per la ristorazione.
      </footer>
    </div>
  );
}
