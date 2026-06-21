import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/UserAvatar";
import { Star, Award, Clock, ShieldCheck, MapPin, Briefcase, CheckCircle2, Car } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { displayWorkerName } from "@/lib/worker-display";
import { formatWorkerLocation } from "@/lib/worker-location-summary";
import { reliabilityDisplayValue } from "@/lib/worker-reliability";

type WorkerProfile = {
  id: string;
  full_name: string | null;
  primary_role: string | null;
  secondary_roles: string[] | null;
  city: string | null;
  neighborhood: string | null;
  province: string | null;
  service_area_city: string | null;
  service_area_district: string | null;
  selected_zones: string[] | null;
  all_zones: boolean | null;
  badge: string | null;
  rating_avg: number | null;
  reviews_count: number | null;
  reliability_pct: number | null;
  punctuality_pct: number | null;
  completion_pct: number | null;
  avg_professionalism: number | null;
  avg_competence: number | null;
  completed_shifts: number | null;
  hourly_rate: number | null;
  short_bio: string | null;
  weekly_availability: string[] | null;
  hourly_availability: string | null;
  reputation_level: string | null;
  spoken_languages: any;
  languages: string[] | null;
  experience_level: string | null;
  experience_years: string | null;
  is_motorized: boolean | null;
};

type Review = {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  punctuality: number | null;
  professionalism: number | null;
  competence: number | null;
  reliability: number | null;
  positive_tags: string[] | null;
  tags: string[] | null;
};

function langsLabel(spoken: any, langs: string[] | null) {
  try {
    if (Array.isArray(spoken) && spoken.length > 0) {
      return spoken.map((l: any) => l?.language ?? l?.name ?? l).filter(Boolean).join(", ");
    }
  } catch { /* ignore */ }
  return (langs ?? []).join(", ");
}

const EXPERIENCE_YEARS_LABELS: Record<string, string> = {
  prima_esperienza: "Prima esperienza",
  meno_di_1: "Meno di 1 anno",
  "1_2": "1-2 anni",
  "3_5": "3-5 anni",
  "6_10": "6-10 anni",
  oltre_10: "Oltre 10 anni",
};
function fmtExperienceYears(v: string | null): string {
  if (!v) return "";
  return EXPERIENCE_YEARS_LABELS[v] ?? v;
}

export function WorkerProfilePreviewDialog({
  workerId,
  open,
  onOpenChange,
  source,
}: {
  workerId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source?: string;
}) {
  const { user, role } = useAuth();
  const [w, setW] = useState<WorkerProfile | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(false);
  const [workedTogether, setWorkedTogether] = useState(false);

  useEffect(() => {
    if (!open || !workerId) return;
    let cancelled = false;
    setLoading(true);
    setW(null);
    setReviews([]);
    setWorkedTogether(false);
    (async () => {
      const [{ data: profile }, { data: revs }] = await Promise.all([
        supabase.from("profiles").select(
          "id,full_name,primary_role,secondary_roles,city,neighborhood,province,service_area_city,service_area_district,selected_zones,all_zones,badge,rating_avg,reviews_count,reliability_pct,punctuality_pct,completion_pct,avg_professionalism,avg_competence,completed_shifts,hourly_rate,short_bio,weekly_availability,hourly_availability,reputation_level,spoken_languages,languages,experience_level,experience_years,is_motorized"
        ).eq("id", workerId).maybeSingle(),
        supabase.from("reviews").select(
          "id,rating,comment,created_at,punctuality,professionalism,competence,reliability,positive_tags,tags"
        ).eq("target_id", workerId).eq("is_visible_to_restaurants", true).order("created_at", { ascending: false }).limit(3),
      ]);
      if (cancelled) return;
      setW((profile as WorkerProfile | null) ?? null);
      setReviews((revs as Review[] | null) ?? []);
      // Privacy: il ristoratore vede Nome e Cognome solo se ha già avuto
      // almeno un turno COMPLETATO con questo lavoratore.
      if (user && role === "restaurant") {
        const { data: sx } = await supabase.from("shifts")
          .select("id").eq("restaurant_id", user.id).eq("worker_id", workerId).eq("status", "completed").limit(1);
        if (!cancelled) setWorkedTogether(!!(sx && sx.length > 0));
      }
      setLoading(false);
      if (typeof console !== "undefined") {
        console.log("[PUPILLO_WORKER_PROFILE_MODAL_OPEN_DEBUG]", {
          pagina_origine: source ?? "unknown",
          worker_user_id: workerId,
          profile_id: workerId,
          nome_lavoratore: (profile as any)?.full_name ?? null,
          popup_aperto: true,
          dati_caricati: !!profile,
          recensioni_caricate: revs?.length ?? 0,
        });
      }
    })();
    return () => { cancelled = true; };
  }, [open, workerId, user?.id, role, source]);

  // Privacy: mostra Nome e Cognome solo se ristoratore ↔ lavoratore hanno
  // già completato almeno un turno. Altrimenti label anonima "ruolo verificato".
  const isRestaurantViewer = role === "restaurant";
  const displayName = w
    ? (isRestaurantViewer
        ? displayWorkerName(w, workedTogether)
        : (w.full_name || "Lavoratore"))
    : "Lavoratore";
  const zone = w ? (formatWorkerLocation(w) || "—") : "—";
  const roles = (w ? [w.primary_role, ...((w.secondary_roles ?? []) as string[])].filter(Boolean) : []) as string[];
  const roleLine = roles.join(" · ");
  const langs = w ? langsLabel(w.spoken_languages, w.languages) : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-[480px] sm:max-w-[480px] max-h-[90vh] overflow-y-auto overflow-x-hidden p-0 gap-0 box-border">
        <DialogHeader className="sr-only">
          <DialogTitle>Profilo lavoratore</DialogTitle>
        </DialogHeader>

        {/* Header */}
        <div className="relative p-4 sm:p-5 pb-4 bg-gradient-to-b from-primary/10 to-transparent pr-12">
          <div className="flex items-start gap-3 sm:gap-4 min-w-0">
            <UserAvatar userId={workerId ?? undefined} name={displayName} className="h-16 w-16 sm:h-20 sm:w-20 shrink-0 ring-2 ring-background shadow-md" />
            <div className="min-w-0 flex-1 pt-1">
              <h2 className="text-lg sm:text-xl font-bold leading-tight break-words">{displayName}</h2>
              {roleLine && <p className="text-sm text-muted-foreground capitalize mt-0.5 break-words">{roleLine}</p>}
              <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{zone}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {w?.badge && (
                  <Badge variant="secondary" className="capitalize text-[10px]">
                    <Award className="h-3 w-3 mr-1" />{w.badge}
                  </Badge>
                )}
                {w?.rating_avg != null && Number(w.rating_avg) > 0 && (
                  <Badge variant="outline" className="text-[10px]">
                    <Star className="h-3 w-3 mr-1 fill-yellow-400 text-yellow-400" />
                    {Number(w.rating_avg).toFixed(1)}
                    {w.reviews_count ? <span className="ml-1 text-muted-foreground">({w.reviews_count})</span> : null}
                  </Badge>
                )}
                {w?.hourly_rate != null && (
                  <Badge variant="outline" className="text-[10px]">€ {Number(w.hourly_rate).toFixed(0)}/h</Badge>
                )}
              </div>
            </div>
          </div>
        </div>

        {loading || !w ? (
          <div className="px-4 sm:px-5 pb-5 text-sm text-muted-foreground">Caricamento profilo…</div>
        ) : (
          <div className="px-4 sm:px-5 pb-5 space-y-4 min-w-0">
            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-2">
              <StatBox icon={<CheckCircle2 className="h-3.5 w-3.5" />} label="Turni completati" value={`${w.completed_shifts ?? 0}`} />
              <StatBox icon={<ShieldCheck className="h-3.5 w-3.5" />} label="Affidabilità" value={reliabilityDisplayValue(w.reliability_pct, w.completed_shifts)} />
              <StatBox icon={<Clock className="h-3.5 w-3.5" />} label="Puntualità" value={w.punctuality_pct ? `${w.punctuality_pct}%` : "—"} />
              <StatBox icon={<Briefcase className="h-3.5 w-3.5" />} label="Professionalità" value={w.avg_professionalism != null && Number(w.avg_professionalism) > 0 ? `${Number(w.avg_professionalism).toFixed(1)}/5` : "—"} />
            </div>

            {/* Mansioni e ruoli */}
            {roles.length > 0 && (
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Mansioni e ruoli</h3>
                <div className="flex flex-wrap gap-1.5">
                  {roles.map((r) => (
                    <Badge key={r} variant="secondary" className="capitalize text-[11px]">{r}</Badge>
                  ))}
                </div>
              </section>
            )}

            {/* Availability */}
            {(w.weekly_availability?.length || w.hourly_availability) && (
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Disponibilità</h3>
                <div className="rounded-lg border bg-card p-2.5 text-sm">
                  {w.weekly_availability?.length ? (
                    <div className="flex flex-wrap gap-1">
                      {w.weekly_availability.map(d => (
                        <span key={d} className="text-[11px] rounded-md bg-secondary px-1.5 py-0.5 capitalize">{d}</span>
                      ))}
                    </div>
                  ) : null}
                  {w.hourly_availability && <p className="mt-1.5 text-xs text-muted-foreground">{w.hourly_availability}</p>}
                </div>
              </section>
            )}

            {/* Zona / Città */}
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Zona / Città</h3>
              <p className="text-sm">{zone}</p>
            </section>

            {/* Bio */}
            {w.short_bio && (
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Bio</h3>
                <p className="text-sm text-foreground/90 leading-relaxed break-words">{w.short_bio}</p>
              </section>
            )}

            {/* Esperienza */}
            <section className="text-sm space-y-1">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Esperienza</h3>
              <div><span className="text-muted-foreground">Livello: </span><span className="capitalize">{w.experience_level || "—"}</span></div>
              <div><span className="text-muted-foreground">Anni: </span>{fmtExperienceYears(w.experience_years) || "—"}</div>
              <div><span className="text-muted-foreground">Tariffa oraria desiderata: </span>{w.hourly_rate != null ? `€ ${Number(w.hourly_rate).toFixed(0)}/h` : "—"}</div>
              <div className="inline-flex items-center gap-1"><Car className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-muted-foreground">Automunito: </span>{w.is_motorized == null ? "Non specificato" : w.is_motorized ? "Sì" : "No"}</div>
            </section>

            {/* Lingue */}
            {langs && (
              <section className="text-sm">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Lingue</h3>
                <p>{langs}</p>
              </section>
            )}

            {/* Reviews */}
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Recensioni recenti</h3>
              {reviews.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">Questo lavoratore non ha ancora recensioni.</p>
              ) : (
                <ul className="space-y-2">
                  {reviews.map(r => (
                    <li key={r.id} className="rounded-lg border bg-card p-2.5 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <div className="inline-flex items-center gap-0.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={i} className={`h-3.5 w-3.5 ${i < r.rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`} />
                          ))}
                        </div>
                        <span className="text-[11px] text-muted-foreground">{new Date(r.created_at).toLocaleDateString("it-IT")}</span>
                      </div>
                      {r.comment && <p className="mt-1.5 text-sm text-foreground/90 break-words">"{r.comment}"</p>}
                      {((r.positive_tags?.length ?? 0) > 0 || (r.tags?.length ?? 0) > 0) && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {(r.positive_tags ?? []).slice(0, 4).map(t => (
                            <span key={`p-${t}`} className="text-[10px] rounded-full bg-primary/10 text-primary px-1.5 py-0.5">{t}</span>
                          ))}
                          {(r.tags ?? []).slice(0, 4).map(t => (
                            <span key={`t-${t}`} className="text-[10px] rounded-full bg-secondary px-1.5 py-0.5">{t}</span>
                          ))}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}

        <DialogFooter className="sticky bottom-0 flex-row gap-2 p-3 sm:p-4 border-t bg-card">
          <Button variant="outline" size="sm" className="ml-auto" onClick={() => onOpenChange(false)}>
            Chiudi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StatBox({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-2.5">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        {icon}<span>{label}</span>
      </div>
      <div className="mt-0.5 text-sm font-semibold">{value}</div>
    </div>
  );
}