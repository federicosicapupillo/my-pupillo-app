import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell, PageHeader } from "@/components/AppShell";
import { useAuth } from "@/lib/auth-context";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar, MapPin, Euro, Heart, List, Map as MapIcon, Search, Send, Clock, Zap, User, CheckCircle2, Moon, Hourglass, Loader2, XCircle } from "lucide-react";
import { formatTariff, formatTotalService, formatOfferDateTime } from "@/lib/format";
import { publicLocationLabel, PRECISE_ADDRESS_HINT } from "@/lib/public-location";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/browse")({
  head: () => ({ meta: [{ title: "Trova offerte — Pupillo" }] }),
  component: () => <RequireAuth><Browse /></RequireAuth>,
});

type Ann = {
  id: string; restaurant_id: string; service_date: string; service_time: string;
  end_time?: string | null; end_date?: string | null;
  duration_hours: number; speed: string; tariff_type: string; tariff_amount: number;
  location_address: string; location_lat: number | null; location_lng: number | null;
  professional_profile: string | null; status: string; created_at: string;
  job_city?: string | null; job_province?: string | null;
  dress_code_items?: string[] | null; dress_code_notes?: string | null;
  required_skills?: string[] | null; language_requirements?: string[] | null;
  license_requirement?: string | null;
  notes?: string | null; job_location_notes?: string | null;
  job_additional_directions?: string | null; job_access_restrictions?: string | null;
};

type RestaurantInfo = { id: string; full_name: string | null; business_name: string | null; venue_type: string | null; city: string | null; neighborhood: string | null; rating_avg: number | null } | null;

const ROLES = ["cameriere","bartender","chef","aiuto cucina","runner","lavapiatti","hostess","responsabile sala"];
const SPEEDS = [{v:"normal",l:"Standard"},{v:"urgent",l:"Urgente"},{v:"flash",l:"Flash"}];

function roleEmoji(role: string | null | undefined): string {
  const r = (role || "").toLowerCase();
  if (r.includes("camer")) return "🍽️";
  if (r.includes("barman") || r.includes("bartender") || r.includes("barista")) return "🍸";
  if (r.includes("cuoc") || r.includes("chef") || r.includes("cucina")) return "👨‍🍳";
  if (r.includes("lavapiatti") || r.includes("plonge")) return "🧽";
  if (r.includes("pizz")) return "🍕";
  if (r.includes("hostess") || r.includes("steward") || r.includes("accogli")) return "🎀";
  if (r.includes("runner")) return "🏃";
  if (r.includes("sommelier")) return "🍷";
  if (r.includes("commis")) return "🧑‍🍳";
  return "💼";
}

function speedLabel(s: string): string {
  if (s === "urgent") return "Urgente";
  if (s === "flash") return "Subito";
  return "Normal";
}

function speedClasses(s: string): string {
  if (s === "urgent") return "bg-destructive/15 text-destructive border border-destructive/30";
  if (s === "flash") return "bg-amber-500/15 text-amber-400 border border-amber-500/30";
  return "bg-secondary/60 text-foreground/80 border border-white/10";
}

function distKm(aLat:number,aLng:number,bLat:number,bLng:number){
  const R=6371,toRad=(d:number)=>d*Math.PI/180;
  const dLat=toRad(bLat-aLat),dLng=toRad(bLng-aLng);
  const x=Math.sin(dLat/2)**2+Math.cos(toRad(aLat))*Math.cos(toRad(bLat))*Math.sin(dLng/2)**2;
  return R*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));
}

function Browse() {
  const { user, role, profile } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<Ann[]>([]);
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());
  const [appStatusById, setAppStatusById] = useState<Record<string, string>>({});
  const [favIds, setFavIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"list"|"map">("list");
  const [q, setQ] = useState("");
  const [roleF, setRoleF] = useState<string>("any");
  const [speedF, setSpeedF] = useState<string>("any");
  const [maxKm, setMaxKm] = useState<string>("");
  const [onlyNotApplied, setOnlyNotApplied] = useState(false);
  const [onlyFav, setOnlyFav] = useState(false);
  const [sort, setSort] = useState<"recent"|"pay"|"date">("recent");
  const [openId, setOpenId] = useState<string | null>(null);
  const [restaurant, setRestaurant] = useState<RestaurantInfo>(null);
  const [restaurantsById, setRestaurantsById] = useState<Record<string, { city: string | null; neighborhood: string | null }>>({});
  const [workersNeededById, setWorkersNeededById] = useState<Record<string, number>>({});
  const [filledById, setFilledById] = useState<Record<string, number>>({});
  const [confirmAnn, setConfirmAnn] = useState<Ann | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [successApp, setSuccessApp] = useState<{ id: string; ann: Ann } | null>(null);
  const [applyMode, setApplyMode] = useState<"accept" | "counter">("accept");
  const [counterAmount, setCounterAmount] = useState<string>("");

  const selected = useMemo(() => items.find(i => i.id === openId) ?? null, [items, openId]);

  useEffect(() => {
    if (!selected) { setRestaurant(null); return; }
    (async () => {
      const { data } = await supabase.from("profiles")
        .select("id, full_name, business_name, venue_type, city, neighborhood, rating_avg")
        .eq("id", selected.restaurant_id).maybeSingle();
      setRestaurant((data as RestaurantInfo) ?? null);
    })();
  }, [selected]);

  const load = async () => {
    setLoading(true);
    // Use the PII-safe view for public browsing (excludes job contact details
    // and exact GPS). Workers only see full row via base table once they have
    // an application/shift on the announcement (enforced by RLS).
    const { data: anns } = await (supabase as any).from("announcements_public").select("*").eq("status","active").order("created_at",{ascending:false}).limit(200);
    const list = (anns as Ann[]) ?? [];
    setItems(list);
    // Multi-position: load workers_needed per announcement and accepted count.
    const annIds = list.map(a => a.id);
    if (annIds.length) {
      const [{ data: jr }, { data: accepted }] = await Promise.all([
        supabase.from("job_requests").select("announcement_id, workers_needed").in("announcement_id", annIds),
        supabase.from("applications").select("announcement_id").in("announcement_id", annIds).eq("status", "accepted"),
      ]);
      const needMap: Record<string, number> = {};
      (jr ?? []).forEach((r: any) => {
        if (!r.announcement_id) return;
        const n = Math.max(1, Number(r.workers_needed ?? 1) || 1);
        needMap[r.announcement_id] = Math.max(needMap[r.announcement_id] ?? 0, n);
      });
      const fillMap: Record<string, number> = {};
      (accepted ?? []).forEach((r: any) => {
        if (!r.announcement_id) return;
        fillMap[r.announcement_id] = (fillMap[r.announcement_id] ?? 0) + 1;
      });
      setWorkersNeededById(needMap);
      setFilledById(fillMap);
    }
    const restIds = Array.from(new Set(list.map(a => a.restaurant_id)));
    if (restIds.length) {
      const { data: rs } = await supabase.from("profiles")
        .select("id, city, neighborhood").in("id", restIds);
      const map: Record<string, { city: string | null; neighborhood: string | null }> = {};
      for (const r of (rs ?? []) as any[]) map[r.id] = { city: r.city, neighborhood: r.neighborhood };
      setRestaurantsById(map);
    }
    if (user) {
      const [{data:apps},{data:favs}] = await Promise.all([
        supabase.from("applications").select("announcement_id,status,created_at").eq("worker_id",user.id).order("created_at",{ascending:false}),
        supabase.from("favorites").select("announcement_id").eq("user_id",user.id),
      ]);
      setAppliedIds(new Set((apps??[]).map((a:any)=>a.announcement_id)));
      const statusMap: Record<string, string> = {};
      for (const a of (apps ?? []) as any[]) {
        if (!statusMap[a.announcement_id]) statusMap[a.announcement_id] = a.status;
      }
      setAppStatusById(statusMap);
      setFavIds(new Set((favs??[]).map((f:any)=>f.announcement_id)));
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, [user]);

  const filtered = useMemo(() => {
    const lat = profile?.service_area_lat, lng = profile?.service_area_lng;
    const max = maxKm ? Number(maxKm) : null;
    let out = items.filter(a => {
      if (roleF !== "any" && a.professional_profile !== roleF) return false;
      if (speedF !== "any" && a.speed !== speedF) return false;
      if (onlyNotApplied && appliedIds.has(a.id)) return false;
      if (onlyFav && !favIds.has(a.id)) return false;
      if (q) {
        const r = restaurantsById[a.restaurant_id];
        const loc = publicLocationLabel({ job_city: a.job_city, city: r?.city, neighborhood: r?.neighborhood });
        const s = `${loc} ${a.professional_profile||""} ${a.speed}`.toLowerCase();
        if (!s.includes(q.toLowerCase())) return false;
      }
      if (max != null && lat != null && lng != null && a.location_lat != null && a.location_lng != null) {
        if (distKm(lat,lng,a.location_lat,a.location_lng) > max) return false;
      }
      return true;
    });
    if (sort === "pay") out = [...out].sort((a,b)=>b.tariff_amount-a.tariff_amount);
    if (sort === "date") out = [...out].sort((a,b)=>a.service_date.localeCompare(b.service_date));
    return out;
  }, [items, roleF, speedF, q, maxKm, onlyNotApplied, onlyFav, sort, profile, appliedIds, favIds, restaurantsById]);

  const toggleFav = async (annId: string) => {
    if (!user) return;
    if (favIds.has(annId)) {
      await supabase.from("favorites").delete().eq("user_id",user.id).eq("announcement_id",annId);
      const n = new Set(favIds); n.delete(annId); setFavIds(n);
    } else {
      await supabase.from("favorites").insert({ user_id: user.id, announcement_id: annId });
      setFavIds(new Set(favIds).add(annId));
    }
  };

  const apply = (a: Ann) => {
    if (appliedIds.has(a.id)) {
      toast.info("Ti sei già candidato a questo turno.");
      return;
    }
    setConfirmAnn(a);
  };

  const submitApplication = async () => {
    if (!user || !confirmAnn) return;
    if (appliedIds.has(confirmAnn.id)) {
      toast.info("Ti sei già candidato a questo turno.");
      setConfirmAnn(null);
      return;
    }
    const workerProfile = profile?.id === user.id
      ? profile
      : (await supabase.from("profiles").select("id").eq("id", user.id).maybeSingle()).data;
    if (!workerProfile?.id) {
      toast.error("Profilo lavoratore non trovato.");
      return;
    }
    const { data: jobRequest } = await supabase
      .from("job_requests")
      .select("id, announcement_id, workers_needed")
      .eq("announcement_id", confirmAnn.id)
      .maybeSingle();
    if (!jobRequest?.announcement_id) {
      toast.error("Turno non valido.");
      return;
    }
    const { data: existingApp } = await supabase
      .from("applications")
      .select("id")
      .eq("announcement_id", confirmAnn.id)
      .eq("worker_id", workerProfile.id)
      .maybeSingle();
    if (existingApp?.id) {
      toast.info("Hai già inviato la candidatura per questo turno.");
      setConfirmAnn(null);
      return;
    }
    const needed = Math.max(1, Number(jobRequest.workers_needed ?? workersNeededById[confirmAnn.id] ?? 1) || 1);
    const { count: acceptedCount } = await supabase
      .from("applications")
      .select("id", { count: "exact", head: true })
      .eq("announcement_id", confirmAnn.id)
      .eq("status", "accepted");
    if ((acceptedCount ?? 0) >= needed) {
      toast.error("Turno già assegnato. Questo turno non è più disponibile perché tutte le posizioni sono già state assegnate.");
      setConfirmAnn(null);
      return;
    }
    // Validazione contro-offerta lato client
    let counterValueNum: number | null = null;
    if (applyMode === "counter") {
      const v = parseFloat(counterAmount.replace(",", "."));
      if (!Number.isFinite(v) || v <= 0) {
        toast.error("Inserisci una tariffa valida.");
        return;
      }
      if (v <= (confirmAnn.tariff_amount ?? 0)) {
        toast.error(`La contro offerta deve essere superiore a € ${confirmAnn.tariff_amount}.`);
        return;
      }
      if (v > 100) {
        toast.error("Importo non valido (max € 100/h).");
        return;
      }
      counterValueNum = Math.round(v * 100) / 100;
    }
    setSubmitting(true);
    const insertPayload: any = {
      announcement_id: confirmAnn.id,
      worker_id: workerProfile.id,
      restaurant_id: confirmAnn.restaurant_id,
      status: "pending",
    };
    if (counterValueNum != null) {
      insertPayload.proposed_tariff = counterValueNum;
      insertPayload.worker_response_at = new Date().toISOString();
    }
    console.log("auth user id", user.id);
    console.log("worker profile id", workerProfile.id);
    console.log("worker profile user_id", (workerProfile as any).user_id);
    console.log("application payload", insertPayload);
    const { data: app, error } = await supabase.from("applications").insert(insertPayload).select("id").single();
    if (error) {
      setSubmitting(false);
      const msg = (error.message || "").toLowerCase();
      if (msg.includes("duplicate") || msg.includes("unique")) {
        return toast.info("Hai già inviato la candidatura per questo turno.");
      }
      if (msg.includes("row-level security") || msg.includes("violates row-level")) {
        return toast.error("Errore autorizzazione candidatura. Controlla le policy Supabase della tabella applications.");
      }
      // Only claim the shift is full after confirming with fresh data — never
      // infer it from a generic RLS error.
      const { count: acceptedCount } = await supabase
        .from("applications")
        .select("id", { count: "exact", head: true })
        .eq("announcement_id", confirmAnn.id)
        .eq("status", "accepted");
      if ((acceptedCount ?? 0) >= needed) {
        return toast.error(
          needed > 1
            ? "Turno completo. Tutte le posizioni sono già state assegnate."
            : "Turno già assegnato. Questo turno non è più disponibile perché tutte le posizioni sono già state assegnate.",
        );
      }
      return toast.error(error.message);
    }
    // Notifica al ristoratore (best-effort)
    if (app?.id) {
      await supabase.from("notifications").insert({
        user_id: confirmAnn.restaurant_id,
        title: counterValueNum != null ? "Nuova contro offerta ricevuta" : "Nuova candidatura ricevuta",
        body: counterValueNum != null
          ? `Un lavoratore propone € ${counterValueNum}/h per uno dei tuoi turni.`
          : "Un lavoratore si è candidato per uno dei tuoi turni.",
        link: `/messages/${app.id}`,
      });
    }
    setAppliedIds(new Set(appliedIds).add(confirmAnn.id));
    setSubmitting(false);
    if (app?.id) {
      setSuccessApp({ id: app.id, ann: confirmAnn });
      toast.success("Candidatura inviata correttamente.");
    }
    setConfirmAnn(null);
    setOpenId(null);
    setApplyMode("accept");
    setCounterAmount("");
  };

  if (role && role !== "worker") {
    return <AppShell><p className="text-muted-foreground">Sezione riservata ai lavoratori.</p></AppShell>;
  }

  return (
    <AppShell>
      <PageHeader title="Trova offerte" subtitle="Esplora gli annunci attivi e candidati" />

      <div className="rounded-2xl border bg-card p-4 mb-4">
        <div className="grid gap-3 md:grid-cols-4">
          <Select value={roleF} onValueChange={setRoleF}>
            <SelectTrigger><SelectValue placeholder="Ruolo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Qualsiasi ruolo</SelectItem>
              {ROLES.map(r => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={speedF} onValueChange={setSpeedF}>
            <SelectTrigger><SelectValue placeholder="Tipologia annuncio" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Tutte le tipologie</SelectItem>
              {SPEEDS.map(s => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="relative">
            <Input type="number" placeholder="Distanza max" value={maxKm} onChange={e=>setMaxKm(e.target.value)} />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">km</span>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={onlyNotApplied} onCheckedChange={v=>setOnlyNotApplied(!!v)} />
              Non candidato
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={onlyFav} onCheckedChange={v=>setOnlyFav(!!v)} />
              Preferiti
            </label>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Parola chiave (città, ruolo…)" value={q} onChange={e=>setQ(e.target.value)} />
          </div>
          <Select value={sort} onValueChange={(v)=>setSort(v as any)}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Ordina per recenti</SelectItem>
              <SelectItem value="pay">Tariffa più alta</SelectItem>
              <SelectItem value="date">Data servizio</SelectItem>
            </SelectContent>
          </Select>
          <div className="inline-flex rounded-lg border p-0.5">
            <Button size="sm" variant={view==="list"?"secondary":"ghost"} onClick={()=>setView("list")} className="gap-1"><List className="h-4 w-4" />Lista</Button>
            <Button size="sm" variant={view==="map"?"secondary":"ghost"} onClick={()=>setView("map")} className="gap-1"><MapIcon className="h-4 w-4" />Mappa</Button>
          </div>
        </div>
      </div>

      {loading ? <p className="text-muted-foreground">Caricamento…</p> : filtered.length === 0 ? (
        <div className="rounded-2xl border bg-card p-12 text-center text-muted-foreground">Nessuna offerta corrisponde ai filtri.</div>
      ) : view === "list" ? (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map(a => {
            const applied = appliedIds.has(a.id);
            const appStatus = appStatusById[a.id];
            const rejected = appStatus === "rejected" || appStatus === "not_interested";
            const fav = favIds.has(a.id);
            const role = a.professional_profile || "ruolo";
            const loc = publicLocationLabel({
              job_city: a.job_city,
              city: restaurantsById[a.restaurant_id]?.city,
              neighborhood: restaurantsById[a.restaurant_id]?.neighborhood,
            });
            const totalDisplay = formatTotalService(
              a.tariff_amount,
              a.tariff_type,
              a.duration_hours,
              a.service_time,
              null, // end_time non disponibile in Ann, usiamo duration_hours
            );
            const hourlyRate = a.tariff_type === "hourly" ? a.tariff_amount : null;
            return (
              <div
                key={a.id}
                className="group relative rounded-3xl border border-white/[0.06] bg-card p-5 shadow-[0_20px_50px_-30px_oklch(0_0_0/0.7)] transition-all hover:border-primary/30 hover:shadow-[0_28px_60px_-25px_oklch(0.65_0.25_310/0.35)]"
              >
                <button
                  type="button"
                  onClick={() => toggleFav(a.id)}
                  aria-label="Preferiti"
                  className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full bg-background/40 backdrop-blur transition-colors hover:bg-background/70"
                >
                  <Heart className={`h-5 w-5 ${fav ? "fill-primary text-primary" : "text-muted-foreground"}`} />
                </button>

                <div className="flex items-start gap-4 pr-10">
                  <div className="relative shrink-0">
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/30 to-accent/30 blur-md opacity-70" aria-hidden />
                    <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-background/60 text-2xl">
                      <span aria-hidden>{roleEmoji(a.professional_profile)}</span>
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold leading-tight capitalize truncate">{role}</h3>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${speedClasses(a.speed)}`}>
                        {speedLabel(a.speed)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">Ristorante partner</p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
                  <div className="space-y-1.5 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 shrink-0 text-primary/80" />
                      <span className="text-foreground/90">
                        {formatOfferDateTime({
                          service_date: a.service_date,
                          service_time: a.service_time,
                          end_date: a.end_date,
                          end_time: a.end_time,
                        })}
                      </span>
                      <span className="text-muted-foreground">· Durata {a.duration_hours}h</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 shrink-0 text-primary/80" />
                      <span className="truncate">{loc}</span>
                    </div>
                  </div>

                  {totalDisplay ? (
                    <div className="flex flex-col items-start gap-0.5 rounded-2xl bg-primary/10 px-4 py-2 ring-1 ring-primary/30 sm:items-end sm:text-right">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-primary/80">
                        Totale servizio
                      </span>
                      <div className="flex items-center gap-1">
                        <span className="text-2xl font-extrabold tracking-tight text-primary tabular-nums">
                          {totalDisplay}
                        </span>
                      </div>
                      {hourlyRate != null && (
                        <span className="text-[10px] text-primary/70">
                          Calcolato su €{hourlyRate}/ora per {a.duration_hours}h
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center justify-start gap-1 rounded-2xl bg-primary/10 px-4 py-2 ring-1 ring-primary/30 sm:justify-end">
                      <Euro className="h-4 w-4 text-primary" />
                      <span className="text-xl font-extrabold tracking-tight text-primary tabular-nums">
                        {formatTariff(a.tariff_amount, a.tariff_type)}
                      </span>
                    </div>
                  )}
                </div>

                <div className="mt-4 flex items-center gap-2">
                  {(() => {
                    const need = workersNeededById[a.id] ?? 1;
                    const filled = filledById[a.id] ?? 0;
                    if (need <= 1) return null;
                    const remaining = Math.max(0, need - filled);
                    return (
                      <span className="absolute left-4 top-4 inline-flex items-center rounded-full bg-primary/15 text-primary text-[10px] font-semibold px-2 py-0.5">
                        {remaining > 0 ? `${remaining}/${need} posti disponibili` : "Turno completo"}
                      </span>
                    );
                  })()}
                  {rejected ? (
                    <div className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border-2 border-destructive bg-destructive/10 px-4 py-3 text-sm font-bold text-destructive">
                      <XCircle className="h-4 w-4" />
                      Candidatura rifiutata
                    </div>
                  ) : applied ? (
                    <div className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-semibold text-primary">
                      <CheckCircle2 className="h-4 w-4" />
                      Candidatura inviata
                    </div>
                  ) : (
                    <Button size="lg" className="flex-1 rounded-xl gap-2" onClick={() => apply(a)}>
                      <Send className="h-4 w-4" />
                      Candidati
                    </Button>
                  )}
                  <Button size="lg" variant="outline" className="rounded-xl" onClick={() => setOpenId(a.id)}>
                    Dettagli
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border bg-card p-2">
          <div className="p-8 text-center text-muted-foreground text-sm">
            La mappa con la posizione esatta è disponibile solo dopo la conferma del turno.<br />
            Usa la vista lista per esplorare le offerte per zona.
          </div>
        </div>
      )}

      <Sheet open={!!openId} onOpenChange={(o)=>!o && setOpenId(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          {selected && (() => {
            const applied = appliedIds.has(selected.id);
            const appStatus = appStatusById[selected.id];
            const rejected = appStatus === "rejected" || appStatus === "not_interested";
            const fav = favIds.has(selected.id);
            const dist = (profile?.service_area_lat != null && profile?.service_area_lng != null && selected.location_lat != null && selected.location_lng != null)
              ? distKm(profile.service_area_lat, profile.service_area_lng, selected.location_lat, selected.location_lng) : null;
            const selectedTotal = formatTotalService(
              selected.tariff_amount,
              selected.tariff_type,
              selected.duration_hours,
              selected.service_time,
              null,
            );
            return (
              <>
                <SheetHeader>
                  <SheetTitle className="capitalize">{selected.professional_profile || "Offerta di lavoro"}</SheetTitle>
                  <SheetDescription>
                    {restaurant?.business_name || restaurant?.full_name || "Ristoratore"}
                    {restaurant?.rating_avg ? ` · ★ ${restaurant.rating_avg}` : ""}
                  </SheetDescription>
                </SheetHeader>

                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-full bg-secondary px-2 py-1 text-xs capitalize">{selected.speed}</span>
                  <span className="rounded-full bg-accent text-accent-foreground px-2 py-1 text-xs">{selected.duration_hours}h</span>
                  <span className="rounded-full bg-primary/10 text-primary px-2 py-1 text-xs">{selectedTotal ?? formatTariff(selected.tariff_amount, selected.tariff_type)}</span>
                  {dist != null && <span className="rounded-full bg-muted px-2 py-1 text-xs">{dist.toFixed(1)} km</span>}
                </div>

                <div className="mt-5 space-y-3 text-sm">
                  <Row icon={Calendar} label="Data" value={new Date(selected.service_date).toLocaleDateString("it-IT", { weekday:"long", day:"numeric", month:"long", year:"numeric" })} />
                  <Row icon={Clock} label="Orario" value={`${selected.service_time?.slice(0,5)} · durata ${selected.duration_hours}h`} />
                  <Row icon={Euro} label="Compenso" value={selectedTotal ?? formatTariff(selected.tariff_amount, selected.tariff_type)} detail={selectedTotal && selected.tariff_type === "hourly" ? `€${selected.tariff_amount}/ora × ${selected.duration_hours}h` : undefined} />
                  <Row icon={Zap} label="Tipologia" value={selected.speed} />
                  <Row icon={MapPin} label="Zona" value={publicLocationLabel({ job_city: selected.job_city, city: restaurant?.city, neighborhood: restaurant?.neighborhood })} />
                  {restaurant?.venue_type && <Row icon={User} label="Locale" value={restaurant.venue_type} />}
                </div>
                <p className="mt-3 text-xs text-muted-foreground">{PRECISE_ADDRESS_HINT}</p>

                <div className="mt-6 flex gap-2 sticky bottom-0 bg-background pt-3">
                  <Button variant="outline" size="icon" onClick={()=>toggleFav(selected.id)} aria-label="Preferiti">
                    <Heart className={`h-5 w-5 ${fav?"fill-primary text-primary":""}`} />
                  </Button>
                  {rejected ? (
                    <div className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border-2 border-destructive bg-destructive/10 px-4 py-3 text-sm font-bold text-destructive">
                      <XCircle className="h-4 w-4" />
                      Candidatura rifiutata
                    </div>
                  ) : applied ? (
                    <Button disabled variant="secondary" className="flex-1">Candidatura già inviata</Button>
                  ) : (
                    <Button className="flex-1 gap-2" onClick={()=>apply(selected)}><Send className="h-4 w-4" />Candidati ora</Button>
                  )}
                </div>
              </>
            );
          })()}
        </SheetContent>
      </Sheet>

      <ApplyConfirmDialog
        ann={confirmAnn}
        restaurantInfo={confirmAnn ? restaurantsById[confirmAnn.restaurant_id] : undefined}
        submitting={submitting}
        applyMode={applyMode}
        setApplyMode={setApplyMode}
        counterAmount={counterAmount}
        setCounterAmount={setCounterAmount}
        onCancel={() => { if (!submitting) { setConfirmAnn(null); setApplyMode("accept"); setCounterAmount(""); } }}
        onConfirm={submitApplication}
      />

      <SuccessDialog
        open={!!successApp}
        onClose={() => setSuccessApp(null)}
        onGoToApplications={() => { const id = successApp?.id; setSuccessApp(null); if (id) navigate({ to: "/messages/$id", params: { id } }); }}
      />
    </AppShell>
  );
}

function isNightShift(time?: string | null) {
  if (!time) return false;
  const h = Number(time.slice(0, 2));
  return h >= 20 || h < 6;
}

function ApplyConfirmDialog({
  ann, restaurantInfo, submitting, applyMode, setApplyMode, counterAmount, setCounterAmount, onCancel, onConfirm,
}: {
  ann: Ann | null;
  restaurantInfo?: { city: string | null; neighborhood: string | null };
  submitting: boolean;
  applyMode: "accept" | "counter";
  setApplyMode: (m: "accept" | "counter") => void;
  counterAmount: string;
  setCounterAmount: (v: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const night = ann ? isNightShift(ann.service_time) : false;
  const long = !!(ann && (ann.duration_hours ?? 0) >= 8);
  const startH = ann?.service_time?.slice(0, 5) ?? "—";
  const endLabel = (() => {
    if (!ann?.service_time) return "—";
    const [h, m] = ann.service_time.split(":").map(Number);
    const total = h * 60 + (m || 0) + Math.round((ann.duration_hours || 0) * 60);
    const eh = Math.floor(total / 60) % 24;
    const em = total % 60;
    return `${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}`;
  })();
  const zone = ann ? publicLocationLabel({ job_city: ann.job_city, city: restaurantInfo?.city, neighborhood: restaurantInfo?.neighborhood }) : "";
  const totalDisplay = ann ? formatTotalService(
    ann.tariff_amount,
    ann.tariff_type,
    ann.duration_hours,
    ann.service_time,
    null,
  ) : null;
  const dressCodeItems = (ann?.dress_code_items ?? []).filter(Boolean);
  const requiredSkills = (ann?.required_skills ?? []).filter(Boolean);
  const languageReqs = (ann?.language_requirements ?? []).filter(Boolean);
  const operationalNotes = [ann?.notes, ann?.job_location_notes, ann?.job_additional_directions, ann?.job_access_restrictions]
    .map((s) => (s ?? "").trim()).filter(Boolean);

  return (
    <Dialog open={!!ann} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden border-primary/20 shadow-[0_0_60px_-15px_hsl(var(--primary)/0.4)] animate-scale-in max-h-[90vh] flex flex-col">
        <div className="bg-gradient-to-br from-primary/10 via-card to-card p-6 pb-4">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold tracking-tight">Confermi la candidatura?</DialogTitle>
            <DialogDescription className="text-sm">
              Controlla i dettagli del turno prima di inviare la candidatura.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="overflow-y-auto flex-1">
        {ann && (
          <div className="px-6 pb-2 space-y-3">
            <div className="rounded-xl border bg-muted/30 p-4 space-y-2.5 text-sm">
              <div className="flex items-center gap-2 text-base font-semibold capitalize">
                <User className="h-4 w-4 text-primary" />
                {ann.professional_profile || "Ruolo"}
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-4 w-4" /><span className="truncate">{zone || "—"}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4" /><span>{startH} → {endLabel} · {ann.duration_hours}h</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-4 w-4" /><span>{new Date(ann.service_date).toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</span>
              </div>
              {totalDisplay ? (
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2 text-lg font-extrabold text-primary">
                    {totalDisplay}
                  </div>
                  {ann.tariff_type === "hourly" && (
                    <div className="text-xs text-muted-foreground pl-7">
                      Calcolato su €{ann.tariff_amount}/ora per {ann.duration_hours}h
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 font-medium text-foreground">
                  <Euro className="h-4 w-4 text-primary" />{formatTariff(ann.tariff_amount, ann.tariff_type)}
                </div>
              )}
              <div className="flex items-center gap-2 text-xs text-muted-foreground pl-6">
                Ristorante partner · Locale verificato
              </div>
            </div>
            {(night || long) && (
              <div className="flex flex-wrap gap-2">
                {night && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-indigo-500/15 text-indigo-300 dark:text-indigo-300 text-xs px-2.5 py-1 font-medium">
                    <Moon className="h-3 w-3" />Turno notturno
                  </span>
                )}
                {long && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-300 text-xs px-2.5 py-1 font-medium">
                    <Hourglass className="h-3 w-3" />Turno lungo
                  </span>
                )}
              </div>
            )}

            <div className="rounded-xl border bg-card p-3 text-sm space-y-1">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Dress code</div>
              {dressCodeItems.length > 0 || ann.dress_code_notes ? (
                <>
                  {dressCodeItems.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {dressCodeItems.map((d) => (
                        <span key={d} className="rounded-full bg-muted px-2 py-0.5 text-xs capitalize">{d}</span>
                      ))}
                    </div>
                  )}
                  {ann.dress_code_notes && <div className="text-muted-foreground">{ann.dress_code_notes}</div>}
                </>
              ) : (
                <div className="text-muted-foreground">Non specificato dal ristoratore.</div>
              )}
            </div>

            <div className="rounded-xl border bg-card p-3 text-sm space-y-1">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Quando presentarsi</div>
              <div className="text-muted-foreground">
                Ti consigliamo di presentarti almeno 10 minuti prima dell'orario di ingresso.
              </div>
            </div>

            <div className="rounded-xl border bg-card p-3 text-sm space-y-1">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Mansioni</div>
              <div className="text-muted-foreground capitalize">
                {ann.professional_profile || "Mansioni standard del ruolo."}
              </div>
            </div>

            {(requiredSkills.length > 0 || languageReqs.length > 0 || ann.license_requirement) && (
              <div className="rounded-xl border bg-card p-3 text-sm space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Requisiti</div>
                {requiredSkills.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {requiredSkills.map((s) => (
                      <span key={s} className="rounded-full bg-muted px-2 py-0.5 text-xs capitalize">{s}</span>
                    ))}
                  </div>
                )}
                {languageReqs.length > 0 && (
                  <div className="text-xs text-muted-foreground">
                    Lingue: <span className="text-foreground">{languageReqs.join(", ")}</span>
                  </div>
                )}
                {ann.license_requirement && (
                  <div className="text-xs text-muted-foreground">
                    Patente/mezzo: <span className="text-foreground">{ann.license_requirement}</span>
                  </div>
                )}
              </div>
            )}

            {operationalNotes.length > 0 && (
              <div className="rounded-xl border bg-card p-3 text-sm space-y-1">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Note operative</div>
                {operationalNotes.map((n, i) => (
                  <div key={i} className="text-muted-foreground whitespace-pre-wrap">{n}</div>
                ))}
              </div>
            )}
          </div>
        )}

        {ann && (
          <div className="px-6 pb-2 space-y-2">
            <Label className="text-sm font-medium">Vuoi candidarti alla tariffa proposta o fare una contro offerta?</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setApplyMode("accept")}
                className={`rounded-xl border p-3 text-left transition ${applyMode === "accept" ? "border-primary bg-primary/10 shadow-[0_0_0_1px_hsl(var(--primary))]" : "border-border bg-card hover:bg-muted/40"}`}
              >
                <div className="text-xs text-muted-foreground">Accetta tariffa</div>
                <div className="font-semibold text-sm mt-0.5">€ {ann.tariff_amount} {ann.tariff_type === "hourly" ? "/h" : ""}</div>
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => setApplyMode("counter")}
                className={`rounded-xl border p-3 text-left transition ${applyMode === "counter" ? "border-primary bg-primary/10 shadow-[0_0_0_1px_hsl(var(--primary))]" : "border-border bg-card hover:bg-muted/40"}`}
              >
                <div className="text-xs text-muted-foreground">Fai contro offerta</div>
                <div className="font-semibold text-sm mt-0.5">Proponi tariffa</div>
              </button>
            </div>
            {applyMode === "counter" && (
              <div className="pt-1 animate-fade-in">
                <Label className="text-xs text-muted-foreground">La tua tariffa (EUR/h)</Label>
                <div className="relative mt-1">
                  <Input
                    type="number"
                    inputMode="decimal"
                    min={ann.tariff_amount + 0.01}
                    max={100}
                    step="0.5"
                    placeholder={`min € ${ann.tariff_amount + 1}`}
                    value={counterAmount}
                    onChange={(e) => setCounterAmount(e.target.value.replace(/[^0-9.,]/g, ""))}
                    disabled={submitting}
                    className="pr-14"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">EUR/h</span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Deve essere superiore a € {ann.tariff_amount}. Massimo € 100/h.
                </p>
              </div>
            )}
          </div>
        )}
        </div>

        <DialogFooter className="p-6 pt-4 gap-2 sm:gap-2 flex-col-reverse sm:flex-row">
          <Button variant="outline" onClick={onCancel} disabled={submitting} className="sm:flex-1">
            Annulla
          </Button>
          <Button onClick={onConfirm} disabled={submitting} className="sm:flex-1 gap-2 shadow-lg shadow-primary/30">
            {submitting ? (<><Loader2 className="h-4 w-4 animate-spin" />Invio candidatura…</>) : (<><Send className="h-4 w-4" />Invia candidatura</>)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SuccessDialog({ open, onClose, onGoToApplications }: { open: boolean; onClose: () => void; onGoToApplications: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md text-center p-8 border-primary/20 shadow-[0_0_60px_-15px_hsl(var(--primary)/0.5)] animate-scale-in">
        <div className="mx-auto h-16 w-16 rounded-full bg-primary/15 flex items-center justify-center mb-2 animate-fade-in">
          <CheckCircle2 className="h-9 w-9 text-primary" />
        </div>
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Candidatura inviata</DialogTitle>
          <DialogDescription className="text-base">
            Il ristoratore riceverà subito la tua disponibilità.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-4 flex-col-reverse sm:flex-row gap-2 sm:gap-2">
          <Button variant="outline" onClick={onClose} className="sm:flex-1">Continua a cercare</Button>
          <Button onClick={onGoToApplications} className="sm:flex-1 shadow-lg shadow-primary/30">Vai alle mie candidature</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ icon: Icon, label, value, detail }: { icon: typeof Calendar; label: string; value: string; detail?: string }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="h-4 w-4 mt-0.5 text-muted-foreground" />
      <div className="flex-1">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="capitalize">{value}</div>
        {detail && <div className="text-xs text-muted-foreground/70">{detail}</div>}
      </div>
    </div>
  );
}