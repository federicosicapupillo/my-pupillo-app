import { createFileRoute, Link } from "@tanstack/react-router";
import { RequireAuth } from "@/components/RequireAuth";
import { RequireRole } from "@/components/RequireRole";
import { AppShell, PageHeader } from "@/components/AppShell";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { CalendarDays, Save, Plus, Trash2, Zap, Info } from "lucide-react";
import {
  DAY_LABELS,
  SLOT_LABELS,
  SLOT_DEFAULT_TIMES,
  type TimeSlot,
  type AvailabilityRow,
  type AvailabilityExceptionRow,
} from "@/lib/availability";

export const Route = createFileRoute("/availability")({
  head: () => ({
    meta: [
      { title: "Le mie disponibilità — Pupillo" },
      { name: "description", content: "Imposta i giorni e le fasce orarie in cui sei disponibile a ricevere proposte di lavoro dai ristoratori." },
    ],
  }),
  component: () => (
    <RequireAuth>
      <RequireRole allow={["worker"]}>
        <AvailabilityPage />
      </RequireRole>
    </RequireAuth>
  ),
});

const ALL_SLOTS: TimeSlot[] = ["pranzo", "aperitivo", "cena", "serale", "intera_giornata", "last_minute"];

type LocalSlot = {
  id?: string;
  time_slot: TimeSlot;
  start_time: string | null;
  end_time: string | null;
  is_flexible: boolean;
  is_last_minute: boolean;
};

type DayState = {
  is_available: boolean;
  flexible: boolean; // "Disponibile, ma valuto in base alla proposta"
  notes: string;
  slots: LocalSlot[];
};

function emptyDay(): DayState {
  return { is_available: false, flexible: false, notes: "", slots: [] };
}

function AvailabilityPage() {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [days, setDays] = useState<DayState[]>(() => Array.from({ length: 7 }, emptyDay));
  const [exceptions, setExceptions] = useState<AvailabilityExceptionRow[]>([]);
  const [newExc, setNewExc] = useState<{ date: string; is_available: boolean; start_time: string; end_time: string; notes: string }>({
    date: "",
    is_available: true,
    start_time: "",
    end_time: "",
    notes: "",
  });
  const [availableNow, setAvailableNow] = useState(false);
  const [availableNowUntil, setAvailableNowUntil] = useState<string | null>(null);
  const [availableNowDuration, setAvailableNowDuration] = useState<"2h" | "today" | "tonight">("2h");

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [rowsRes, excRes] = await Promise.all([
        supabase.from("worker_availability").select("*").eq("worker_id", user.id),
        supabase.from("worker_availability_exceptions").select("*").eq("worker_id", user.id).order("date", { ascending: true }),
      ]);
      if (cancelled) return;
      const rows = (rowsRes.data ?? []) as AvailabilityRow[];
      const exc = (excRes.data ?? []) as AvailabilityExceptionRow[];
      const next: DayState[] = Array.from({ length: 7 }, emptyDay);
      rows.forEach((r) => {
        const d = next[r.day_of_week];
        d.is_available = true;
        if (r.time_slot === "flessibile") {
          d.flexible = true;
        } else {
          d.slots.push({
            id: r.id,
            time_slot: r.time_slot,
            start_time: r.start_time?.slice(0, 5) ?? null,
            end_time: r.end_time?.slice(0, 5) ?? null,
            is_flexible: r.is_flexible,
            is_last_minute: r.is_last_minute,
          });
        }
        if (r.notes && !d.notes) d.notes = r.notes;
      });
      setDays(next);
      setExceptions(exc);
      const until = (profile as any)?.available_now_until as string | null | undefined;
      if (until && new Date(until).getTime() > Date.now()) {
        setAvailableNow(true);
        setAvailableNowUntil(until);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user, profile]);

  const toggleDay = (i: number, on: boolean) => {
    setDays((d) => d.map((x, idx) => (idx === i ? { ...x, is_available: on } : x)));
  };

  const toggleSlot = (i: number, slot: TimeSlot) => {
    setDays((d) =>
      d.map((x, idx) => {
        if (idx !== i) return x;
        const has = x.slots.find((s) => s.time_slot === slot);
        if (has) {
          return { ...x, slots: x.slots.filter((s) => s.time_slot !== slot) };
        }
        const def = SLOT_DEFAULT_TIMES[slot];
        return {
          ...x,
          is_available: true,
          slots: [
            ...x.slots,
            {
              time_slot: slot,
              start_time: def.start,
              end_time: def.end,
              is_flexible: false,
              is_last_minute: slot === "last_minute",
            },
          ],
        };
      }),
    );
  };

  const updateSlotTime = (i: number, slot: TimeSlot, field: "start_time" | "end_time", v: string) => {
    setDays((d) =>
      d.map((x, idx) =>
        idx === i
          ? { ...x, slots: x.slots.map((s) => (s.time_slot === slot ? { ...s, [field]: v || null } : s)) }
          : x,
      ),
    );
  };

  const setFlexible = (i: number, on: boolean) => {
    setDays((d) => d.map((x, idx) => (idx === i ? { ...x, flexible: on, is_available: on || x.is_available } : x)));
  };

  const setNotes = (i: number, v: string) => {
    setDays((d) => d.map((x, idx) => (idx === i ? { ...x, notes: v } : x)));
  };

  const save = async () => {
    if (!user) return;
    setSaving(true);
    try {
      // Replace all rows for this worker
      const { error: delErr } = await supabase.from("worker_availability").delete().eq("worker_id", user.id);
      if (delErr) throw delErr;

      const inserts: Array<Omit<AvailabilityRow, "id">> = [];
      days.forEach((d, dow) => {
        if (!d.is_available) return;
        if (d.flexible) {
          inserts.push({
            worker_id: user.id,
            day_of_week: dow,
            time_slot: "flessibile",
            start_time: null,
            end_time: null,
            is_flexible: true,
            is_last_minute: false,
            notes: d.notes || null,
          });
        }
        d.slots.forEach((s) => {
          inserts.push({
            worker_id: user.id,
            day_of_week: dow,
            time_slot: s.time_slot,
            start_time: s.start_time,
            end_time: s.end_time,
            is_flexible: false,
            is_last_minute: s.time_slot === "last_minute",
            notes: d.notes || null,
          });
        });
      });

      if (inserts.length > 0) {
        const { error: insErr } = await supabase.from("worker_availability").insert(inserts as never);
        if (insErr) throw insErr;
      }
      toast.success("Disponibilità salvate");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Errore nel salvataggio";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const addException = async () => {
    if (!user || !newExc.date) {
      toast.error("Indica una data");
      return;
    }
    const payload = {
      worker_id: user.id,
      date: newExc.date,
      is_available: newExc.is_available,
      start_time: newExc.is_available && newExc.start_time ? newExc.start_time : null,
      end_time: newExc.is_available && newExc.end_time ? newExc.end_time : null,
      time_slot: null,
      notes: newExc.notes || null,
    };
    const { data, error } = await supabase
      .from("worker_availability_exceptions")
      .insert(payload as never)
      .select("*")
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    setExceptions((e) => [...e, data as AvailabilityExceptionRow].sort((a, b) => a.date.localeCompare(b.date)));
    setNewExc({ date: "", is_available: true, start_time: "", end_time: "", notes: "" });
    toast.success("Eccezione aggiunta");
  };

  const removeException = async (id: string) => {
    const { error } = await supabase.from("worker_availability_exceptions").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setExceptions((e) => e.filter((x) => x.id !== id));
  };

  const toggleAvailableNow = async (on: boolean) => {
    if (!user) return;
    setAvailableNow(on);
    let until: string | null = null;
    if (on) {
      const now = new Date();
      const d = new Date(now);
      if (availableNowDuration === "2h") d.setHours(d.getHours() + 2);
      else if (availableNowDuration === "today") d.setHours(23, 59, 59, 0);
      else d.setHours(23, 59, 59, 0); // tonight ~ end of day
      until = d.toISOString();
    }
    setAvailableNowUntil(until);
    const { error } = await supabase.from("profiles").update({ available_now_until: until }).eq("id", user.id);
    if (error) {
      toast.error(error.message);
      setAvailableNow(!on);
    } else {
      toast.success(on ? "Sei visibile per proposte last minute" : "Disponibilità immediata disattivata");
    }
  };

  const summary = useMemo(() => {
    const active = days.filter((d) => d.is_available).length;
    const totalSlots = days.reduce((acc, d) => acc + d.slots.length + (d.flexible ? 1 : 0), 0);
    return { active, totalSlots };
  }, [days]);

  const isEmpty = !loading && summary.active === 0 && exceptions.length === 0;

  return (
    <AppShell>
      <PageHeader
        title="Le mie disponibilità"
        subtitle="Indica quando sei disponibile a ricevere proposte di lavoro dai ristoratori."
        action={
          <Button onClick={save} disabled={saving || loading} className="gap-2">
            <Save className="h-4 w-4" /> {saving ? "Salvataggio..." : "Salva disponibilità settimanale"}
          </Button>
        }
      />

      {/* Available now */}
      <Card className="mb-6">
        <CardContent className="p-5 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-[220px]">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <div className="font-semibold">Disponibile ora</div>
              <div className="text-sm text-muted-foreground">
                Attiva questa opzione se puoi ricevere proposte di lavoro immediate.
              </div>
              {availableNow && availableNowUntil && (
                <div className="text-xs text-primary mt-1">
                  Attivo fino alle {new Date(availableNowUntil).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
                </div>
              )}
            </div>
          </div>
          <Select value={availableNowDuration} onValueChange={(v) => setAvailableNowDuration(v as "2h" | "today" | "tonight")}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="2h">Prossime 2 ore</SelectItem>
              <SelectItem value="today">Disponibile oggi</SelectItem>
              <SelectItem value="tonight">Questa sera</SelectItem>
            </SelectContent>
          </Select>
          <Switch checked={availableNow} onCheckedChange={toggleAvailableNow} aria-label="Disponibile ora" />
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="mb-6 rounded-2xl border bg-card p-4 flex flex-wrap items-center gap-3 text-sm">
        <CalendarDays className="h-4 w-4 text-primary" />
        <span className="font-medium">Riepilogo settimanale:</span>
        <span className="text-muted-foreground">
          {summary.active} {summary.active === 1 ? "giorno disponibile" : "giorni disponibili"} · {summary.totalSlots} {summary.totalSlots === 1 ? "fascia" : "fasce"}
        </span>
        <span className="ml-auto text-xs text-muted-foreground inline-flex items-center gap-1">
          <Info className="h-3.5 w-3.5" />
          Inserire un orario preciso aumenta la possibilità di ricevere proposte adatte alla tua disponibilità.
        </span>
      </div>

      {isEmpty && (
        <Card className="mb-6 border-dashed">
          <CardContent className="p-8 text-center space-y-3">
            <CalendarDays className="h-10 w-10 mx-auto text-muted-foreground" />
            <div className="font-semibold text-lg">Non hai ancora inserito le tue disponibilità.</div>
            <p className="text-sm text-muted-foreground">
              Inseriscile per ricevere proposte di lavoro più adatte ai tuoi orari.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Weekly grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {days.map((d, i) => (
          <Card key={i} className={d.is_available ? "" : "opacity-80"}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-base">{DAY_LABELS[i]}</CardTitle>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">{d.is_available ? "Disponibile" : "Non disponibile"}</span>
                <Switch checked={d.is_available} onCheckedChange={(v) => toggleDay(i, v)} aria-label={`Disponibile ${DAY_LABELS[i]}`} />
              </div>
            </CardHeader>
            {d.is_available && (
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {ALL_SLOTS.map((slot) => {
                    const active = !!d.slots.find((s) => s.time_slot === slot);
                    return (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => toggleSlot(i, slot)}
                        className={`text-xs rounded-full px-3 py-1.5 border transition-colors ${
                          active
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background hover:bg-accent border-border text-foreground"
                        }`}
                      >
                        {SLOT_LABELS[slot]}
                      </button>
                    );
                  })}
                </div>

                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={d.flexible}
                    onChange={(e) => setFlexible(i, e.target.checked)}
                    className="h-4 w-4"
                  />
                  Disponibile, ma valuto in base alla proposta
                </label>

                {d.slots.length > 0 && (
                  <div className="space-y-2">
                    {d.slots.map((s) => (
                      <div key={s.time_slot} className="rounded-lg border p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <Badge variant="secondary">{SLOT_LABELS[s.time_slot]}</Badge>
                          {s.time_slot === "last_minute" && (
                            <span className="text-xs text-muted-foreground">Nessun orario fisso</span>
                          )}
                        </div>
                        {s.time_slot !== "last_minute" && (
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-xs text-muted-foreground mb-1">Dalle</label>
                              <Input
                                type="time"
                                value={s.start_time ?? ""}
                                onChange={(e) => updateSlotTime(i, s.time_slot, "start_time", e.target.value)}
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-muted-foreground mb-1">Alle</label>
                              <Input
                                type="time"
                                value={s.end_time ?? ""}
                                onChange={(e) => updateSlotTime(i, s.time_slot, "end_time", e.target.value)}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Note sulla disponibilità (facoltative)</label>
                  <Textarea
                    value={d.notes}
                    onChange={(e) => setNotes(i, e.target.value)}
                    placeholder="Es. Preferisco turni serali in zona centro"
                    rows={2}
                  />
                </div>
              </CardContent>
            )}
          </Card>
        ))}
      </div>

      <div className="mt-6 flex justify-end">
        <Button onClick={save} disabled={saving || loading} className="gap-2">
          <Save className="h-4 w-4" /> {saving ? "Salvataggio..." : "Salva disponibilità settimanale"}
        </Button>
      </div>

      {/* Exceptions */}
      <section className="mt-10">
        <h2 className="text-xl font-semibold mb-2">Eccezioni</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Indica date specifiche in cui sei disponibile anche se normalmente non lo sei, o viceversa.
        </p>

        <Card>
          <CardContent className="p-4 grid gap-3 md:grid-cols-5">
            <div className="md:col-span-1">
              <label className="block text-xs text-muted-foreground mb-1">Data</label>
              <Input type="date" value={newExc.date} onChange={(e) => setNewExc({ ...newExc, date: e.target.value })} />
            </div>
            <div className="md:col-span-1">
              <label className="block text-xs text-muted-foreground mb-1">Stato</label>
              <Select value={newExc.is_available ? "yes" : "no"} onValueChange={(v) => setNewExc({ ...newExc, is_available: v === "yes" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">Disponibile</SelectItem>
                  <SelectItem value="no">Non disponibile</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Dalle</label>
              <Input type="time" disabled={!newExc.is_available} value={newExc.start_time} onChange={(e) => setNewExc({ ...newExc, start_time: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Alle</label>
              <Input type="time" disabled={!newExc.is_available} value={newExc.end_time} onChange={(e) => setNewExc({ ...newExc, end_time: e.target.value })} />
            </div>
            <div className="md:col-span-1 flex items-end">
              <Button onClick={addException} className="w-full gap-2">
                <Plus className="h-4 w-4" /> Aggiungi
              </Button>
            </div>
            <div className="md:col-span-5">
              <label className="block text-xs text-muted-foreground mb-1">Note (facoltative)</label>
              <Input value={newExc.notes} onChange={(e) => setNewExc({ ...newExc, notes: e.target.value })} placeholder="Es. Vacanza, evento speciale..." />
            </div>
          </CardContent>
        </Card>

        <div className="mt-4 space-y-2">
          {exceptions.length === 0 && (
            <p className="text-sm text-muted-foreground italic">Nessuna eccezione impostata.</p>
          )}
          {exceptions.map((e) => (
            <div key={e.id} className="rounded-lg border p-3 flex items-center gap-3 text-sm">
              <Badge variant={e.is_available ? "default" : "destructive"}>
                {e.is_available ? "Disponibile" : "Non disponibile"}
              </Badge>
              <span className="font-medium">
                {new Date(e.date + "T00:00:00").toLocaleDateString("it-IT", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
              </span>
              {e.is_available && e.start_time && e.end_time && (
                <span className="text-muted-foreground">
                  {e.start_time.slice(0, 5)} – {e.end_time.slice(0, 5)}
                </span>
              )}
              {e.notes && <span className="text-muted-foreground truncate">· {e.notes}</span>}
              <Button
                variant="ghost"
                size="icon"
                className="ml-auto"
                onClick={() => removeException(e.id)}
                aria-label="Rimuovi eccezione"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-8 text-center">
        <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">
          ← Torna alla dashboard
        </Link>
      </div>
    </AppShell>
  );
}