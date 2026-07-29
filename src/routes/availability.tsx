import { createFileRoute, Link } from "@tanstack/react-router";
import { RequireAuth } from "@/components/RequireAuth";
import { RequireRole } from "@/components/RequireRole";
import { AppShell } from "@/components/AppShell";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { setMyAvailableNow } from "@/lib/profile-self-update";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  CalendarDays,
  Save,
  Plus,
  Trash2,
  Zap,
  MapPin,
  Copy,
  Sparkles,
  CalendarIcon,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Info,
  Repeat,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
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
import {
  addMonths,
  buildMonthGrid,
  dowOfIso,
  formatDateLong,
  formatMonthLabel,
  rangesOverlap,
  startOfMonth,
  toIso,
} from "@/lib/availability-calendar";
import { WORKER_CITIES, ALL_ZONES_OPTION, zonesForCity } from "@/lib/worker-cities";
import { useAvailableNowEnabled } from "@/lib/use-available-now-enabled";
import { useWorkerSpecialAvailabilityEnabled } from "@/lib/use-worker-special-availability-enabled";

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

/** Fasce principali mostrate nel pannello giorno (configurazione centralizzata). */
const PRIMARY_SLOTS: TimeSlot[] = ["colazione", "pranzo", "cena"];
/** Fasce secondarie, mantenute per compatibilità con i dati già salvati. */
const SECONDARY_SLOTS: TimeSlot[] = ["aperitivo", "serale", "intera_giornata", "last_minute"];
const PANEL_SLOTS: TimeSlot[] = [...PRIMARY_SLOTS, "personalizzata", ...SECONDARY_SLOTS];
const EXC_SLOTS: TimeSlot[] = ["colazione", "pranzo", "aperitivo", "cena", "serale", "intera_giornata", "last_minute", "personalizzata"];

const DAY_SHORT = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

const TIME_OPTIONS: string[] = (() => {
  const out: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 15, 30, 45]) {
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

let uidSeq = 0;
const nextUid = () => `s${++uidSeq}`;

type LocalSlot = {
  uid: string;
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

type WorkArea = {
  city: string;
  province: string;
  district: string;
  radius_km: number | null;
  notes: string;
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
  return { is_available: false, flexible: false, notes: "", slots: [], city, province, district, radius_km };
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

function slotLabelOf(s: LocalSlot): string {
  return SLOT_LABELS[s.time_slot] ?? s.time_slot;
}

function sameArea(d: DayState, a: WorkArea): boolean {
  return (
    (d.city || "") === (a.city || "") &&
    (d.district || "") === (a.district || "") &&
    (d.radius_km ?? null) === (a.radius_km ?? null)
  );
}

function AvailabilityPage() {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { requireCompleteForAvailability, canPerformOperationalAction } = useProfileGate();
  const { enabled: availableNowEnabled } = useAvailableNowEnabled();
  // Fail-closed: la sezione "Disponibilità speciali" esiste solo con flag ON.
  const { isEnabled: specialAvailabilityEnabled } = useWorkerSpecialAvailabilityEnabled();

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
  const [area, setArea] = useState<WorkArea>({ city: "", province: "", district: "", radius_km: null, notes: "" });
  const [exceptions, setExceptions] = useState<AvailabilityExceptionRow[]>([]);
  const [newExc, setNewExc] = useState<NewExc>(() => emptyNewExc());
  const [availableNow, setAvailableNow] = useState(false);
  const [availableNowUntil, setAvailableNowUntil] = useState<string | null>(null);
  const [availableNowDuration, setAvailableNowDuration] = useState<"2h" | "today" | "tonight">("2h");

  const [month, setMonth] = useState<Date>(() => startOfMonth(new Date()));
  const [selectedDates, setSelectedDates] = useState<string[]>(() => [toIso(new Date())]);

  const [copyOpen, setCopyOpen] = useState(false);
  const [copyTargets, setCopyTargets] = useState<boolean[]>(() => Array.from({ length: 7 }, () => false));
  const [copying, setCopying] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmApplyArea, setConfirmApplyArea] = useState(false);
  const [howItWorks, setHowItWorks] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [addingException, setAddingException] = useState(false);
  type ExcErrors = Partial<Record<"date" | "is_available" | "time_slot" | "city" | "district" | "radius_km" | "time", string>>;
  const [excErrors, setExcErrors] = useState<ExcErrors>({});
  const loadedRef = useRef(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const rowsRes = await supabase.from("worker_availability").select("*").eq("worker_id", user.id);
      if (cancelled) return;
      const rows = (rowsRes.data ?? []) as unknown as AvailabilityRow[];
      const next: DayState[] = Array.from({ length: 7 }, () =>
        emptyDay(defaults.city, defaults.province, defaults.district, defaults.radius_km),
      );
      rows.forEach((r) => {
        const d = next[r.day_of_week];
        if (!d) return;
        d.is_available = true;
        if (r.city) d.city = r.city;
        if (r.province) d.province = r.province;
        if (r.district) d.district = r.district;
        if (r.radius_km != null) d.radius_km = r.radius_km;
        if (r.time_slot === "flessibile") {
          d.flexible = true;
        } else {
          d.slots.push({
            uid: nextUid(),
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
      // Area di lavoro: valore prevalente fra i giorni attivi, altrimenti default profilo.
      const active = next.filter((d) => d.is_available && d.city);
      const base = active[0];
      setArea({
        city: base?.city || defaults.city,
        province: base?.province || defaults.province,
        district: base?.district || defaults.district,
        radius_km: base?.radius_km ?? defaults.radius_km,
        notes: base?.notes || "",
      });
      setNewExc(emptyNewExc(defaults.city, defaults.province, defaults.district, defaults.radius_km));
      const until = (profile as { available_now_until?: string | null } | null)?.available_now_until ?? null;
      if (until && new Date(until).getTime() > Date.now()) {
        setAvailableNow(true);
        setAvailableNowUntil(until);
      }
      setLoading(false);
      setTimeout(() => { loadedRef.current = true; setDirty(false); }, 0);
    })();
    return () => { cancelled = true; };
  }, [user, profile, defaults.city, defaults.province, defaults.district, defaults.radius_km]);

  // Disponibilità speciali: nessuna query quando il flag è OFF/loading/error.
  useEffect(() => {
    if (!user || !specialAvailabilityEnabled) {
      setExceptions([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("worker_availability_exceptions")
        .select("*")
        .eq("worker_id", user.id)
        .order("date", { ascending: true });
      if (cancelled) return;
      setExceptions((data ?? []) as unknown as AvailabilityExceptionRow[]);
    })();
    return () => { cancelled = true; };
  }, [user, specialAvailabilityEnabled]);

  useEffect(() => {
    if (!loadedRef.current) return;
    setDirty(true);
  }, [days]);

  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "Hai modifiche non salvate. Vuoi uscire senza salvare?";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  // ─────────── Selezione calendario → giorni della settimana ───────────
  const selectedDows = useMemo(() => {
    const set = new Set<number>();
    selectedDates.forEach((iso) => set.add(dowOfIso(iso)));
    return [...set].sort((a, b) => a - b);
  }, [selectedDates]);

  const primaryDow = selectedDows.length > 0 ? selectedDows[0] : null;

  const toggleDate = (iso: string) => {
    setSelectedDates((prev) =>
      prev.includes(iso) ? prev.filter((x) => x !== iso) : [...prev, iso].sort(),
    );
  };

  const applyToSelected = useCallback(
    (fn: (d: DayState) => DayState) => {
      setDays((prev) => prev.map((d, i) => (selectedDows.includes(i) ? fn(d) : d)));
    },
    [selectedDows],
  );

  // ─────────── Editing fasce ───────────
  const setDayAvailable = (on: boolean) =>
    applyToSelected((d) => ({
      ...d,
      is_available: on,
      city: on ? (d.city || area.city) : d.city,
      province: on ? (d.province || area.province) : d.province,
      district: on ? (d.district || area.district) : d.district,
      radius_km: on ? (d.radius_km ?? area.radius_km) : d.radius_km,
    }));

  const addSlot = (slot: TimeSlot) => {
    const def = SLOT_DEFAULT_TIMES[slot];
    applyToSelected((d) => ({
      ...d,
      is_available: true,
      city: d.city || area.city,
      province: d.province || area.province,
      district: d.district || area.district,
      radius_km: d.radius_km ?? area.radius_km,
      slots: [
        ...d.slots,
        {
          uid: nextUid(),
          time_slot: slot,
          start_time: def.start ?? (slot === "personalizzata" ? "18:00" : null),
          end_time: def.end ?? (slot === "personalizzata" ? "23:00" : null),
          is_flexible: false,
          is_last_minute: slot === "last_minute",
        },
      ],
    }));
  };

  const removeSlot = (uid: string) =>
    applyToSelected((d) => ({ ...d, slots: d.slots.filter((s) => s.uid !== uid) }));

  const patchSlot = (uid: string, patch: Partial<LocalSlot>) =>
    applyToSelected((d) => ({
      ...d,
      slots: d.slots.map((s) => (s.uid === uid ? { ...s, ...patch } : s)),
    }));

  const setSlotType = (uid: string, slot: TimeSlot) => {
    const def = SLOT_DEFAULT_TIMES[slot];
    applyToSelected((d) => ({
      ...d,
      slots: d.slots.map((s) =>
        s.uid === uid
          ? {
              ...s,
              time_slot: slot,
              is_last_minute: slot === "last_minute",
              start_time: slot === "personalizzata" ? (s.start_time ?? "18:00") : def.start,
              end_time: slot === "personalizzata" ? (s.end_time ?? "23:00") : def.end,
            }
          : s,
      ),
    }));
  };

  const setFlexible = (on: boolean) =>
    applyToSelected((d) => ({ ...d, flexible: on, is_available: on || d.is_available }));

  // ─────────── Area di lavoro ───────────
  const setAreaCity = (city: string) => {
    const zones = zonesForCity(city);
    const keep = area.district && zones.includes(area.district) ? area.district : ALL_ZONES_OPTION;
    setArea((a) => ({ ...a, city, province: provinceForCity(city), district: keep }));
  };

  const applyAreaToAllDays = () => {
    setDays((prev) =>
      prev.map((d) =>
        d.is_available
          ? { ...d, city: area.city, province: area.province, district: area.district, radius_km: area.radius_km, notes: area.notes }
          : d,
      ),
    );
    setConfirmApplyArea(false);
    toast.success("Area di lavoro applicata a tutti i giorni disponibili.");
  };

  // ─────────── Validazione + salvataggio ───────────
  const validateBeforeSave = (list: DayState[] = days): string | null => {
    for (let i = 0; i < list.length; i++) {
      const d = list[i];
      if (!d.is_available) continue;
      if (!d.city || !d.city.trim()) {
        return `Seleziona la città nell'area di lavoro (${DAY_LABELS[i]}).`;
      }
      if (!d.flexible && d.slots.length === 0) {
        return `Indica almeno una fascia oraria per ${DAY_LABELS[i]}.`;
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
      const ranges = d.slots.filter((s) => s.time_slot !== "last_minute" && s.start_time && s.end_time);
      for (let a = 0; a < ranges.length; a++) {
        for (let b = a + 1; b < ranges.length; b++) {
          const ra = ranges[a];
          const rb = ranges[b];
          if (rangesOverlap(ra.start_time as string, ra.end_time as string, rb.start_time as string, rb.end_time as string)) {
            return `Le fasce orarie di ${DAY_LABELS[i]} si sovrappongono.`;
          }
        }
      }
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
      setLastSavedAt(new Date());
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

  // ─────────── Copia su altri giorni ───────────
  const openCopy = () => {
    if (primaryDow == null) return;
    setCopyTargets(Array.from({ length: 7 }, () => false));
    setCopyOpen(true);
  };

  const applyCopy = async () => {
    if (primaryDow == null) return;
    const src = days[primaryDow];
    const next = days.map((d, i) =>
      i === primaryDow || !copyTargets[i]
        ? d
        : { ...src, slots: src.slots.map((s) => ({ ...s, uid: nextUid(), id: undefined })) },
    );
    setDays(next);
    setCopying(true);
    try {
      const ok = await persistAll(next, { silent: true });
      if (ok) {
        setCopyOpen(false);
        toast.success("Disponibilità copiata e salvata correttamente.");
      } else {
        toast.error("Non è stato possibile copiare la disponibilità. Riprova.");
      }
    } finally {
      setCopying(false);
    }
  };

  const clearAll = () => {
    setDays(Array.from({ length: 7 }, () => emptyDay(area.city, area.province, area.district, area.radius_km)));
    setConfirmClear(false);
    toast.success("Tutte le disponibilità sono state cancellate.");
  };

  // ─────────── Disponibilità speciali (flag) ───────────
  const addException = async () => {
    if (!user || !specialAvailabilityEnabled) return;
    const errs: ExcErrors = {};
    if (!newExc.date) {
      errs.date = "Seleziona una data valida.";
    } else {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const picked = new Date(newExc.date + "T00:00:00");
      if (picked < today) errs.date = "Non puoi inserire una disponibilità speciale in una data passata.";
    }
    if (newExc.is_available) {
      if (!newExc.time_slot) errs.time_slot = "Seleziona una fascia oraria.";
      if (!newExc.city.trim()) errs.city = "Seleziona la città.";
      if (!newExc.district.trim()) errs.district = "Seleziona la zona o quartiere.";
      if (newExc.radius_km == null) errs.radius_km = "Seleziona il raggio massimo.";
      if (newExc.time_slot === "personalizzata") {
        if (!newExc.start_time || !newExc.end_time) {
          errs.time = "Inserisci orario di inizio e fine.";
        } else if (!isValidTimeRange(newExc.start_time, newExc.end_time)) {
          errs.time = "L'orario di inizio e fine non possono coincidere.";
        }
      }
    }
    if (Object.keys(errs).length > 0) {
      setExcErrors(errs);
      toast.error("Controlla i campi evidenziati.");
      return;
    }
    setExcErrors({});
    const dup = exceptions.find(
      (e) => e.date === newExc.date && (e.time_slot ?? "") === newExc.time_slot,
    );
    if (dup) {
      toast.error("Hai già inserito una disponibilità speciale per questa data e fascia.");
      return;
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
    setAddingException(true);
    try {
      const { data, error } = await supabase
        .from("worker_availability_exceptions")
        .insert(payload as never)
        .select("*")
        .single();
      if (error) {
        toast.error("Non è stato possibile aggiungere la disponibilità speciale. Riprova.");
        return;
      }
      setExceptions((e) => [...e, data as unknown as AvailabilityExceptionRow].sort((a, b) => a.date.localeCompare(b.date)));
      setNewExc(emptyNewExc(area.city, area.province, area.district, area.radius_km));
      toast.success("Disponibilità speciale aggiunta correttamente.");
    } finally {
      setAddingException(false);
    }
  };

  const removeException = async (id: string) => {
    if (!specialAvailabilityEnabled) return;
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
    const { error } = await setMyAvailableNow(until);
    if (error) {
      toast.error(error.message);
      setAvailableNow(!on);
    } else {
      toast.success(on ? "Sei visibile per proposte last minute" : "Disponibilità immediata disattivata");
    }
  };

  // ─────────── Derivati ───────────
  const grid = useMemo(() => buildMonthGrid(month), [month]);

  const monthSetCount = useMemo(
    () => grid.filter((c) => c.inMonth && !c.isPast && days[c.dow]?.is_available).length,
    [grid, days],
  );

  const summary = useMemo(() => {
    const active = days.filter((d) => d.is_available).length;
    const totalSlots = days.reduce((acc, d) => acc + d.slots.length + (d.flexible ? 1 : 0), 0);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const nextSpecial = exceptions
      .filter((e) => new Date(e.date + "T00:00:00") >= today)
      .sort((a, b) => a.date.localeCompare(b.date))[0] ?? null;
    return { active, totalSlots, nextSpecial };
  }, [days, exceptions]);

  const isEmpty = !loading && summary.active === 0 && exceptions.length === 0;

  const saveGated = requireCompleteForAvailability(save);
  const addExceptionGated = requireCompleteForAvailability(addException);
  const removeExceptionGated = requireCompleteForAvailability(removeException);
  const toggleAvailableNowGated = requireCompleteForAvailability(toggleAvailableNow);
  const gatedOpacity = canPerformOperationalAction ? "" : "opacity-70";

  const saveStatus: "saving" | "dirty" | "saved" | "idle" =
    saving ? "saving" : dirty ? "dirty" : lastSavedAt ? "saved" : "idle";

  const SAVE_PILL = {
    saving: { label: "Salvataggio…", cls: "border-primary/50 bg-primary/15 text-primary", Icon: Loader2, spin: true },
    dirty: { label: "Modifiche non salvate", cls: "border-amber-500/60 bg-amber-500/15 text-amber-700 dark:text-amber-300", Icon: AlertCircle, spin: false },
    saved: { label: "Tutto salvato", cls: "border-emerald-500/50 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300", Icon: CheckCircle2, spin: false },
    idle: { label: "Nessuna modifica", cls: "border-border bg-muted text-muted-foreground", Icon: CheckCircle2, spin: false },
  }[saveStatus];

  const panelDay = primaryDow != null ? days[primaryDow] : null;
  const selectionLabel =
    selectedDates.length === 0
      ? "Nessun giorno selezionato"
      : selectedDates.length === 1
        ? formatDateLong(selectedDates[0])
        : `${selectedDates.length} giorni selezionati`;
  const affectedLabel = selectedDows.map((d) => DAY_LABELS[d]).join(", ");

  return (
    <AppShell>
      {/* ───────── HEADER ───────── */}
      <header className="mb-5 rounded-2xl border bg-card/70 p-5 sm:p-6 shadow-sm">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="truncate text-2xl sm:text-3xl font-bold tracking-tight">Le mie disponibilità</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Imposta il tuo schema settimanale ricorrente scegliendo i giorni dal calendario.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setHowItWorks(true)}
              aria-label="Come funziona il calendario"
            >
              <Info className="h-5 w-5 text-muted-foreground" />
            </Button>
            <span className={cn(
              "hidden sm:inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors",
              SAVE_PILL.cls,
            )}>
              <SAVE_PILL.Icon className={cn("h-3.5 w-3.5", SAVE_PILL.spin && "animate-spin")} />
              {SAVE_PILL.label}
            </span>
            <Button
              onClick={saveGated}
              disabled={saving || loading || !dirty}
              size="lg"
              className={cn("hidden sm:inline-flex gap-2 shadow-sm min-w-[180px]", gatedOpacity)}
            >
              <Save className="h-4 w-4" />
              {saving ? "Salvataggio..." : "Salva disponibilità"}
            </Button>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/60 px-3 py-1.5 text-xs">
            <CalendarDays className="h-3.5 w-3.5 text-primary" />
            <strong className="tabular-nums">{summary.active}</strong>/7 giorni
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/60 px-3 py-1.5 text-xs">
            <Zap className="h-3.5 w-3.5 text-primary" />
            <strong className="tabular-nums">{summary.totalSlots}</strong> {summary.totalSlots === 1 ? "fascia" : "fasce"}
          </span>
          {area.city && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs text-foreground">
              <MapPin className="h-3.5 w-3.5 text-primary" />
              <strong>{area.city}</strong>{area.district ? ` · ${area.district}` : ""}
            </span>
          )}
          {summary.nextSpecial && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/60 px-3 py-1.5 text-xs text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5" />
              Speciale {new Date(summary.nextSpecial.date + "T00:00:00").toLocaleDateString("it-IT", { day: "2-digit", month: "short" })}
            </span>
          )}
        </div>

        <div className="sm:hidden mt-4">
          <span className={cn(
            "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors",
            SAVE_PILL.cls,
          )}>
            <SAVE_PILL.Icon className={cn("h-3.5 w-3.5", SAVE_PILL.spin && "animate-spin")} />
            {SAVE_PILL.label}
          </span>
        </div>
      </header>

      {dirty && (
        <div className="mb-5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <div className="flex items-start gap-3">
            <span className="relative flex h-2.5 w-2.5 shrink-0 mt-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-500 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-500" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-amber-600 dark:text-amber-400">Hai modifiche non salvate</p>
              <p className="text-xs text-amber-700/80 dark:text-amber-300/80 mt-0.5">
                Premi "Salva disponibilità" prima di uscire dalla pagina.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ───────── DISPONIBILE ORA ───────── */}
      {availableNowEnabled && (
        <Card className="mb-5 border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
          <CardContent className="p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex items-center gap-3 sm:flex-1 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                  <Zap className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="font-semibold">Disponibile ora</div>
                  <div className="text-xs sm:text-sm text-muted-foreground">
                    Attiva per ricevere proposte immediate, a prescindere dal calendario.
                  </div>
                  {availableNow && availableNowUntil && (
                    <div className="text-xs text-primary mt-1">
                      Attivo fino alle {new Date(availableNowUntil).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 sm:shrink-0">
                <Select value={availableNowDuration} onValueChange={(v) => setAvailableNowDuration(v as "2h" | "today" | "tonight")}>
                  <SelectTrigger className="w-full sm:w-[170px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2h">Prossime 2 ore</SelectItem>
                    <SelectItem value="today">Disponibile oggi</SelectItem>
                    <SelectItem value="tonight">Questa sera</SelectItem>
                  </SelectContent>
                </Select>
                <Switch checked={availableNow} onCheckedChange={toggleAvailableNowGated} aria-label="Disponibile ora" />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ───────── AREA DI LAVORO ───────── */}
      <Card className="mb-5">
        <CardHeader className="pb-3">
          <CardTitle className="text-base sm:text-lg flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" /> Area di lavoro
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Città, zona e raggio valgono per le nuove disponibilità che imposti. I giorni già salvati mantengono la
            loro area finché non premi "Applica a tutti i giorni".
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Città</label>
              <Select value={area.city || undefined} onValueChange={setAreaCity}>
                <SelectTrigger><SelectValue placeholder="Seleziona la città" /></SelectTrigger>
                <SelectContent>
                  {area.city && !WORKER_CITIES.includes(area.city as (typeof WORKER_CITIES)[number]) && (
                    <SelectItem value={area.city}>{area.city} (attuale)</SelectItem>
                  )}
                  {WORKER_CITIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Zona / quartiere</label>
              {(() => {
                const zones = zonesForCity(area.city);
                const dedup = Array.from(new Set([ALL_ZONES_OPTION, "Centro", ...zones.filter((z) => z !== "Centro")]));
                const showCurrent = area.district && !dedup.includes(area.district);
                return (
                  <Select
                    value={area.district || undefined}
                    onValueChange={(v) => setArea((a) => ({ ...a, district: v }))}
                    disabled={!area.city}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={area.city ? "Seleziona la zona" : "Prima seleziona la città"} />
                    </SelectTrigger>
                    <SelectContent>
                      {showCurrent && <SelectItem value={area.district}>{area.district} (attuale)</SelectItem>}
                      {dedup.map((z) => (
                        <SelectItem key={z} value={z}>{z}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                );
              })()}
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Provincia</label>
              <Input value={area.province} readOnly disabled placeholder="Auto" />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Raggio massimo</label>
              <Select
                value={area.radius_km != null ? String(area.radius_km) : undefined}
                onValueChange={(v) => setArea((a) => ({ ...a, radius_km: parseInt(v, 10) }))}
              >
                <SelectTrigger><SelectValue placeholder="Seleziona raggio" /></SelectTrigger>
                <SelectContent>
                  {RADIUS_OPTIONS.map((r) => (
                    <SelectItem key={r.value} value={String(r.value)}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Note per i ristoratori (facoltative)</label>
            <Input
              value={area.notes}
              onChange={(e) => setArea((a) => ({ ...a, notes: e.target.value }))}
              placeholder="Es. Mi sposto volentieri anche fuori zona con preavviso"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setConfirmApplyArea(true)} disabled={!area.city}>
              Applica a tutti i giorni disponibili
            </Button>
            <span className="text-xs text-muted-foreground">Sovrascrive l'area dei giorni già impostati.</span>
          </div>
        </CardContent>
      </Card>

      {isEmpty && (
        <Card className="mb-5 border-dashed border-2 bg-card/40">
          <CardContent className="p-8 text-center space-y-3">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
              <CalendarDays className="h-7 w-7 text-primary" />
            </div>
            <div className="font-semibold text-lg">Nessuna disponibilità impostata</div>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Tocca un giorno sul calendario e imposta le fasce orarie: verranno applicate a tutti i giorni della
              settimana corrispondenti.
            </p>
          </CardContent>
        </Card>
      )}

      {/* ───────── CALENDARIO MENSILE ───────── */}
      <Card className="mb-5 overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setMonth((m) => addMonths(m, -1))}
              aria-label="Mese precedente"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div className="text-center min-w-0">
              <CardTitle className="text-base sm:text-lg truncate">{formatMonthLabel(month)}</CardTitle>
              <p className="text-[11px] text-muted-foreground mt-0.5 tabular-nums">
                {monthSetCount} {monthSetCount === 1 ? "giorno impostato" : "giorni impostati"}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setMonth((m) => addMonths(m, 1))}
              aria-label="Mese successivo"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pb-5">
          <div className="grid grid-cols-7 gap-1 mb-2">
            {DAY_SHORT.map((d) => (
              <div key={d} className="text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
            {grid.map((c) => {
              const isSelected = selectedDates.includes(c.iso);
              const hasAvail = days[c.dow]?.is_available;
              const disabled = c.isPast;
              return (
                <button
                  key={c.iso}
                  type="button"
                  disabled={disabled}
                  onClick={() => toggleDate(c.iso)}
                  aria-pressed={isSelected}
                  aria-label={`${formatDateLong(c.iso)}${hasAvail ? " · disponibilità impostata" : ""}`}
                  className={cn(
                    "relative aspect-square rounded-xl border text-sm font-medium transition-all",
                    "flex flex-col items-center justify-center gap-1",
                    c.inMonth ? "text-foreground" : "text-muted-foreground/40",
                    disabled && "opacity-35 cursor-not-allowed",
                    isSelected
                      ? "border-primary bg-primary text-primary-foreground shadow-neon"
                      : hasAvail && c.inMonth
                        ? "border-primary/40 bg-primary/10 hover:bg-primary/15"
                        : "border-border/70 bg-card/50 hover:bg-muted/60",
                    c.isToday && !isSelected && "ring-1 ring-primary/60",
                  )}
                >
                  <span className="tabular-nums leading-none">{c.day}</span>
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      hasAvail && c.inMonth
                        ? isSelected ? "bg-primary-foreground" : "bg-primary"
                        : "bg-transparent",
                    )}
                    aria-hidden
                  />
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-primary" /> Disponibilità impostata
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-[4px] border border-primary bg-primary" /> Selezionato
            </span>
            {selectedDates.length > 0 && (
              <button
                type="button"
                className="ml-auto inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                onClick={() => setSelectedDates([])}
              >
                <X className="h-3.5 w-3.5" /> Deseleziona
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ───────── PANNELLO GIORNO ───────── */}
      {panelDay == null ? (
        <Card className="mb-6 border-dashed">
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Seleziona uno o più giorni sul calendario per impostare le fasce orarie.
          </CardContent>
        </Card>
      ) : (
        <Card className={cn("mb-6 border transition-colors", panelDay.is_available ? "border-primary/25 bg-card/80" : "bg-card/60")}>
          <CardHeader className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 space-y-0 pb-3">
            <div className="min-w-0">
              <CardTitle className="text-base sm:text-lg truncate">{selectionLabel}</CardTitle>
              <div className="mt-1 text-xs text-muted-foreground">
                {panelDay.is_available ? "Disponibile" : "Non disponibile"}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="hidden sm:inline text-xs font-medium text-muted-foreground">Disponibile</span>
              <Switch
                checked={panelDay.is_available}
                onCheckedChange={setDayAvailable}
                aria-label="Disponibile"
              />
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Avviso ricorrenza — sempre visibile */}
            <div className="flex items-start gap-2.5 rounded-xl border border-primary/25 bg-primary/5 px-3.5 py-3">
              <Repeat className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <p className="text-xs leading-relaxed text-muted-foreground">
                Le modifiche valgono per <strong className="text-foreground">tutti i {affectedLabel}</strong> in modo
                ricorrente, non solo per la data selezionata.
              </p>
            </div>

            {!panelDay.is_available ? (
              <div className="rounded-lg border border-dashed bg-muted/40 px-4 py-6 text-center text-sm text-muted-foreground">
                Attiva il selettore per impostare le fasce orarie.
              </div>
            ) : (
              <>
                {/* Area applicata a questo giorno */}
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/60 px-3 py-1.5">
                    <MapPin className="h-3.5 w-3.5 text-primary" />
                    {panelDay.city
                      ? `${panelDay.city}${panelDay.district ? ` · ${panelDay.district}` : ""}${panelDay.radius_km ? ` · ${panelDay.radius_km} km` : ""}`
                      : "Area non impostata"}
                  </span>
                  {panelDay.city && !sameArea(panelDay, area) && (
                    <Badge variant="secondary">Diversa dall'area di lavoro</Badge>
                  )}
                </div>

                {/* Fasce orarie */}
                <div className="space-y-2.5">
                  {panelDay.slots.length === 0 && !panelDay.flexible && (
                    <div className="rounded-lg border border-dashed bg-muted/30 px-4 py-4 text-center text-xs text-muted-foreground">
                      Nessuna fascia oraria. Aggiungine una qui sotto.
                    </div>
                  )}
                  {panelDay.slots.map((s) => (
                    <div key={s.uid} className="rounded-xl border bg-background/60 p-3">
                      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                        <Select value={s.time_slot} onValueChange={(v) => setSlotType(s.uid, v as TimeSlot)}>
                          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {PANEL_SLOTS.map((opt) => (
                              <SelectItem key={opt} value={opt}>{SLOT_LABELS[opt]}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeSlot(s.uid)}
                          aria-label={`Rimuovi fascia ${slotLabelOf(s)}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      {s.time_slot !== "last_minute" && (
                        <div className="mt-2.5 grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[11px] text-muted-foreground mb-1">Dalle</label>
                            <Select
                              value={s.start_time ?? ""}
                              onValueChange={(v) => patchSlot(s.uid, { start_time: v })}
                            >
                              <SelectTrigger className="h-9"><SelectValue placeholder="--:--" /></SelectTrigger>
                              <SelectContent className="max-h-64">
                                {TIME_OPTIONS.map((t) => (
                                  <SelectItem key={`s-${s.uid}-${t}`} value={t}>{t}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <label className="block text-[11px] text-muted-foreground mb-1">Alle</label>
                            <Select
                              value={s.end_time ?? ""}
                              onValueChange={(v) => patchSlot(s.uid, { end_time: v })}
                            >
                              <SelectTrigger className="h-9"><SelectValue placeholder="--:--" /></SelectTrigger>
                              <SelectContent className="max-h-64">
                                {TIME_OPTIONS.map((t) => (
                                  <SelectItem key={`e-${s.uid}-${t}`} value={t}>{t}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          {s.start_time && s.end_time && (
                            <div className="col-span-2 -mt-1 space-y-1">
                              {crossesMidnight(s.start_time, s.end_time) && (
                                <p className="text-[11px] text-muted-foreground">Termina il giorno successivo</p>
                              )}
                              {!isValidTimeRange(s.start_time, s.end_time) && (
                                <p className="text-[11px] text-destructive">Inizio e fine non possono coincidere.</p>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                      {s.time_slot === "personalizzata" && (
                        <div className="mt-2.5 flex flex-wrap gap-1.5">
                          {QUICK_RANGES.map((r) => (
                            <Button
                              key={r.label}
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 text-[11px]"
                              onClick={() => patchSlot(s.uid, { start_time: r.start, end_time: r.end })}
                            >
                              {r.label}
                            </Button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Aggiunta rapida fasce */}
                <div className="flex flex-wrap gap-2">
                  {PRIMARY_SLOTS.map((slot) => (
                    <Button key={slot} type="button" size="sm" variant="outline" className="gap-1.5" onClick={() => addSlot(slot)}>
                      <Plus className="h-3.5 w-3.5" /> {SLOT_LABELS[slot]}
                    </Button>
                  ))}
                  <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={() => addSlot("personalizzata")}>
                    <Plus className="h-3.5 w-3.5" /> Personalizza
                  </Button>
                </div>

                {/* Flessibile */}
                <label className="flex items-center justify-between gap-3 rounded-xl border bg-background/60 px-3.5 py-3">
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">Valuto in base alla proposta</span>
                    <span className="block text-xs text-muted-foreground">
                      Ricevi proposte anche fuori dalle fasce indicate.
                    </span>
                  </span>
                  <Switch checked={panelDay.flexible} onCheckedChange={setFlexible} aria-label="Valuto in base alla proposta" />
                </label>
              </>
            )}

            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="gap-2"
                onClick={openCopy}
                disabled={selectedDows.length !== 1}
              >
                <Copy className="h-4 w-4" /> Copia su tutta la settimana
              </Button>
              <Button type="button" variant="ghost" size="sm" className="gap-2 text-destructive" onClick={() => setConfirmClear(true)}>
                <Trash2 className="h-4 w-4" /> Cancella tutto
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ───────── DISPONIBILITÀ SPECIALI (feature flag) ───────── */}
      {specialAvailabilityEnabled && (
        <section className="mb-8">
          <div className="mb-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> Disponibilità speciali
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Eccezioni per date specifiche: hanno sempre la priorità sul calendario ricorrente.
            </p>
          </div>

          <Card>
            <CardContent className="grid gap-3 p-4 md:grid-cols-6">
              <div className="md:col-span-2">
                <label className="block text-xs text-muted-foreground mb-1">Data <span className="text-destructive">*</span></label>
                {(() => {
                  const today = new Date(); today.setHours(0, 0, 0, 0);
                  const selected = newExc.date ? new Date(newExc.date + "T00:00:00") : undefined;
                  const label = selected
                    ? selected.toLocaleDateString("it-IT", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" })
                    : "Seleziona una data";
                  return (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !selected && "text-muted-foreground",
                            excErrors.date && "border-destructive",
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          <span className="capitalize">{label}</span>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={selected}
                          onSelect={(d) => {
                            if (!d) return;
                            setNewExc({ ...newExc, date: toIso(d) });
                            setExcErrors((e) => ({ ...e, date: undefined }));
                          }}
                          disabled={(d) => d < today}
                          initialFocus
                          className={cn("p-3 pointer-events-auto")}
                        />
                      </PopoverContent>
                    </Popover>
                  );
                })()}
                {excErrors.date && <p className="text-xs text-destructive mt-1">{excErrors.date}</p>}
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs text-muted-foreground mb-1">Stato <span className="text-destructive">*</span></label>
                <Select value={newExc.is_available ? "yes" : "no"} onValueChange={(v) => setNewExc({ ...newExc, is_available: v === "yes" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">Disponibile</SelectItem>
                    <SelectItem value="no">Non disponibile</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs text-muted-foreground mb-1">Fascia {newExc.is_available && <span className="text-destructive">*</span>}</label>
                <Select
                  value={newExc.time_slot || undefined}
                  onValueChange={(v) => { setNewExc({ ...newExc, time_slot: v as TimeSlot }); setExcErrors((e) => ({ ...e, time_slot: undefined })); }}
                  disabled={!newExc.is_available}
                >
                  <SelectTrigger className={cn(excErrors.time_slot && "border-destructive")}>
                    <SelectValue placeholder="Seleziona una fascia" />
                  </SelectTrigger>
                  <SelectContent>
                    {EXC_SLOTS.map((s) => (
                      <SelectItem key={s} value={s}>{SLOT_LABELS[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {excErrors.time_slot && <p className="text-xs text-destructive mt-1">{excErrors.time_slot}</p>}
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs text-muted-foreground mb-1">Città {newExc.is_available && <span className="text-destructive">*</span>}</label>
                <Select
                  value={newExc.city || undefined}
                  onValueChange={(v) => {
                    const zones = zonesForCity(v);
                    const keepDistrict = newExc.district && zones.includes(newExc.district) ? newExc.district : ALL_ZONES_OPTION;
                    setNewExc({ ...newExc, city: v, province: provinceForCity(v), district: keepDistrict });
                    setExcErrors((e) => ({ ...e, city: undefined, district: undefined }));
                  }}
                  disabled={!newExc.is_available}
                >
                  <SelectTrigger className={cn(excErrors.city && "border-destructive")}>
                    <SelectValue placeholder="Seleziona la città" />
                  </SelectTrigger>
                  <SelectContent>
                    {newExc.city && !WORKER_CITIES.includes(newExc.city as (typeof WORKER_CITIES)[number]) && (
                      <SelectItem value={newExc.city}>{newExc.city} (attuale)</SelectItem>
                    )}
                    {WORKER_CITIES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {excErrors.city && <p className="text-xs text-destructive mt-1">{excErrors.city}</p>}
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs text-muted-foreground mb-1">Zona / quartiere {newExc.is_available && <span className="text-destructive">*</span>}</label>
                {(() => {
                  const zones = zonesForCity(newExc.city);
                  const dedup = Array.from(new Set([ALL_ZONES_OPTION, "Centro", ...zones.filter((z) => z !== "Centro")]));
                  const showCurrent = newExc.district && !dedup.includes(newExc.district);
                  return (
                    <Select
                      value={newExc.district || undefined}
                      onValueChange={(v) => { setNewExc({ ...newExc, district: v }); setExcErrors((e) => ({ ...e, district: undefined })); }}
                      disabled={!newExc.is_available || !newExc.city}
                    >
                      <SelectTrigger className={cn(excErrors.district && "border-destructive")}>
                        <SelectValue placeholder={newExc.city ? "Seleziona la zona" : "Prima seleziona la città"} />
                      </SelectTrigger>
                      <SelectContent>
                        {showCurrent && <SelectItem value={newExc.district}>{newExc.district} (attuale)</SelectItem>}
                        {dedup.map((z) => (
                          <SelectItem key={z} value={z}>{z}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  );
                })()}
                {excErrors.district && <p className="text-xs text-destructive mt-1">{excErrors.district}</p>}
              </div>

              <div>
                <label className="block text-xs text-muted-foreground mb-1">Provincia</label>
                <Input value={newExc.province} readOnly disabled placeholder="Auto" />
              </div>

              <div>
                <label className="block text-xs text-muted-foreground mb-1">Raggio {newExc.is_available && <span className="text-destructive">*</span>}</label>
                <Select
                  value={newExc.radius_km != null ? String(newExc.radius_km) : undefined}
                  onValueChange={(v) => { setNewExc({ ...newExc, radius_km: parseInt(v, 10) }); setExcErrors((e) => ({ ...e, radius_km: undefined })); }}
                  disabled={!newExc.is_available}
                >
                  <SelectTrigger className={cn(excErrors.radius_km && "border-destructive")}>
                    <SelectValue placeholder="Seleziona raggio" />
                  </SelectTrigger>
                  <SelectContent>
                    {RADIUS_OPTIONS.map((r) => (
                      <SelectItem key={r.value} value={String(r.value)}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {excErrors.radius_km && <p className="text-xs text-destructive mt-1">{excErrors.radius_km}</p>}
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
                      <SelectTrigger className={cn(excErrors.time && "border-destructive")}><SelectValue placeholder="Seleziona" /></SelectTrigger>
                      <SelectContent className="max-h-64">
                        {TIME_OPTIONS.map((t) => (
                          <SelectItem key={`xs-${t}`} value={t}>{t}</SelectItem>
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
                      <SelectTrigger className={cn(excErrors.time && "border-destructive")}><SelectValue placeholder="Seleziona" /></SelectTrigger>
                      <SelectContent className="max-h-64">
                        {TIME_OPTIONS.map((t) => (
                          <SelectItem key={`xe-${t}`} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {newExc.start_time && newExc.end_time && crossesMidnight(newExc.start_time, newExc.end_time) && (
                      <p className="text-[11px] text-muted-foreground mt-1">Termina il giorno successivo</p>
                    )}
                  </div>
                  {excErrors.time && (
                    <div className="md:col-span-6 -mt-2">
                      <p className="text-xs text-destructive">{excErrors.time}</p>
                    </div>
                  )}
                </>
              )}

              <div className="md:col-span-6">
                <label className="block text-xs text-muted-foreground mb-1">Note (facoltative)</label>
                <Input value={newExc.notes} onChange={(e) => setNewExc({ ...newExc, notes: e.target.value })} placeholder="Es. Sono a Milano per il weekend" />
              </div>
              <div className="md:col-span-6 flex justify-end">
                <Button onClick={addExceptionGated} disabled={addingException} className={`gap-2 ${gatedOpacity}`}>
                  <Plus className="h-4 w-4" /> {addingException ? "Aggiunta in corso…" : "Aggiungi disponibilità speciale"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="mt-4 space-y-3">
            {exceptions.length === 0 && (
              <div className="rounded-xl border border-dashed border-border/80 bg-card/40 p-7 text-center">
                <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-muted">
                  <Sparkles className="h-5 w-5 text-muted-foreground/70" />
                </div>
                <p className="mt-3 text-sm font-medium">Nessuna disponibilità speciale</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Aggiungi eccezioni per date specifiche, ad esempio festivi o giorni fuori routine.
                </p>
              </div>
            )}
            {exceptions.map((e) => (
              <div key={e.id} className="rounded-xl border border-border/80 bg-card/60 p-3.5 flex flex-wrap items-center gap-3 text-sm transition-colors hover:bg-card/80">
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
      )}

      {/* ───────── DIALOGS ───────── */}
      <Dialog open={howItWorks} onOpenChange={setHowItWorks}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Come funziona il calendario</DialogTitle>
            <DialogDescription>
              Il calendario è una vista sul tuo schema settimanale ricorrente.
            </DialogDescription>
          </DialogHeader>
          <ul className="space-y-2 text-sm text-muted-foreground list-disc pl-5">
            <li>Selezionando una data modifichi <strong className="text-foreground">tutti i giorni della settimana corrispondenti</strong> (es. tocca un mercoledì → vale per tutti i mercoledì).</li>
            <li>Puoi selezionare più date insieme: le modifiche si applicano a tutti i giorni della settimana coinvolti.</li>
            <li>Città, zona e raggio si impostano una sola volta nella sezione "Area di lavoro".</li>
            <li>Le date passate non sono selezionabili.</li>
          </ul>
          <DialogFooter>
            <Button onClick={() => setHowItWorks(false)}>Ho capito</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={copyOpen} onOpenChange={setCopyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Copia {primaryDow != null ? DAY_LABELS[primaryDow] : ""} su altri giorni
            </DialogTitle>
            <DialogDescription>
              Verranno copiate fasce orarie, area di lavoro e note. I giorni selezionati saranno sovrascritti.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => setCopyTargets(Array.from({ length: 7 }, (_, i) => i !== primaryDow))}>
                Tutta la settimana
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setCopyTargets(Array.from({ length: 7 }, (_, i) => i < 5 && i !== primaryDow))}>
                Solo feriali
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setCopyTargets(Array.from({ length: 7 }, (_, i) => i >= 5 && i !== primaryDow))}>
                Solo weekend
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {DAY_LABELS.map((lbl, idx) => (
                <label
                  key={idx}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border p-2 text-sm",
                    idx === primaryDow ? "opacity-40 cursor-not-allowed" : "cursor-pointer",
                  )}
                >
                  <input
                    type="checkbox"
                    disabled={idx === primaryDow}
                    checked={copyTargets[idx]}
                    onChange={(e) => setCopyTargets((t) => t.map((v, i) => (i === idx ? e.target.checked : v)))}
                    className="h-4 w-4"
                  />
                  {lbl}
                </label>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCopyOpen(false)} disabled={copying}>Annulla</Button>
            <Button onClick={applyCopy} disabled={!copyTargets.some(Boolean) || copying || saving}>
              {copying ? "Copia in corso…" : "Applica"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmApplyArea} onOpenChange={setConfirmApplyArea}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Applicare l'area a tutti i giorni?</DialogTitle>
            <DialogDescription>
              Città, zona, raggio e note verranno sovrascritti su tutti i giorni disponibili.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmApplyArea(false)}>Annulla</Button>
            <Button onClick={applyAreaToAllDays}>Applica</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmClear} onOpenChange={setConfirmClear}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancella tutte le disponibilità</DialogTitle>
            <DialogDescription>
              Stai per cancellare tutte le disponibilità impostate. Vuoi continuare?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmClear(false)}>Annulla</Button>
            <Button variant="destructive" onClick={clearAll}>Cancella tutto</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="mt-8 text-center">
        <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">
          ← Torna alla dashboard
        </Link>
      </div>

      {/* ───────── Sticky save bar (mobile) ───────── */}
      <div className="sm:hidden h-24" aria-hidden />
      <div className={cn(
        "sm:hidden fixed bottom-0 inset-x-0 z-40 border-t p-4 transition-colors",
        dirty
          ? "border-amber-500/30 bg-background/98 backdrop-blur supports-[backdrop-filter]:bg-background/90 shadow-[0_-8px_30px_-10px_rgba(0,0,0,0.3)]"
          : "border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80",
      )}>
        <div className="flex items-center gap-3">
          <span className={cn(
            "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold shrink-0",
            SAVE_PILL.cls,
          )}>
            <SAVE_PILL.Icon className={cn("h-3 w-3", SAVE_PILL.spin && "animate-spin")} />
            <span className="truncate max-w-[120px]">{SAVE_PILL.label}</span>
          </span>
          <Button
            onClick={saveGated}
            disabled={saving || loading || !dirty}
            className={cn("flex-1 gap-2 h-12 text-base font-semibold", gatedOpacity, dirty && "shadow-neon")}
          >
            <Save className="h-4 w-4" />
            {saving ? "Salvataggio..." : "Salva disponibilità"}
          </Button>
        </div>
      </div>
    </AppShell>
  );
}