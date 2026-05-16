// Logica condivisa per ordinare e raggruppare le conversazioni della pagina "Messaggi".
// Estratta in un modulo a parte per essere testabile in isolamento.

export type ThreadLike = {
  status: string;
  lastAt: string | null;
  createdAt: string | null;
  ann: { date: string | null; time: string | null } | null;
};

// Priorità del badge aggregato di gruppo.
// Più alto = più importante. Le proposte che richiedono un'azione vengono prima,
// poi gli esiti positivi, infine quelli conclusi/negativi.
export const STATUS_PRIORITY: Record<string, number> = {
  pending: 60,
  counter_offer: 55,
  interested: 50,
  accepted: 40,
  rejected: 20,
  expired: 10,
};

export const statusRank = (s: string): number => STATUS_PRIORITY[s] ?? 0;

// Chiave di recency: preferiamo l'ultimo messaggio; se manca, ripieghiamo
// sulla data di creazione della proposta e infine sulla data/ora del turno.
export function recencyKey(t: ThreadLike): string {
  if (t.lastAt) return t.lastAt;
  if (t.createdAt) return t.createdAt;
  if (t.ann?.date) return `${t.ann.date}T${t.ann.time ?? "00:00"}`;
  return "";
}

// Stato primario di un gruppo: vince la priorità più alta;
// a parità di priorità, vince la proposta più recente.
export function computePrimaryStatus<T extends ThreadLike>(threads: T[]): string | undefined {
  if (threads.length === 0) return undefined;
  return [...threads].sort((a, b) => {
    const pr = statusRank(b.status) - statusRank(a.status);
    if (pr !== 0) return pr;
    return recencyKey(b).localeCompare(recencyKey(a));
  })[0].status;
}

// Stato "effettivo" usato dai filtri utente: una proposta accettata il cui turno
// è già passato viene considerata "completed".
export function effectiveStatus(
  t: ThreadLike,
  now: Date = new Date(),
): string {
  if (t.status === "accepted" && t.ann?.date) {
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const d = new Date(t.ann.date);
    d.setHours(0, 0, 0, 0);
    if (d.getTime() < today.getTime()) return "completed";
  }
  return t.status;
}

// Forma minimale di un thread necessaria al filtro di ricerca e ai conteggi
// dei chip. Estratta qui per essere testabile senza renderizzare la pagina.
export type SearchableThread = ThreadLike & {
  other: { id: string; name: string };
  lastBody: string | null;
  unread: number;
};

// Replica della pre-filtrazione applicata in /messages: filtra per utente
// "focalizzato" (?with=) e per query testuale (nome controparte, ruolo,
// data/ora del turno, ultimo messaggio).
export function searchScopeThreads<T extends SearchableThread>(
  threads: T[],
  query: string,
  withUser: string,
): T[] {
  const q = query.trim().toLowerCase();
  return threads.filter((t) => {
    if (withUser && t.other.id !== withUser) return false;
    if (!q) return true;
    const role = t.ann?.role ?? "";
    const date = t.ann?.date
      ? new Date(t.ann.date).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" })
      : "";
    const time = t.ann?.time ? t.ann.time.slice(0, 5) : "";
    const hay = [
      t.other.name,
      role,
      date,
      time,
      t.ann?.date ?? "",
      t.lastBody ?? "",
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}

export type ChipCounts = {
  total: number;
  unread: number;
  byStatus: Record<string, number>;
};

// Calcola i conteggi dei chip (Tutte, Non lette, e per stato effettivo)
// a partire dai thread già passati per searchScopeThreads.
export function computeChipCounts<T extends SearchableThread>(
  scoped: T[],
  now: Date = new Date(),
): ChipCounts {
  const byStatus: Record<string, number> = {};
  let unread = 0;
  for (const t of scoped) {
    if (t.unread > 0) unread += 1;
    const eff = effectiveStatus(t, now);
    byStatus[eff] = (byStatus[eff] ?? 0) + 1;
  }
  return { total: scoped.length, unread, byStatus };
}