import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ChefHat, Users, Sparkles, MapPin, Clock, ShieldCheck } from "lucide-react";
import pupilloLogo from "@/assets/pupillo-logo.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Pupillo — Trova personale extra per la ristorazione" },
      { name: "description", content: "Pupillo connette ristoratori e lavoratori extra: pubblica un annuncio, trova personale qualificato in zona, gestisci tutto in un'unica piattaforma." },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link
            to="/"
            aria-label="Vai alla home page"
            className="inline-flex items-center cursor-pointer rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            onKeyDown={(e) => { if (e.key === " " || e.code === "Space") { e.preventDefault(); (e.currentTarget as HTMLAnchorElement).click(); } }}
          >
            <img src={pupilloLogo} alt="Logo Pupillo" className="h-10 w-auto object-contain md:h-12" />
          </Link>
          <div className="flex items-center">
            <Link to="/auth"><Button variant="ghost">Accedi</Button></Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-20 text-center">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-sm text-accent-foreground">
          <Sparkles className="h-3.5 w-3.5" /> Marketplace per la ristorazione
        </div>
        <h1 className="mt-6 text-5xl font-bold tracking-tight md:text-6xl">
          Trova personale extra <br />
          <span className="text-primary">in pochi minuti.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          Pupillo connette ristoratori e lavoratori extra qualificati nella tua zona.
          Pubblica un annuncio, ricevi candidature, scegli e prenota — tutto in un unico posto.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link to="/auth" search={{ role: "restaurant" } as never}>
            <Button size="lg" className="gap-2"><ChefHat className="h-4 w-4" /> Sono un ristoratore</Button>
          </Link>
          <Link to="/auth" search={{ role: "worker" } as never}>
            <Button size="lg" variant="outline" className="gap-2"><Users className="h-4 w-4" /> Sono un lavoratore</Button>
          </Link>
        </div>
        <div className="mt-4 text-sm">
          <Link to="/lavoratori" className="text-primary underline-offset-4 hover:underline">
            Sei un lavoratore? Scopri come trovare turni →
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20">
        <div className="grid gap-6 md:grid-cols-3">
          {[
            { i: MapPin, t: "Vicino a te", d: "Mostriamo i lavoratori entro 500m dal luogo del servizio." },
            { i: Clock, t: "Servizi flash", d: "Normale, veloce o flash: scegli la tempistica giusta." },
            { i: ShieldCheck, t: "Profili verificati", d: "Lavoratori con esperienza, lingue parlate e profilo professionale." },
          ].map(({ i: Icon, t, d }) => (
            <div key={t} className="rounded-2xl border bg-card p-6">
              <Icon className="h-6 w-6 text-primary" />
              <h3 className="mt-4 font-semibold">{t}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{d}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        © 2026 Pupillo. Marketplace per la ristorazione.
      </footer>
    </div>
  );
}
