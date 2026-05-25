import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell, PageHeader } from "@/components/AppShell";
import { useAuth } from "@/lib/auth-context";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Calendar,
  MapPin,
  Euro,
  MessageSquare,
  Briefcase,
  Store,
  Clock,
  Star,
  ShieldCheck,
  Info,
} from "lucide-react";
import { formatTariff, formatTotalService } from "@/lib/format";
import { publicLocationLabel } from "@/lib/public-location";
import { venueTypeLabel } from "@/lib/venue-types";

function roleEmoji(role: string | null | undefined): string {
  const r = (role || "").toLowerCase();
  if (r.includes("camer")) return "🍽️";
  if (r.includes("barman") || r.includes("bartender") || r.includes("barista")) return "🍸";
  if (r.includes("cuoc") || r.includes("chef") || r.includes("cucina")) return "👨‍🍳";
  if (r.includes("lavapiatti") || r.includes("plonge")) return "🧽";
  if (r.includes("pizz")) return "🍕";
  if (r.includes("hostess") || r.includes("steward") || r.includes("accogli")) return "🎀";
  if (r.includes("runner")) return "🏃";
  if (r.includes("sommelier")) return "🍷";
  if (r.includes("commis")) return "🧑‍🍳";
  return "💼";
}

export const Route = createFileRoute("/jobs")({
  head: () => ({ meta: [{ title: "Offerte ricevute — Pupillo" }] }),
  component: () => (
    <RequireAuth>
      <Jobs />
    </RequireAuth>
  ),
});

type Announcement = {
  id: string;
  service_date: string;
  service_time: string;
  end_time: string | null;
  duration_hours: number;
  tariff_amount: number;
  tariff_type: string;
  speed: string;
  job_city: string | null;
  job_province: string | null;
  assigned_worker_id: string | null;
  professional_profile: string | null;
  notes: string | null;
  required_skills: string[] | null;
  dress_code_items: string[] | null;
  dress_code_notes: string | null;
};

type RestaurantPublic = {
  id: string;
  full_name: string | null;
  business_name: string | null;
  city: string | null;
  neighborhood: string | null;
  venue_type: string | null;
  venue_type_other: string | null;
  // Sensitive — only revealed once the offer is mutually confirmed
  phone_full: string | null;
  email: string | null;
  address: string | null;
  street: string | null;
  street_number: string | null;
  contact_person_first_name: string | null;
  contact_person_last_name: string | null;
  contact_person_phone: string | null;
};

type ShiftLite = {
  id: string;
  announcement_id: string | null;
  restaurant_id: string;
  status: "scheduled" | "completed" | "no_show" | "cancelled";
  shift_date: string;
};

type Row = {
  id: string;
  status: string;
  created_at: string;
  restaurant_id: string;
  worker_response_at: string | null;
  announcement: Announcement | null;
  restaurant: RestaurantPublic | null;
  shift: ShiftLite | null;
  hasWorkerReview: boolean;
  lastMessage: string | null;
};

type Bucket =
  | "nuove"
  | "da_rispondere"
  | "accettate"
  | "rifiutate"
  | "scadute"
  | "da_recensire";

type SortMode = "service_date" | "received" | "tariff" | "role" | "status";

const SEEN_KEY = "pupillo.jobs.lastSeenAt";

function isMutuallyConfirmed(r: Row): boolean {
  return r.status === "accepted";
}

function isCompleted(r: Row): boolean {
  return r.shift?.status === "completed";
}

function isCancelled(r: Row): boolean {
  if (r.shift?.status === "cancelled") return true;
  if (
    r.status === "not_interested" ||
    r.status === "rejected" ||
    r.status === "expired" ||
    r.status === "cancelled"
  ) return true;
  return false;
}

/** Buckets the offer belongs to. An offer can match more than one (e.g. confermata + da_recensire). */
function bucketsFor(r: Row, lastSeenAt: number): Bucket[] {
  const out: Bucket[] = [];
  if (isCompleted(r)) {
    if (!r.hasWorkerReview) out.push("da_recensire");
    else out.push("accettate");
    return out;
  }
  if (isCancelled(r)) {
    if (r.status === "expired" || r.status === "cancelled" || r.shift?.status === "cancelled")
      out.push("scadute");
    else if (r.status === "rejected" || r.status === "not_interested") out.push("rifiutate");
    else out.push("scadute");
    return out;
  }
  if (isMutuallyConfirmed(r)) {
    out.push("accettate");
    return out;
  }
  if (r.status === "pending") {
    out.push("da_rispondere");
    if (new Date(r.created_at).getTime() > lastSeenAt) out.push("nuove");
    return out;
  }
  if (r.status === "interested") {
    out.push("accettate");
    return out;
  }
  if (r.status === "counter_offer") {
    out.push("accettate");
    return out;
  }
  return out;
}

function statusBadge(r: Row, isNew: boolean): { label: string; cls: string } {
  if (isCompleted(r)) {
    if (!r.hasWorkerReview)
      return { label: "Da recensire", cls: "bg-amber-100 text-amber-900 border-amber-200" };
    return { label: "Completata", cls: "bg-emerald-100 text-emerald-900 border-emerald-200" };
  }
  if (r.shift?.status === "cancelled")
    return { label: "Annullata", cls: "bg-muted text-muted-foreground border-border" };
  if (r.status === "cancelled")
    return { label: "Annullata", cls: "bg-amber-100 text-amber-900 border-amber-200" };
  if (r.status === "accepted")
    return { label: "Confermata da entrambi", cls: "bg-emerald-100 text-emerald-900 border-emerald-200" };
  if (r.status === "rejected") {
    return {
      label: "Candidatura rifiutata",
      cls: "bg-rose-100 text-rose-900 border-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30",
    };
  }
  if (r.status === "not_interested")
    return {
      label: "Hai rifiutato",
      cls: "bg-rose-100 text-rose-900 border-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30",
    };
  if (r.status === "expired")
    return { label: "Scaduta", cls: "bg-muted text-muted-foreground border-border" };
  if (r.status === "counter_offer")
    return { label: "In attesa conferma ristoratore", cls: "bg-sky-100 text-sky-900 border-sky-200" };
  if (r.status === "interested")
    return { label: "Accettata da te", cls: "bg-sky-100 text-sky-900 border-sky-200" };
  if (r.status === "pending")
    return isNew
      ? { label: "Nuova offerta", cls: "bg-primary/15 text-primary border-primary/30" }
      : { label: "Da rispondere", cls: "bg-amber-100 text-amber-900 border-amber-200" };
  return { label: r.status, cls: "bg-secondary text-foreground border-border" };
}

const TABS: {
  key: Bucket;
  label: string;
  // Tailwind classes for active and inactive states (light + dark friendly).
  activeCls: string;
  inactiveCls: string;
  badgeActiveCls: string;
  badgeInactiveCls: string;
}[] = [
  {
    key: "nuove",
    label: "Nuove",
    activeCls:
      "bg-sky-500 text-white border-sky-500 shadow-md shadow-sky-500/30",
    inactiveCls:
      "bg-sky-50 text-sky-800 border-sky-200 hover:bg-sky-100 dark:bg-sky-500/10 dark:text-sky-200 dark:border-sky-500/30 dark:hover:bg-sky-500/20",
    badgeActiveCls: "bg-white/25 text-white",
    badgeInactiveCls: "bg-sky-500/20 text-sky-900 dark:bg-sky-400/20 dark:text-sky-100",
  },
  {
    key: "da_rispondere",
    label: "Da rispondere",
    activeCls:
      "bg-orange-500 text-white border-orange-500 shadow-md shadow-orange-500/30",
    inactiveCls:
      "bg-orange-50 text-orange-800 border-orange-200 hover:bg-orange-100 dark:bg-orange-500/10 dark:text-orange-200 dark:border-orange-500/30 dark:hover:bg-orange-500/20",
    badgeActiveCls: "bg-white/25 text-white",
    badgeInactiveCls: "bg-orange-500/20 text-orange-900 dark:bg-orange-400/20 dark:text-orange-100",
  },
  {
    key: "accettate",
    label: "Accettate",
    activeCls:
      "bg-emerald-500 text-white border-emerald-500 shadow-md shadow-emerald-500/30",
    inactiveCls:
      "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-200 dark:border-emerald-500/30 dark:hover:bg-emerald-500/20",
    badgeActiveCls: "bg-white/25 text-white",
    badgeInactiveCls: "bg-emerald-500/20 text-emerald-900 dark:bg-emerald-400/20 dark:text-emerald-100",
  },
  {
    key: "rifiutate",
    label: "Rifiutate",
    activeCls:
      "bg-rose-500 text-white border-rose-500 shadow-md shadow-rose-500/30",
    inactiveCls:
      "bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100 dark:bg-rose-500/10 dark:text-rose-200 dark:border-rose-500/30 dark:hover:bg-rose-500/20",
    badgeActiveCls: "bg-white/25 text-white",
    badgeInactiveCls: "bg-rose-500/20 text-rose-900 dark:bg-rose-400/20 dark:text-rose-100",
  },
  {
    key: "scadute",
    label: "Scadute",
    activeCls:
      "bg-slate-600 text-white border-slate-600 shadow-md shadow-slate-600/30",
    inactiveCls:
      "bg-slate-100 text-slate-800 border-slate-200 hover:bg-slate-200 dark:bg-slate-500/10 dark:text-slate-200 dark:border-slate-500/30 dark:hover:bg-slate-500/20",
    badgeActiveCls: "bg-white/25 text-white",
    badgeInactiveCls: "bg-slate-500/20 text-slate-900 dark:bg-slate-400/20 dark:text-slate-100",
  },
  {
    key: "da_recensire",
    label: "Da recensire",
    activeCls:
      "bg-violet-500 text-white border-violet-500 shadow-md shadow-violet-500/30",
    inactiveCls:
      "bg-violet-50 text-violet-800 border-violet-200 hover:bg-violet-100 dark:bg-violet-500/10 dark:text-violet-200 dark:border-violet-500/30 dark:hover:bg-violet-500/20",
    badgeActiveCls: "bg-white/25 text-white",
    badgeInactiveCls: "bg-violet-500/20 text-violet-900 dark:bg-violet-400/20 dark:text-violet-100",
  },
];

function priorityFor(r: Row, isNew: boolean): number {
  // Lower = shown first
  if (isNew) return 0;
  if (r.status === "pending") return 1;
  if (r.status === "interested" || r.status === "counter_offer") return 3;
  if (r.status === "accepted") return 4;
  if (isCompleted(r) && !r.hasWorkerReview) return 5;
  if (isCompleted(r)) return 6;
  return 7; // cancelled/rejected/expired
}

function Jobs() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Bucket>("nuove");
  const [sortMode, setSortMode] = useState<SortMode>("service_date");
  const [lastSeenAt] = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    const raw = window.localStorage.getItem(SEEN_KEY);
    return raw ? Number(raw) : 0;
  });

  const load = async () => {
    if (!user) return;
    const { data: apps } = await supabase
      .from("applications")
      .select(
        "id, status, created_at, restaurant_id, announcement_id, worker_response_at, last_message_preview",
      )
      .eq("worker_id", user.id)
      .order("created_at", { ascending: false });

    const annIds = (apps ?? []).map((a) => a.announcement_id).filter(Boolean);
    const restIds = Array.from(new Set((apps ?? []).map((a) => a.restaurant_id)));
    const [{ data: anns }, { data: rests }, { data: shifts }, { data: revs }] = await Promise.all([
      annIds.length
        ? supabase
            .from("announcements")
            .select(
              "id, service_date, service_time, end_time, duration_hours, tariff_amount, tariff_type, speed, job_city, job_province, assigned_worker_id, professional_profile, notes, required_skills, dress_code_items, dress_code_notes",
            )
            .in("id", annIds)
        : Promise.resolve({ data: [] as any[] }),
      restIds.length
        ? supabase
            .from("profiles")
            .select(
              "id, full_name, business_name, city, neighborhood, venue_type, venue_type_other, phone_full, email, address, street, street_number, contact_person_first_name, contact_person_last_name, contact_person_phone",
            )
            .in("id", restIds)
        : Promise.resolve({ data: [] as any[] }),
      annIds.length
        ? supabase
            .from("shifts")
            .select("id, announcement_id, restaurant_id, status, shift_date")
            .eq("worker_id", user.id)
            .in("announcement_id", annIds)
        : Promise.resolve({ data: [] as any[] }),
      supabase
        .from("reviews")
        .select("application_id")
        .eq("author_id", user.id),
    ]);
    const annMap = new Map((anns ?? []).map((a: any) => [a.id, a]));
    const restMap = new Map((rests ?? []).map((r: any) => [r.id, r]));
    const shiftByAnn = new Map((shifts ?? []).map((s: any) => [s.announcement_id, s]));
    const reviewedAppIds = new Set((revs ?? []).map((r: any) => r.application_id).filter(Boolean));

    setRows(
      (apps ?? []).map((a: any) => {
        const ann = annMap.get(a.announcement_id) ?? null;
        return {
          id: a.id,
          status: a.status,
          created_at: a.created_at,
          restaurant_id: a.restaurant_id,
          worker_response_at: a.worker_response_at,
          announcement: ann,
          restaurant: restMap.get(a.restaurant_id) ?? null,
          shift: ann ? (shiftByAnn.get(ann.id) as ShiftLite | undefined) ?? null : null,
          hasWorkerReview: reviewedAppIds.has(a.id),
          lastMessage: a.last_message_preview ?? null,
        } as Row;
      }),
    );
    setLoading(false);
  };

  useEffect(() => {
    load();
    // Mark "now" as last seen on unmount so future visits compute "Nuove" correctly,
    // but only after rows have loaded once.
    return () => {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(SEEN_KEY, String(Date.now()));
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const respond = async (id: string, status: "interested" | "not_interested") => {
    const { error } = await supabase
      .from("applications")
      .update({ status, worker_response_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (status === "interested" && user) {
      const { data: existing } = await supabase
        .from("messages")
        .select("id")
        .eq("application_id", id)
        .eq("sender_id", user.id)
        .eq("message_type", "auto_application")
        .maybeSingle();
      if (!existing) {
        await supabase.from("messages").insert({
          application_id: id,
          sender_id: user.id,
          message_type: "auto_application",
          body:
            "Ciao! Ho inviato la mia candidatura per il turno pubblicato.\n\nSono disponibile nell'orario richiesto e resto a disposizione per conferma o ulteriori informazioni. A presto!",
        });
      }
      toast.success("Offerta accettata");
      navigate({ to: "/messages/$id", params: { id } });
      return;
    }
    toast.success("Offerta rifiutata");
    load();
  };

  // ---- counts & filtering ----
  const counts = useMemo(() => {
    const c: Record<Bucket, number> = {
      nuove: 0,
      da_rispondere: 0,
      accettate: 0,
      rifiutate: 0,
      scadute: 0,
      da_recensire: 0,
    };
    for (const r of rows) for (const b of bucketsFor(r, lastSeenAt)) c[b] += 1;
    return c;
  }, [rows, lastSeenAt]);

  const filtered = useMemo(() => {
    const list = rows.filter((r) => bucketsFor(r, lastSeenAt).includes(tab));
    list.sort((a, b) => {
      if (sortMode === "service_date") {
        return (a.announcement?.service_date ?? "9999").localeCompare(b.announcement?.service_date ?? "9999");
      }
      if (sortMode === "received") {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      if (sortMode === "tariff") {
        return (b.announcement?.tariff_amount ?? 0) - (a.announcement?.tariff_amount ?? 0);
      }
      if (sortMode === "role") {
        return (a.announcement?.professional_profile ?? "").localeCompare(
          b.announcement?.professional_profile ?? "",
        );
      }
      // status — group by workflow priority
      const isNewA = a.status === "pending" && new Date(a.created_at).getTime() > lastSeenAt;
      const isNewB = b.status === "pending" && new Date(b.created_at).getTime() > lastSeenAt;
      return priorityFor(a, isNewA) - priorityFor(b, isNewB);
    });
    return list;
  }, [rows, tab, sortMode, lastSeenAt]);

  if (role !== "worker")
    return (
      <AppShell>
        <p className="text-muted-foreground">Sezione riservata ai lavoratori.</p>
      </AppShell>
    );


  return (
    <AppShell>
      <PageHeader
        title="Offerte per te"
        subtitle="Proposte ricevute dai ristoratori"
      />

      {/* Privacy hint */}
      <div className="mt-5 flex items-start gap-2 rounded-2xl border border-border/60 bg-muted/30 p-3 text-sm text-muted-foreground">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          Per proteggere entrambe le parti, i dati completi del locale vengono mostrati solo dopo la conferma
          reciproca del servizio.
        </span>
      </div>

      {/* Filtri — tab colorate, grandi, scrollabili su mobile e a griglia su desktop */}
      <div
        role="tablist"
        aria-label="Filtra offerte"
        className="mt-5 -mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-3 sm:overflow-visible sm:px-0 lg:grid-cols-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {TABS.map((t) => {
          const active = tab === t.key;
          const count = counts[t.key];
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.key)}
              className={
                "group flex shrink-0 items-center justify-between gap-2 rounded-2xl border-2 px-4 py-3 text-sm font-semibold tracking-tight transition-all duration-150 active:scale-[0.98] sm:px-4 sm:py-3.5 " +
                (active
                  ? `${t.activeCls} scale-[1.01]`
                  : t.inactiveCls)
              }
            >
              <span className="truncate">{t.label}</span>
              <span
                className={
                  "inline-flex min-w-[1.75rem] items-center justify-center rounded-full px-2 py-0.5 text-xs font-bold tabular-nums " +
                  (active ? t.badgeActiveCls : t.badgeInactiveCls)
                }
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Ordina per */}
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="font-medium">Ordina per:</span>
        {(
          [
            ["service_date", "Data servizio"],
            ["received", "Offerta più recente"],
            ["tariff", "Compenso più alto"],
            ["role", "Ruolo"],
            ["status", "Stato"],
          ] as [SortMode, string][]
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setSortMode(k)}
            className={
              "rounded-full border px-3 py-1 transition " +
              (sortMode === k
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-card hover:bg-accent")
            }
          >
            {label}
          </button>
        ))}
      </div>

      {/* Lista */}
      <div className="mt-6">
        {loading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-56 animate-pulse rounded-2xl border bg-card"
              />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-3xl border bg-card p-12 text-center shadow-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <Briefcase className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="mt-4 text-lg font-semibold">Non hai ancora ricevuto offerte</div>
            <div className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              Quando un ristoratore ti invierà una proposta di lavoro, la troverai qui con tutti i
              dettagli del turno.
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">
            Nessuna offerta in questa sezione.
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {filtered.map((r) => (
              <OfferCard key={r.id} r={r} lastSeenAt={lastSeenAt} onRespond={respond} />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function OfferCard({
  r,
  lastSeenAt,
  onRespond,
}: {
  r: Row;
  lastSeenAt: number;
  onRespond: (id: string, status: "interested" | "not_interested") => void;
}) {
  const isNew = r.status === "pending" && new Date(r.created_at).getTime() > lastSeenAt;
  const badge = statusBadge(r, isNew);
  const confirmed = isMutuallyConfirmed(r) || isCompleted(r);
  const venue = venueTypeLabel(r.restaurant?.venue_type, r.restaurant?.venue_type_other);
  const zone = publicLocationLabel({
    job_city: r.announcement?.job_city ?? null,
    city: r.restaurant?.city ?? null,
    neighborhood: r.restaurant?.neighborhood ?? null,
  });
  const role = r.announcement?.professional_profile || "Ruolo non specificato";
  const dateStr = r.announcement?.service_date
    ? new Date(r.announcement.service_date).toLocaleDateString("it-IT")
    : "—";
  const startTime = r.announcement?.service_time?.slice(0, 5);
  const endTime = r.announcement?.end_time?.slice(0, 5);
  const duration = r.announcement?.duration_hours;
  const totalDisplay = r.announcement
    ? formatTotalService(
        r.announcement.tariff_amount,
        r.announcement.tariff_type,
        r.announcement.duration_hours,
        r.announcement.service_time,
        r.announcement.end_time,
      )
    : null;
  const hourlyRate = r.announcement?.tariff_type === "hourly" ? r.announcement.tariff_amount : null;
  const durationH = r.announcement?.duration_hours;
  const tariff = r.announcement
    ? formatTariff(r.announcement.tariff_amount, r.announcement.tariff_type)
    : null;
  const receivedAt = new Date(r.created_at).toLocaleDateString("it-IT");

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-3xl border border-white/[0.06] bg-card p-5 shadow-[0_20px_50px_-25px_oklch(0_0_0/0.6)] transition-shadow hover:shadow-[0_24px_60px_-25px_oklch(0.65_0.25_310/0.35)] sm:p-6">
      {/* Top row: avatar + role/locale + badge */}
      <div className="flex items-start gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/25 to-accent/25 text-2xl ring-1 ring-white/10 sm:h-16 sm:w-16 sm:text-3xl">
          <span aria-hidden>{roleEmoji(role)}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-xl font-bold leading-tight text-foreground sm:text-2xl">
              {role}
            </h3>
            <span
              className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${badge.cls}`}
            >
              {badge.label}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <Store className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">
              {confirmed
                ? r.restaurant?.business_name || r.restaurant?.full_name || venue || "Ristoratore"
                : venue || "Ristorante partner"}
            </span>
          </div>
        </div>
      </div>

      {/* Key info row: date/time, location, compenso */}
      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
        <div className="space-y-1.5 text-sm">
          <div className="flex items-center gap-2 text-foreground">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="font-semibold">
              {dateStr}
              {startTime ? ` · ${startTime}` : ""}
              {endTime ? `–${endTime}` : ""}
            </span>
            {duration ? (
              <span className="text-xs text-muted-foreground">({duration}h)</span>
            ) : null}
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <MapPin className="h-4 w-4" />
            <span className="truncate">
              {confirmed && r.restaurant?.address ? r.restaurant.address : zone}
            </span>
          </div>
        </div>
        {totalDisplay ? (
          <div className="flex flex-col items-start gap-0.5 rounded-2xl bg-primary/10 px-4 py-2 ring-1 ring-primary/30 sm:items-end sm:text-right">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-primary/80">
              Totale servizio
            </span>
            <div className="flex items-center gap-1">
              <span className="text-2xl font-extrabold tracking-tight text-primary tabular-nums">
                {totalDisplay}
              </span>
            </div>
            {hourlyRate != null && durationH != null && (
              <span className="text-[10px] text-primary/70">
                Calcolato su €{hourlyRate}/ora per {durationH}h
              </span>
            )}
          </div>
        ) : tariff ? (
          <div className="flex items-center justify-start gap-1 rounded-2xl bg-primary/10 px-4 py-2 ring-1 ring-primary/30 sm:justify-end">
            <Euro className="h-4 w-4 text-primary" />
            <span className="text-xl font-extrabold tracking-tight text-primary tabular-nums">
              {tariff}
            </span>
          </div>
        ) : null}
      </div>

      {r.lastMessage && (
        <div className="mt-4 rounded-xl border border-border/60 bg-background/40 p-3 text-xs text-muted-foreground line-clamp-2">
          <span className="font-medium text-foreground">Messaggio: </span>
          {r.lastMessage}
        </div>
      )}

      {r.status === "rejected" && (
        <div
          role="status"
          className="mt-4 flex items-start gap-3 rounded-2xl border-2 border-rose-400/70 bg-rose-50 p-4 text-rose-900 shadow-sm dark:border-rose-500/50 dark:bg-rose-500/10 dark:text-rose-100"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-500 text-white">
            <X className="h-5 w-5" strokeWidth={3} />
          </div>
          <div className="min-w-0">
            <div className="text-base font-bold leading-tight sm:text-lg">
              Candidatura rifiutata
            </div>
            <div className="mt-0.5 text-xs text-rose-800/90 dark:text-rose-200/90 sm:text-sm">
              Il ristoratore ha scelto un altro candidato per questo turno.
            </div>
          </div>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Clock className="h-3 w-3" /> Ricevuta il {receivedAt}
        </span>
        {!confirmed && (
          <span className="inline-flex items-center gap-1">
            <Info className="h-3 w-3" /> Nome locale visibile dopo conferma
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {r.status === "pending" && (
          <>
            <Button
              size="lg"
              className="flex-1 rounded-xl text-base"
              onClick={() => onRespond(r.id, "interested")}
            >
              Accetta offerta
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="flex-1 rounded-xl text-base"
              onClick={() => onRespond(r.id, "not_interested")}
            >
              Rifiuta
            </Button>
          </>
        )}
        {(r.status === "interested" || r.status === "counter_offer" || r.status === "accepted") && (
          <Link to="/messages/$id" params={{ id: r.id }} className="flex-1">
            <Button size="lg" className="w-full gap-2 rounded-xl text-base">
              <MessageSquare className="h-4 w-4" />
              Scrivi al ristoratore
            </Button>
          </Link>
        )}
        {isCompleted(r) && !r.hasWorkerReview && (
          <Link to="/messages/$id" params={{ id: r.id }} className="flex-1">
            <Button size="lg" className="w-full gap-2 rounded-xl text-base">
              <Star className="h-4 w-4" />
              Lascia recensione
            </Button>
          </Link>
        )}
        <Link to="/messages/$id" params={{ id: r.id }} className="flex-1">
          <Button size="lg" variant="secondary" className="w-full gap-2 rounded-xl text-base">
            Apri dettagli
          </Button>
        </Link>
      </div>
    </div>
  );
}