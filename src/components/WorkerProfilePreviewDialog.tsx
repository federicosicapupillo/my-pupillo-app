import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/UserAvatar";
import { Star, Award, Clock, ShieldCheck, MapPin, Briefcase, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { displayWorkerName } from "@/lib/worker-display";

type WorkerProfile = {
  id: string;
  full_name: string | null;
  primary_role: string | null;
  secondary_roles: string[] | null;
  city: string | null;
  neighborhood: string | null;
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
  experience_years: number | null;
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

export function WorkerProfilePreviewDialog({
  workerId,
  open,
  onOpenChange,
}: {
  workerId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
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
          "id,full_name,primary_role,secondary_roles,city,neighborhood,badge,rating_avg,reviews_count,reliability_pct,punctuality_pct,completion_pct,avg_professionalism,avg_competence,completed_shifts,hourly_rate,short_bio,weekly_availability,hourly_availability,reputation_level,spoken_languages,languages,experience_level,experience_years"
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
    })();
    return () => { cancelled = true; };
  }, [open, workerId, user?.id, role]);

  // Privacy: mostra Nome e Cognome solo se ristoratore ↔ lavoratore hanno
  // già completato almeno un turno. Altrimenti label anonima "ruolo verificato".
  const isRestaurantViewer = role === "restaurant";
  const displayName = w
    ? (isRestaurantViewer
        ? displayWorkerName(w, workedTogether)
        : (w.full_name || "Lavoratore"))
    : "Lavoratore";
  const zone = w ? [w.neighborhood, w.city].filter(Boolean).join(", ") || w.city || "—" : "—";
  const roleLine = w ? [w.primary_role, ...(w.secondary_roles ?? [])].filter(Boolean).join(" · ") : "";
  const langs = w ? langsLabel(w.spoken_languages, w.languages) : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto p-0 gap-0">
        <DialogHeader className="sr-only">
          <DialogTitle>Profilo lavoratore</DialogTitle>
        </DialogHeader>

        {/* Header */}
        <div className="relative p-5 pb-4 bg-gradient-to-b from-primary/10 to-transparent">
          <div className="flex items-start gap-4">
            <UserAvatar userId={workerId ?? undefined} name={displayName} className="h-20 w-20 ring-2 ring-background shadow-md" />
            <div className="min-w-0 flex-1 pt-1">
              <h2 className="text-xl font-bold leading-tight truncate">{displayName}</h2>
              {roleLine && <p className="text-sm text-muted-foreground capitalize mt-0.5 truncate">{roleLine}</p>}
              <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" />
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
          <div className="px-5 pb-5 text-sm text-muted-foreground">Caricamento profilo…</div>
        ) : (
          <div className="px-5 pb-5 space-y-4">
            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-2">
              <StatBox icon={<CheckCircle2 className="h-3.5 w-3.5" />} label="Turni completati" value={`${w.completed_shifts ?? 0}`} />
              <StatBox icon={<ShieldCheck className="h-3.5 w-3.5" />} label="Affidabilità" value={w.reliability_pct != null ? `${w.reliability_pct}%` : "—"} />
              <StatBox icon={<Clock className="h-3.5 w-3.5" />} label="Puntualità" value={w.punctuality_pct ? `${w.punctuality_pct}%` : "—"} />
              <StatBox icon={<Briefcase className="h-3.5 w-3.5" />} label="Professionalità" value={w.avg_professionalism != null && Number(w.avg_professionalism) > 0 ? `${Number(w.avg_professionalism).toFixed(1)}/5` : "—"} />
            </div>

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

            {/* Bio */}
            {w.short_bio && (
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Bio</h3>
                <p className="text-sm text-foreground/90 leading-relaxed">{w.short_bio}</p>
              </section>
            )}

            {/* Experience + langs */}
            {(w.experience_level || w.experience_years != null || langs) && (
              <section className="text-sm space-y-1">
                {(w.experience_level || w.experience_years != null) && (
                  <div><span className="text-muted-foreground">Esperienza: </span><span className="capitalize">{w.experience_level || ""}{w.experience_years != null ? ` · ${w.experience_years} anni` : ""}</span></div>
                )}
                {langs && (
                  <div><span className="text-muted-foreground">Lingue: </span>{langs}</div>
                )}
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
                      {r.comment && <p className="mt-1.5 text-sm text-foreground/90">"{r.comment}"</p>}
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

        <DialogFooter className="flex-row gap-2 p-4 border-t bg-card">
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