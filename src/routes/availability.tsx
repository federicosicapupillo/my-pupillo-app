import { createFileRoute, Link } from "@tanstack/react-router";
import { RequireAuth } from "@/components/RequireAuth";
import { RequireRole } from "@/components/RequireRole";
import { AppShell, PageHeader } from "@/components/AppShell";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { CalendarDays, Save, Plus, Trash2, Zap, Info, MapPin, Copy, Pencil, ChevronDown, Sparkles, Wand2 } from "lucide-react";
import { useProfileGate } from "@/components/ProfileGate";
import {
  DAY_LABELS,
  SLOT_LABELS,
  SLOT_DEFAULT_TIMES,
  RADIUS_OPTIONS,
  type TimeSlot,
  type AvailabilityRow,
  type AvailabilityExceptionRow,
  crossesMidnight,
  isValidTimeRange,
} from "@/lib/availability";
import { WORKER_CITIES, ALL_ZONES_OPTION, zonesForCity } from "@/lib/worker-cities";

// Province codes for the supported worker cities. Keep aligned with WORKER_CITIES.
const CITY_PROVINCE_CODE: Record<string, string> = {
  Milano: "MI",
  Roma: "RM",
  Torino: "TO",
  Bologna: "BO",
  Firenze: "FI",
  Napoli: "NA",
  Genova: "GE",
  Verona: "VR",
  Venezia: "VE",
  Bari: "BA",
};

function provinceForCity(city: string): string {
  return CITY_PROVINCE_CODE[city] ?? "";
}

export const Route = createFileRoute("/availability")({
  head: () => ({
    meta: [
      { title: "Le mie disponibilità — Pupillo" },
      { name: "description", content: "Imposta giorni, fasce orarie, città e zone in cui sei disponibile a ricevere proposte di lavoro." },
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
const EXC_SLOTS: TimeSlot[] = ["pranzo", "aperitivo", "cena", "serale", "intera_giornata", "last_minute", "personalizzata"];

const TIME_OPTIONS: string[] = (() => {
  const out: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 30]) {
      out.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return out;
})();

const QUICK_RANGES: Array<{ start: string; end: string; label: string }> = [
  { start: "09:00", end: "13:00", label: "09:00 – 13:00" },
  { start: "14:00", end: "18:00", label: "14:00 – 18:00" },
  { start: "18:00", end: "23:00", label: "18:00 – 23:00" },
  { start: "20:00", end: "02:00", label: "20:00 – 02:00" },
];

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
  flexible: boolean;
  notes: string;
  slots: LocalSlot[];
  city: string;
  province: string;
  district: string;
  radius_km: number | null;
};

type NewExc = {
  date: string;
  is_available: boolean;
  start_time: string;
  end_time: string;
  notes: string;
  city: string;
  province: string;
  district: string;
  radius_km: number | null;
  time_slot: TimeSlot | "";
};

function emptyDay(city = "", province = "", district = "", radius_km: number | null = null): DayState {
  return {
    is_available: false,
    flexible: false,
    notes: "",
    slots: [],
    city,
    province,
    district,
    radius_km,
  };
}

function emptyNewExc(city = "", province = "", district = "", radius_km: number | null = null): NewExc {
  return {
    date: "",
    is_available: true,
    start_time: "",
    end_time: "",
    notes: "",
    city,
    province,
    district,
    radius_km,
    time_slot: "",
  };
}

function AvailabilityPage() {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { requireCompleteForAvailability, canPerformOperationalAction } = useProfileGate();

  // Defaults from worker profile
  const defaults = useMemo(() => {
    const p = (profile ?? {}) as Record<string, unknown>;
    const radiusM = (p.service_area_radius_m as number | null) ?? null;
    return {
      city: (p.service_area_city as string | null) ?? (p.city as string | null) ?? "",
      province: (p.province as string | null) ?? "",
      district: (p.service_area_district as string | null) ?? (p.neighborhood as string | null) ?? "",
      radius_km: radiusM ? Math.max(1, Math.round(radiusM / 1000)) : null,
    };
  }, [profile]);

  const [days, setDays] = useState<DayState[]>(() => Array.from({ length: 7 }, () => emptyDay()));
  const [exceptions, setExceptions] = useState<AvailabilityExceptionRow[]>([]);
  const [newExc, setNewExc] = useState<NewExc>(() => emptyNewExc());
  const [availableNow, setAvailableNow] = useState(false);
  const [availableNowUntil, setAvailableNowUntil] = useState<string | null>(null);
  const [availableNowDuration, setAvailableNowDuration] = useState<"2h" | "today" | "tonight">("2h");
  const [duplicateFrom, setDuplicateFrom] = useState<number | null>(null);
  const [duplicateTargets, setDuplicateTargets] = useState<boolean[]>(() => Array.from({ length: 7 }, () => false));
  const [editingDay, setEditingDay] = useState<number | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  type PresetType = "all" | "weekend" | "cena" | "pranzo";
  const [confirmPreset, setConfirmPreset] = useState<{ type: PresetType; title: string; message: string } | null>(null);
  const [dirty, setDirty] = useState(false);
  const [copying, setCopying] = useState(false);
  const loadedRef = useRef(false);

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
      const rows = (rowsRes.data ?? []) as unknown as AvailabilityRow[];
      const exc = (excRes.data ?? []) as unknown as AvailabilityExceptionRow[];
      const next: DayState[] = Array.from({ length: 7 }, () =>
        emptyDay(defaults.city, defaults.province, defaults.district, defaults.radius_km),
      );
      rows.forEach((r) => {
        const d = next[r.day_of_week];
        d.is_available = true;
        if (r.city) d.city = r.city;
        if (r.province) d.province = r.province;
        if (r.district) d.district = r.district;
        if (r.radius_km != null) d.radius_km = r.radius_km;
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
      setNewExc(emptyNewExc(defaults.city, defaults.province, defaults.district, defaults.radius_km));
      const until = (profile as { available_now_until?: string | null } | null)?.available_now_until ?? null;
      if (until && new Date(until).getTime() > Date.now()) {
        setAvailableNow(true);
        setAvailableNowUntil(until);
      }
      setLoading(false);
      // Mark "loaded" on next tick so the dirty tracker doesn't fire from hydration
      setTimeout(() => { loadedRef.current = true; setDirty(false); }, 0);
    })();
    return () => { cancelled = true; };
  }, [user, profile, defaults.city, defaults.province, defaults.district, defaults.radius_km]);

  // Track unsaved changes on the weekly grid
  useEffect(() => {
    if (!loadedRef.current) return;
    setDirty(true);
  }, [days]);

  // Browser warning on unload when there are unsaved changes
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "Hai modifiche non salvate. Vuoi uscire senza salvare?";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const updateDay = (i: number, patch: Partial<DayState>) =>
    setDays((d) => d.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));

  const toggleDay = (i: number, on: boolean) => updateDay(i, { is_available: on });

  const toggleSlot = (i: number, slot: TimeSlot) => {
    setDays((d) =>
      d.map((x, idx) => {
        if (idx !== i) return x;
        const has = x.slots.find((s) => s.time_slot === slot);
        if (has) return { ...x, slots: x.slots.filter((s) => s.time_slot !== slot) };
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

  const setFlexible = (i: number, on: boolean) =>
    updateDay(i, { flexible: on, is_available: on || days[i].is_available });

  const openDuplicate = (i: number) => {
    setDuplicateFrom(i);
    setDuplicateTargets(Array.from({ length: 7 }, (_, idx) => false));
  };

  const applyDuplicate = async () => {
    if (duplicateFrom == null) return;
    const src = days[duplicateFrom];
    const next = days.map((x, idx) => {
      if (idx === duplicateFrom || !duplicateTargets[idx]) return x;
      return {
        ...src,
        slots: src.slots.map((s) => ({ ...s, id: undefined })),
      };
    });
    setDays(next);
    setCopying(true);
    try {
      const ok = await persistAll(next, { silent: true });
      if (ok) {
        setDuplicateFrom(null);
        toast.success("Disponibilità copiata e salvata correttamente.");
      } else {
        toast.error("Non è stato possibile copiare la disponibilità. Riprova.");
      }
    } finally {
      setCopying(false);
    }
  };

  // -- Quick presets -------------------------------------------------------
  const presetAll = () => {
    setDays((d) => d.map((x) => ({
      ...x,
      is_available: true,
      city: x.city || defaults.city,
      province: x.province || defaults.province,
      district: x.district || defaults.district,
      radius_km: x.radius_km ?? defaults.radius_km,
    })));
    toast.success("Disponibilità settimana impostata correttamente.");
  };
  const presetWeekend = () => {
    setDays((d) => d.map((x, i) => {
      const isW = i === 5 || i === 6;
      return {
        ...x,
        is_available: isW,
        city: isW ? (x.city || defaults.city) : x.city,
        province: isW ? (x.province || defaults.province) : x.province,
        district: isW ? (x.district || defaults.district) : x.district,
        radius_km: isW ? (x.radius_km ?? defaults.radius_km) : x.radius_km,
      };
    }));
    toast.success("Disponibilità weekend impostata correttamente.");
  };
  const presetSlot = (slot: TimeSlot) => {
    const def = SLOT_DEFAULT_TIMES[slot];
    setDays((d) => {
      const anyOn = d.some((x) => x.is_available);
      return d.map((x) => {
        const apply = anyOn ? x.is_available : true;
        if (!apply) return x;
        return {
          ...x,
          is_available: true,
          city: x.city || defaults.city,
          province: x.province || defaults.province,
          district: x.district || defaults.district,
          radius_km: x.radius_km ?? defaults.radius_km,
          flexible: false,
          slots: [{
            time_slot: slot,
            start_time: def.start,
            end_time: def.end,
            is_flexible: false,
            is_last_minute: slot === "last_minute",
          }],
        };
      });
    });
    const slotToast = slot === "cena" ? "serale" : slot === "pranzo" ? "pranzo" : SLOT_LABELS[slot];
    toast.success(`Disponibilità ${slotToast} impostata correttamente.`);
  };
  const clearAll = () => {
    setDays(Array.from({ length: 7 }, () => emptyDay(defaults.city, defaults.province, defaults.district, defaults.radius_km)));
    setEditingDay(null);
    setConfirmClear(false);
    toast.success("Tutte le disponibilità sono state cancellate.");
  };

  const applyPreset = () => {
    if (!confirmPreset) return;
    switch (confirmPreset.type) {
      case "all": presetAll(); break;
      case "weekend": presetWeekend(); break;
      case "cena": presetSlot("cena"); break;
      case "pranzo": presetSlot("pranzo"); break;
    }
    setConfirmPreset(null);
  };

  const daySummary = (d: DayState): { location: string; hours: string } => {
    const loc = d.city
      ? `${d.city}${d.district ? ` · ${d.district}` : " · Tutte le zone"}`
      : "Città non indicata";
    if (d.flexible && d.slots.length === 0) {
      return { location: loc, hours: "Valuto in base alla proposta" };
    }
    if (d.slots.length === 0) return { location: loc, hours: "Nessuna fascia" };
    const parts = d.slots.slice(0, 2).map((s) => {
      if (s.time_slot === "last_minute") return "Last minute";
      if (s.start_time && s.end_time) return `${s.start_time} - ${s.end_time}`;
      return SLOT_LABELS[s.time_slot];
    });
    const more = d.slots.length > 2 ? ` · +${d.slots.length - 2}` : "";
    return { location: loc, hours: parts.join(" · ") + more };
  };

  const validateBeforeSave = (list: DayState[] = days): string | null => {
    for (let i = 0; i < list.length; i++) {
      const d = list[i];
      if (!d.is_available) continue;
      if (!d.city || !d.city.trim()) {
        return `Seleziona la città in cui sei disponibile (${DAY_LABELS[i]}).`;
      }
      if (!d.flexible && d.slots.length === 0) {
        return `Indica almeno una fascia oraria o un orario di disponibilità per ${DAY_LABELS[i]}.`;
      }
      for (const s of d.slots) {
        if (s.time_slot === "last_minute") continue;
        if (!s.start_time || !s.end_time) {
          return `Completa orario di inizio e fine per ${DAY_LABELS[i]}.`;
        }
        if (!isValidTimeRange(s.start_time, s.end_time)) {
          return `Orario di inizio e fine non possono coincidere (${DAY_LABELS[i]}).`;
        }
      }
    }
    return null;
  };

  // Stricter per-day validation used by "Salva e chiudi".
  const validateDay = (i: number): string | null => {
    const d = days[i];
    if (!d.is_available) return null;
    if (!d.city.trim()) return "Seleziona la città.";
    if (!d.district.trim()) return "Seleziona la zona o quartiere.";
    if (!d.flexible && d.slots.length === 0) return "Seleziona almeno una fascia oraria.";
    for (const s of d.slots) {
      if (s.time_slot === "last_minute") continue;
      if (!s.start_time || !s.end_time) return "Inserisci orario di inizio e fine.";
      if (!isValidTimeRange(s.start_time, s.end_time)) return "Orario di inizio e fine non possono coincidere.";
    }
    return null;
  };

  const persistAll = async (
    override?: DayState[],
    opts: { silent?: boolean } = {},
  ): Promise<boolean> => {
    if (!user) return false;
    const list = override ?? days;
    const err = validateBeforeSave(list);
    if (err) { toast.error(err); return false; }
    setSaving(true);
    try {
      const { error: delErr } = await supabase.from("worker_availability").delete().eq("worker_id", user.id);
      if (delErr) throw delErr;

      const inserts: Array<Omit<AvailabilityRow, "id">> = [];
      list.forEach((d, dow) => {
        if (!d.is_available) return;
        const loc = {
          city: d.city.trim() || null,
          province: d.province.trim() || null,
          district: d.district.trim() || null,
          latitude: null,
          longitude: null,
          radius_km: d.radius_km,
        };
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
            ...loc,
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
            ...loc,
          });
        });
      });

      if (inserts.length > 0) {
        const { error: insErr } = await supabase.from("worker_availability").insert(inserts as never);
        if (insErr) throw insErr;
      }
      setDirty(false);
      if (!opts.silent) toast.success("Disponibilità salvate");
      return true;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Errore nel salvataggio";
      console.error("[availability] save failed", msg);
      toast.error("Non è stato possibile salvare la disponibilità. Riprova.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const save = async (): Promise<void> => { await persistAll(); };

  const saveAndClose = async (i: number) => {
    const err = validateDay(i);
    if (err) { toast.error(err); return; }
    const ok = await persistAll(undefined, { silent: true });
    if (ok) {
      setEditingDay(null);
      toast.success("Disponibilità aggiornata correttamente.");
    }
  };

  const addException = async () => {
    if (!user) return;
    if (!newExc.date) { toast.error("Seleziona una data."); return; }
    if (newExc.is_available) {
      if (!newExc.city.trim()) {
        toast.error("Seleziona la città in cui sei disponibile.");
        return;
      }
      if (!newExc.time_slot) {
        toast.error("Seleziona una fascia di disponibilità.");
        return;
      }
      if (newExc.time_slot === "personalizzata") {
        if (!newExc.start_time || !newExc.end_time) {
          toast.error("Inserisci orario di inizio e fine per la fascia personalizzata.");
          return;
        }
        if (!isValidTimeRange(newExc.start_time, newExc.end_time)) {
          toast.error("L'orario di inizio e fine non possono coincidere.");
          return;
        }
      }
    }
    const start = newExc.time_slot === "personalizzata" ? (newExc.start_time || null) : null;
    const end = newExc.time_slot === "personalizzata" ? (newExc.end_time || null) : null;
    const payload = {
      worker_id: user.id,
      date: newExc.date,
      is_available: newExc.is_available,
      start_time: newExc.is_available ? start : null,
      end_time: newExc.is_available ? end : null,
      time_slot: newExc.is_available && newExc.time_slot ? newExc.time_slot : null,
      notes: newExc.notes || null,
      city: newExc.is_available ? (newExc.city.trim() || null) : null,
      province: newExc.is_available ? (newExc.province.trim() || null) : null,
      district: newExc.is_available ? (newExc.district.trim() || null) : null,
      latitude: null,
      longitude: null,
      radius_km: newExc.is_available ? newExc.radius_km : null,
    };
    const { data, error } = await supabase
      .from("worker_availability_exceptions")
      .insert(payload as never)
      .select("*")
      .single();
    if (error) { toast.error(error.message); return; }
    setExceptions((e) => [...e, data as unknown as AvailabilityExceptionRow].sort((a, b) => a.date.localeCompare(b.date)));
    setNewExc(emptyNewExc(defaults.city, defaults.province, defaults.district, defaults.radius_km));
    toast.success("Disponibilità speciale aggiunta");
  };

  const removeException = async (id: string) => {
    const { error } = await supabase.from("worker_availability_exceptions").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    setExceptions((e) => e.filter((x) => x.id !== id));
  };

  const toggleAvailableNow = async (on: boolean) => {
    if (!user) return;
    setAvailableNow(on);
    let until: string | null = null;
    if (on) {
      const d = new Date();
      if (availableNowDuration === "2h") d.setHours(d.getHours() + 2);
      else d.setHours(23, 59, 59, 0);
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
    const cityCounts = new Map<string, number>();
    days.forEach((d) => {
      if (!d.is_available || !d.city) return;
      const k = d.city.trim();
      if (!k) return;
      cityCounts.set(k, (cityCounts.get(k) ?? 0) + 1);
    });
    let prevalentCity: string | null = null;
    let max = 0;
    cityCounts.forEach((v, k) => { if (v > max) { max = v; prevalentCity = k; } });
    const today = new Date(); today.setHours(0,0,0,0);
    const nextSpecial = exceptions
      .filter((e) => new Date(e.date + "T00:00:00") >= today)
      .sort((a, b) => a.date.localeCompare(b.date))[0] ?? null;
    return { active, totalSlots, prevalentCity, nextSpecial };
  }, [days, exceptions]);

  const isEmpty = !loading && summary.active === 0 && exceptions.length === 0;

  // Gate: profili non completi al 100% non possono modificare la disponibilità.
  // I tasti restano visibili ma al click apre il popup dedicato.
  const saveGated = requireCompleteForAvailability(save);
  const addExceptionGated = requireCompleteForAvailability(addException);
  const removeExceptionGated = requireCompleteForAvailability(removeException);
  const toggleAvailableNowGated = requireCompleteForAvailability(toggleAvailableNow);
  const gatedOpacity = canPerformOperationalAction ? "" : "opacity-70";

  return (
    <AppShell>
      <PageHeader
        title="Le mie disponibilità"
        subtitle="Indica quando e dove sei disponibile a ricevere proposte di lavoro."
        action={
          <Button onClick={saveGated} disabled={saving || loading} className={`gap-2 ${gatedOpacity}`}>
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
          <Switch checked={availableNow} onCheckedChange={toggleAvailableNowGated} aria-label="Disponibile ora" />
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="mb-6 rounded-2xl border bg-card p-4 flex flex-wrap items-center gap-3 text-sm">
        <CalendarDays className="h-4 w-4 text-primary" />
        <span className="font-medium">Riepilogo settimanale:</span>
        <span className="text-muted-foreground">
          {summary.active} {summary.active === 1 ? "giorno disponibile" : "giorni disponibili"} · {summary.totalSlots} {summary.totalSlots === 1 ? "fascia" : "fasce"}
        </span>
        {summary.prevalentCity && (
          <span className="inline-flex items-center gap-1 text-foreground">
            <MapPin className="h-3.5 w-3.5 text-primary" /> Principalmente su <strong>{summary.prevalentCity}</strong>
          </span>
        )}
        {summary.nextSpecial && (
          <span className="text-xs text-muted-foreground">
            Prossima speciale: {new Date(summary.nextSpecial.date + "T00:00:00").toLocaleDateString("it-IT", { weekday: "long", day: "2-digit", month: "long" })}
            {summary.nextSpecial.city ? ` · ${summary.nextSpecial.city}` : ""}
          </span>
        )}
        <span className="ml-auto text-xs text-muted-foreground inline-flex items-center gap-1">
          <Info className="h-3.5 w-3.5" />
          Inserire città e orario aumenta le proposte coerenti.
        </span>
      </div>

      {isEmpty && (
        <Card className="mb-6 border-dashed">
          <CardContent className="p-8 text-center space-y-3">
            <CalendarDays className="h-10 w-10 mx-auto text-muted-foreground" />
            <div className="font-semibold text-lg">Non hai ancora inserito le tue disponibilità.</div>
            <p className="text-sm text-muted-foreground">
              Inseriscile per ricevere proposte di lavoro coerenti con i tuoi giorni, orari e zone.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Quick actions */}
      <Card className="mb-6 border bg-card">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary shrink-0">
              <Wand2 className="h-5 w-5" />
            </div>
            <div>
              <div className="font-semibold">Imposta rapidamente la tua disponibilità</div>
              <p className="text-sm text-muted-foreground">
                Queste azioni compilano automaticamente più giorni o fasce orarie per aiutarti a impostare la tua disponibilità più velocemente. Non sono filtri.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" className={`gap-1.5 ${gatedOpacity}`} onClick={() => setConfirmPreset({ type: "all", title: "Imposta tutta la settimana", message: "Questa azione imposterà la disponibilità su tutti i giorni della settimana. Vuoi continuare?" })}>
              <Wand2 className="h-3.5 w-3.5" /> Imposta tutta la settimana
            </Button>
            <Button type="button" size="sm" className={`gap-1.5 ${gatedOpacity}`} onClick={() => setConfirmPreset({ type: "weekend", title: "Imposta solo weekend", message: "Questa azione imposterà la disponibilità su Sabato e Domenica. Vuoi continuare?" })}>
              <Wand2 className="h-3.5 w-3.5" /> Imposta solo weekend
            </Button>
            <Button type="button" size="sm" className={`gap-1.5 ${gatedOpacity}`} onClick={() => setConfirmPreset({ type: "cena", title: "Imposta solo sere", message: "Questa azione imposterà la fascia oraria 'Cena' sui giorni attualmente disponibili (o tutti se nessuno è attivo). Vuoi continuare?" })}>
              <Wand2 className="h-3.5 w-3.5" /> Imposta solo sere
            </Button>
            <Button type="button" size="sm" className={`gap-1.5 ${gatedOpacity}`} onClick={() => setConfirmPreset({ type: "pranzo", title: "Imposta solo pranzo", message: "Questa azione imposterà la fascia oraria 'Pranzo' sui giorni attualmente disponibili (o tutti se nessuno è attivo). Vuoi continuare?" })}>
              <Wand2 className="h-3.5 w-3.5" /> Imposta solo pranzo
            </Button>
            <div className="flex-1" />
            <Button type="button" size="sm" variant="outline" className="gap-1.5 text-destructive hover:text-destructive border-destructive/30 hover:border-destructive" onClick={() => setConfirmClear(true)}>
              <Trash2 className="h-3.5 w-3.5" /> Cancella tutte le disponibilità
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Weekly grid: compact cards, one editable at a time */}
      <div className="grid gap-3 md:grid-cols-2">
        {days.map((d, i) => {
          const isEditing = editingDay === i;
          const sum = daySummary(d);
          return (
          <Card key={i} className={`${d.is_available ? "" : "opacity-90"} ${isEditing ? "ring-1 ring-primary/40" : ""}`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-3">
              <div className="min-w-0">
                <CardTitle className="text-base leading-tight">{DAY_LABELS[i]}</CardTitle>
                <div className={`text-xs mt-0.5 ${d.is_available ? "text-primary" : "text-muted-foreground"}`}>
                  {d.is_available ? "Disponibile" : "Non disponibile"}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={d.is_available}
                  onCheckedChange={(v) => { toggleDay(i, v); if (!v && isEditing) setEditingDay(null); }}
                  aria-label={`Disponibile ${DAY_LABELS[i]}`}
                />
              </div>
            </CardHeader>

            {!isEditing && (
              <CardContent className="pt-0 pb-3">
                {d.is_available ? (
                  <div className="space-y-1 text-sm">
                    <div className="inline-flex items-center gap-1 text-foreground">
                      <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span className="truncate">{sum.location}</span>
                    </div>
                    <div className="text-muted-foreground">{sum.hours}</div>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">Nessuna disponibilità impostata per questo giorno.</div>
                )}
                <div className="mt-3 flex justify-end">
                  <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={() => { setEditingDay(i); if (!d.is_available) toggleDay(i, true); }}>
                    <Pencil className="h-3.5 w-3.5" /> Modifica
                  </Button>
                </div>
              </CardContent>
            )}

            {isEditing && d.is_available && (
              <CardContent className="space-y-4">
                {/* Location */}
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Città *</label>
                    <Input
                      value={d.city}
                      placeholder={defaults.city || "Es. Bologna"}
                      onChange={(e) => updateDay(i, { city: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Zona / quartiere</label>
                    <Input
                      value={d.district}
                      placeholder={defaults.district || "Es. Centro, Navigli..."}
                      onChange={(e) => updateDay(i, { district: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Provincia</label>
                    <Input
                      value={d.province}
                      placeholder={defaults.province || "Es. BO"}
                      onChange={(e) => updateDay(i, { province: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Raggio massimo</label>
                    <Select
                      value={d.radius_km != null ? String(d.radius_km) : "none"}
                      onValueChange={(v) => updateDay(i, { radius_km: v === "none" ? null : parseInt(v, 10) })}
                    >
                      <SelectTrigger><SelectValue placeholder="Nessun limite" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nessun limite</SelectItem>
                        {RADIUS_OPTIONS.map((r) => (
                          <SelectItem key={r.value} value={String(r.value)}>{r.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Slots */}
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
                              <Input type="time" value={s.start_time ?? ""} onChange={(e) => updateSlotTime(i, s.time_slot, "start_time", e.target.value)} />
                            </div>
                            <div>
                              <label className="block text-xs text-muted-foreground mb-1">Alle</label>
                              <Input type="time" value={s.end_time ?? ""} onChange={(e) => updateSlotTime(i, s.time_slot, "end_time", e.target.value)} />
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
                    onChange={(e) => updateDay(i, { notes: e.target.value })}
                    placeholder="Es. Preferisco turni serali in zona centro"
                    rows={2}
                  />
                </div>

                <div className="flex flex-wrap justify-end gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => openDuplicate(i)}
                    disabled={saving || copying}
                  >
                    <Copy className="h-3.5 w-3.5" /> Copia su altri giorni
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className={`gap-2 ${gatedOpacity}`}
                    onClick={() => requireCompleteForAvailability(() => saveAndClose(i))()}
                    disabled={saving || copying}
                  >
                    <Save className="h-3.5 w-3.5" /> {saving ? "Salvataggio…" : "Salva e chiudi"}
                  </Button>
                </div>
              </CardContent>
            )}
          </Card>
          );
        })}
      </div>

      <div className="mt-6 flex justify-end">
        <Button onClick={saveGated} disabled={saving || loading} className={`gap-2 ${gatedOpacity}`}>
          <Save className="h-4 w-4" /> {saving ? "Salvataggio..." : "Salva disponibilità settimanale"}
        </Button>
      </div>

      {/* Special dates */}
      <section className="mt-10">
        <h2 className="text-xl font-semibold mb-2">Disponibilità speciali / spostamenti</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Indica date specifiche in cui sei disponibile in un'altra città o con orari diversi. Queste hanno priorità sulla disponibilità ricorrente.
        </p>

        <Card>
          <CardContent className="p-4 grid gap-3 md:grid-cols-6">
            <div className="md:col-span-2">
              <label className="block text-xs text-muted-foreground mb-1">Data</label>
              <Input type="date" value={newExc.date} onChange={(e) => setNewExc({ ...newExc, date: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-muted-foreground mb-1">Stato</label>
              <Select value={newExc.is_available ? "yes" : "no"} onValueChange={(v) => setNewExc({ ...newExc, is_available: v === "yes" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">Disponibile</SelectItem>
                  <SelectItem value="no">Non disponibile</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-muted-foreground mb-1">Fascia</label>
              <Select
                value={newExc.time_slot || "none"}
                onValueChange={(v) => setNewExc({ ...newExc, time_slot: v === "none" ? "" : (v as TimeSlot) })}
                disabled={!newExc.is_available}
              >
                <SelectTrigger><SelectValue placeholder="Nessuna" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nessuna</SelectItem>
                  {EXC_SLOTS.map((s) => (
                    <SelectItem key={s} value={s}>{SLOT_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-muted-foreground mb-1">Città {newExc.is_available ? "*" : ""}</label>
              <Input
                disabled={!newExc.is_available}
                value={newExc.city}
                placeholder={defaults.city || "Es. Milano"}
                onChange={(e) => setNewExc({ ...newExc, city: e.target.value })}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-muted-foreground mb-1">Zona / quartiere</label>
              <Input
                disabled={!newExc.is_available}
                value={newExc.district}
                placeholder="Es. Navigli"
                onChange={(e) => setNewExc({ ...newExc, district: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Provincia</label>
              <Input
                disabled={!newExc.is_available}
                value={newExc.province}
                placeholder="MI"
                onChange={(e) => setNewExc({ ...newExc, province: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Raggio</label>
              <Select
                value={newExc.radius_km != null ? String(newExc.radius_km) : "none"}
                onValueChange={(v) => setNewExc({ ...newExc, radius_km: v === "none" ? null : parseInt(v, 10) })}
                disabled={!newExc.is_available}
              >
                <SelectTrigger><SelectValue placeholder="Nessuno" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nessuno</SelectItem>
                  {RADIUS_OPTIONS.map((r) => (
                    <SelectItem key={r.value} value={String(r.value)}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {newExc.time_slot === "personalizzata" && (
              <>
                <div className="md:col-span-3">
                  <label className="block text-xs text-muted-foreground mb-1">Dalle *</label>
                  <Select
                    value={newExc.start_time || ""}
                    onValueChange={(v) => setNewExc({ ...newExc, start_time: v })}
                    disabled={!newExc.is_available}
                  >
                    <SelectTrigger><SelectValue placeholder="Seleziona" /></SelectTrigger>
                    <SelectContent className="max-h-64">
                      {TIME_OPTIONS.map((t) => (
                        <SelectItem key={`s-${t}`} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-3">
                  <label className="block text-xs text-muted-foreground mb-1">Alle *</label>
                  <Select
                    value={newExc.end_time || ""}
                    onValueChange={(v) => setNewExc({ ...newExc, end_time: v })}
                    disabled={!newExc.is_available}
                  >
                    <SelectTrigger><SelectValue placeholder="Seleziona" /></SelectTrigger>
                    <SelectContent className="max-h-64">
                      {TIME_OPTIONS.map((t) => (
                        <SelectItem key={`e-${t}`} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {newExc.start_time && newExc.end_time && crossesMidnight(newExc.start_time, newExc.end_time) && (
                    <p className="text-[11px] text-muted-foreground mt-1">Termina il giorno successivo</p>
                  )}
                </div>
                <div className="md:col-span-6">
                  <label className="block text-xs text-muted-foreground mb-2">Scelte rapide</label>
                  <div className="flex flex-wrap gap-2">
                    {QUICK_RANGES.map((r) => (
                      <Button
                        key={r.label}
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={!newExc.is_available}
                        onClick={() => setNewExc({ ...newExc, start_time: r.start, end_time: r.end })}
                      >
                        {r.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </>
            )}
            <div className="md:col-span-6">
              <label className="block text-xs text-muted-foreground mb-1">Note (facoltative)</label>
              <Input value={newExc.notes} onChange={(e) => setNewExc({ ...newExc, notes: e.target.value })} placeholder="Es. Sono a Milano per il weekend" />
            </div>
            <div className="md:col-span-6 flex justify-end">
              <Button onClick={addExceptionGated} className={`gap-2 ${gatedOpacity}`}>
                <Plus className="h-4 w-4" /> Aggiungi disponibilità speciale
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="mt-4 space-y-2">
          {exceptions.length === 0 && (
            <p className="text-sm text-muted-foreground italic">Nessuna disponibilità speciale impostata.</p>
          )}
          {exceptions.map((e) => (
            <div key={e.id} className="rounded-lg border p-3 flex flex-wrap items-center gap-3 text-sm">
              <Badge variant={e.is_available ? "default" : "destructive"}>
                {e.is_available ? "Disponibile" : "Non disponibile"}
              </Badge>
              <span className="font-medium">
                {new Date(e.date + "T00:00:00").toLocaleDateString("it-IT", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
              </span>
              {e.is_available && e.city && (
                <span className="inline-flex items-center gap-1 text-foreground">
                  <MapPin className="h-3.5 w-3.5 text-primary" />
                  {e.city}{e.district ? ` · ${e.district}` : ""}
                  {e.radius_km ? ` · entro ${e.radius_km} km` : ""}
                </span>
              )}
              {e.is_available && e.time_slot && (
                <Badge variant="secondary">{SLOT_LABELS[e.time_slot]}</Badge>
              )}
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
                onClick={() => removeExceptionGated(e.id)}
                aria-label="Rimuovi disponibilità speciale"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </section>

      {/* Duplicate dialog */}
      <Dialog open={duplicateFrom != null} onOpenChange={(open) => { if (!open) setDuplicateFrom(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Duplica {duplicateFrom != null ? DAY_LABELS[duplicateFrom] : ""} su altri giorni
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Verranno copiati città, zona, raggio, fasce orarie e note. I dati esistenti sui giorni selezionati saranno sovrascritti.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {DAY_LABELS.map((lbl, idx) => (
                <label key={idx} className={`flex items-center gap-2 rounded-lg border p-2 text-sm ${idx === duplicateFrom ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}>
                  <input
                    type="checkbox"
                    disabled={idx === duplicateFrom}
                    checked={duplicateTargets[idx]}
                    onChange={(e) => setDuplicateTargets((t) => t.map((v, i) => (i === idx ? e.target.checked : v)))}
                    className="h-4 w-4"
                  />
                  {lbl}
                </label>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDuplicateFrom(null)} disabled={copying}>Annulla</Button>
            <Button onClick={applyDuplicate} disabled={!duplicateTargets.some(Boolean) || copying || saving}>
              {copying ? "Copia in corso…" : "Applica"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmClear} onOpenChange={setConfirmClear}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancella tutte le disponibilità</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Stai per cancellare tutte le disponibilità impostate. Vuoi continuare?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmClear(false)}>Annulla</Button>
            <Button variant="destructive" onClick={clearAll}>Cancella tutto</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preset confirmation dialog */}
      <Dialog open={!!confirmPreset} onOpenChange={(open) => { if (!open) setConfirmPreset(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirmPreset?.title}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{confirmPreset?.message}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmPreset(null)}>Annulla</Button>
            <Button onClick={applyPreset}>Applica</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="mt-8 text-center">
        <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">
          ← Torna alla dashboard
        </Link>
      </div>
    </AppShell>
  );
}
