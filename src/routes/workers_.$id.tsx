import { createFileRoute, Link } from "@tanstack/react-router";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell, PageHeader } from "@/components/AppShell";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Award, Briefcase, Clock, Mail, MapPin, Phone, Shield, Star, Users } from "lucide-react";
import { SpokenLanguagesView, normalizeSpokenLanguages } from "@/components/SpokenLanguages";
import { UserAvatar } from "@/components/UserAvatar";
import {
  CRITERION_LABEL,
  REVIEW_CRITERIA,
  BADGE_LABEL,
  computeWorkerBadges,
  type WorkerStats,
} from "@/lib/reviews";

export const Route = createFileRoute("/workers_/$id")({
  head: () => ({ meta: [{ title: "Profilo lavoratore — Pupillo" }] }),
  component: () => <RequireAuth><WorkerDetailPage /></RequireAuth>,
});

type Worker = {
  id: string;
  full_name: string | null;
  professional_profile: string | null;
  primary_role: string | null;
  secondary_roles: string[] | null;
  experience_years: number | null;
  experience_level: string | null;
  languages: string[] | null;
  spoken_languages: any;
  city: string | null;
  neighborhood: string | null;
  province: string | null;
  rating_avg: number | null;
  reviews_count: number | null;
  badge: string | null;
  reliability_pct: number | null;
  completed_shifts: number | null;
  hourly_rate: number | null;
  hourly_availability: string | null;
  weekly_availability: string[] | null;
  short_bio: string | null;
  age: number | null;
  phone: string | null;
  email: string | null;
  is_motorized: boolean | null;
  avg_punctuality: number | null;
  avg_professionalism: number | null;
  avg_competence: number | null;
  avg_reliability: number | null;
  avg_teamwork: number | null;
};

function initials(name: string | null) {
  if (!name) return "?";
  return name.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

function WorkerDetailPage() {
  const { id } = Route.useParams();
  const { user, role } = useAuth();
  const [w, setW] = useState<Worker | null>(null);
  const [loading, setLoading] = useState(true);
  const [contactAllowed, setContactAllowed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from("profiles")
        .select("id,full_name,professional_profile,primary_role,secondary_roles,experience_years,experience_level,languages,spoken_languages,city,neighborhood,province,rating_avg,reviews_count,badge,reliability_pct,completed_shifts,hourly_rate,hourly_availability,weekly_availability,short_bio,age,phone,email,is_motorized,avg_punctuality,avg_professionalism,avg_competence,avg_reliability,avg_teamwork")
        .eq("id", id).maybeSingle();
      if (cancelled) return;
      setW((data as any) ?? null);
      // Show contacts only if the viewer (restaurant) has an accepted application with this worker
      if (user && role === "restaurant") {
        const { data: ax } = await supabase.from("applications")
          .select("id").eq("restaurant_id", user.id).eq("worker_id", id).eq("status", "accepted").limit(1);
        if (!cancelled) setContactAllowed(!!(ax && ax.length > 0));
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [id, user?.id, role]);

  if (loading) return <AppShell><p className="text-muted-foreground">Caricamento…</p></AppShell>;
  if (!w) return <AppShell><p className="text-muted-foreground">Lavoratore non trovato.</p></AppShell>;

  const cityLine = [w.city, w.neighborhood, w.province].filter(Boolean).join(" · ");
  const roleLine = [w.professional_profile || w.primary_role, ...(w.secondary_roles ?? [])].filter(Boolean).join(" · ");
  const langsJson = normalizeSpokenLanguages(w.spoken_languages);

  const stats: WorkerStats = {
    rating_avg: Number(w.rating_avg ?? 0),
    reviews_count: Number(w.reviews_count ?? 0),
    avg_punctuality: Number(w.avg_punctuality ?? 0),
    avg_professionalism: Number(w.avg_professionalism ?? 0),
    avg_competence: Number(w.avg_competence ?? 0),
    avg_reliability: Number(w.avg_reliability ?? 0),
    avg_teamwork: Number(w.avg_teamwork ?? 0),
  };
  const paramAvgs: Record<string, number> = {
    punctuality: stats.avg_punctuality,
    professionalism: stats.avg_professionalism,
    competence: stats.avg_competence,
    reliability: stats.avg_reliability,
    teamwork: stats.avg_teamwork,
  };
  const earnedBadges = computeWorkerBadges(stats);

  return (
    <AppShell>
      <div className="mb-4">
        <Link to=".." from={Route.fullPath}>
          <Button variant="ghost" size="sm" className="gap-2"><ArrowLeft className="h-4 w-4" />Indietro</Button>
        </Link>
      </div>

      <PageHeader title={w.full_name || "Lavoratore"} subtitle={roleLine || "—"} />

      <div className="grid gap-4 md:grid-cols-[280px_1fr]">
        <div className="rounded-2xl border bg-card p-5 flex flex-col items-center text-center">
          <UserAvatar userId={w.id} name={w.full_name} className="h-24 w-24 text-2xl mb-3" />
          <div className="font-semibold">{w.full_name || "—"}</div>
          {w.age != null && <div className="text-xs text-muted-foreground">{w.age} anni</div>}
          {w.badge && (
            <Badge className="mt-2 bg-violet-500/15 text-violet-700 hover:bg-violet-500/20">
              <Award className="h-3 w-3 mr-1" />{w.badge}
            </Badge>
          )}
          <div className="mt-4 grid grid-cols-3 gap-2 w-full text-xs">
            <Metric icon={Star} label="Rating" value={w.rating_avg ? `${Number(w.rating_avg).toFixed(1)}` : "—"} sub={w.reviews_count ? `${w.reviews_count} rec.` : undefined} iconClassName="text-yellow-500" />
            <Metric icon={Shield} label="Affidab." value={w.reliability_pct != null ? `${w.reliability_pct}%` : "—"} />
            <Metric icon={Briefcase} label="Turni" value={w.completed_shifts != null ? String(w.completed_shifts) : "—"} />
          </div>
        </div>

        <div className="space-y-4">
          <Card title="Esperienza">
            <Row label="Anni di esperienza" value={w.experience_years != null ? `${w.experience_years}` : "—"} />
            <Row label="Livello" value={w.experience_level || "—"} />
            <Row label="Tariffa oraria" value={w.hourly_rate != null ? `€${w.hourly_rate}/h` : "—"} />
            <Row label="Automunito" value={w.is_motorized ? "Sì" : "No"} />
            {w.short_bio && <p className="pt-2 border-t text-sm whitespace-pre-wrap">{w.short_bio}</p>}
          </Card>

          <Card title="Valutazioni">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold">
                {stats.rating_avg > 0 ? stats.rating_avg.toFixed(1) : "—"}
              </span>
              <span className="text-amber-500 text-sm" aria-hidden>
                {"★".repeat(Math.round(stats.rating_avg))}
                <span className="text-muted-foreground/40">
                  {"★".repeat(Math.max(0, 5 - Math.round(stats.rating_avg)))}
                </span>
              </span>
              <span className="text-xs text-muted-foreground">
                {stats.reviews_count} recension{stats.reviews_count === 1 ? "e" : "i"}
              </span>
            </div>
            {stats.reviews_count > 0 ? (
              <div className="pt-2 space-y-1.5">
                {REVIEW_CRITERIA.map((c) => {
                  const v = paramAvgs[c] || 0;
                  return (
                    <div key={c} className="flex items-center justify-between gap-2">
                      <span className="text-sm text-muted-foreground">{CRITERION_LABEL[c]}</span>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-24 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full bg-primary"
                            style={{ width: `${Math.max(0, Math.min(100, (v / 5) * 100))}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium w-8 text-right tabular-nums">
                          {v > 0 ? v.toFixed(1) : "—"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nessuna recensione ancora.</p>
            )}
            {earnedBadges.length > 0 && (
              <div className="pt-3 border-t flex flex-wrap gap-1.5">
                {earnedBadges.map((b) => (
                  <Badge key={b} className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/20 border-emerald-500/30">
                    <Award className="h-3 w-3 mr-1" />{BADGE_LABEL[b]}
                  </Badge>
                ))}
              </div>
            )}
          </Card>

          <Card title="Lingue parlate">
            {langsJson.length > 0 ? (
              <SpokenLanguagesView value={langsJson} />
            ) : (w.languages && w.languages.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {w.languages.map((l) => <Badge key={l} variant="secondary">{l}</Badge>)}
              </div>
            ) : <p className="text-sm text-muted-foreground">—</p>)}
          </Card>

          <Card title="Disponibilità">
            <Row label="Fascia oraria" value={w.hourly_availability || "—"} />
            {w.weekly_availability && w.weekly_availability.length > 0 ? (
              <div className="flex flex-wrap gap-1 pt-1">
                {w.weekly_availability.map((d) => <Badge key={d} variant="outline">{d}</Badge>)}
              </div>
            ) : null}
          </Card>

          <Card title="Zona / Città">
            <div className="flex items-start gap-2 text-sm">
              <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <span>{cityLine || "—"}</span>
            </div>
          </Card>

          {contactAllowed && (w.phone || w.email) && (
            <Card title="Contatti">
              {w.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <a href={`tel:${w.phone}`} className="text-primary hover:underline">{w.phone}</a>
                </div>
              )}
              {w.email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <a href={`mailto:${w.email}`} className="text-primary hover:underline">{w.email}</a>
                </div>
              )}
            </Card>
          )}
          {!contactAllowed && (
            <p className="text-xs text-muted-foreground">I contatti diretti del lavoratore sono visibili solo dopo aver accettato la candidatura.</p>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border bg-card p-5 space-y-2 text-sm">
      <div className="font-medium text-base">{title}</div>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function Metric({ icon: Icon, label, value, sub, iconClassName }: { icon: typeof Star; label: string; value: string; sub?: string; iconClassName?: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-2">
      <div className="flex items-center justify-center gap-1 text-muted-foreground">
        <Icon className={`h-3 w-3 ${iconClassName ?? ""}`} /><span>{label}</span>
      </div>
      <div className="font-semibold mt-0.5 text-center">{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground text-center">{sub}</div>}
    </div>
  );
}