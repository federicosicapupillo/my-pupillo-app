import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell, PageHeader } from "@/components/AppShell";
import { useAuth } from "@/lib/auth-context";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { AnnouncementMap } from "@/components/AnnouncementMap";
import { geocodeAddress } from "@/lib/geocode";
import { useEffect } from "react";

export const Route = createFileRoute("/announcements/new")({
  head: () => ({ meta: [{ title: "Nuovo annuncio — Pupillo" }] }),
  component: () => <RequireAuth><NewAnn /></RequireAuth>,
});

function NewAnn() {
  const { user, role, profile } = useAuth();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [f, setF] = useState({
    service_date: "", service_time: "19:00", duration_hours: "4",
    speed: "normal", tariff_type: "hourly", tariff_amount: "12",
    location_address: profile?.address ?? "", professional_profile: "",
    languages: "",
  });

  useEffect(() => {
    const addr = f.location_address.trim();
    if (addr.length < 5) { setCoords(null); return; }
    setGeocoding(true);
    const t = setTimeout(async () => {
      const r = await geocodeAddress(addr);
      setCoords(r);
      setGeocoding(false);
    }, 700);
    return () => clearTimeout(t);
  }, [f.location_address]);

  if (role !== "restaurant") {
    return <AppShell><p className="text-muted-foreground">Solo i ristoratori possono creare annunci.</p></AppShell>;
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
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
      status: "active",
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Annuncio pubblicato!");
    nav({ to: "/announcements" });
  };

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
          <div className="mt-2 text-xs text-muted-foreground">
            {geocoding ? "Ricerca posizione…" : coords ? "Posizione trovata sulla mappa" : f.location_address ? "Posizione non trovata" : ""}
          </div>
          {coords && (
            <div className="mt-2"><AnnouncementMap lat={coords.lat} lng={coords.lng} address={f.location_address} /></div>
          )}
        </div>
        <div><Label>Profilo richiesto</Label><Input placeholder="Cameriere, runner, lavapiatti…" value={f.professional_profile} onChange={e => setF({ ...f, professional_profile: e.target.value })} /></div>
        <div><Label>Lingue richieste</Label><Input placeholder="Italiano, Inglese" value={f.languages} onChange={e => setF({ ...f, languages: e.target.value })} /></div>
        <Button type="submit" disabled={busy} className="w-full">{busy ? "Pubblicazione…" : "Pubblica annuncio"}</Button>
      </form>
    </AppShell>
  );
}