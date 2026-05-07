import { createFileRoute, Link } from "@tanstack/react-router";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell, PageHeader } from "@/components/AppShell";
import { useAuth } from "@/lib/auth-context";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus, Calendar, MapPin, Euro, Clock, RotateCw } from "lucide-react";
import { AnnouncementMap } from "@/components/AnnouncementMap";

export const Route = createFileRoute("/announcements")({
  head: () => ({ meta: [{ title: "Annunci — Pupillo" }] }),
  component: () => <RequireAuth><AnnouncementsPage /></RequireAuth>,
});

type Ann = { id: string; service_date: string; service_time: string; duration_hours: number; speed: string; tariff_type: string; tariff_amount: number; location_address: string; location_lat: number | null; location_lng: number | null; status: string; expires_at: string };

function expiresLabel(iso: string) {
  const ms = new Date(iso).getTime() - Date.now();
  const days = Math.ceil(ms / (1000 * 60 * 60 * 24));
  if (days < 0) return { text: "Scaduto", tone: "muted" as const };
  if (days === 0) return { text: "Scade oggi", tone: "warn" as const };
  if (days <= 2) return { text: `Scade tra ${days}g`, tone: "warn" as const };
  return { text: `Scade tra ${days}g`, tone: "ok" as const };
}

function AnnouncementsPage() {
  const { user, role } = useAuth();
  const [items, setItems] = useState<Ann[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const base = supabase.from("announcements").select("*").order("created_at", { ascending: false });
      const { data } = role === "restaurant" ? await base.eq("restaurant_id", user.id) : await base.eq("status", "active");
      setItems((data as Ann[]) ?? []);
      setLoading(false);
    })();
  }, [user, role]);

  return (
    <AppShell>
      <PageHeader
        title={role === "restaurant" ? "I miei annunci" : "Annunci disponibili"}
        action={role === "restaurant" && (<Link to="/announcements/new"><Button className="gap-2"><Plus className="h-4 w-4" /> Nuovo annuncio</Button></Link>)}
      />
      {loading ? <p className="text-muted-foreground">Caricamento…</p> : items.length === 0 ? (
        <div className="rounded-2xl border bg-card p-12 text-center">
          <p className="text-muted-foreground">Nessun annuncio.</p>
          {role === "restaurant" && <Link to="/announcements/new"><Button className="mt-4">Crea il primo</Button></Link>}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((a) => (
            <div key={a.id} className="rounded-2xl border bg-card p-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground"><Calendar className="h-4 w-4" />{new Date(a.service_date).toLocaleDateString("it-IT")} · {a.service_time?.slice(0,5)}</div>
                  <h3 className="mt-2 font-semibold">Servizio {a.speed} · {a.duration_hours}h</h3>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={`text-xs rounded-full px-2 py-1 ${a.status === 'active' ? 'bg-green-100 text-green-800' : a.status === 'assigned' ? 'bg-blue-100 text-blue-800' : 'bg-muted text-muted-foreground'}`}>{a.status}</span>
                  {a.status === 'active' && (() => {
                    const e = expiresLabel(a.expires_at);
                    return <span className={`text-[10px] rounded-full px-2 py-0.5 ${e.tone === 'warn' ? 'bg-yellow-100 text-yellow-800' : e.tone === 'ok' ? 'bg-secondary text-secondary-foreground' : 'bg-muted text-muted-foreground'}`}>{e.text}</span>;
                  })()}
                </div>
              </div>
              <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                <div className="flex items-center gap-2"><MapPin className="h-4 w-4" />{a.location_address}</div>
                <div className="flex items-center gap-2"><Euro className="h-4 w-4" />€{a.tariff_amount} ({a.tariff_type === 'hourly' ? "orario" : "a servizio"})</div>
                <div className="flex items-center gap-2"><Clock className="h-4 w-4" />Scade il {new Date(a.expires_at).toLocaleDateString("it-IT")}</div>
              </div>
              {a.location_lat != null && a.location_lng != null && (
                <div className="mt-3"><AnnouncementMap lat={a.location_lat} lng={a.location_lng} address={a.location_address} height={140} /></div>
              )}
              {role === "restaurant" && a.status !== "active" && (
                <Link to="/announcements/new" search={{ reuse: a.id } as never} className="mt-3 inline-flex"><Button variant="outline" size="sm" className="gap-2"><RotateCw className="h-3 w-3" />Riusa come nuovo</Button></Link>
              )}
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}