import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell, PageHeader } from "@/components/AppShell";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CalendarClock, CheckCircle2, XCircle, AlertTriangle, Wifi, Star, MessageSquare, Clock, Eye } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RequiredReviewsBanner } from "@/components/RequiredReviewsBanner";
import { useRequiredReviews } from "@/lib/required-reviews";

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

type PendingApp = {
  id: string;
  announcement_id: string;
  worker_id: string;
  restaurant_id: string;
  status: "pending" | "interested" | "counter_offer";
  proposed_tariff: number | null;
  created_at: string;
  service_date: string | null;
  service_time: string | null;
};

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
  const [filter, setFilter] = useState<"all" | "upcoming" | "past" | "to-review">(
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("tab") === "to-review" ? "to-review" : "all"
  );
  const [live, setLive] = useState(false);
  const [reviewMap, setReviewMap] = useState<Record<string, number>>({});
  const [pendingApps, setPendingApps] = useState<PendingApp[]>([]);
  const [reviewOpen, setReviewOpen] = useState<string | null>(null);
  const [viewReviewShiftId, setViewReviewShiftId] = useState<string | null>(null);
  const [viewReviewData, setViewReviewData] = useState<{ rating: number; comment: string | null } | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const { items: requiredReviews } = useRequiredReviews();
  const reqByShift = useMemo(() => {
    const m: Record<string, { status: string; due_date: string }> = {};
    requiredReviews.forEach((r) => { if (r.shift_id) m[r.shift_id] = { status: r.status, due_date: r.due_date }; });
    return m;
  }, [requiredReviews]);

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
    // For restaurants, also load pending/in-flight applications (candidature in attesa)
    let pending: PendingApp[] = [];
    if (role === "restaurant") {
      const { data: apps } = await (supabase as any)
        .from("applications")
        .select("id, announcement_id, worker_id, restaurant_id, status, proposed_tariff, created_at, announcements!inner(service_date, service_time)")
        .eq("restaurant_id", user.id)
        .in("status", ["pending", "interested", "counter_offer"])
        .order("created_at", { ascending: false });
      pending = (apps ?? []).map((a: any) => ({
        id: a.id,
        announcement_id: a.announcement_id,
        worker_id: a.worker_id,
        restaurant_id: a.restaurant_id,
        status: a.status,
        proposed_tariff: a.proposed_tariff,
        created_at: a.created_at,
        service_date: a.announcements?.service_date ?? null,
        service_time: a.announcements?.service_time ?? null,
      })) as PendingApp[];
      setPendingApps(pending);
    }
    const otherIds = list.map(s => role === "restaurant" ? s.worker_id : s.restaurant_id);
    const pendingWorkerIds = pending.map(p => p.worker_id);
    const ids = Array.from(new Set([...otherIds, ...pendingWorkerIds]));
    if (ids.length) {
      const { data: ps } = await supabase.from("profiles").select("id,full_name,business_name,city").in("id", ids);
      const map: Record<string, Profile> = {};
      (ps ?? []).forEach((p: any) => { map[p.id] = p; });
      setProfiles(map);
    }
    const shiftIds = list.map(s => s.id);
    if (shiftIds.length && user) {
      const { data: rs } = await supabase.from("reviews").select("shift_id").eq("author_id", user.id).in("shift_id", shiftIds);
      setReviewed(new Set((rs ?? []).map((r: any) => r.shift_id)));
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

  const submitReview = async (s: Shift) => {
    if (!user) return;
    const targetId = role === "restaurant" ? s.worker_id : s.restaurant_id;
    const { error } = await supabase.from("reviews").insert({
      author_id: user.id, target_id: targetId, shift_id: s.id, rating, comment: comment.trim() || null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Recensione inviata");
    setReviewed(prev => new Set(prev).add(s.id));
    setReviewOpen(null);
    setRating(5);
    setComment("");
  };

  const openViewReview = async (shiftId: string) => {
    if (!user) return;
    const { data } = await supabase
      .from("reviews")
      .select("rating, comment")
      .eq("author_id", user.id)
      .eq("shift_id", shiftId)
      .maybeSingle();
    if (data) {
      setViewReviewData(data as any);
      setViewReviewShiftId(shiftId);
    } else {
      toast.error("Recensione non trovata");
    }
  };

  const closeViewReview = () => {
    setViewReviewShiftId(null);
    setViewReviewData(null);
  };

  const filtered = useMemo(() => {
    if (filter === "upcoming") return [] as Shift[]; // pending applications rendered separately
    if (filter === "past") return shifts.filter(s => s.status === "completed");
    if (filter === "to-review") return shifts.filter(s => s.status === "completed" && reqByShift[s.id] && reqByShift[s.id].status !== "completed");
    return shifts;
  }, [shifts, filter, reqByShift]);

  const counts = useMemo(() => {
    const past = shifts.filter(s => s.status === "completed").length;
    const toReview = shifts.filter(s => s.status === "completed" && reqByShift[s.id] && reqByShift[s.id].status !== "completed").length;
    const pending = role === "restaurant" ? pendingApps.length : 0;
    const all = shifts.length + pending;
    return { all, pending, past, toReview };
  }, [shifts, pendingApps, reqByShift, role]);

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
        {(["all", "upcoming", "past", "to-review"] as const).map(f => {
          const label =
            f === "all" ? `Tutti (${counts.all})`
            : f === "upcoming" ? `In attesa conferma (${counts.pending})`
            : f === "past" ? `Passati (${counts.past})`
            : `Da recensire (${counts.toReview})`;
          return (
            <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)}>
              {label}
            </Button>
          );
        })}
      </div>

      {role === "restaurant" && <RequiredReviewsBanner />}

      {loading ? <p className="text-muted-foreground">Caricamento…</p> : (
        <>
          {role === "restaurant" && (filter === "all" || filter === "upcoming") && pendingApps.length > 0 && (
            <div className="space-y-3 mb-3">
              {pendingApps.map(a => {
                const w = profiles[a.worker_id];
                const wName = w?.full_name || "Lavoratore";
                const statusLabel =
                  a.status === "counter_offer" ? "Contro offerta" :
                  a.status === "interested" ? "Interessato" : "In attesa";
                return (
                  <div key={a.id} className="rounded-2xl border bg-card p-4 sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{wName}</div>
                        <div className="text-sm text-muted-foreground mt-0.5">
                          {a.service_date ? new Date(a.service_date).toLocaleDateString("it-IT", { weekday: "short", day: "2-digit", month: "short" }) : "—"}
                          {a.service_time && <> · {a.service_time.slice(0,5)}</>}
                          {a.proposed_tariff != null && <> · €{Number(a.proposed_tariff).toFixed(2)}</>}
                        </div>
                      </div>
                      <Badge variant="outline" className="gap-1 bg-amber-500/10 text-amber-700 border-amber-500/30">
                        <Clock className="h-3 w-3" />{statusLabel}
                      </Badge>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button asChild size="sm" className="gap-1">
                        <Link to="/messages/$id" params={{ id: a.id }}><MessageSquare className="h-4 w-4" /> Vedi candidatura</Link>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {filtered.length === 0 && !(role === "restaurant" && (filter === "all" || filter === "upcoming") && pendingApps.length > 0) ? (
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

                {s.status === "completed" && (
                  <div className="mt-4 border-t pt-3">
                    {role === "restaurant" && reqByShift[s.id] && reqByShift[s.id].status !== "completed" && (() => {
                      const due = new Date(reqByShift[s.id].due_date).getTime();
                      const now = Date.now();
                      const overdue = reqByShift[s.id].status === "overdue" || due < now;
                      const soon = !overdue && (due - now) < 24 * 60 * 60 * 1000;
                      return (
                        <div className={`mb-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          overdue ? "bg-destructive/15 text-destructive" : soon ? "bg-amber-500/15 text-amber-700" : "bg-muted text-muted-foreground"
                        }`}>
                          {overdue ? "Scaduta" : soon ? "In scadenza" : `Entro il ${new Date(reqByShift[s.id].due_date).toLocaleDateString("it-IT")}`}
                        </div>
                      );
                    })()}
                    {reviewed.has(s.id) ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-3 py-1 text-sm font-semibold text-emerald-700 shadow-[0_0_12px_-2px_rgba(16,185,129,0.35)] dark:text-emerald-400 dark:bg-emerald-500/10">
                          <CheckCircle2 className="h-4 w-4" />
                          Recensione inviata
                        </div>
                        <Button size="sm" variant="outline" className="gap-1" onClick={() => openViewReview(s.id)}>
                          <Eye className="h-4 w-4" /> Vedi recensione
                        </Button>
                      </div>
                    ) : reviewOpen === s.id ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-1">
                          {[1,2,3,4,5].map(n => (
                            <button key={n} type="button" onClick={() => setRating(n)} className="p-1">
                              <Star className={`h-5 w-5 ${n <= rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`} />
                            </button>
                          ))}
                        </div>
                        <Textarea placeholder="Commento (opzionale)" value={comment} onChange={e => setComment(e.target.value)} rows={2} />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => submitReview(s)}>Invia recensione</Button>
                          <Button size="sm" variant="ghost" onClick={() => setReviewOpen(null)}>Annulla</Button>
                        </div>
                      </div>
                    ) : (
                      <Button size="sm" variant="outline" className="gap-1" onClick={() => { setReviewOpen(s.id); setRating(5); setComment(""); }}>
                        <Star className="h-4 w-4" /> Lascia recensione
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
        </>
      )}

      <Dialog open={!!viewReviewShiftId} onOpenChange={(open) => !open && closeViewReview()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>La tua recensione</DialogTitle>
          </DialogHeader>
          {viewReviewData && (
            <div className="space-y-3 py-2">
              <div className="flex items-center gap-1">
                {[1,2,3,4,5].map(n => (
                  <Star key={n} className={`h-6 w-6 ${n <= viewReviewData.rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`} />
                ))}
              </div>
              {viewReviewData.comment ? (
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{viewReviewData.comment}</p>
              ) : (
                <p className="text-sm text-muted-foreground italic">Nessun commento</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
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
