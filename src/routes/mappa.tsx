import { createFileRoute } from "@tanstack/react-router";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell, PageHeader } from "@/components/AppShell";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import type { MapPoint } from "@/components/MapViewInner";

const MapViewInner = lazy(() => import("@/components/MapViewInner"));

export const Route = createFileRoute("/mappa")({
  head: () => ({ meta: [{ title: "Mappa — Pupillo" }] }),
  component: () => <RequireAuth><MapPage /></RequireAuth>,
});

function MapPage() {
  const [points, setPoints] = useState<MapPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [showR, setShowR] = useState(true);
  const [showW, setShowW] = useState(true);
  const [showA, setShowA] = useState(true);
  const [city, setCity] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data: profs }, { data: anns }] = await Promise.all([
        supabase.from("profiles")
          .select("id, full_name, business_name, venue_type, city, primary_role, service_area_lat, service_area_lng, account_status")
          .eq("account_status", "active")
          .limit(500),
        supabase.from("announcements")
          .select("id, location_address, location_lat, location_lng, professional_profile, status, service_date")
          .eq("status", "active")
          .limit(500),
      ]);

      const pts: MapPoint[] = [];
      (profs || []).forEach((p: any) => {
        if (p.service_area_lat == null || p.service_area_lng == null) return;
        const isRest = p.primary_role === "restaurant" || !!p.business_name;
        pts.push({
          id: p.id,
          lat: p.service_area_lat,
          lng: p.service_area_lng,
          category: isRest ? "restaurant" : "worker",
          title: isRest ? (p.business_name || p.full_name || "Locale") : (p.full_name || "Lavoratore"),
          subtitle: isRest ? (p.venue_type || "Ristorante") : (p.primary_role || "Lavoratore"),
          city: p.city,
          link: isRest ? undefined : "/workers",
        });
      });
      (anns || []).forEach((a: any) => {
        if (a.location_lat == null || a.location_lng == null) return;
        pts.push({
          id: a.id,
          lat: a.location_lat,
          lng: a.location_lng,
          category: "announcement",
          title: a.professional_profile || "Annuncio",
          subtitle: a.location_address,
          status: a.status,
          link: "/browse",
        });
      });
      setPoints(pts);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    return points.filter(p => {
      if (p.category === "restaurant" && !showR) return false;
      if (p.category === "worker" && !showW) return false;
      if (p.category === "announcement" && !showA) return false;
      if (city && !(p.city || "").toLowerCase().includes(city.toLowerCase()) && !(p.subtitle || "").toLowerCase().includes(city.toLowerCase())) return false;
      return true;
    });
  }, [points, showR, showW, showA, city]);

  const center: [number, number] = filtered[0] ? [filtered[0].lat, filtered[0].lng] : [42.5, 12.5]; // Italia

  return (
    <AppShell>
      <PageHeader title="Mappa" subtitle="Ristoratori, lavoratori e richieste attive" />

      <div className="rounded-2xl border bg-card p-4 mb-4 grid gap-3 md:grid-cols-2">
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={showR} onCheckedChange={v => setShowR(!!v)} />
            <span className="inline-flex items-center gap-1"><Dot color="#4f46e5" /> Ristoratori</span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={showW} onCheckedChange={v => setShowW(!!v)} />
            <span className="inline-flex items-center gap-1"><Dot color="#22c55e" /> Lavoratori</span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={showA} onCheckedChange={v => setShowA(!!v)} />
            <span className="inline-flex items-center gap-1"><Dot color="#06b6d4" /> Richieste</span>
          </label>
        </div>
        <Input placeholder="Filtra per città o indirizzo" value={city} onChange={e => setCity(e.target.value)} />
      </div>

      {loading ? (
        <div className="rounded-2xl border bg-card p-12 text-center text-muted-foreground">Caricamento mappa…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border bg-card p-12 text-center text-muted-foreground">
          Nessun dato disponibile sulla mappa. Aggiungi coordinate ai profili o pubblica annunci con un indirizzo geocodificato.
        </div>
      ) : (
        <Suspense fallback={<div className="rounded-xl bg-muted animate-pulse" style={{ height: "70vh" }} />}>
          <div style={{ height: "min(75vh, 700px)", minHeight: 500 }}>
            <MapViewInner points={filtered} height={Math.max(500, Math.min(window.innerHeight * 0.75, 700))} center={center} />
          </div>
        </Suspense>
      )}

      <div className="mt-3 text-xs text-muted-foreground">
        {filtered.length} elementi visualizzati · OpenStreetMap
      </div>
    </AppShell>
  );
}

function Dot({ color }: { color: string }) {
  return <span style={{ background: color, width: 10, height: 10, borderRadius: 9999, display: "inline-block" }} />;
}