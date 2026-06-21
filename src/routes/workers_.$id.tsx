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
import { WorkerReputationCard } from "@/components/WorkerReputationCard";
import { WorkerReputationBadge } from "@/components/WorkerReputationBadge";
import { displayWorkerName } from "@/lib/worker-display";
import { formatWorkerLocation, resolveWorkerCity, resolveWorkerZone } from "@/lib/worker-location-summary";
import { formatWorkerAvailabilityCardLine } from "@/lib/worker-availability-summary";
import type { AvailabilityRow } from "@/lib/availability";

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
  experience_years: string | null;
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
  reputation_score: number | null;
  reputation_level: string | null;
  punctuality_pct: number | null;
  completion_pct: number | null;
  no_show_count: number | null;
  rehire_restaurants_count: number | null;
  rehire_yes_count: number | null;
  rehire_total_answers: number | null;
  distinct_restaurants_count: number | null;
  avatar_url: string | null;
  phone_verified: boolean | null;
  profile_completed: boolean | null;
  id_document_path: string | null;
  is_deleted: boolean | null;
  deleted_at: string | null;
  service_area_city?: string | null;
  service_area_district?: string | null;
  selected_zones?: string[] | null;
  all_zones?: boolean | null;
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
  const [workedTogether, setWorkedTogether] = useState(false);
  const [availRows, setAvailRows] = useState<AvailabilityRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from("profiles")
        .select("id,full_name,professional_profile,primary_role,secondary_roles,experience_years,experience_level,languages,spoken_languages,city,neighborhood,province,rating_avg,reviews_count,badge,reliability_pct,completed_shifts,hourly_rate,hourly_availability,weekly_availability,short_bio,age,phone,email,is_motorized,reputation_score,reputation_level,punctuality_pct,completion_pct,no_show_count,rehire_restaurants_count,rehire_yes_count,rehire_total_answers,distinct_restaurants_count,avatar_url,phone_verified,profile_completed,id_document_path,is_deleted,deleted_at,service_area_city,service_area_district,selected_zones,all_zones")
        .eq("id", id).maybeSingle();
      if (cancelled) return;
      const worker = data as Worker | null;
      setW(worker && !worker.is_deleted && !worker.deleted_at ? worker : null);
      // Load worker_availability rows — same source used by the card / map,
      // so the detail page can format hours with the same helper.
      const { data: avail } = await supabase
        .from("worker_availability")
        .select("*")
        .eq("worker_id", id);
      if (!cancelled) setAvailRows((avail ?? []) as unknown as AvailabilityRow[]);
      // Show contacts only if the viewer (restaurant) has an accepted application with this worker
      if (user && role === "restaurant") {
        const { data: ax } = await supabase.from("applications")
          .select("id").eq("restaurant_id", user.id).eq("worker_id", id).eq("status", "accepted").limit(1);
        if (!cancelled) setContactAllowed(!!(ax && ax.length > 0));
        const { data: sx } = await supabase.from("shifts")
          .select("id").eq("restaurant_id", user.id).eq("worker_id", id).eq("status", "completed").limit(1);
        if (!cancelled) setWorkedTogether(!!(sx && sx.length > 0));
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [id, user?.id, role]);

  if (loading) return <AppShell><p className="text-muted-foreground">Caricamento…</p></AppShell>;
  if (!w) return <AppShell><p className="text-muted-foreground">Lavoratore non trovato.</p></AppShell>;

  const cityLine = formatWorkerLocation(w);
  const roleLine = [w.professional_profile || w.primary_role, ...(w.secondary_roles ?? [])].filter(Boolean).join(" · ");
  const langsJson = normalizeSpokenLanguages(w.spoken_languages);
  const isRestaurantViewer = role === "restaurant";
  const shownName = isRestaurantViewer ? displayWorkerName(w, workedTogether) : (w.full_name || "Lavoratore");

  // Same formatter used by Mappa / Cerca lavoratori cards.
  const availabilityLine = formatWorkerAvailabilityCardLine(availRows ?? [], new Date());
  const hasAvailabilitySignal =
    (availRows && availRows.length > 0) ||
    (w.weekly_availability && w.weekly_availability.length > 0) ||
    !!w.hourly_availability;
  const hourlyLine =
    availabilityLine ||
    (w.hourly_availability && w.hourly_availability.trim()) ||
    (hasAvailabilitySignal ? "Disponibilità impostata" : "—");

  // Formatters for experience section (must match labels used in profile editing).
  const fmtExperienceYears = (y: string | null) => {
    if (!y) return "—";
    const map: Record<string, string> = {
      prima_esperienza: "Prima esperienza",
      meno_di_1: "Meno di 1 anno",
      oltre_10: "Oltre 10 anni",
    };
    return map[y] || y;
  };
  const fmtExperienceLevel = (l: string | null) => {
    if (!l) return "—";
    const map: Record<string, string> = {
      prima_esperienza: "Prima esperienza",
      junior: "Junior",
      intermediate: "Intermedio",
      esperto: "Esperto",
      senior: "Senior",
    };
    return map[l] || l;
  };
  const fmtHourlyRate = (r: number | null) => {
    if (r == null) return "—";
    if (r >= 21) return "Oltre 20 €/h";
    return `€${r}/h`;
  };
  const fmtMotorized = (m: boolean | null) => m === true ? "Sì" : m === false ? "No" : "Non specificato";

  if (typeof console !== "undefined") {
    console.log("[PUPILLO_WORKER_PROFILE_LOCATION_AVAILABILITY_DEBUG]", {
      worker_user_id: w.id,
      profile_id: w.id,
      nome: w.full_name,
      city_profiles: w.city,
      neighborhood_profiles: w.neighborhood,
      service_area_city: w.service_area_city ?? null,
      service_area_district: w.service_area_district ?? null,
      all_zones: w.all_zones ?? null,
      selected_zones: w.selected_zones ?? null,
      hourly_availability_raw: w.hourly_availability,
      weekly_availability_raw: w.weekly_availability ?? [],
      worker_availability_rows_count: availRows?.length ?? 0,
      worker_availability_rows: availRows ?? [],
      resolved_city: resolveWorkerCity(w),
      resolved_zone: resolveWorkerZone(w),
      formattedLocation: cityLine,
      formattedAvailability: hourlyLine,
      experience_years_raw: w.experience_years,
      experience_level_raw: w.experience_level,
      hourly_rate_raw: w.hourly_rate,
      is_motorized_raw: w.is_motorized,
      dati_letti_nel_profilo_ristoratore: true,
      motivo_dash:
        cityLine === "—"
          ? "nessun dato città/zona/provincia su profilo"
          : hourlyLine === "—"
            ? "nessuna riga worker_availability + nessuna weekly/hourly su profilo"
            : null,
    });
  }

  return (
    <AppShell>
      <div className="mb-4">
        <Link to=".." from={Route.fullPath}>
          <Button variant="ghost" size="sm" className="gap-2"><ArrowLeft className="h-4 w-4" />Indietro</Button>
        </Link>
      </div>

      <PageHeader title={shownName} subtitle={roleLine || "—"} />

      <div className="grid gap-4 md:grid-cols-[280px_1fr]">
        <div className="rounded-2xl border bg-card p-5 flex flex-col items-center text-center">
          <UserAvatar userId={w.id} name={shownName} className="h-24 w-24 text-2xl mb-3" />
          <div className="font-semibold">{shownName}</div>
          {w.age != null && <div className="text-xs text-muted-foreground">{w.age} anni</div>}
          <div className="mt-2">
            <WorkerReputationBadge profile={w} />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 w-full text-xs">
            <Metric icon={Star} label="Rating" value={w.rating_avg ? `${Number(w.rating_avg).toFixed(1)}` : "—"} sub={w.reviews_count ? `${w.reviews_count} rec.` : undefined} />
            <Metric icon={Shield} label="Affidab." value={reliabilityDisplayValue(w.reliability_pct, w.completed_shifts)} />
            <Metric icon={Briefcase} label="Turni" value={w.completed_shifts != null ? String(w.completed_shifts) : "—"} />
          </div>
        </div>

        <div className="space-y-4">
          <WorkerReputationCard workerId={w.id} profile={w} />

          <Card title="Esperienza">
            <Row label="Anni di esperienza" value={fmtExperienceYears(w.experience_years)} />
            <Row label="Livello" value={fmtExperienceLevel(w.experience_level)} />
            <Row label="Tariffa oraria" value={fmtHourlyRate(w.hourly_rate)} />
            <Row label="Automunito" value={fmtMotorized(w.is_motorized)} />
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
            <Row label="Fascia oraria" value={hourlyLine} />
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

function Metric({ icon: Icon, label, value, sub }: { icon: typeof Star; label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-2">
      <div className="flex items-center justify-center gap-1 text-muted-foreground">
        <Icon className="h-3 w-3" /><span>{label}</span>
      </div>
      <div className="font-semibold mt-0.5 text-center">{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground text-center">{sub}</div>}
    </div>
  );
}