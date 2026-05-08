import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  Zap,
  UserPlus,
  BellRing,
  TrendingUp,
  Clock,
  Euro,
  Send,
  CheckCircle2,
  Star,
  Award,
  Eye,
  ArrowRight,
  Sparkles,
  Smartphone,
  MapPin,
  ChefHat,
} from "lucide-react";
import pupilloLogo from "@/assets/pupillo-logo.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Pupillo — Trova turni di lavoro nella ristorazione" },
      {
        name: "description",
        content:
          "Pupillo è l'app per i lavoratori Horeca: candidati ai turni vicino a te in ristoranti, bar, hotel ed eventi. Compensi chiari, registrazione veloce, reputazione che cresce.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3">
          <Link to="/" aria-label="Home Pupillo" className="inline-flex items-center">
            <img src={pupilloLogo} alt="Logo Pupillo" className="h-9 w-auto md:h-10" />
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/auth">
              <Button variant="ghost" size="sm">Accedi</Button>
            </Link>
            <Link to="/ristoratori">
              <Button variant="outline" size="sm" className="gap-1 border-primary/40 text-primary hover:bg-primary/10">
                <ChefHat className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Sono un ristoratore</span>
                <span className="sm:hidden">Ristoratore</span>
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
              "radial-gradient(800px 400px at 10% 0%, color-mix(in oklab, var(--primary) 18%, transparent), transparent 60%), radial-gradient(600px 300px at 90% 10%, color-mix(in oklab, var(--primary) 10%, transparent), transparent 60%)",
          }}
        />
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 md:grid-cols-2 md:py-20">
          <div className="flex flex-col justify-center">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium">
              <Sparkles className="h-3.5 w-3.5 text-primary" /> Per camerieri, bartender, chef ed extra
            </div>
            <h1 className="mt-5 text-4xl font-bold leading-tight tracking-tight md:text-6xl">
              Trova turni di lavoro <span className="text-primary">vicino a te.</span>
              <br />
              <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                Anche oggi.
              </span>
            </h1>
            <p className="mt-5 max-w-xl text-base text-muted-foreground md:text-lg">
              Con Pupillo ti candidi ai turni pubblicati da ristoranti, bar e locali Horeca della tua
              città. Vedi <strong className="text-foreground">orari</strong> e{" "}
              <strong className="text-foreground">compensi stimati</strong> prima di accettare e
              costruisci il tuo profilo professionale, turno dopo turno.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link to="/auth" search={{ role: "worker" } as never}>
                <Button size="lg" className="gap-2 shadow-lg shadow-primary/20">
                  <UserPlus className="h-4 w-4" /> Registrati come lavoratore
                </Button>
              </Link>
              <a href="#come-funziona">
                <Button size="lg" variant="outline" className="gap-2">
                  Scopri come funziona
                </Button>
              </a>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-primary" /> Gratis per i lavoratori</span>
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-primary" /> Senza impegno</span>
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-primary" /> Pochi minuti per iniziare</span>
            </div>
          </div>

          {/* App mockup */}
          <div className="relative mx-auto flex w-full max-w-sm items-center justify-center">
            <div className="relative w-full rounded-[2.2rem] border-8 border-foreground/10 bg-card p-3 shadow-2xl">
              <div className="mb-2 flex items-center justify-between px-2 pt-1 text-[10px] text-muted-foreground">
                <span>9:41</span>
                <span className="inline-flex items-center gap-1"><Smartphone className="h-3 w-3" /> Pupillo</span>
              </div>
              <div className="rounded-2xl bg-gradient-to-br from-primary/10 to-transparent p-3">
                <div className="text-xs font-medium text-muted-foreground">Turni vicino a te</div>
                <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                  <MapPin className="h-3 w-3" /> Milano centro
                </div>
              </div>
              <div className="mt-3 space-y-2.5">
                {[
                  { role: "Cameriere", venue: "Trattoria Da Marco", time: "Stasera · 19:00", pay: "€90", flash: true },
                  { role: "Bartender", venue: "Lounge Bar Aurora", time: "Sab · 20:30", pay: "€110" },
                  { role: "Aiuto cucina", venue: "Pizzeria Vesuvio", time: "Dom · 18:00", pay: "€75" },
                ].map((s, i) => (
                  <div key={i} className="rounded-xl border bg-background p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-semibold">{s.role}</span>
                          {s.flash && (
                            <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-primary">
                              Subito
                            </span>
                          )}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">{s.venue}</div>
                        <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                          <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{s.time}</span>
                          <span className="inline-flex items-center gap-1 font-semibold text-foreground"><Euro className="h-3 w-3" />{s.pay}</span>
                        </div>
                      </div>
                      <button className="rounded-lg bg-primary px-2.5 py-1.5 text-[11px] font-semibold text-primary-foreground">
                        Candidati
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="absolute -left-2 top-10 hidden rotate-[-6deg] rounded-xl border bg-card px-3 py-2 text-xs shadow-lg md:block">
              <div className="flex items-center gap-1.5"><Star className="h-3.5 w-3.5 fill-primary text-primary" /> <strong>+12</strong> recensioni</div>
            </div>
            <div className="absolute -right-2 bottom-10 hidden rotate-[5deg] rounded-xl border bg-card px-3 py-2 text-xs shadow-lg md:block">
              <div className="flex items-center gap-1.5"><Award className="h-3.5 w-3.5 text-primary" /> Lavoratore <strong>affidabile</strong></div>
            </div>
          </div>
        </div>
      </section>

      {/* 4 main cards */}
      <section className="mx-auto max-w-6xl px-4 py-14 md:py-20">
        <div className="mb-10 text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Perché lavorare con Pupillo</h2>
          <p className="mt-3 text-muted-foreground">Tutto quello che ti serve per trovare turni e crescere.</p>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          {[
            {
              icon: Zap,
              title: "Turni disponibili subito",
              text: "Sfoglia i turni pubblicati dai locali partner e mandi la tua candidatura in pochi clic. Niente colloqui infiniti, niente tempo sprecato.",
              points: ["Turni con inizio immediato", "Orari e compensi sempre visibili", "Candidatura rapida dall'app"],
            },
            {
              icon: UserPlus,
              title: "Registrazione semplice",
              text: "Crea il tuo profilo, racconta le tue esperienze e seleziona le mansioni che ti interessano: cameriere, bartender, chef, aiuto cucina, runner o lavapiatti.",
              points: ["Profilo personalizzato", "Mansioni che scegli tu", "Validazione veloce"],
            },
            {
              icon: BellRing,
              title: "Risposte rapide",
              text: "Quando ti candidi, il locale riceve subito la tua disponibilità. Se ti scelgono, la conferma arriva direttamente nell'app — senza telefonate inutili.",
              points: ["Candidatura in tempo reale", "Conferma immediata del turno", "Tutto tracciato nell'app"],
            },
            {
              icon: TrendingUp,
              title: "Più lavori bene, più cresci",
              text: "Ogni turno completato con cura migliora la tua reputazione. Le recensioni positive ti rendono più visibile e ti aprono nuove opportunità.",
              points: ["Recensioni dai locali", "Badge di affidabilità", "Più visibilità nel tempo"],
            },
          ].map(({ icon: Icon, title, text, points }) => (
            <div
              key={title}
              className="group relative overflow-hidden rounded-2xl border bg-card p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg md:p-7"
            >
              <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-primary/5 transition group-hover:scale-125" />
              <div className="relative">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-xl font-bold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>
                <ul className="mt-4 space-y-1.5">
                  {points.map((p) => (
                    <li key={p} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="come-funziona" className="border-y bg-muted/30 py-14 md:py-20">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mb-10 text-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              Come funziona
            </div>
            <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
              Tre passaggi e sei pronto a lavorare
            </h2>
          </div>
          <div className="relative grid gap-6 md:grid-cols-3">
            {[
              { n: "01", icon: UserPlus, title: "Registrati", text: "Crea il tuo profilo in pochi minuti. Indica esperienze e mansioni." },
              { n: "02", icon: Send, title: "Candidati ai turni", text: "Scegli i turni più adatti a te e invia la tua candidatura." },
              { n: "03", icon: Star, title: "Lavora e cresci", text: "Completa i turni, ricevi recensioni e migliora la tua reputazione." },
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

      {/* Highlight strip */}
      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { icon: Eye, label: "Compensi trasparenti", value: "prima di candidarti" },
            { icon: Clock, label: "Turni flash", value: "anche per stasera" },
            { icon: Award, label: "Reputazione", value: "che cresce con te" },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-center gap-3 rounded-2xl border bg-card p-4">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-semibold">{label}</div>
                <div className="text-xs text-muted-foreground">{value}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 pb-16 md:pb-24">
        <div className="relative overflow-hidden rounded-3xl border bg-gradient-to-br from-primary to-primary/70 p-8 text-primary-foreground shadow-xl md:p-14">
          <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -bottom-20 -left-10 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
          <div className="relative max-w-2xl">
            <h2 className="text-3xl font-bold tracking-tight md:text-5xl">
              Vuoi iniziare a lavorare quando vuoi?
            </h2>
            <p className="mt-4 text-base opacity-90 md:text-lg">
              Registrati su Pupillo e scopri i turni disponibili nella tua zona. Pochi minuti
              ora, opportunità di lavoro per i prossimi mesi.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link to="/auth" search={{ role: "worker" } as never}>
                <Button size="lg" variant="secondary" className="gap-2 font-semibold">
                  <UserPlus className="h-4 w-4" /> Registrati come lavoratore
                </Button>
              </Link>
              <Link to="/ristoratori">
                <Button
                  size="lg"
                  variant="outline"
                  className="gap-2 border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground hover:text-primary"
                >
                  <ChefHat className="h-4 w-4" /> Sei un ristoratore?
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
