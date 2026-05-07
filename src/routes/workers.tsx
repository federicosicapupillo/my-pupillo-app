import { createFileRoute } from "@tanstack/react-router";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell, PageHeader } from "@/components/AppShell";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Search, List, Map as MapIcon } from "lucide-react";
import { AnnouncementMap } from "@/components/AnnouncementMap";

export const Route = createFileRoute("/workers")({
  head: () => ({ meta: [{ title: "Cerca lavoratori — Pupillo" }] }),
  component: () => <RequireAuth><WorkersPage /></RequireAuth>,
});

type W = { id: string; full_name: string | null; age: number | null; languages: string[] | null; professional_profile: string | null; service_area_lat: number | null; service_area_lng: number | null; service_area_radius_m: number | null };
type Ann = { id: string; service_date: string; location_address: string; location_lat: number | null; location_lng: number | null };

function distanceM(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function WorkersPage() {
  const { user, role } = useAuth();
  const [workers, setWorkers] = useState<W[]>([]);
  const [anns, setAnns] = useState<Ann[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [q, setQ] = useState("");
  const [lang, setLang] = useState("");
  const [view, setView] = useState<"list" | "map">("list");

  useEffect(() => {
    (async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "worker");
      const ids = (roles ?? []).map((r) => r.user_id);
      if (ids.length) {
        const { data } = await supabase.from("profiles").select("id, full_name, age, languages, professional_profile, service_area_lat, service_area_lng, service_area_radius_m").in("id", ids);
        setWorkers((data as W[]) ?? []);
      }
      if (user) {
        const { data } = await supabase.from("announcements").select("id, service_date, location_address, location_lat, location_lng").eq("restaurant_id", user.id).eq("status", "active");
        setAnns((data as Ann[]) ?? []);
        if (data?.[0]) setSelected(data[0].id);
      }
    })();
  }, [user]);

  if (role !== "restaurant") return <AppShell><p>Solo i ristoratori.</p></AppShell>;

  const invite = async (workerId: string) => {
    if (!selected || !user) { toast.error("Seleziona prima un annuncio"); return; }
    const { error } = await supabase.from("applications").insert({
      announcement_id: selected,
      worker_id: workerId,
      restaurant_id: user.id,
      status: "pending",
    });
    if (error) toast.error(error.message);
    else {
      await supabase.from("notifications").insert({ user_id: workerId, title: "Nuova offerta di lavoro", body: "Un ristoratore ti ha contattato.", link: "/jobs" });
      toast.success("Lavoratore contattato!");
    }
  };

  const filtered = workers.filter(w => {
    const text = `${w.full_name ?? ""} ${w.professional_profile ?? ""}`.toLowerCase();
    if (q && !text.includes(q.toLowerCase())) return false;
    if (lang && !(w.languages ?? []).some(l => l.toLowerCase().includes(lang.toLowerCase()))) return false;
    return true;
  });

  const selectedAnn = anns.find((a) => a.id === selected);
  const inRange = (w: W) => {
    if (!selectedAnn?.location_lat || !selectedAnn?.location_lng) return false;
    if (w.service_area_lat == null || w.service_area_lng == null) return false;
    const d = distanceM(selectedAnn.location_lat, selectedAnn.location_lng, w.service_area_lat, w.service_area_lng);
    return d <= (w.service_area_radius_m ?? 500);
  };
  const sorted = [...filtered].sort((a, b) => Number(inRange(b)) - Number(inRange(a)));

  return (
    <AppShell>
      <PageHeader title="Cerca lavoratori" subtitle="Trova personale extra disponibile" />
      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <div>
          <label className="text-sm font-medium">Annuncio per cui contattare</label>
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger className="mt-1"><SelectValue placeholder="Nessun annuncio attivo" /></SelectTrigger>
            <SelectContent>
              {anns.map((a) => <SelectItem key={a.id} value={a.id}>{new Date(a.service_date).toLocaleDateString("it-IT")} · {a.location_address}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-sm font-medium">Cerca per nome/profilo</label>
          <div className="relative mt-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" placeholder="es. cameriere" value={q} onChange={e => setQ(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="text-sm font-medium">Lingua</label>
          <Input className="mt-1" placeholder="es. Inglese" value={lang} onChange={e => setLang(e.target.value)} />
        </div>
      </div>
      <div className="mb-4 flex justify-end">
        <div className="inline-flex rounded-lg border p-0.5">
          <Button size="sm" variant={view==="list"?"secondary":"ghost"} onClick={()=>setView("list")} className="gap-1"><List className="h-4 w-4" />Lista</Button>
          <Button size="sm" variant={view==="map"?"secondary":"ghost"} onClick={()=>setView("map")} className="gap-1"><MapIcon className="h-4 w-4" />Mappa</Button>
        </div>
      </div>
      {anns.length > 0 && (
        <div className="mb-4">
          <div className="text-xs text-muted-foreground mb-2">Clicca un annuncio per selezionarlo</div>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {anns.map(a => (
              <button
                key={a.id}
                onClick={() => { setSelected(a.id); setView("map"); }}
                className={`shrink-0 rounded-xl border px-3 py-2 text-left text-sm transition ${selected===a.id ? "border-primary bg-primary/5 ring-1 ring-primary" : "bg-card hover:bg-accent"}`}
              >
                <div className="font-medium">{new Date(a.service_date).toLocaleDateString("it-IT")}</div>
                <div className="text-xs text-muted-foreground line-clamp-1 max-w-[220px]">{a.location_address}</div>
              </button>
            ))}
          </div>
        </div>
      )}
      {view === "map" ? (
        <div className="rounded-2xl border bg-card p-2">
          {selectedAnn?.location_lat != null && selectedAnn?.location_lng != null ? (
            <>
              <AnnouncementMap
                lat={selectedAnn.location_lat}
                lng={selectedAnn.location_lng}
                address={selectedAnn.location_address}
                height={420}
                selectedId={selectedAnn.id}
                onSelect={(id) => setSelected(id)}
                markers={anns
                  .filter((a) => a.location_lat != null && a.location_lng != null)
                  .map((a) => ({ id: a.id, lat: a.location_lat as number, lng: a.location_lng as number, address: a.location_address }))}
              />
              <div className="p-3 text-xs text-muted-foreground">Posizione dell'annuncio selezionato. I lavoratori "in zona" sono evidenziati nella vista lista.</div>
            </>
          ) : (
            <div className="p-12 text-center text-muted-foreground">Seleziona un annuncio con coordinate per vederne la posizione sulla mappa.</div>
          )}
        </div>
      ) : (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {sorted.map((w) => {
          const near = inRange(w);
          return (
          <div key={w.id} className={`rounded-2xl border p-5 ${near ? "border-emerald-500/50 bg-emerald-500/5" : "bg-card"}`}>
            <div className="flex items-center gap-3">
              <div className={`h-12 w-12 rounded-full flex items-center justify-center font-semibold ${near ? "bg-emerald-500/20 text-emerald-700" : "bg-primary/10 text-primary"}`}>{w.full_name?.[0] ?? "?"}</div>
              <div>
                <div className="font-semibold">{w.full_name || "Lavoratore"}</div>
                {w.age && <div className="text-xs text-muted-foreground">{w.age} anni</div>}
              </div>
              {near && <span className="ml-auto text-[10px] rounded-full bg-emerald-500/20 text-emerald-700 px-2 py-0.5 font-medium">In zona</span>}
            </div>
            <p className="mt-3 text-sm text-muted-foreground line-clamp-2">{w.professional_profile || "Profilo non specificato"}</p>
            {w.languages && w.languages.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {w.languages.map((l) => <span key={l} className="text-xs bg-secondary px-2 py-0.5 rounded-full">{l}</span>)}
              </div>
            )}
            <Button size="sm" className="mt-4 w-full" onClick={() => invite(w.id)} disabled={!selected}>Contatta</Button>
          </div>
          );
        })}
        {sorted.length === 0 && <p className="text-muted-foreground">Nessun lavoratore corrisponde ai filtri.</p>}
      </div>
      )}
    </AppShell>
  );
}