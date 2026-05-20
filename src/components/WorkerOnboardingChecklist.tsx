import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useAvatarUrl } from "@/hooks/use-avatar-urls";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Circle, ArrowRight, Sparkles, Rocket, Search, Star, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

type ItemKey =
  | "phone"
  | "photo"
  | "roles"
  | "city"
  | "availability"
  | "profile"
  | "application";

type Item = {
  key: ItemKey;
  label: string;
  hint?: string;
  done: boolean;
  href: string;
  weight: number;
};

export function WorkerOnboardingChecklist() {
  const { user, profile } = useAuth();
  const avatarUrl = useAvatarUrl(user?.id ?? null);
  const [availCount, setAvailCount] = useState<number | null>(null);
  const [appsCount, setAppsCount] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    (async () => {
      const [{ count: a }, { count: ap }] = await Promise.all([
        supabase
          .from("worker_availability")
          .select("id", { count: "exact", head: true })
          .eq("worker_id", user.id),
        supabase
          .from("applications")
          .select("id", { count: "exact", head: true })
          .eq("worker_id", user.id),
      ]);
      if (!alive) return;
      setAvailCount(a ?? 0);
      setAppsCount(ap ?? 0);
    })();
    return () => {
      alive = false;
    };
  }, [user]);

  if (!user || !profile) return null;

  const hasRoles = !!profile.professional_profile;
  const hasCity = !!profile.city;
  const hasProfileInfo =
    !!profile.profile_completed ||
    (!!profile.full_name && (profile.languages?.length ?? 0) > 0);

  const items: Item[] = [
    { key: "phone", label: "Telefono / WhatsApp verificato", done: !!profile.phone_verified, href: "/verify-phone", weight: 15 },
    { key: "photo", label: "Foto profilo caricata", done: !!avatarUrl, href: "/profile", weight: 15 },
    { key: "roles", label: "Ruoli selezionati", done: hasRoles, href: "/onboarding", weight: 15 },
    { key: "city", label: "Città e zona inserite", done: hasCity, href: "/onboarding", weight: 10 },
    { key: "availability", label: "Disponibilità impostate", done: (availCount ?? 0) > 0, href: "/availability", weight: 25 },
    { key: "profile", label: "Profilo completato", hint: "Lingue, esperienza, bio", done: hasProfileInfo, href: "/profile", weight: 10 },
    { key: "application", label: "Prima candidatura inviata", done: (appsCount ?? 0) > 0, href: "/jobs", weight: 10 },
  ];

  const total = items.reduce((s, i) => s + i.weight, 0);
  const earned = items.filter((i) => i.done).reduce((s, i) => s + i.weight, 0);
  const pct = Math.round((earned / total) * 100);
  const allDone = items.every((i) => i.done);

  if (allDone) {
    return (
      <section className="rounded-2xl border bg-card p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="text-xs uppercase tracking-wide text-emerald-600 font-semibold">
              Profilo completo
            </div>
            <h2 className="text-lg font-semibold mt-0.5">Pronto a ricevere offerte</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Sei pronto a ricevere offerte e candidarti ai turni.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link to="/jobs">
                <Button size="sm" className="gap-1">
                  <Search className="h-4 w-4" /> Trova offerte
                </Button>
              </Link>
              <Link to="/availability">
                <Button size="sm" variant="outline">
                  Aggiorna disponibilità
                </Button>
              </Link>
              <Link to="/profile">
                <Button size="sm" variant="ghost" className="gap-1">
                  <Star className="h-4 w-4" /> Vedi reputazione
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    );
  }

  const nextItem = items.find((i) => !i.done);

  return (
    <section
      aria-label="Guida iniziale lavoratore"
      className="overflow-hidden rounded-2xl border bg-card"
    >
      <div className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
              <Sparkles className="h-3 w-3" />
              Benvenuto su Pupillo
            </div>
            <h2 className="mt-2 text-xl font-bold tracking-tight sm:text-2xl">
              Completa questi passaggi per iniziare
            </h2>
            <p className="mt-1 text-sm text-muted-foreground max-w-xl">
              Completa il tuo profilo e imposta le disponibilità per iniziare a ricevere
              proposte di lavoro dai ristoratori.
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-extrabold leading-none text-primary">{pct}%</div>
            <div className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground">
              Profilo completato
            </div>
          </div>
        </div>

        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>

        <ul className="mt-5 grid gap-2">
          {items.map((it) => (
            <li key={it.key}>
              <div
                className={cn(
                  "flex items-center gap-3 rounded-xl border bg-background/60 px-3 py-2.5 transition-colors",
                  !it.done && "hover:bg-accent/40",
                )}
              >
                {it.done ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                ) : (
                  <Circle className="h-5 w-5 shrink-0 text-muted-foreground" />
                )}
                <div className="min-w-0 flex-1">
                  <div
                    className={cn(
                      "text-sm font-medium truncate",
                      it.done ? "text-muted-foreground line-through" : "text-foreground",
                    )}
                  >
                    {it.label}
                  </div>
                  {it.hint && (
                    <p className="text-[11px] text-muted-foreground truncate">{it.hint}</p>
                  )}
                </div>
                {it.done ? (
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-emerald-600">
                    Fatto
                  </span>
                ) : (
                  <Link to={it.href as never}>
                    <Button size="sm" variant="outline" className="h-8 gap-1">
                      Completa ora <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground italic">
            Più il tuo profilo è completo, più aumentano le possibilità di essere scelto.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link to="/guida">
              <Button size="sm" variant="outline" className="gap-1">
                <BookOpen className="h-4 w-4" /> Guida iniziale
              </Button>
            </Link>
            {nextItem && (
              <Link to={nextItem.href as never}>
                <Button size="sm" className="gap-1">
                  <Rocket className="h-4 w-4" />
                  Continua: {nextItem.label}
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
