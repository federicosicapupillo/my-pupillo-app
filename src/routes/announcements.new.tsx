import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell, PageHeader } from "@/components/AppShell";
import { useAuth } from "@/lib/auth-context";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { AnnouncementMap } from "@/components/AnnouncementMap";
import { geocodeAddressWithRetry, describeGeocodeError, type GeocodeError } from "@/lib/geocode";
import { useEffect, useRef } from "react";
import { AlertCircle, CheckCircle2, Loader2, RefreshCw, Search } from "lucide-react";
import { consumeCredits } from "@/lib/credits";
import { CREDIT_COSTS } from "@/lib/pricing";

export const Route = createFileRoute("/announcements/new")({
  head: () => ({ meta: [{ title: "Nuovo annuncio — Pupillo" }] }),
  validateSearch: (s: Record<string, unknown>) => ({ reuse: typeof s.reuse === "string" ? s.reuse : undefined }),
  component: () => <RequireAuth><NewAnn /></RequireAuth>,
});

function NewAnn() {
  const { user, role, profile } = useAuth();
  const nav = useNavigate();
  const { reuse } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geoState, setGeoState] = useState<{ status: "idle" | "loading" | "ok" | "error"; attempt: number; error?: GeocodeError }>({ status: "idle", attempt: 0 });
  const [f, setF] = useState({
    service_date: "", service_time: "19:00", duration_hours: "4",
    speed: "normal", tariff_type: "hourly", tariff_amount: "12",
    location_address: profile?.address ?? "", professional_profile: "",
    languages: "", notes: "",
  });

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!reuse) return;
    (async () => {
      const { data } = await supabase.from("announcements").select("*").eq("id", reuse).maybeSingle();
      if (!data) return;
      setF((prev) => ({
        ...prev,
        service_time: data.service_time?.slice(0, 5) ?? prev.service_time,
        duration_hours: String(data.duration_hours ?? prev.duration_hours),
        speed: data.speed ?? prev.speed,
        tariff_type: data.tariff_type ?? prev.tariff_type,
        tariff_amount: String(data.tariff_amount ?? prev.tariff_amount),
        location_address: data.location_address ?? prev.location_address,
        professional_profile: data.professional_profile ?? "",
        languages: (data.languages ?? []).join(", "),
        notes: (data as any).notes ?? "",
      }));
      if (data.location_lat != null && data.location_lng != null) {
        setCoords({ lat: data.location_lat, lng: data.location_lng });
        setGeoState({ status: "ok", attempt: 0 });
      }
    })();
  }, [reuse]);

  const runGeocode = async (addr: string) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setGeoState({ status: "loading", attempt: 1 });
    const r = await geocodeAddressWithRetry(addr, {
      maxAttempts: 3,
      signal: ctrl.signal,
      onAttempt: (n) => setGeoState((s) => ({ ...s, status: "loading", attempt: n })),
    });
    if (ctrl.signal.aborted) return;
    if (r.ok) {
      setCoords({ lat: r.lat, lng: r.lng });
      setGeoState({ status: "ok", attempt: 0 });
    } else if (r.error.kind !== "aborted") {
      setCoords(null);
      setGeoState({ status: "error", attempt: 0, error: r.error });
    }
  };

  useEffect(() => {
    const addr = f.location_address.trim();
    if (addr.length < 5) {
      abortRef.current?.abort();
      setCoords(null);
      setGeoState({ status: "idle", attempt: 0 });
      return;
    }
    const t = setTimeout(() => { runGeocode(addr); }, 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.location_address]);

  if (role !== "restaurant") {
    return <AppShell><p className="text-muted-foreground">Solo i ristoratori possono creare annunci.</p></AppShell>;
  }

  const save = async (asDraft: boolean) => {
    if (!user) return;
    if (!asDraft && !coords) {
      toast.error("Posizione non valida: verifica l'indirizzo prima di pubblicare.");
      return;
    }
    if (!f.service_date) { toast.error("Inserisci la data del servizio"); return; }
    setBusy(true);
    // Consume credits only when publishing (not draft). Urgent (flash/fast) costs more.
    if (!asDraft) {
      const isUrgent = f.speed === "flash" || f.speed === "fast";
      const cost = isUrgent ? CREDIT_COSTS.publishUrgentAnnouncement : CREDIT_COSTS.publishAnnouncement;
      const ok = await consumeCredits(cost, isUrgent ? "publish_urgent_announcement" : "publish_announcement");
      if (!ok) { setBusy(false); return; }
    }
    const { error } = await supabase.from("announcements").insert({
      restaurant_id: user.id,
      service_date: f.service_date,
      service_time: f.service_time,
      duration_hours: parseFloat(f.duration_hours),
      speed: f.speed as "normal" | "fast" | "flash",
      tariff_type: f.tariff_type as "hourly" | "flat",
      tariff_amount: parseFloat(f.tariff_amount),
      location_address: f.location_address,
      location_lat: coords?.lat ?? null,
      location_lng: coords?.lng ?? null,
      professional_profile: f.professional_profile || null,
      languages: f.languages.split(",").map(s => s.trim()).filter(Boolean),
      notes: f.notes || null,
      status: asDraft ? "draft" : "active",
    } as any);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(asDraft ? "Bozza salvata" : "Annuncio pubblicato!");
    nav({ to: "/announcements" });
  };
  const submit = (e: React.FormEvent) => { e.preventDefault(); save(false); };

  return (
    <AppShell>
      <PageHeader title="Nuovo annuncio" subtitle="Pubblica una richiesta di personale extra" />
      <form onSubmit={submit} className="max-w-2xl space-y-5 rounded-2xl border bg-card p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div><Label>Data servizio</Label><Input type="date" required value={f.service_date} onChange={e => setF({ ...f, service_date: e.target.value })} /></div>
          <div><Label>Ora inizio</Label><Input type="time" required value={f.service_time} onChange={e => setF({ ...f, service_time: e.target.value })} /></div>
          <div><Label>Durata (ore)</Label><Input type="number" min="1" step="0.5" required value={f.duration_hours} onChange={e => setF({ ...f, duration_hours: e.target.value })} /></div>
          <div>
            <Label>Velocità ricerca</Label>
            <Select value={f.speed} onValueChange={v => setF({ ...f, speed: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">Normale (7 giorni)</SelectItem>
                <SelectItem value="fast">Veloce (24 ore)</SelectItem>
                <SelectItem value="flash">Flash (immediato)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Tipo tariffa</Label>
            <Select value={f.tariff_type} onValueChange={v => setF({ ...f, tariff_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="hourly">Oraria</SelectItem>
                <SelectItem value="flat">A servizio</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Importo (€)</Label><Input type="number" min="1" step="0.5" required value={f.tariff_amount} onChange={e => setF({ ...f, tariff_amount: e.target.value })} /></div>
        </div>
        <div>
          <Label>Indirizzo del servizio</Label>
          <Input required value={f.location_address} onChange={e => setF({ ...f, location_address: e.target.value })} />
          <GeoBadge
            state={geoState}
            hasAddress={f.location_address.trim().length >= 3}
            onRetry={() => runGeocode(f.location_address.trim())}
          />
          {coords && (
            <div className="mt-2"><AnnouncementMap lat={coords.lat} lng={coords.lng} address={f.location_address} /></div>
          )}
        </div>
        <div>
          <Label>Ruolo richiesto</Label>
          <Select value={f.professional_profile} onValueChange={v => setF({ ...f, professional_profile: v })}>
            <SelectTrigger><SelectValue placeholder="Seleziona un ruolo" /></SelectTrigger>
            <SelectContent>
              {["cameriere","bartender","chef","aiuto cucina","runner","lavapiatti","hostess","responsabile sala"].map(r => (
                <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div><Label>Lingue richieste</Label><Input placeholder="Italiano, Inglese" value={f.languages} onChange={e => setF({ ...f, languages: e.target.value })} /></div>
        <div>
          <Label>Note operative (opzionali)</Label>
          <Textarea rows={3} placeholder="Es. dress code nero, citofono lato cucina, chiedere di Marco…" value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} />
        </div>
        {!coords && f.location_address.trim().length >= 3 && geoState.status !== "loading" && (
          <p className="text-xs text-destructive flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5" />
            Devi confermare una posizione valida sulla mappa per pubblicare.
          </p>
        )}
        <div className="flex flex-col sm:flex-row gap-2">
          <Button type="button" variant="outline" disabled={busy} onClick={()=>save(true)} className="sm:w-auto w-full">
            Salva come bozza
          </Button>
          <Button type="submit" disabled={busy || !coords} className="flex-1">
            {busy ? "Pubblicazione…" : geoState.status === "loading" ? "Ricerca posizione…" : !coords ? "Posizione richiesta" : "Pubblica annuncio"}
          </Button>
        </div>
      </form>
    </AppShell>
  );
}

function GeoBadge({
  state, hasAddress, onRetry,
}: {
  state: { status: "idle" | "loading" | "ok" | "error"; attempt: number; error?: GeocodeError };
  hasAddress: boolean;
  onRetry: () => void;
}) {
  // Idle: nothing to lookup yet
  if (state.status === "idle" || (state.status !== "loading" && !hasAddress)) {
    return (
      <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border bg-muted px-2.5 py-1 text-xs text-muted-foreground">
        <Search className="h-3 w-3" />
        In attesa dell'indirizzo
      </div>
    );
  }

  if (state.status === "loading") {
    return (
      <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs text-primary">
        <Loader2 className="h-3 w-3 animate-spin" />
        Ricerca in corso{state.attempt > 1 ? ` · tentativo ${state.attempt}/3` : ""}
      </div>
    );
  }

  if (state.status === "ok") {
    return (
      <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-700 dark:text-emerald-400">
        <CheckCircle2 className="h-3 w-3" />
        Posizione trovata
      </div>
    );
  }

  return (
    <div className="mt-2 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
      <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
      <div className="flex-1">
        <div className="font-medium">Posizione non trovata</div>
        <div className="opacity-90">{state.error ? describeGeocodeError(state.error) : "Errore sconosciuto"}</div>
      </div>
      <Button type="button" size="sm" variant="ghost" className="h-6 px-2 gap-1 text-destructive hover:text-destructive" onClick={onRetry}>
        <RefreshCw className="h-3 w-3" />Riprova
      </Button>
    </div>
  );
}