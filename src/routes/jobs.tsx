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
import { formatTariff } from "@/lib/format";
import { publicLocationLabel } from "@/lib/public-location";
import { venueTypeLabel } from "@/lib/venue-types";

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
  | "accettate_da_me"
  | "in_attesa_conferma"
  | "confermate"
  | "completate"
  | "rifiutate"
  | "scadute"
  | "annullate"
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
    out.push("completate");
    if (!r.hasWorkerReview) out.push("da_recensire");
    return out;
  }
  if (isCancelled(r)) {
    if (r.status === "expired") out.push("scadute");
    else if (r.status === "rejected" || r.status === "not_interested") out.push("rifiutate");
    else out.push("annullate");
    return out;
  }
  if (isMutuallyConfirmed(r)) {
    out.push("confermate");
    return out;
  }
  if (r.status === "pending") {
    out.push("da_rispondere");
    if (new Date(r.created_at).getTime() > lastSeenAt) out.push("nuove");
    return out;
  }
  if (r.status === "interested") {
    out.push("accettate_da_me");
    out.push("in_attesa_conferma");
    return out;
  }
  if (r.status === "counter_offer") {
    out.push("in_attesa_conferma");
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
  if (r.status === "rejected")
    return {
      label: "Rifiutata dal ristoratore",
      cls: "bg-rose-100 text-rose-900 border-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30",
    };
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

const TABS: { key: "tutte" | Bucket; label: string }[] = [
  { key: "tutte", label: "Tutte" },
  { key: "nuove", label: "Nuove" },
  { key: "da_rispondere", label: "Da rispondere" },
  { key: "accettate_da_me", label: "Accettate" },
  { key: "in_attesa_conferma", label: "In attesa conferma" },
  { key: "confermate", label: "Confermate" },
  { key: "completate", label: "Completate" },
  { key: "da_recensire", label: "Da recensire" },
  { key: "rifiutate", label: "Rifiutate" },
  { key: "scadute", label: "Scadute" },
  { key: "annullate", label: "Annullate" },
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
  const [tab, setTab] = useState<"tutte" | Bucket>("tutte");
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
    const c: Record<Bucket | "tutte", number> = {
      tutte: rows.length,
      nuove: 0,
      da_rispondere: 0,
      accettate_da_me: 0,
      in_attesa_conferma: 0,
      confermate: 0,
      completate: 0,
      rifiutate: 0,
      scadute: 0,
      annullate: 0,
      da_recensire: 0,
    };
    for (const r of rows) for (const b of bucketsFor(r, lastSeenAt)) c[b] += 1;
    return c;
  }, [rows, lastSeenAt]);

  const filtered = useMemo(() => {
    const list = tab === "tutte" ? rows.slice() : rows.filter((r) => bucketsFor(r, lastSeenAt).includes(tab));
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
    if (tab === "tutte") {
      // Default "Tutte" view: workflow priority first, then service date
      list.sort((a, b) => {
        const isNewA = a.status === "pending" && new Date(a.created_at).getTime() > lastSeenAt;
        const isNewB = b.status === "pending" && new Date(b.created_at).getTime() > lastSeenAt;
        const p = priorityFor(a, isNewA) - priorityFor(b, isNewB);
        if (p !== 0) return p;
        return (a.announcement?.service_date ?? "9999").localeCompare(b.announcement?.service_date ?? "9999");
      });
    }
    return list;
  }, [rows, tab, sortMode, lastSeenAt]);

  if (role !== "worker")
    return (
      <AppShell>
        <p className="text-muted-foreground">Sezione riservata ai lavoratori.</p>
      </AppShell>
    );

  const stats: { label: string; value: number; tone: string; tab: "tutte" | Bucket }[] = [
    {
      label: "Nuove",
      value: counts.nuove,
      tone: "bg-primary/10 text-primary border-primary/30",
      tab: "nuove",
    },
    {
      label: "Da rispondere",
      value: counts.da_rispondere,
      tone: "bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30",
      tab: "da_rispondere",
    },
    {
      label: "Accettate",
      value: counts.confermate + counts.accettate_da_me,
      tone: "bg-emerald-100 text-emerald-900 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30",
      tab: "confermate",
    },
    {
      label: "Rifiutate",
      value: counts.rifiutate,
      tone: "bg-rose-100 text-rose-900 border-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30",
      tab: "rifiutate",
    },
    {
      label: "Scadute",
      value: counts.scadute,
      tone: "bg-muted text-muted-foreground border-border",
      tab: "scadute",
    },
  ];

  return (
    <AppShell>
      <PageHeader
        title="Offerte ricevute"
        subtitle="Qui trovi le proposte di lavoro ricevute dai ristoratori."
      />

      {/* Riepilogo numerico — KPI chiari in alto */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={() => setTab(s.tab)}
            className={
              "rounded-2xl border px-4 py-3 text-left shadow-sm transition hover:shadow-md focus:outline-none focus:ring-2 focus:ring-ring " +
              (tab === s.tab ? "ring-2 ring-foreground/40 " : "") +
              s.tone
            }
          >
            <div className="text-[11px] font-semibold uppercase tracking-wide opacity-80">
              {s.label}
            </div>
            <div className="mt-1 text-2xl font-bold tabular-nums">{s.value}</div>
          </button>
        ))}
      </div>

      {/* Privacy hint */}
      <div className="mt-5 flex items-start gap-2 rounded-2xl border border-border/60 bg-muted/30 p-3 text-sm text-muted-foreground">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          Per proteggere entrambe le parti, i dati completi del locale vengono mostrati solo dopo la conferma
          reciproca del servizio.
        </span>
      </div>

      {/* Filtri — pill scrollabili orizzontalmente su mobile */}
      <div className="mt-5 -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex gap-2 whitespace-nowrap pb-1">
          {TABS.map((t) => {
            const active = tab === t.key;
            const count = counts[t.key];
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={
                  "shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition " +
                  (active
                    ? "border-foreground bg-foreground text-background shadow-sm"
                    : "border-border bg-card text-foreground hover:bg-accent")
                }
              >
                {t.label}
                <span
                  className={
                    "ml-2 rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums " +
                    (active ? "bg-background/20 text-background" : "bg-muted text-muted-foreground")
                  }
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
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
            Nessuna offerta in questa categoria.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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
  const tariff = r.announcement
    ? formatTariff(r.announcement.tariff_amount, r.announcement.tariff_type)
    : null;
  const receivedAt = new Date(r.created_at).toLocaleDateString("it-IT");

  return (
    <div className="group flex flex-col rounded-2xl border bg-card p-5 shadow-sm transition hover:shadow-md">
      {/* Header: stato in alto, ruolo grande, contesto locale piccolo */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Store className="h-3.5 w-3.5" />
            <span className="truncate">{venue}</span>
          </div>
          <h3 className="mt-1.5 truncate text-lg font-semibold leading-tight text-foreground">
            {role}
          </h3>
          {confirmed && (
            <div className="mt-0.5 truncate text-sm text-muted-foreground">
              {r.restaurant?.business_name || r.restaurant?.full_name || "Ristoratore"}
            </div>
          )}
        </div>
        <span
          className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap ${badge.cls}`}
        >
          {badge.label}
        </span>
      </div>

      {/* Info chiave: data/orario + luogo + compenso, in evidenza */}
      <div className="mt-4 grid grid-cols-1 gap-2 rounded-xl bg-muted/30 p-3 text-sm sm:grid-cols-2">
        <div className="flex items-center gap-2 text-foreground">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">
            {dateStr}
            {startTime ? ` · ${startTime}` : ""}
            {endTime ? `–${endTime}` : ""}
          </span>
          {duration ? (
            <span className="text-xs text-muted-foreground">({duration}h)</span>
          ) : null}
        </div>
        {tariff && (
          <div className="flex items-center gap-2 text-foreground">
            <Euro className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{tariff}</span>
          </div>
        )}
        <div className="flex items-center gap-2 text-muted-foreground sm:col-span-2">
          <MapPin className="h-4 w-4" />
          <span className="truncate">
            {confirmed && r.restaurant?.address ? r.restaurant.address : zone}
          </span>
        </div>
      </div>

      {/* Info secondarie meno invasive */}
      <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Clock className="h-3.5 w-3.5" />
        <span>Ricevuta il {receivedAt}</span>
      </div>

      {r.lastMessage && (
        <div className="mt-3 rounded-lg border border-border/60 bg-background/60 p-2.5 text-xs text-muted-foreground line-clamp-2">
          <span className="font-medium text-foreground">Messaggio: </span>
          {r.lastMessage}
        </div>
      )}

      {!confirmed && (
        <div className="mt-3 flex items-start gap-1.5 text-[11px] text-muted-foreground">
          <Info className="mt-0.5 h-3 w-3 shrink-0" />
          <span>Dati completi del locale visibili dopo la conferma reciproca.</span>
        </div>
      )}

      {/* Azioni: spinte in fondo per allineare card di altezze diverse */}
      <div className="mt-auto pt-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {r.status === "pending" && (
            <>
              <Button size="sm" className="flex-1" onClick={() => onRespond(r.id, "interested")}>
                Accetta offerta
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                onClick={() => onRespond(r.id, "not_interested")}
              >
                Rifiuta
              </Button>
            </>
          )}
          {(r.status === "interested" || r.status === "counter_offer" || r.status === "accepted") && (
            <Link to="/messages/$id" params={{ id: r.id }} className="flex-1">
              <Button size="sm" className="w-full gap-2">
                <MessageSquare className="h-4 w-4" />
                Scrivi al ristoratore
              </Button>
            </Link>
          )}
          {isCompleted(r) && !r.hasWorkerReview && (
            <Link to="/messages/$id" params={{ id: r.id }} className="flex-1">
              <Button size="sm" className="w-full gap-2">
                <Star className="h-4 w-4" />
                Lascia recensione
              </Button>
            </Link>
          )}
          <Link to="/messages/$id" params={{ id: r.id }} className="flex-1">
            <Button size="sm" variant="secondary" className="w-full gap-2">
              Apri dettagli
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}