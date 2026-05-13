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
import { Calendar, MapPin, Euro, Heart, List, Map as MapIcon, Search, Send, Clock, Zap, User, CheckCircle2, Moon, Hourglass, Loader2 } from "lucide-react";
import { formatTariff } from "@/lib/format";
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
  duration_hours: number; speed: string; tariff_type: string; tariff_amount: number;
  location_address: string; location_lat: number | null; location_lng: number | null;
  professional_profile: string | null; status: string; created_at: string;
  job_city?: string | null; job_province?: string | null;
};

type RestaurantInfo = { id: string; full_name: string | null; business_name: string | null; venue_type: string | null; city: string | null; neighborhood: string | null; rating_avg: number | null } | null;

const ROLES = ["cameriere","bartender","chef","aiuto cucina","runner","lavapiatti","hostess","responsabile sala"];
const SPEEDS = [{v:"normal",l:"Standard"},{v:"urgent",l:"Urgente"},{v:"flash",l:"Flash"}];

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
    const { data: anns } = await supabase.from("announcements").select("*").eq("status","active").order("created_at",{ascending:false}).limit(200);
    const list = (anns as Ann[]) ?? [];
    setItems(list);
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
        supabase.from("applications").select("announcement_id").eq("worker_id",user.id),
        supabase.from("favorites").select("announcement_id").eq("user_id",user.id),
      ]);
      setAppliedIds(new Set((apps??[]).map((a:any)=>a.announcement_id)));
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
      announcement_id: confirmAnn.id, worker_id: user.id, restaurant_id: confirmAnn.restaurant_id,
    };
    if (counterValueNum != null) {
      insertPayload.status = "counter_offer";
      insertPayload.proposed_tariff = counterValueNum;
      insertPayload.worker_response_at = new Date().toISOString();
    }
    const { data: app, error } = await supabase.from("applications").insert(insertPayload).select("id").single();
    if (error) { setSubmitting(false); return toast.error(error.message); }
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
            const fav = favIds.has(a.id);
            return (
              <div key={a.id} className="rounded-2xl border bg-card p-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="rounded-full bg-secondary px-2 py-0.5 capitalize">{a.professional_profile || "ruolo"}</span>
                      <span className="rounded-full bg-accent text-accent-foreground px-2 py-0.5 capitalize">{a.speed}</span>
                    </div>
                    <h3 className="mt-2 font-semibold">{a.duration_hours}h · {formatTariff(a.tariff_amount, a.tariff_type)}</h3>
                  </div>
                  <Button size="icon" variant="ghost" onClick={()=>toggleFav(a.id)} aria-label="Preferiti">
                    <Heart className={`h-5 w-5 ${fav?"fill-primary text-primary":""}`} />
                  </Button>
                </div>
                <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2"><Calendar className="h-4 w-4" />{new Date(a.service_date).toLocaleDateString("it-IT")} · {a.service_time?.slice(0,5)}</div>
                  <div className="flex items-center gap-2"><MapPin className="h-4 w-4" />{publicLocationLabel({ job_city: a.job_city, city: restaurantsById[a.restaurant_id]?.city, neighborhood: restaurantsById[a.restaurant_id]?.neighborhood })}</div>
                  <div className="flex items-center gap-2"><Euro className="h-4 w-4" />{formatTariff(a.tariff_amount, a.tariff_type)}</div>
                </div>
                <div className="mt-4 flex gap-2">
                  {applied ? (
                    <Button size="sm" variant="secondary" disabled className="flex-1">Candidatura inviata</Button>
                  ) : (
                    <Button size="sm" className="flex-1 gap-2" onClick={()=>apply(a)}><Send className="h-4 w-4" />Candidati</Button>
                  )}
                  <Button size="sm" variant="outline" onClick={()=>setOpenId(a.id)}>Dettagli</Button>
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
            const fav = favIds.has(selected.id);
            const dist = (profile?.service_area_lat != null && profile?.service_area_lng != null && selected.location_lat != null && selected.location_lng != null)
              ? distKm(profile.service_area_lat, profile.service_area_lng, selected.location_lat, selected.location_lng) : null;
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
                  <span className="rounded-full bg-primary/10 text-primary px-2 py-1 text-xs">{formatTariff(selected.tariff_amount, selected.tariff_type)}</span>
                  {dist != null && <span className="rounded-full bg-muted px-2 py-1 text-xs">{dist.toFixed(1)} km</span>}
                </div>

                <div className="mt-5 space-y-3 text-sm">
                  <Row icon={Calendar} label="Data" value={new Date(selected.service_date).toLocaleDateString("it-IT", { weekday:"long", day:"numeric", month:"long", year:"numeric" })} />
                  <Row icon={Clock} label="Orario" value={`${selected.service_time?.slice(0,5)} · durata ${selected.duration_hours}h`} />
                  <Row icon={Euro} label="Compenso" value={formatTariff(selected.tariff_amount, selected.tariff_type)} />
                  <Row icon={Zap} label="Tipologia" value={selected.speed} />
                  <Row icon={MapPin} label="Zona" value={publicLocationLabel({ job_city: selected.job_city, city: restaurant?.city, neighborhood: restaurant?.neighborhood })} />
                  {restaurant?.venue_type && <Row icon={User} label="Locale" value={restaurant.venue_type} />}
                </div>
                <p className="mt-3 text-xs text-muted-foreground">{PRECISE_ADDRESS_HINT}</p>

                <div className="mt-6 flex gap-2 sticky bottom-0 bg-background pt-3">
                  <Button variant="outline" size="icon" onClick={()=>toggleFav(selected.id)} aria-label="Preferiti">
                    <Heart className={`h-5 w-5 ${fav?"fill-primary text-primary":""}`} />
                  </Button>
                  {applied ? (
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
  ann, restaurantInfo, submitting, onCancel, onConfirm,
}: {
  ann: Ann | null;
  restaurantInfo?: { city: string | null; neighborhood: string | null };
  submitting: boolean;
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

  return (
    <Dialog open={!!ann} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden border-primary/20 shadow-[0_0_60px_-15px_hsl(var(--primary)/0.4)] animate-scale-in">
        <div className="bg-gradient-to-br from-primary/10 via-card to-card p-6 pb-4">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold tracking-tight">Confermi la candidatura?</DialogTitle>
            <DialogDescription className="text-sm">
              Stai inviando la tua disponibilità per questo turno.
            </DialogDescription>
          </DialogHeader>
        </div>

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
              <div className="flex items-center gap-2 font-medium text-foreground">
                <Euro className="h-4 w-4 text-primary" />{formatTariff(ann.tariff_amount, ann.tariff_type)}
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
          </div>
        )}

        <DialogFooter className="p-6 pt-4 gap-2 sm:gap-2 flex-col-reverse sm:flex-row">
          <Button variant="outline" onClick={onCancel} disabled={submitting} className="sm:flex-1">
            Annulla
          </Button>
          <Button onClick={onConfirm} disabled={submitting} className="sm:flex-1 gap-2 shadow-lg shadow-primary/30">
            {submitting ? (<><Loader2 className="h-4 w-4 animate-spin" />Invio candidatura…</>) : (<><Send className="h-4 w-4" />Conferma candidatura</>)}
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

function Row({ icon: Icon, label, value }: { icon: typeof Calendar; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="h-4 w-4 mt-0.5 text-muted-foreground" />
      <div className="flex-1">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="capitalize">{value}</div>
      </div>
    </div>
  );
}