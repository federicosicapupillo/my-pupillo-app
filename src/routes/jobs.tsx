import { createFileRoute, Link } from "@tanstack/react-router";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell, PageHeader } from "@/components/AppShell";
import { useAuth } from "@/lib/auth-context";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Calendar, MapPin, Euro, MessageSquare, Star, Eye, CheckCircle2, XCircle, Clock, AlertCircle } from "lucide-react";
import { formatTariff } from "@/lib/format";
import { publicLocationLabel } from "@/lib/public-location";

export const Route = createFileRoute("/jobs")({
  head: () => ({ meta: [{ title: "I miei servizi — Pupillo" }] }),
  component: () => <RequireAuth><Jobs /></RequireAuth>,
});

type Ann = {
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
  job_address: string | null;
  location_address: string | null;
  professional_profile: string | null;
  assigned_worker_id: string | null;
  status: string;
};
type Restaurant = {
  id: string;
  full_name: string | null;
  business_name: string | null;
  city: string | null;
  neighborhood: string | null;
};
type Application = {
  id: string;
  status: string;
  created_at: string;
  restaurant_id: string;
  announcement_id: string;
  worker_response_at: string | null;
};
type Shift = {
  id: string;
  announcement_id: string | null;
  status: string;
  shift_date: string;
};

type Category = "in_attesa" | "confermati" | "completati" | "annullati" | "da_recensire";

type Service = {
  app: Application;
  ann: Ann | null;
  restaurant: Restaurant | null;
  shift: Shift | null;
  reviewed: boolean;
  category: Category;
};

const CATEGORY_LABEL: Record<Category, string> = {
  in_attesa: "In attesa",
  confermati: "Confermato",
  completati: "Completato",
  annullati: "Annullato",
  da_recensire: "Da recensire",
};

const CATEGORY_CLS: Record<Category, string> = {
  in_attesa: "bg-amber-100 text-amber-800 border border-amber-200",
  confermati: "bg-emerald-100 text-emerald-800 border border-emerald-200",
  completati: "bg-blue-100 text-blue-800 border border-blue-200",
  annullati: "bg-red-100 text-red-800 border border-red-200",
  da_recensire: "bg-yellow-100 text-yellow-900 border border-yellow-300",
};

function deriveCategory(app: Application, ann: Ann | null, shift: Shift | null, reviewed: boolean): Category {
  const cancelledApp = ["not_interested", "rejected", "expired"].includes(app.status);
  if (cancelledApp || shift?.status === "cancelled" || ann?.status === "cancelled") return "annullati";
  const isCompleted = shift?.status === "completed" || ann?.status === "completed";
  if (isCompleted) return reviewed ? "completati" : "da_recensire";
  if (app.status === "accepted") return "confermati";
  return "in_attesa";
}

function Jobs() {
  const { user, role } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | Category>("all");

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data: apps } = await supabase
        .from("applications")
        .select("id, status, created_at, restaurant_id, announcement_id, worker_response_at")
        .eq("worker_id", user.id)
        .order("created_at", { ascending: false });
      const appList = (apps ?? []) as Application[];
      const annIds = Array.from(new Set(appList.map((a) => a.announcement_id))).filter(Boolean);
      const restIds = Array.from(new Set(appList.map((a) => a.restaurant_id))).filter(Boolean);
      const [{ data: anns }, { data: rests }, { data: shifts }, { data: revs }] = await Promise.all([
        annIds.length
          ? supabase
              .from("announcements")
              .select(
                "id, service_date, service_time, end_time, duration_hours, tariff_amount, tariff_type, speed, job_city, job_province, job_address, location_address, professional_profile, assigned_worker_id, status",
              )
              .in("id", annIds)
          : Promise.resolve({ data: [] as any[] }),
        restIds.length
          ? supabase
              .from("profiles")
              .select("id, full_name, business_name, city, neighborhood")
              .in("id", restIds)
          : Promise.resolve({ data: [] as any[] }),
        annIds.length
          ? supabase
              .from("shifts")
              .select("id, announcement_id, status, shift_date")
              .eq("worker_id", user.id)
              .in("announcement_id", annIds)
          : Promise.resolve({ data: [] as any[] }),
        annIds.length
          ? supabase
              .from("reviews")
              .select("announcement_id, target_id")
              .eq("author_id", user.id)
              .in("announcement_id", annIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);
      const annMap = new Map<string, Ann>((anns ?? []).map((a: any) => [a.id, a]));
      const restMap = new Map<string, Restaurant>((rests ?? []).map((r: any) => [r.id, r]));
      const shiftMap = new Map<string, Shift>();
      (shifts ?? []).forEach((s: any) => {
        if (s.announcement_id) shiftMap.set(s.announcement_id, s);
      });
      const reviewedSet = new Set<string>(
        (revs ?? []).map((r: any) => `${r.announcement_id}::${r.target_id}`),
      );
      const list: Service[] = appList.map((app) => {
        const ann = annMap.get(app.announcement_id) ?? null;
        const restaurant = restMap.get(app.restaurant_id) ?? null;
        const shift = shiftMap.get(app.announcement_id) ?? null;
        const reviewed = reviewedSet.has(`${app.announcement_id}::${app.restaurant_id}`);
        const category = deriveCategory(app, ann, shift, reviewed);
        return { app, ann, restaurant, shift, reviewed, category };
      });
      setServices(list);
      setLoading(false);
    })();
  }, [user]);

  const counts = useMemo(() => {
    const c = { all: services.length, in_attesa: 0, confermati: 0, completati: 0, annullati: 0, da_recensire: 0 };
    services.forEach((s) => {
      c[s.category] += 1;
    });
    // "completati" tab should include also "da_recensire" (sono comunque completati)
    c.completati = services.filter((s) => s.category === "completati" || s.category === "da_recensire").length;
    return c;
  }, [services]);

  const filtered = useMemo(() => {
    if (filter === "all") return services;
    if (filter === "completati") return services.filter((s) => s.category === "completati" || s.category === "da_recensire");
    return services.filter((s) => s.category === filter);
  }, [services, filter]);

  if (role !== "worker") {
    return (
      <AppShell>
        <p className="text-muted-foreground">Sezione riservata ai lavoratori.</p>
      </AppShell>
    );
  }

  const tabs: { key: "all" | Category; label: string; count: number }[] = [
    { key: "all", label: "Tutti", count: counts.all },
    { key: "in_attesa", label: "In attesa", count: counts.in_attesa },
    { key: "confermati", label: "Confermati", count: counts.confermati },
    { key: "completati", label: "Completati", count: counts.completati },
    { key: "annullati", label: "Annullati", count: counts.annullati },
    { key: "da_recensire", label: "Da recensire", count: counts.da_recensire },
  ];

  return (
    <AppShell>
      <PageHeader title="I miei servizi" subtitle="Tutti i servizi collegati al tuo profilo" />

      <div className="flex flex-wrap gap-2 mb-5">
        {tabs.map((t) => (
          <Button
            key={t.key}
            size="sm"
            variant={filter === t.key ? "default" : "outline"}
            className="rounded-full"
            onClick={() => setFilter(t.key)}
          >
            {t.label} ({t.count})
          </Button>
        ))}
      </div>

      {loading ? (
        <p className="text-muted-foreground">Caricamento…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border bg-card p-12 text-center text-muted-foreground">
          Nessun servizio in questa categoria.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((s) => (
            <ServiceCard key={s.app.id} svc={s} />
          ))}
        </div>
      )}
    </AppShell>
  );
}

function ServiceCard({ svc }: { svc: Service }) {
  const { app, ann, restaurant, category, reviewed } = svc;
  const restaurantName = restaurant?.business_name || restaurant?.full_name || "Ristoratore";
  const address =
    ann?.job_address ||
    ann?.location_address ||
    publicLocationLabel({
      job_city: ann?.job_city ?? null,
      city: restaurant?.city ?? null,
      neighborhood: restaurant?.neighborhood ?? null,
    });
  const role = ann?.professional_profile;
  const Icon =
    category === "completati" ? CheckCircle2
      : category === "annullati" ? XCircle
      : category === "da_recensire" ? Star
      : category === "confermati" ? CheckCircle2
      : Clock;

  return (
    <div className="rounded-2xl border bg-card p-5 flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold truncate">{restaurantName}</div>
          {role && <div className="text-sm text-muted-foreground capitalize truncate">{role}</div>}
        </div>
        <span className={`shrink-0 text-xs rounded-full px-2.5 py-1 inline-flex items-center gap-1 ${CATEGORY_CLS[category]}`}>
          <Icon className="h-3.5 w-3.5" />
          {CATEGORY_LABEL[category]}
        </span>
      </div>

      {ann && (
        <div className="mt-3 space-y-1 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 shrink-0" />
            {new Date(ann.service_date).toLocaleDateString("it-IT")} · {ann.service_time?.slice(0, 5)}
            {ann.end_time ? `–${ann.end_time.slice(0, 5)}` : ann.duration_hours ? ` (${ann.duration_hours}h)` : ""}
          </div>
          {address && (
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 shrink-0" />
              <span className="truncate">{address}</span>
            </div>
          )}
          {ann.tariff_amount != null && (
            <div className="flex items-center gap-2">
              <Euro className="h-4 w-4 shrink-0" />
              {formatTariff(ann.tariff_amount, ann.tariff_type)}
            </div>
          )}
        </div>
      )}

      {!ann && (
        <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
          <AlertCircle className="h-4 w-4" />
          Dettagli annuncio non disponibili.
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Link to="/messages/$id" params={{ id: app.id }}>
          <Button size="sm" variant="secondary" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            Scrivi al ristoratore
          </Button>
        </Link>
        {ann && (
          <Link to="/announcements/$id" params={{ id: ann.id }}>
            <Button size="sm" variant="outline" className="gap-2">
              <Eye className="h-4 w-4" />
              Apri dettagli
            </Button>
          </Link>
        )}
        {category === "da_recensire" && (
          <Link to="/shifts" search={{ tab: "to-review" } as any}>
            <Button size="sm" className="gap-2">
              <Star className="h-4 w-4" />
              Lascia recensione
            </Button>
          </Link>
        )}
        {category === "completati" && reviewed && (
          <Link to="/shifts">
            <Button size="sm" variant="outline" className="gap-2">
              <Star className="h-4 w-4" />
              Vedi recensione
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}
