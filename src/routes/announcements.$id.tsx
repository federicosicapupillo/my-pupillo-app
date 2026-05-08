import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell, PageHeader } from "@/components/AppShell";
import { useAuth } from "@/lib/auth-context";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ArrowLeft, Calendar, MapPin, Euro, Clock, Users, Star, Shield,
  CheckCircle2, XCircle, MessageSquare, Award, Building2, Phone, Mail, Globe,
  Languages as LanguagesIcon, IdCard, ListChecks, Sparkles, Info,
} from "lucide-react";
import {
  LICENSE_OPTIONS, LANGUAGE_OPTIONS, TATTOO_OPTIONS, PIERCING_OPTIONS,
  BEARD_OPTIONS, SKILL_OPTIONS, DRESS_CODE_OPTIONS, labelOf, labelsOf,
} from "@/lib/announcement-requirements";

export const Route = createFileRoute("/announcements/$id")({
  head: () => ({ meta: [{ title: "Dettaglio annuncio — Pupillo" }] }),
  component: () => <RequireAuth><AnnouncementDetail /></RequireAuth>,
});

type Ann = {
  id: string; restaurant_id: string; service_date: string; service_time: string;
  duration_hours: number; speed: string; tariff_type: string; tariff_amount: number;
  location_address: string; status: string; expires_at: string;
  professional_profile: string | null; languages: string[] | null; notes: string | null;
  assigned_worker_id: string | null;
  license_requirement?: string | null;
  language_requirements?: string[] | null;
  tattoos_allowed?: string | null;
  piercings_allowed?: string | null;
  beard_allowed?: string | null;
  required_skills?: string[] | null;
  dress_code_items?: string[] | null;
  dress_code_notes?: string | null;
  job_address?: string | null;
  job_city?: string | null;
  job_province?: string | null;
  job_postal_code?: string | null;
  job_country?: string | null;
  job_latitude?: number | null;
  job_longitude?: number | null;
  job_access_restrictions?: string | null;
  job_additional_directions?: string | null;
  job_location_notes?: string | null;
  job_contact_person_name?: string | null;
  job_contact_person_phone?: string | null;
  job_contact_person_email?: string | null;
  location_lat?: number | null;
  location_lng?: number | null;
};
type App = {
  id: string; status: string; worker_id: string; proposed_tariff: number | null;
  created_at: string;
};
type WorkerProfile = {
  id: string; full_name: string | null; age: number | null; city: string | null;
  professional_profile: string | null; languages: string[] | null;
  rating_avg: number | null; reviews_count: number | null; badge: string | null;
  reliability_pct: number | null; experience_years: number | null;
  completed_shifts: number | null;
};
type Restaurant = {
  id: string; full_name: string | null; business_name: string | null;
  venue_type: string | null; address: string | null; city: string | null;
  neighborhood: string | null; price_range: string | null; phone: string | null;
  email: string | null; rating_avg: number | null; reviews_count: number | null;
  opening_hours: string | null; employees_count: number | null;
};

type JobRequest = {
  title: string | null; role_required: string | null; workers_needed: number | null;
  description: string | null; tasks: string | null; start_time: string | null; end_time: string | null;
  hourly_rate: number | null; break_included: boolean | null; operational_notes: string | null;
  restaurant_name: string | null; district: string | null; worker_notes: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Bozza", active: "Pubblicato", assigned: "Assegnato",
  completed: "Completato", cancelled: "Annullato", expired: "Scaduto",
};
const STATUS_CLS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  active: "bg-emerald-500/15 text-emerald-700",
  assigned: "bg-blue-500/15 text-blue-700",
  completed: "bg-violet-500/15 text-violet-700",
  cancelled: "bg-red-500/15 text-red-700",
  expired: "bg-amber-500/15 text-amber-700",
};

const APP_STATUS_LABEL: Record<string, string> = {
  pending: "In attesa",
  interested: "Interessato",
  counter_offer: "Controfferta",
  accepted: "Accettata",
  rejected: "Rifiutata",
  not_interested: "Non interessato",
  expired: "Scaduta",
};
const APP_STATUS_CLS: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  interested: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  counter_offer: "bg-orange-500/15 text-orange-700 border-orange-500/30",
  accepted: "bg-blue-500/15 text-blue-700 border-blue-500/30",
  rejected: "bg-red-500/15 text-red-700 border-red-500/30",
  not_interested: "bg-muted text-muted-foreground",
  expired: "bg-muted text-muted-foreground",
};

function AnnouncementDetail() {
  const { id } = Route.useParams();
  const { user, role } = useAuth();
  const nav = useNavigate();
  const [ann, setAnn] = useState<Ann | null>(null);
  const [apps, setApps] = useState<App[]>([]);
  const [workers, setWorkers] = useState<Record<string, WorkerProfile>>({});
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [jobRequest, setJobRequest] = useState<JobRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    const { data: a } = await supabase.from("announcements").select("*").eq("id", id).maybeSingle();
    setAnn(a as Ann | null);
    if (!a) { setLoading(false); return; }
    const { data: r } = await supabase.from("profiles")
      .select("id,full_name,business_name,venue_type,venue_type_other,address,city,neighborhood,price_range,phone,email,rating_avg,reviews_count,opening_hours,employees_count")
      .eq("id", (a as Ann).restaurant_id).maybeSingle();
    setRestaurant(r as Restaurant | null);
    const { data: ax } = await supabase.from("applications")
      .select("id,status,worker_id,proposed_tariff,created_at")
      .eq("announcement_id", id)
      .order("created_at", { ascending: false });
    const list = (ax as App[]) ?? [];
    setApps(list);
    const { data: jr } = await (supabase as any)
      .from("job_requests")
      .select("title,role_required,workers_needed,description,tasks,start_time,end_time,hourly_rate,break_included,operational_notes,restaurant_name,district,worker_notes")
      .eq("announcement_id", id)
      .maybeSingle();
    setJobRequest((jr as JobRequest) ?? null);
    const ids = Array.from(new Set(list.map(x => x.worker_id)));
    if (ids.length) {
      const { data: ps } = await supabase.from("profiles")
        .select("id,full_name,age,city,professional_profile,languages,rating_avg,reviews_count,badge,reliability_pct,experience_years,completed_shifts")
        .in("id", ids);
      const map: Record<string, WorkerProfile> = {};
      (ps ?? []).forEach((p: any) => { map[p.id] = p; });
      setWorkers(map);
    }
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  // Realtime applications changes
  useEffect(() => {
    if (!ann) return;
    const isOwnerNow = !!(user && ann.restaurant_id === user.id);
    const ch = supabase.channel(`ann-${id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "applications", filter: `announcement_id=eq.${id}` },
        async (p) => {
          const n = p.new as App;
          if (isOwnerNow) {
            // fetch worker name for nicer toast
            const { data: w } = await supabase.from("profiles").select("full_name").eq("id", n.worker_id).maybeSingle();
            const who = (w as any)?.full_name || "Un lavoratore";
            toast.success("Nuova candidatura", { description: `${who} si è candidato per questo annuncio.` });
          }
          load();
        })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "applications", filter: `announcement_id=eq.${id}` },
        async (p) => {
          const oldA = p.old as App;
          const newA = p.new as App;
          if (isOwnerNow && oldA.status !== newA.status) {
            const { data: w } = await supabase.from("profiles").select("full_name").eq("id", newA.worker_id).maybeSingle();
            const who = (w as any)?.full_name || "Lavoratore";
            const label = ({
              interested: `${who}: interessato`,
              counter_offer: `${who}: controfferta ricevuta`,
              not_interested: `${who}: non interessato`,
              accepted: `${who}: candidatura accettata`,
              rejected: `${who}: candidatura rifiutata`,
              expired: `${who}: candidatura scaduta`,
            } as Record<string, string>)[newA.status] || `${who}: ${newA.status}`;
            toast.message("Aggiornamento candidatura", { description: label });
          }
          load();
        })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "announcements", filter: `id=eq.${id}` },
        (p) => setAnn(prev => prev ? { ...prev, ...(p.new as Ann) } : (p.new as Ann)))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line
  }, [id, ann?.restaurant_id, user?.id]);

  const isOwner = !!(ann && user && ann.restaurant_id === user.id);
  const restaurantName = restaurant?.business_name || restaurant?.full_name || "Ristoratore";

  const accept = async (app: App) => {
    setBusyId(app.id);
    const { error } = await supabase.from("applications").update({ status: "accepted" }).eq("id", app.id);
    setBusyId(null);
    if (error) { toast.error(error.message); return; }
    await supabase.from("announcements")
      .update({ status: "assigned", assigned_worker_id: app.worker_id })
      .eq("id", id);
    toast.success("Lavoratore assegnato!");
  };
  const reject = async (app: App) => {
    setBusyId(app.id);
    const { error } = await supabase.from("applications").update({ status: "rejected" }).eq("id", app.id);
    setBusyId(null);
    if (error) { toast.error(error.message); return; }
    toast.success("Candidatura rifiutata");
  };

  const publishDraft = async () => {
    if (!ann) return;
    const { error } = await supabase.from("announcements").update({ status: "active" }).eq("id", ann.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Annuncio pubblicato");
  };

  const cancelAnnouncement = async () => {
    if (!ann) return;
    if (!confirm("Vuoi davvero annullare l'annuncio? Le candidature aperte verranno chiuse.")) return;
    const { error } = await supabase.from("announcements").update({ status: "cancelled" }).eq("id", ann.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Annuncio annullato");
  };

  const counts = useMemo(() => ({
    total: apps.length,
    pending: apps.filter(a => ["pending","interested","counter_offer"].includes(a.status)).length,
    accepted: apps.filter(a => a.status === "accepted").length,
    rejected: apps.filter(a => ["rejected","not_interested","expired"].includes(a.status)).length,
  }), [apps]);

  const sortedApps = useMemo(() => {
    const order: Record<string, number> = {
      accepted: 0, counter_offer: 1, interested: 2, pending: 3,
      rejected: 4, not_interested: 5, expired: 6,
    };
    return [...apps].sort((a, b) =>
      (order[a.status] ?? 9) - (order[b.status] ?? 9) ||
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [apps]);

  if (loading) return <AppShell><p className="text-muted-foreground">Caricamento…</p></AppShell>;
  if (!ann) return <AppShell><p className="text-muted-foreground">Annuncio non trovato.</p></AppShell>;

  return (
    <AppShell>
      <div className="mb-4">
        <Link to="/announcements"><Button variant="ghost" size="sm" className="gap-2"><ArrowLeft className="h-4 w-4" />Torna agli annunci</Button></Link>
      </div>

      <PageHeader
        title={jobRequest?.title || `Servizio ${ann.speed} · ${ann.duration_hours}h`}
        subtitle={`${jobRequest?.restaurant_name || restaurantName}${jobRequest?.role_required || ann.professional_profile ? ` · Ruolo: ${jobRequest?.role_required || ann.professional_profile}` : ""}`}
        action={
          <span className={`text-xs rounded-full px-3 py-1 ${STATUS_CLS[ann.status] ?? "bg-muted text-muted-foreground"}`}>
            {STATUS_LABEL[ann.status] ?? ann.status}
          </span>
        }
      />

      <div className="grid gap-4 md:grid-cols-[1fr_320px] mb-6">
        <div className="space-y-4">
        <div className="rounded-2xl border bg-card p-5 space-y-2 text-sm">
          <div className="font-medium text-base mb-1">Dettagli servizio</div>
          {jobRequest?.workers_needed && <div className="flex items-center gap-2"><Users className="h-4 w-4 text-muted-foreground" />{jobRequest.workers_needed} lavorator{jobRequest.workers_needed === 1 ? "e" : "i"} richiest{jobRequest.workers_needed === 1 ? "o" : "i"}</div>}
          <div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-muted-foreground" />{new Date(ann.service_date).toLocaleDateString("it-IT", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })} · {(jobRequest?.start_time || ann.service_time)?.slice(0,5)}{jobRequest?.end_time ? `–${jobRequest.end_time.slice(0,5)}` : ""}</div>
          <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" />{ann.location_address}</div>
          <div className="flex items-center gap-2"><Euro className="h-4 w-4 text-muted-foreground" />€{jobRequest?.hourly_rate ?? ann.tariff_amount} ({ann.tariff_type === "hourly" ? "/ora" : "a servizio"})</div>
          <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-muted-foreground" />Scade il {new Date(ann.expires_at).toLocaleDateString("it-IT")}</div>
          {jobRequest?.break_included != null && <div className="text-muted-foreground">Pausa prevista: <span className="font-medium text-foreground">{jobRequest.break_included ? "Sì" : "No"}</span></div>}
          {ann.languages && ann.languages.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {ann.languages.map(l => <Badge key={l} variant="secondary">{l}</Badge>)}
            </div>
          )}
          {(jobRequest?.description || jobRequest?.tasks || jobRequest?.operational_notes || jobRequest?.worker_notes) && (
            <div className="pt-2 text-muted-foreground border-t mt-2 space-y-2 whitespace-pre-wrap">
              {jobRequest.description && <p><strong className="text-foreground">Descrizione:</strong> {jobRequest.description}</p>}
              {jobRequest.tasks && <p><strong className="text-foreground">Mansioni:</strong> {jobRequest.tasks}</p>}
              {jobRequest.operational_notes && <p><strong className="text-foreground">Note operative:</strong> {jobRequest.operational_notes}</p>}
              {jobRequest.worker_notes && <p><strong className="text-foreground">Note per il lavoratore:</strong> {jobRequest.worker_notes}</p>}
            </div>
          )}
          {ann.notes && !jobRequest && (
            <p className="pt-2 text-muted-foreground border-t mt-2 whitespace-pre-wrap">{ann.notes}</p>
          )}
        </div>

        {restaurant && (
          <div className="rounded-2xl border bg-card p-5 space-y-2 text-sm">
            <div className="flex items-center justify-between mb-1">
              <div className="font-medium text-base flex items-center gap-2"><Building2 className="h-4 w-4" />{restaurantName}</div>
              <Link to="/restaurants/$id" params={{ id: restaurant.id }}>
                <Button size="sm" variant="ghost">Vedi profilo</Button>
              </Link>
            </div>
            <div className="text-xs text-muted-foreground">
              {[restaurant.venue_type, restaurant.price_range].filter(Boolean).join(" · ") || "—"}
            </div>
            {(restaurant.address || restaurant.city) && (
              <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" />{[restaurant.address, restaurant.neighborhood, restaurant.city].filter(Boolean).join(", ")}</div>
            )}
            {restaurant.opening_hours && (
              <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-muted-foreground" />{restaurant.opening_hours}</div>
            )}
            {restaurant.phone && (
              <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" />{restaurant.phone}</div>
            )}
            {restaurant.email && (
              <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" />{restaurant.email}</div>
            )}
            {restaurant.rating_avg != null && Number(restaurant.rating_avg) > 0 && (
              <div className="flex items-center gap-2"><Star className="h-4 w-4 text-amber-500" />{Number(restaurant.rating_avg).toFixed(1)} ({restaurant.reviews_count ?? 0} recensioni)</div>
            )}
          </div>
        )}
        </div>

        {isOwner && (
          <div className="rounded-2xl border bg-card p-5 space-y-3">
            <div className="text-sm font-medium">Azioni</div>
            {ann.status === "draft" && (
              <Button className="w-full" onClick={publishDraft}>Pubblica annuncio</Button>
            )}
            {(ann.status === "active" || ann.status === "assigned") && (
              <Button variant="outline" className="w-full text-destructive hover:text-destructive" onClick={cancelAnnouncement}>
                Annulla annuncio
              </Button>
            )}
            <Link to="/shifts"><Button variant="ghost" className="w-full">Vai ai turni</Button></Link>
            <div className="border-t pt-3 grid grid-cols-3 gap-2 text-center text-xs">
              <div><div className="text-lg font-semibold">{counts.total}</div><div className="text-muted-foreground">Tot</div></div>
              <div><div className="text-lg font-semibold text-emerald-600">{counts.pending}</div><div className="text-muted-foreground">Aperte</div></div>
              <div><div className="text-lg font-semibold text-blue-600">{counts.accepted}</div><div className="text-muted-foreground">Acc.</div></div>
            </div>
          </div>
        )}
      </div>

      <RequirementsSection ann={ann} isOwner={isOwner} />

      <LocationAccessSection ann={ann} restaurant={restaurant} isOwner={isOwner} />

      {isOwner && (
        <>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Users className="h-5 w-5" /> Candidati ({counts.total})
          </h2>
          {apps.length === 0 ? (
            <div className="rounded-2xl border bg-card p-12 text-center text-muted-foreground">
              Nessuna candidatura ricevuta. Condividi l'annuncio o invita lavoratori dal motore di ricerca.
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {sortedApps.map(a => {
                const w = workers[a.worker_id];
                const hasCounter = a.proposed_tariff != null && Number(a.proposed_tariff) !== Number(ann.tariff_amount);
                const tariff = a.proposed_tariff ?? ann.tariff_amount;
                const isAccepted = a.status === "accepted";
                const isRejected = ["rejected","not_interested","expired"].includes(a.status);
                const canAct = (ann.status === "active" || ann.status === "assigned" && !isAccepted) && !isAccepted && !isRejected;
                return (
                  <div key={a.id} className={`rounded-2xl border bg-card p-4 ${isAccepted ? "border-emerald-500/40 bg-emerald-500/5" : ""}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-semibold truncate flex items-center gap-2">
                          {w?.full_name ?? "Lavoratore"}
                          {w?.badge === "pro" && <Badge className="bg-violet-500/15 text-violet-700 hover:bg-violet-500/20"><Award className="h-3 w-3 mr-0.5" />Pro</Badge>}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {[w?.professional_profile, w?.city, w?.age && `${w.age} anni`].filter(Boolean).join(" · ") || "—"}
                        </div>
                      </div>
                      <Badge variant="outline" className={APP_STATUS_CLS[a.status] ?? ""}>
                        {APP_STATUS_LABEL[a.status] ?? a.status}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
                      <Metric icon={Star} label="Rating" value={w?.rating_avg ? `${Number(w.rating_avg).toFixed(1)} (${w.reviews_count ?? 0})` : "—"} />
                      <Metric icon={Shield} label="Affidabilità" value={w?.reliability_pct != null ? `${w.reliability_pct}%` : "—"} />
                      <Metric icon={Award} label="Esperienza" value={w?.experience_years != null ? `${w.experience_years}a` : (w?.completed_shifts ? `${w.completed_shifts} turni` : "—")} />
                    </div>

                    {w?.languages && w.languages.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-3">
                        {w.languages.slice(0, 4).map(l => <Badge key={l} variant="secondary" className="text-[10px]">{l}</Badge>)}
                      </div>
                    )}

                    <div className="mt-3 rounded-lg bg-muted/30 p-2 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Tariffa annuncio</span>
                        <span>€{ann.tariff_amount} {ann.tariff_type === "hourly" ? "/ora" : ""}</span>
                      </div>
                      {hasCounter && (
                        <div className="flex items-center justify-between text-orange-700">
                          <span>Controproposta</span>
                          <strong>€{a.proposed_tariff} {ann.tariff_type === "hourly" ? "/ora" : ""}</strong>
                        </div>
                      )}
                      <div className="text-[10px] text-muted-foreground pt-0.5 border-t">
                        Candidatura del {new Date(a.created_at).toLocaleDateString("it-IT")}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t">
                      <Button size="sm" variant="outline" className="gap-1"
                        onClick={() => nav({ to: "/messages/$id", params: { id: a.id } })}>
                        <MessageSquare className="h-3.5 w-3.5" />Chat
                      </Button>
                      {canAct && (
                        <>
                          <Button size="sm" className="gap-1" disabled={busyId === a.id} onClick={() => accept(a)}>
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            {hasCounter ? `Accetta €${a.proposed_tariff}` : "Assegna"}
                          </Button>
                          <Button size="sm" variant="ghost" className="gap-1 text-destructive hover:text-destructive" disabled={busyId === a.id} onClick={() => reject(a)}>
                            <XCircle className="h-3.5 w-3.5" />Rifiuta
                          </Button>
                        </>
                      )}
                      {isAccepted && (
                        <Link to="/shifts">
                          <Button size="sm" variant="secondary" className="gap-1">
                            <Calendar className="h-3.5 w-3.5" />Vai al turno
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </AppShell>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Star; label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-2 text-center">
      <div className="flex items-center justify-center gap-1 text-muted-foreground">
        <Icon className="h-3 w-3" /><span>{label}</span>
      </div>
      <div className="font-semibold mt-0.5">{value}</div>
    </div>
  );
}

function RequirementsSection({ ann, isOwner }: { ann: Ann; isOwner: boolean }) {
  const langs = labelsOf(ann.language_requirements ?? null, LANGUAGE_OPTIONS);
  const skills = labelsOf(ann.required_skills ?? null, SKILL_OPTIONS);
  const dressItems = (ann.dress_code_items ?? []).map(v => DRESS_CODE_OPTIONS.find(o => o.value === v)).filter(Boolean) as typeof DRESS_CODE_OPTIONS;
  const hasAnything = !!(ann.license_requirement || langs.length || ann.tattoos_allowed || ann.piercings_allowed || ann.beard_allowed || skills.length || dressItems.length || ann.dress_code_notes);
  if (!hasAnything) return null;
  return (
    <section className="mb-6">
      <h2 className="text-lg font-semibold mb-3 flex items-center gap-2"><ListChecks className="h-5 w-5" /> Requisiti e Competenze</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border bg-card p-5 space-y-3 text-sm">
          <ReqRow icon={IdCard} label="Tipo di patente" value={labelOf(ann.license_requirement, LICENSE_OPTIONS)} />
          <ReqRow icon={LanguagesIcon} label="Lingue richieste" value={langs.length ? null : "—"}>
            {langs.length > 0 && <div className="flex flex-wrap gap-1 mt-1">{langs.map(l => <Badge key={l} variant="secondary">{l}</Badge>)}</div>}
          </ReqRow>
          <ReqRow icon={Sparkles} label="Tatuaggi" value={labelOf(ann.tattoos_allowed, TATTOO_OPTIONS)} />
          <ReqRow icon={Sparkles} label="Piercing" value={labelOf(ann.piercings_allowed, PIERCING_OPTIONS)} />
          <ReqRow icon={Sparkles} label="Barba" value={labelOf(ann.beard_allowed, BEARD_OPTIONS)} />
          <ReqRow icon={ListChecks} label="Competenze" value={skills.length ? null : "—"}>
            {skills.length > 0 && <div className="flex flex-wrap gap-1 mt-1">{skills.map(s => <Badge key={s} variant="outline">{s}</Badge>)}</div>}
          </ReqRow>
        </div>

        <div className="rounded-2xl border bg-card p-5 space-y-3">
          <div className="text-sm font-medium">Disposizioni dress code</div>
          {dressItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessuna disposizione specifica.</p>
          ) : (
            <div className="grid gap-2 grid-cols-2 sm:grid-cols-3">
              {dressItems.map(o => {
                const Icon = o.icon;
                return (
                  <div key={o.value} className="flex flex-col items-center text-center gap-1.5 rounded-xl border bg-muted/30 p-2.5">
                    <div className="h-9 w-9 rounded-full bg-primary/15 text-primary flex items-center justify-center">
                      <Icon className="h-4 w-4" />
                    </div>
                    <span className="text-[11px] leading-tight">{o.label}</span>
                  </div>
                );
              })}
            </div>
          )}
          {ann.dress_code_notes && (
            <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground border-t pt-3 mt-1 whitespace-pre-wrap">
              {ann.dress_code_notes}
            </div>
          )}
        </div>
      </div>
      {!isOwner && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs text-primary">
          <Info className="h-4 w-4 mt-0.5 shrink-0" />
          <span>Confermando la candidatura dichiari di aver letto requisiti, competenze richieste e dress code del turno.</span>
        </div>
      )}
    </section>
  );
}

function ReqRow({ icon: Icon, label, value, children }: { icon: typeof Star; label: string; value: string | null; children?: ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="h-4 w-4 mt-0.5 text-muted-foreground" />
      <div className="flex-1 min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        {value && <div className="font-medium">{value}</div>}
        {children}
      </div>
    </div>
  );
}
function distKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371, toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat), dLng = toRad(bLng - aLng);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function LocationAccessSection({ ann, restaurant, isOwner }: { ann: Ann; restaurant: any; isOwner: boolean }) {
  const lat = ann.job_latitude ?? ann.location_lat ?? restaurant?.latitude ?? restaurant?.service_area_lat ?? null;
  const lng = ann.job_longitude ?? ann.location_lng ?? restaurant?.longitude ?? restaurant?.service_area_lng ?? null;
  const address = ann.job_address || ann.location_address;
  const cityLine = [ann.job_city || restaurant?.city, ann.job_province || restaurant?.province, ann.job_country || restaurant?.country].filter(Boolean).join(", ");
  const restrictions = ann.job_access_restrictions ?? restaurant?.access_restrictions;
  const directions = ann.job_additional_directions ?? restaurant?.additional_directions;
  const notes = ann.job_location_notes ?? restaurant?.location_notes;
  const contactName = ann.job_contact_person_name || [restaurant?.contact_person_first_name, restaurant?.contact_person_last_name].filter(Boolean).join(" ");
  const contactPhone = ann.job_contact_person_phone ?? restaurant?.contact_person_phone;
  const contactEmail = ann.job_contact_person_email ?? restaurant?.contact_person_email;

  const [me, setMe] = useState<{ lat: number; lng: number } | null>(null);
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation || lat == null || lng == null) return;
    navigator.geolocation.getCurrentPosition(
      (p) => setMe({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => {},
      { timeout: 8000 }
    );
  }, [lat, lng]);

  const dist = me && lat != null && lng != null ? distKm(me.lat, me.lng, lat, lng) : null;
  const mapsUrl = lat != null && lng != null
    ? `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`
    : `https://www.openstreetmap.org/search?query=${encodeURIComponent(address || "")}`;
  const directionsUrl = lat != null && lng != null
    ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
    : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address || "")}`;

  return (
    <div className="rounded-2xl border bg-card p-6 mb-6">
      <h2 className="text-2xl font-bold text-primary mb-4">Luogo e Accesso</h2>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex items-center gap-2 text-base">
          <MapPin className="h-5 w-5 text-primary" />
          <span className="font-medium">{address}{cityLine ? `, ${cityLine}` : ""}</span>
        </div>
        {dist != null && (
          <span className="inline-flex items-center gap-1 rounded-full bg-destructive text-destructive-foreground text-xs font-bold px-3 py-1">
            <MapPin className="h-3 w-3" />{dist < 1 ? `${Math.round(dist*1000)} m` : `${dist.toFixed(dist < 10 ? 1 : 0)} km`}
          </span>
        )}
      </div>
      <div className="space-y-3 text-sm">
        {restrictions && <p><strong>Restrizioni all'ingresso:</strong> {restrictions}</p>}
        {directions && <p><strong>Indicazioni aggiuntive:</strong> {directions}</p>}
        {notes && <p><strong>Note:</strong> {notes}</p>}
        {contactName && (
          <p><strong>Referente:</strong> {contactName}
            {contactPhone && !isOwner && <> · <a href={`tel:${contactPhone}`} className="text-primary hover:underline">{contactPhone}</a></>}
            {contactPhone && isOwner && <> · {contactPhone}</>}
            {contactEmail && <> · <a href={`mailto:${contactEmail}`} className="text-primary hover:underline">{contactEmail}</a></>}
          </p>
        )}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <a href={mapsUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm hover:bg-accent">
          <MapPin className="h-4 w-4" />Apri sulla mappa
        </a>
        <a href={directionsUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-sm hover:opacity-90">
          Calcola percorso
        </a>
      </div>
    </div>
  );
}
