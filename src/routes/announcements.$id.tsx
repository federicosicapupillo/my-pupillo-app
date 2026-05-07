import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell, PageHeader } from "@/components/AppShell";
import { useAuth } from "@/lib/auth-context";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ArrowLeft, Calendar, MapPin, Euro, Clock, Users, Star, Shield,
  CheckCircle2, XCircle, MessageSquare, Award, Building2, Phone, Mail, Globe,
} from "lucide-react";

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
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    const { data: a } = await supabase.from("announcements").select("*").eq("id", id).maybeSingle();
    setAnn(a as Ann | null);
    if (!a) { setLoading(false); return; }
    const { data: r } = await supabase.from("profiles")
      .select("id,full_name,business_name,venue_type,address,city,neighborhood,price_range,phone,email,rating_avg,reviews_count,opening_hours,employees_count")
      .eq("id", (a as Ann).restaurant_id).maybeSingle();
    setRestaurant(r as Restaurant | null);
    const { data: ax } = await supabase.from("applications")
      .select("id,status,worker_id,proposed_tariff,created_at")
      .eq("announcement_id", id)
      .order("created_at", { ascending: false });
    const list = (ax as App[]) ?? [];
    setApps(list);
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
        title={`Servizio ${ann.speed} · ${ann.duration_hours}h`}
        subtitle={`${restaurantName}${ann.professional_profile ? ` · Ruolo: ${ann.professional_profile}` : ""}`}
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
          <div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-muted-foreground" />{new Date(ann.service_date).toLocaleDateString("it-IT", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })} · {ann.service_time?.slice(0,5)}</div>
          <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" />{ann.location_address}</div>
          <div className="flex items-center gap-2"><Euro className="h-4 w-4 text-muted-foreground" />€{ann.tariff_amount} ({ann.tariff_type === "hourly" ? "/ora" : "a servizio"})</div>
          <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-muted-foreground" />Scade il {new Date(ann.expires_at).toLocaleDateString("it-IT")}</div>
          {ann.languages && ann.languages.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {ann.languages.map(l => <Badge key={l} variant="secondary">{l}</Badge>)}
            </div>
          )}
          {ann.notes && (
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