import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell, PageHeader } from "@/components/AppShell";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CalendarClock, CheckCircle2, XCircle, AlertTriangle, Wifi } from "lucide-react";

export const Route = createFileRoute("/shifts")({
  head: () => ({ meta: [{ title: "I miei turni — Pupillo" }] }),
  component: () => <RequireAuth><ShiftsPage /></RequireAuth>,
});

type Shift = {
  id: string;
  announcement_id: string | null;
  restaurant_id: string;
  worker_id: string;
  shift_date: string;
  hours: number;
  amount: number | null;
  status: "scheduled" | "completed" | "no_show" | "cancelled";
  created_at: string;
};
type Profile = { id: string; full_name: string | null; business_name: string | null; city: string | null };

const statusMeta: Record<Shift["status"], { label: string; color: string; icon: any }> = {
  scheduled: { label: "Programmato", color: "bg-blue-500/10 text-blue-700 border-blue-500/30", icon: CalendarClock },
  completed: { label: "Completato", color: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30", icon: CheckCircle2 },
  no_show: { label: "No-show", color: "bg-red-500/10 text-red-700 border-red-500/30", icon: AlertTriangle },
  cancelled: { label: "Annullato", color: "bg-gray-500/10 text-gray-700 border-gray-500/30", icon: XCircle },
};

function ShiftsPage() {
  const { user, role } = useAuth();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "upcoming" | "past">("all");
  const [live, setLive] = useState(false);

  const load = async () => {
    if (!user || !role) return;
    const col = role === "restaurant" ? "restaurant_id" : "worker_id";
    const { data, error } = await supabase
      .from("shifts")
      .select("*")
      .eq(col, user.id)
      .order("shift_date", { ascending: false });
    if (error) { toast.error("Errore nel caricamento turni"); return; }
    const list = (data ?? []) as Shift[];
    setShifts(list);
    const ids = Array.from(new Set(list.map(s => role === "restaurant" ? s.worker_id : s.restaurant_id)));
    if (ids.length) {
      const { data: ps } = await supabase.from("profiles").select("id,full_name,business_name,city").in("id", ids);
      const map: Record<string, Profile> = {};
      (ps ?? []).forEach((p: any) => { map[p.id] = p; });
      setProfiles(map);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [user?.id, role]);

  // Realtime
  useEffect(() => {
    if (!user || !role) return;
    const col = role === "restaurant" ? "restaurant_id" : "worker_id";
    const channel = supabase
      .channel(`shifts-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "shifts", filter: `${col}=eq.${user.id}` }, (payload) => {
        if (payload.eventType === "INSERT") {
          setShifts(prev => [payload.new as Shift, ...prev]);
          toast.info("Nuovo turno aggiunto");
        } else if (payload.eventType === "UPDATE") {
          setShifts(prev => prev.map(s => s.id === (payload.new as Shift).id ? (payload.new as Shift) : s));
          toast.info(`Turno aggiornato: ${statusMeta[(payload.new as Shift).status].label}`);
        } else if (payload.eventType === "DELETE") {
          setShifts(prev => prev.filter(s => s.id !== (payload.old as Shift).id));
        }
      })
      .subscribe((status) => setLive(status === "SUBSCRIBED"));
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, role]);

  const updateStatus = async (s: Shift, newStatus: Shift["status"]) => {
    const { error } = await supabase.from("shifts").update({ status: newStatus }).eq("id", s.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Stato turno aggiornato");
  };

  const filtered = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    if (filter === "upcoming") return shifts.filter(s => s.shift_date >= today);
    if (filter === "past") return shifts.filter(s => s.shift_date < today);
    return shifts;
  }, [shifts, filter]);

  const stats = useMemo(() => ({
    total: shifts.length,
    completed: shifts.filter(s => s.status === "completed").length,
    scheduled: shifts.filter(s => s.status === "scheduled").length,
  }), [shifts]);

  return (
    <AppShell>
      <PageHeader
        title="I miei turni"
        subtitle={role === "restaurant" ? "Gestisci i turni assegnati ai lavoratori." : "Visualizza i tuoi turni e aggiorna lo stato."}
        action={<div className="flex items-center gap-2 text-xs text-muted-foreground"><Wifi className={`h-3.5 w-3.5 ${live ? "text-emerald-500" : "text-muted-foreground"}`} />{live ? "In tempo reale" : "Connessione..."}</div>}
      />

      <div className="grid gap-3 grid-cols-3 mb-6">
        <Stat label="Totali" value={stats.total} />
        <Stat label="Programmati" value={stats.scheduled} />
        <Stat label="Completati" value={stats.completed} />
      </div>

      <div className="flex gap-2 mb-4 overflow-x-auto">
        {(["all", "upcoming", "past"] as const).map(f => (
          <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)}>
            {f === "all" ? "Tutti" : f === "upcoming" ? "In arrivo" : "Passati"}
          </Button>
        ))}
      </div>

      {loading ? <p className="text-muted-foreground">Caricamento…</p> : filtered.length === 0 ? (
        <div className="rounded-2xl border bg-card p-8 text-center">
          <CalendarClock className="mx-auto h-10 w-10 text-muted-foreground mb-2" />
          <p className="text-muted-foreground">Nessun turno da mostrare.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(s => {
            const meta = statusMeta[s.status];
            const Icon = meta.icon;
            const otherId = role === "restaurant" ? s.worker_id : s.restaurant_id;
            const other = profiles[otherId];
            const otherName = role === "restaurant"
              ? (other?.full_name || "Lavoratore")
              : (other?.business_name || other?.full_name || "Locale");
            const dateObj = new Date(s.shift_date);
            const isPast = s.shift_date < new Date().toISOString().slice(0, 10);
            const canRestaurantAct = role === "restaurant" && s.status === "scheduled";
            const canWorkerComplete = role === "worker" && s.status === "scheduled" && isPast;

            return (
              <div key={s.id} className="rounded-2xl border bg-card p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{otherName}</div>
                    <div className="text-sm text-muted-foreground mt-0.5">
                      {dateObj.toLocaleDateString("it-IT", { weekday: "short", day: "2-digit", month: "short", year: "numeric" })}
                      {" · "}{s.hours}h
                      {s.amount != null && <> · €{Number(s.amount).toFixed(2)}</>}
                      {other?.city && <> · {other.city}</>}
                    </div>
                  </div>
                  <Badge variant="outline" className={`gap-1 ${meta.color}`}>
                    <Icon className="h-3 w-3" />{meta.label}
                  </Badge>
                </div>

                {(canRestaurantAct || canWorkerComplete) && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {canWorkerComplete && (
                      <Button size="sm" onClick={() => updateStatus(s, "completed")} className="gap-1">
                        <CheckCircle2 className="h-4 w-4" /> Segna come completato
                      </Button>
                    )}
                    {canRestaurantAct && (
                      <>
                        <Button size="sm" onClick={() => updateStatus(s, "completed")} className="gap-1">
                          <CheckCircle2 className="h-4 w-4" /> Completato
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => updateStatus(s, "no_show")} className="gap-1">
                          <AlertTriangle className="h-4 w-4" /> No-show
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => updateStatus(s, "cancelled")} className="gap-1">
                          <XCircle className="h-4 w-4" /> Annulla
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}
