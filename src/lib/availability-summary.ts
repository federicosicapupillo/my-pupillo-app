// Sintesi della disponibilità settimanale del lavoratore.
// I valori in `weekly_availability` sono token tipo "lun_sera", "sab_pranzo".
// L'obiettivo è produrre 1–2 righe sintetiche da mostrare nelle card.

export type SlotKey = "mattina" | "pranzo" | "pomeriggio" | "sera" | "notte";

const DAY_ORDER = ["lun", "mar", "mer", "gio", "ven", "sab", "dom"] as const;
export type DayKey = (typeof DAY_ORDER)[number];

const DAY_LABEL: Record<DayKey, string> = {
  lun: "Lun", mar: "Mar", mer: "Mer", gio: "Gio", ven: "Ven", sab: "Sab", dom: "Dom",
};

const SLOT_LABEL: Record<SlotKey, string> = {
  mattina: "Mattina",
  pranzo: "Pranzo",
  pomeriggio: "Pomeriggio",
  sera: "Sera",
  notte: "Notte",
};

const SLOT_HOURS: Record<SlotKey, string> = {
  mattina: "09:00 - 12:00",
  pranzo: "12:00 - 15:00",
  pomeriggio: "15:00 - 18:00",
  sera: "19:00 - 23:00",
  notte: "23:00 - 03:00",
};

function parseToken(tok: string): { day: DayKey; slot: SlotKey } | null {
  const [d, s] = tok.toLowerCase().trim().split("_");
  if (!d || !s) return null;
  if (!(DAY_ORDER as readonly string[]).includes(d)) return null;
  if (!(s in SLOT_LABEL)) return null;
  return { day: d as DayKey, slot: s as SlotKey };
}

function todayKey(now = new Date()): DayKey {
  // getDay(): 0=dom, 1=lun, ..., 6=sab
  const map: DayKey[] = ["dom", "lun", "mar", "mer", "gio", "ven", "sab"];
  return map[now.getDay()];
}

function compressRange(days: DayKey[]): string {
  if (days.length === 0) return "";
  // ordina secondo DAY_ORDER
  const sorted = [...new Set(days)].sort(
    (a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b),
  );
  if (sorted.length === 7) return "Tutta la settimana";
  // verifica contiguità
  const idxs = sorted.map((d) => DAY_ORDER.indexOf(d));
  const contiguous = idxs.every((v, i) => i === 0 || v === idxs[i - 1] + 1);
  if (contiguous && sorted.length >= 2) {
    return `${DAY_LABEL[sorted[0]]} - ${DAY_LABEL[sorted[sorted.length - 1]]}`;
  }
  return sorted.map((d) => DAY_LABEL[d]).join(", ");
}

export type AvailabilitySummary =
  | { kind: "none" }
  | { kind: "today"; hours: string | null; slot: SlotKey | null }
  | { kind: "lines"; lines: string[]; totalDays: number; truncated: boolean }
  | { kind: "all_week"; hours: string | null }
  | { kind: "wide"; totalDays: number };

export function summarizeWeeklyAvailability(
  weekly: string[] | null | undefined,
  availableNowUntil?: string | null,
  now: Date = new Date(),
): AvailabilitySummary {
  // available_now_until ha priorità: il lavoratore si è dichiarato disponibile ora.
  if (availableNowUntil) {
    const until = new Date(availableNowUntil);
    if (!Number.isNaN(until.getTime()) && until.getTime() > now.getTime()) {
      const hh = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      const eh = `${String(until.getHours()).padStart(2, "0")}:${String(until.getMinutes()).padStart(2, "0")}`;
      return { kind: "today", hours: `${hh} - ${eh}`, slot: null };
    }
  }

  const tokens = (weekly ?? [])
    .map(parseToken)
    .filter((x): x is { day: DayKey; slot: SlotKey } => x != null);

  if (tokens.length === 0) return { kind: "none" };

  // Raggruppa per slot → giorni
  const bySlot = new Map<SlotKey, DayKey[]>();
  for (const { day, slot } of tokens) {
    const arr = bySlot.get(slot) ?? [];
    if (!arr.includes(day)) arr.push(day);
    bySlot.set(slot, arr);
  }
  const uniqueDays = new Set(tokens.map((t) => t.day));

  // CASO A: disponibile oggi
  const today = todayKey(now);
  const todaySlots = tokens.filter((t) => t.day === today).map((t) => t.slot);
  if (todaySlots.length > 0) {
    const slot = todaySlots[0];
    return { kind: "today", hours: SLOT_HOURS[slot], slot };
  }

  // CASO C: tutta la settimana (un singolo slot copre tutti e 7 i giorni)
  for (const [slot, days] of bySlot.entries()) {
    if (days.length === 7) {
      return { kind: "all_week", hours: SLOT_HOURS[slot] };
    }
  }

  // CASO D: troppi slot diversi → sintesi compatta
  if (bySlot.size > 2 || uniqueDays.size >= 6) {
    return { kind: "wide", totalDays: uniqueDays.size };
  }

  // CASO B: max 2 righe sintetiche
  const slotsOrder: SlotKey[] = ["mattina", "pranzo", "pomeriggio", "sera", "notte"];
  const lines: string[] = [];
  let count = 0;
  for (const slot of slotsOrder) {
    const days = bySlot.get(slot);
    if (!days || days.length === 0) continue;
    const range = compressRange(days);
    lines.push(`${range} · ${SLOT_HOURS[slot]}`);
    count++;
    if (count >= 2) break;
  }
  const truncated = bySlot.size > lines.length;
  return { kind: "lines", lines, totalDays: uniqueDays.size, truncated };
}

// Per il dialog "Vedi dettagli": dato un giorno, restituisce gli slot etichettati.
export function formatAvailabilitySlotsForDay(
  weekly: string[] | null | undefined,
): Array<{ day: string; slots: Array<{ label: string; hours: string }> }> {
  const tokens = (weekly ?? [])
    .map(parseToken)
    .filter((x): x is { day: DayKey; slot: SlotKey } => x != null);
  const byDay = new Map<DayKey, SlotKey[]>();
  for (const { day, slot } of tokens) {
    const arr = byDay.get(day) ?? [];
    if (!arr.includes(slot)) arr.push(slot);
    byDay.set(day, arr);
  }
  return DAY_ORDER.filter((d) => byDay.has(d)).map((d) => ({
    day: DAY_LABEL[d],
    slots: (byDay.get(d) ?? []).map((s) => ({
      label: SLOT_LABEL[s],
      hours: SLOT_HOURS[s],
    })),
  }));
}