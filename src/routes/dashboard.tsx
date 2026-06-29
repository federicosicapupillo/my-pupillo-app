import { PayOnHireBox } from "@/components/PayOnHireInfo";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell, PageHeader } from "@/components/AppShell";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Briefcase, Plus, Users, MessageSquare, AlertCircle, Coins, CheckCircle2, Calendar, MapPin, ArrowRight, Star, Clock, XCircle, AlertTriangle, CheckCheck, Heart, Store, BadgeCheck, CalendarDays, Sparkles, UserCircle2, Gift, ChevronRight, ShieldCheck } from "lucide-react";
import { ProfileStatusBanner } from "@/components/ProfileStatusBanner";
import { toastOnce } from "@/lib/toast-dedup";
import { ReferralCard } from "@/components/ReferralCard";
import { RequiredReviewsBanner } from "@/components/RequiredReviewsBanner";
import { WorkerReputationCard } from "@/components/WorkerReputationCard";
import { WorkerMyReviews } from "@/components/WorkerMyReviews";
import { WorkerAvailabilitySummary } from "@/components/WorkerAvailabilitySummary";
import { RestaurantReputationCard } from "@/components/RestaurantReputationCard";
import { getShiftStartDate, getShiftEndDate } from "@/lib/announcement-time";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { goToRestaurantOnboarding } from "@/lib/restaurant-onboarding-navigation";
import { CancelShiftDialog } from "@/components/CancelShiftDialog";
import { countUnreadChats } from "@/lib/unread-chats";
import { createDebouncedReload } from "@/lib/inbox-realtime";


export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Pupillo" }] }),
  component: () => <RequireAuth><DashboardInner /></RequireAuth>,
});

type AssignedItem = {
  ann_id: string;
  service_date: string;
  service_time: string;
  duration_hours: number | null;
  end_time: string | null;
  end_date: string | null;
  location_address: string;
  role_label: string | null;
  worker_id: string | null;
  worker_name: string | null;
  shift_id: string | null;
  shift_status: "scheduled" | "completed" | "no_show" | "cancelled" | null;
  app_id: string | null;
  has_review: boolean;
  required_status: string | null;
  required_due: string | null;
};

function DashboardInner() {
  const { profile, role, user } = useAuth();
  const nav = useNavigate();
  const [stats, setStats] = useState({ active: 0, assigned: 0, applications: 0, messages: 0 });
  const [assignedList, setAssignedList] = useState<AssignedItem[]>([]);
  const [closingItem, setClosingItem] = useState<AssignedItem | null>(null);
  const [closing, setClosing] = useState(false);

  // Il redirect forzato a /onboarding per profilo incompleto è stato rimosso
  // per permettere ai ristoratori di accedere alla dashboard anche con profilo
  // incompleto. Il box visibile nella dashboard guida l'utente a completare
  // il profilo quando vuole.

  // Promemoria: toast una volta per sessione (dedup centralizzato).
  useEffect(() => {
    if (!profile) return;
    const phoneOk = !!profile.phone_verified;
    const profileOk = !!profile.profile_completed;
    if (!phoneOk) {
      toastOnce("Numero WhatsApp non verificato", {
        key: "reminder:phone",
        variant: "warning",
        guard: () => !profile.phone_verified,
        description: "Verifica il numero dall'onboarding per attivare completamente l'account.",
        action: { label: "Vai all'onboarding", onClick: () => nav({ to: "/onboarding" }) },
        duration: 8000,
      });
    } else if (!profileOk) {
      toastOnce("Profilo da completare", {
        key: "reminder:profile",
        variant: "message",
        guard: () => !profile.profile_completed,
        description: "Aggiungi le informazioni mancanti per pubblicare e candidarti.",
        action: { label: "Completa", onClick: () => goToRestaurantOnboarding(nav) },
        duration: 8000,
      });
    }
  }, [profile, nav]);

  useEffect(() => {
    if (!user || !role) return;
    let cancelled = false;
    const run = async () => {
      // Metric: number of threads (applications) with at least one message
      // received and not yet read by the current user. Uses the shared
      // `countUnreadChats` helper so the dashboard, navbar badge and the
      // /messages page all show the SAME number.
      const PENDING_STATUSES = ["pending", "interested", "counter_offer"] as const;
      if (role === "restaurant") {
        const { count: active } = await supabase.from("announcements").select("*", { count: "exact", head: true }).eq("restaurant_id", user.id).eq("status", "active");
        const { count: assignedCount } = await supabase.from("announcements").select("*", { count: "exact", head: true }).eq("restaurant_id", user.id).eq("status", "assigned");
        const { count: apps } = await supabase
          .from("applications")
          .select("*", { count: "exact", head: true })
          .eq("restaurant_id", user.id)
          .in("status", PENDING_STATUSES);
        const msgs = await countUnreadChats(user.id, role);
        if (cancelled) return;
        setStats({ active: active ?? 0, assigned: assignedCount ?? 0, applications: apps ?? 0, messages: msgs });
        await loadAssigned(user.id);
      } else if (role === "worker") {
        const { count: apps } = await supabase
          .from("applications")
          .select("*", { count: "exact", head: true })
          .eq("worker_id", user.id)
          .in("status", PENDING_STATUSES);
        const msgs = await countUnreadChats(user.id, role);
        if (cancelled) return;
        setStats({ active: 0, assigned: 0, applications: apps ?? 0, messages: msgs });
      }
    };
    const refreshUnread = async () => {
      const msgs = await countUnreadChats(user.id, role);
      if (cancelled) return;
      setStats((s) => (s.messages === msgs ? s : { ...s, messages: msgs }));
    };
    run();
    // Keep the counter in sync with the /messages page: any insert/update/
    // delete on messages (e.g. a chat opened and read_at filled in) refreshes
    // the dashboard badge without requiring a full reload.
    const reloader = createDebouncedReload(() => { refreshUnread(); }, 300);
    const ch = supabase
      .channel(`dashboard-unread-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => reloader.schedule())
      .subscribe();
    const onVisible = () => { if (document.visibilityState === "visible") refreshUnread(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      reloader.cancel();
      supabase.removeChannel(ch);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [user, role]);

  const loadAssigned = async (uid: string) => {
    // Anteprima annunci assegnati (max 8, ordinati per data servizio)
    const { data: assignedRows } = await supabase
      .from("announcements")
      .select("id, service_date, service_time, duration_hours, end_time, end_date, location_address, assigned_worker_id, professional_profile")
      .eq("restaurant_id", uid)
      .eq("status", "assigned")
      .order("service_date", { ascending: true })
      .limit(8);
    const rows = (assignedRows ?? []) as any[];
    if (rows.length === 0) { setAssignedList([]); return; }
    const annIds = rows.map(r => r.id);
    const workerIds = Array.from(new Set(rows.map(r => r.assigned_worker_id).filter(Boolean))) as string[];
    const [profsRes, jrRes, shiftsRes, appsRes] = await Promise.all([
      workerIds.length ? supabase.from("profiles").select("id, full_name").in("id", workerIds) : Promise.resolve({ data: [] as any[] }),
      supabase.from("job_requests").select("announcement_id, role_required").in("announcement_id", annIds),
      supabase.from("shifts").select("id, announcement_id, status, worker_id, reviewed_at").in("announcement_id", annIds).eq("restaurant_id", uid),
      supabase.from("applications").select("id, announcement_id, worker_id, status").in("announcement_id", annIds).eq("restaurant_id", uid),
    ]);
    const nameMap: Record<string, string> = {};
    (profsRes.data ?? []).forEach((p: any) => { nameMap[p.id] = p.full_name; });
    const roleMap: Record<string, string> = {};
    (jrRes.data ?? []).forEach((j: any) => { if (j.announcement_id) roleMap[j.announcement_id] = j.role_required; });
    // pick latest active shift per announcement (prefer scheduled/completed over cancelled)
    const shiftMap: Record<string, any> = {};
    const rank = (st: string) => st === "scheduled" ? 4 : st === "completed" ? 3 : st === "no_show" ? 2 : 1;
    (shiftsRes.data ?? []).forEach((s: any) => {
      const cur = shiftMap[s.announcement_id];
      if (!cur || rank(s.status) > rank(cur.status)) shiftMap[s.announcement_id] = s;
    });
    const appMap: Record<string, any> = {};
    (appsRes.data ?? []).forEach((a: any) => {
      const key = `${a.announcement_id}|${a.worker_id}`;
      if (!appMap[key] || a.status === "accepted") appMap[key] = a;
    });
    // reviews + required_reviews
    const shiftIds = Object.values(shiftMap).map((s: any) => s.id);
    let reviewSet = new Set<string>();
    let reqMap: Record<string, { status: string; due_date: string }> = {};
    if (shiftIds.length) {
      const [{ data: revs }, { data: reqs }] = await Promise.all([
        supabase.from("reviews").select("shift_id").eq("author_id", uid).in("shift_id", shiftIds),
        (supabase as any).from("required_reviews").select("shift_id, status, due_date").eq("restaurant_user_id", uid).in("shift_id", shiftIds),
      ]);
      reviewSet = new Set((revs ?? []).map((r: any) => r.shift_id));
      (reqs ?? []).forEach((r: any) => { if (r.shift_id) reqMap[r.shift_id] = { status: r.status, due_date: r.due_date }; });
    }
    setAssignedList(rows.map((r): AssignedItem => {
      const s = shiftMap[r.id] ?? null;
      const app = r.assigned_worker_id ? appMap[`${r.id}|${r.assigned_worker_id}`] ?? null : null;
      return {
        ann_id: r.id,
        service_date: r.service_date,
        service_time: r.service_time,
        duration_hours: r.duration_hours,
        end_time: r.end_time ?? null,
        end_date: r.end_date ?? null,
        location_address: r.location_address,
        role_label: roleMap[r.id] ?? r.professional_profile ?? null,
        worker_id: r.assigned_worker_id,
        worker_name: r.assigned_worker_id ? nameMap[r.assigned_worker_id] ?? null : null,
        shift_id: s?.id ?? null,
        shift_status: s?.status ?? null,
        app_id: app?.id ?? null,
        has_review: s ? reviewSet.has(s.id) : false,
        required_status: s ? reqMap[s.id]?.status ?? null : null,
        required_due: s ? reqMap[s.id]?.due_date ?? null : null,
      };
    }));
  };

  const concludeShift = async () => {
    if (!closingItem || !user) return;
    if (!closingItem.worker_id) {
      toast.error("Lavoratore non collegato al turno.");
      return;
    }
    const endDt = getShiftEndDate(closingItem);
    if (endDt && Date.now() < endDt.getTime()) {
      toast.error("Non puoi concludere questo turno prima della fine del servizio.");
      return;
    }
    setClosing(true);
    try {
      let shiftId = closingItem.shift_id;
      const completedAt = new Date().toISOString();
      if (!shiftId) {
        // crea il turno se mancante
        const { data: created, error } = await supabase.from("shifts").insert({
          announcement_id: closingItem.ann_id,
          restaurant_id: user.id,
          worker_id: closingItem.worker_id,
          shift_date: closingItem.service_date,
          hours: closingItem.duration_hours ?? 4,
          status: "completed",
          completed_at: completedAt,
        } as never).select("id").single();
        if (error) throw error;
        shiftId = (created as any).id;
      } else {
        const { error } = await supabase.from("shifts")
          .update({ status: "completed", completed_at: completedAt })
          .eq("id", shiftId)
          .eq("restaurant_id", user.id);
        if (error) throw error;
      }
      toast.success("Turno concluso. Lascia ora la recensione.");
      setClosingItem(null);
      await loadAssigned(user.id);
      // porta direttamente alla pagina dettaglio turno con sezione recensione aperta
      if (shiftId) {
        nav({ to: "/ristoratore/turni/$shiftId", params: { shiftId }, search: { section: "recensione" } as never });
      } else if (closingItem.app_id) {
        nav({ to: "/messages/$id", params: { id: closingItem.app_id } });
      }
    } catch (e: any) {
      const msg = String(e?.message ?? "");
      toast.error(
        msg.includes("required_reviews") || msg.includes("ON CONFLICT")
          ? "Impossibile creare la recensione obbligatoria. Riprova."
          : msg || "Errore durante la chiusura del turno"
      );
    } finally {
      setClosing(false);
    }
  };

  return (
    <AppShell>
      <PageHeader
        title={`Ciao ${profile?.full_name || ""} 👋`}
        subtitle={role === "restaurant" ? "Gestisci i tuoi annunci e trova personale extra." : role === "worker" ? "Visualizza le offerte e gestisci le tue candidature." : "Pannello amministratore."}
        action={role === "restaurant" && (
          <Link to="/ristoratore/annunci/nuovo" data-tour="restaurant-create-announcement"><Button className="gap-2"><Plus className="h-4 w-4" /> Nuovo annuncio</Button></Link>
        )}
      />

      {role === "restaurant" && <PayOnHireBox className="mb-6" />}

      <ProfileStatusBanner />
      {role === "restaurant" && <RequiredReviewsBanner />}


      {role === "restaurant" && profile && (
        <div className="mb-6 rounded-2xl border bg-card p-5 flex items-start gap-4">
          <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Store className="h-6 w-6" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Locale</div>
            {profile.business_name ? (
              <>
                <div className="text-lg font-semibold text-foreground truncate">{profile.business_name}</div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                  {profile.venue_type && <span className="capitalize">{profile.venue_type}</span>}
                  {profile.city && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{profile.city}</span>}
                  {profile.vat_status === "valid" && (
                    <span className="inline-flex items-center gap-1 text-emerald-600"><BadgeCheck className="h-3.5 w-3.5" /> Verificato</span>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="text-base font-medium text-foreground">Nome locale non ancora inserito</div>
                <div className="mt-2">
                  <Link to="/onboarding"><Button size="sm" variant="outline">Completa profilo locale</Button></Link>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {profile && !profile.profile_completed && (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-yellow-300 bg-yellow-50 p-4">
          <AlertCircle className="h-5 w-5 text-yellow-700" />
          <div className="flex-1">
            <div className="font-medium text-yellow-900">Profilo incompleto</div>
            <div className="text-sm text-yellow-800">Completa il profilo per usare tutte le funzionalità.</div>
          </div>
          <Link to="/onboarding"><Button size="sm">Completa</Button></Link>
        </div>
      )}

      {role !== "worker" && (() => {
        const showApps = role === "restaurant" && stats.applications > 0;
        const showMsgs = stats.messages > 0;
        const cards: ReactNode[] = [];
        cards.push(
          <StatCard key="active" icon={Briefcase} label={role === "restaurant" ? "Annunci attivi" : "Candidature"} value={role === "restaurant" ? stats.active : stats.applications} />,
        );
        if (role === "restaurant") {
          cards.push(
            <Link key="assigned" to="/announcements" search={{ status: "assigned" } as never} className="block">
              <StatCard icon={CheckCircle2} label="Annunci assegnati" value={stats.assigned} highlight />
            </Link>,
          );
        }
        if (showApps) {
          cards.push(
            <StatCard key="apps" icon={Users} label="Candidature da valutare" value={stats.applications} />,
          );
        }
        if (showMsgs) {
          cards.push(
            <StatCard key="msgs" icon={MessageSquare} label="Chat con messaggi da leggere" value={stats.messages} />,
          );
        }
        const cols = cards.length >= 4 ? "md:grid-cols-4" : cards.length === 3 ? "md:grid-cols-3" : cards.length === 2 ? "md:grid-cols-2" : "md:grid-cols-1";
        return <div className={`grid gap-4 ${cols}`}>{cards}</div>;
      })()}

      {role === "restaurant" && assignedList.length > 0 && (
        <div className="mt-6 rounded-2xl border bg-card p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              <h2 className="font-semibold">Turni assegnati da gestire</h2>
            </div>
            <Link to="/announcements" search={{ status: "assigned" } as never}>
              <Button variant="ghost" size="sm" className="gap-1">Vedi tutti <ArrowRight className="h-3.5 w-3.5" /></Button>
            </Link>
          </div>
          <ul className="space-y-3">
            {assignedList.map((a) => (
              <AssignedShiftCard
                key={a.ann_id}
                item={a}
                onClose={() => setClosingItem(a)}
                onCancelled={(annId) => {
                  setAssignedList((prev) =>
                    prev.map((x) => (x.ann_id === annId ? { ...x, shift_status: "cancelled" } : x)),
                  );
                }}
              />
            ))}
          </ul>
        </div>
      )}

      {role === "restaurant" && <FavoriteWorkersSection />}

      {role === "restaurant" && user && (
        <section className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Star className="h-5 w-5 text-primary" />
              <h2 className="font-semibold">Reputation Score</h2>
            </div>
          </div>
          <RestaurantReputationCard restaurantId={user.id} />
        </section>
      )}

      {role === "worker" && user && profile && (
        <WorkerHome
          userId={user.id}
          profile={profile}
          applications={stats.applications}
          messages={stats.messages}
        />
      )}

      <AlertDialog open={!!closingItem} onOpenChange={(o) => !o && !closing && setClosingItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Concludere questo turno?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                Confermando la chiusura del turno, potrai lasciare una recensione al lavoratore.
                La recensione è necessaria per aggiornare il profilo reputazionale.
              </span>
              {closingItem && (
                <span className="block rounded-md bg-muted/60 p-3 text-sm text-foreground">
                  <strong>{closingItem.role_label ?? "Servizio"}</strong>
                  {closingItem.worker_name && <> · {closingItem.worker_name}</>}<br />
                  {new Date(closingItem.service_date).toLocaleDateString("it-IT", { weekday: "long", day: "2-digit", month: "long" })}
                  {closingItem.service_time && <> · {closingItem.service_time.slice(0,5)}</>}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={closing}>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); concludeShift(); }} disabled={closing}>
              {closing ? "Chiusura..." : "Conferma e lascia recensione"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {role === "restaurant" && (
        <div className="mt-6 flex items-center justify-between gap-4 rounded-2xl border bg-card p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Coins className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Saldo crediti</div>
              <div className="text-2xl font-semibold">{profile?.credits ?? 0}</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Pubblica annuncio: 1 credito · Urgente: 3 · Invita lavoratore: 2
              </div>
            </div>
          </div>
          <Link to="/billing"><Button variant="outline" className="gap-2"><Plus className="h-4 w-4" />Acquista crediti</Button></Link>
        </div>
      )}

      {role !== "worker" && (
        <div className="mt-8 rounded-2xl border bg-card p-6">
          <h2 className="font-semibold mb-2">Cosa puoi fare ora</h2>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
            {role === "restaurant" && <>
              <li>Crea un nuovo annuncio per il prossimo servizio</li>
              <li>Cerca lavoratori disponibili nella tua zona</li>
              <li>Chatta con i candidati interessati</li>
            </>}
            {role === "admin" && <li>Apri il pannello Admin per gestire utenti e annunci</li>}
          </ul>
        </div>
      )}

      {role !== "worker" && (
        <div className="mt-6">
          <ReferralCard />
        </div>
      )}
    </AppShell>
  );
}

function StatCard({ icon: Icon, label, value, highlight }: { icon: typeof Briefcase; label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl border bg-card p-5 transition-colors ${highlight ? "hover:border-emerald-500/50 hover:bg-emerald-500/5 cursor-pointer" : ""}`}>
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">{label}</div>
        <Icon className={`h-4 w-4 ${highlight ? "text-emerald-600" : "text-muted-foreground"}`} />
      </div>
      <div className="mt-2 text-3xl font-semibold">{value}</div>
    </div>
  );
}

type WorkerHomeProps = {
  userId: string;
  profile: any;
  applications: number;
  messages: number;
};

function WorkerHome({ userId, profile, applications, messages }: WorkerHomeProps) {
  const phoneOk = !!profile?.phone_verified;
  const profileOk = !!profile?.profile_completed;
  const isReady = phoneOk && profileOk;
  const completedShifts = Number(profile?.completed_shifts ?? 0) || 0;
  const reputationLevel = profile?.reputation_level ?? "new";

  const tasks: Array<{
    icon: typeof Briefcase;
    title: string;
    desc: string;
    to: any;
    cta: string;
    priority: "high" | "normal";
  }> = [];

  if (!phoneOk) {
    tasks.push({
      icon: ShieldCheck,
      title: "Verifica il tuo numero",
      desc: "Sblocca le candidature e la chat con i ristoratori.",
      to: { to: "/onboarding" },
      cta: "Verifica ora",
      priority: "high",
    });
  }
  if (!profileOk) {
    tasks.push({
      icon: UserCircle2,
      title: "Completa il profilo professionale",
      desc: "Ruoli, esperienza e zona: i ristoratori ti trovano più facilmente.",
      to: { to: "/onboarding" },
      cta: "Completa profilo",
      priority: "high",
    });
  }
  if (messages > 0) {
    tasks.push({
      icon: MessageSquare,
      title: `${messages} ${messages === 1 ? "chat con messaggi da leggere" : "chat con messaggi da leggere"}`,
      desc: "Rispondi velocemente: i ristoratori scelgono chi è reattivo.",
      to: { to: "/messages" },
      cta: "Apri inbox",
      priority: "high",
    });
  }
  if (applications > 0) {
    tasks.push({
      icon: Users,
      title: `${applications} ${applications === 1 ? "candidatura in attesa" : "candidature in attesa"}`,
      desc: "Tieni d'occhio le risposte dei ristoratori.",
      to: { to: "/messages" },
      cta: "Vedi",
      priority: "high",
    });
  }

  const topTasks = tasks.slice(0, 4);

  return (
    <div className="mt-6 space-y-8">
      {/* 1. HERO / STATO UTENTE */}
      <section
        className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-card via-card to-primary/5 p-5 sm:p-7"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/15 blur-3xl"
        />
        <div className="relative grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              Home operativa
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {isReady
                ? "Sei pronto a lavorare. Tieni d'occhio offerte e messaggi."
                : "Completa i passi qui sotto per iniziare a ricevere offerte."}
            </p>
            {!isReady && (
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                {!phoneOk && (
                  <StatusPill
                    ok={false}
                    okLabel="Numero verificato"
                    koLabel="Numero da verificare"
                  />
                )}
                {!profileOk && (
                  <StatusPill
                    ok={false}
                    okLabel="Profilo completo"
                    koLabel="Profilo da completare"
                  />
                )}
              </div>
            )}
          </div>
          <div className="shrink-0">
            {isReady ? (
              <Link to="/announcements">
                <Button size="sm" className="gap-1.5">
                  <Briefcase className="h-4 w-4" /> Vedi offerte
                </Button>
              </Link>
            ) : (
              <Link to="/onboarding">
                <Button size="sm" className="gap-1.5">
                  Completa <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* 2. KPI OPERATIVI */}
      {(() => {
        const tiles: ReactNode[] = [];
        if (applications > 0) {
          tiles.push(
            <KpiTile
              key="apps"
              icon={Users}
              label="Candidature in attesa"
              value={applications}
              to={{ to: "/messages" }}
            />,
          );
        }
        if (messages > 0) {
          tiles.push(
            <KpiTile
              key="msgs"
              icon={MessageSquare}
              label="Chat da leggere"
              value={messages}
              highlight
              to={{ to: "/messages" }}
            />,
          );
        }
        tiles.push(
          <KpiTile
            key="done"
            icon={CheckCircle2}
            label="Turni completati"
            value={completedShifts}
          />,
        );
        const cols = tiles.length === 1 ? "grid-cols-1" : tiles.length === 2 ? "grid-cols-2" : "grid-cols-3";
        return <section className={`grid ${cols} gap-2 sm:gap-3`}>{tiles}</section>;
      })()}

      {/* 3. QUICK ACTIONS */}
      <section>
        <SectionHeader
          icon={Sparkles}
          title="Cosa fare ora"
          subtitle="Le prossime azioni utili per il tuo profilo"
        />
        <div className="grid gap-2.5 sm:grid-cols-2">
          {topTasks.length === 0 && (
            <div className="sm:col-span-2 rounded-2xl border bg-card p-4 text-sm text-muted-foreground">
              Tutto aggiornato. Non hai azioni urgenti da completare.
            </div>
          )}
          {topTasks.map((t, i) => (
            <Link key={i} {...t.to} className="group block">
              <div
                className={`flex h-full items-center gap-3 rounded-2xl border p-3.5 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md ${
                  t.priority === "high"
                    ? "border-primary/30 bg-primary/5"
                    : "bg-card"
                }`}
              >
                <div
                  className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
                    t.priority === "high"
                      ? "bg-primary/15 text-primary"
                      : "bg-muted text-foreground"
                  }`}
                >
                  <t.icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{t.title}</div>
                  <div className="line-clamp-1 text-xs text-muted-foreground">
                    {t.desc}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* 4. DISPONIBILITÀ */}
      <section>
        <SectionHeader
          icon={CalendarDays}
          title="Le mie disponibilità"
          subtitle="Riepilogo settimanale"
          action={
            <Link to="/availability">
              <Button variant="ghost" size="sm" className="gap-1">
                Gestisci <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          }
        />
        <WorkerAvailabilitySummary workerId={userId} collapsible />
      </section>


      {/* 5. REPUTAZIONE */}
      <section>
        <SectionHeader
          icon={Star}
          title="La mia reputazione"
          subtitle={
            completedShifts >= 3
              ? "Il tuo punteggio basato su servizi reali"
              : "In costruzione — completa i primi servizi"
          }
          action={
            <Link to="/profile">
              <Button variant="ghost" size="sm" className="gap-1">
                Profilo <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          }
        />
        <WorkerReputationCard workerId={userId} profile={profile as never} showTips />
      </section>

      {/* 6. RECENSIONI */}
      <section>
        <SectionHeader
          icon={MessageSquare}
          title="Le mie recensioni"
          action={
            <Link to="/profile">
              <Button variant="ghost" size="sm" className="gap-1">
                Vedi tutte <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          }
        />
        <WorkerMyReviews workerId={userId} limit={3} />
      </section>

      {/* 7. REFERRAL */}
      <section>
        <SectionHeader
          icon={Gift}
          title="Presenta un amico"
          subtitle="Più amici inviti, più cresce la community"
        />
        <ReferralCard />
      </section>

      <div aria-hidden className="h-2" />
      {/* keep level reference for future use */}
      <span className="hidden" data-reputation-level={reputationLevel} />
    </div>
  );
}

function StatusPill({
  ok,
  okLabel,
  koLabel,
}: {
  ok: boolean;
  okLabel: string;
  koLabel: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${
        ok
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
          : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400"
      }`}
    >
      {ok ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
      {ok ? okLabel : koLabel}
    </span>
  );
}

function KpiTile({
  icon: Icon,
  label,
  value,
  highlight,
  to,
}: {
  icon: typeof Briefcase;
  label: string;
  value: number;
  highlight?: boolean;
  to?: any;
}) {
  const inner = (
    <div
      className={`group h-full rounded-2xl border p-3.5 transition-all sm:p-4 ${
        highlight
          ? "border-primary/40 bg-primary/5"
          : "bg-card hover:border-primary/30 hover:bg-primary/[0.03]"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <Icon
          className={`h-3.5 w-3.5 ${highlight ? "text-primary" : "text-muted-foreground"}`}
        />
      </div>
      <div
        className={`mt-1 text-2xl font-bold tabular-nums sm:text-3xl ${
          highlight ? "text-primary" : "text-foreground"
        }`}
      >
        {value}
      </div>
    </div>
  );
  if (to) return <Link {...to} className="block">{inner}</Link>;
  return inner;
}

function SectionHeader({
  icon: Icon,
  title,
  subtitle,
  action,
}: {
  icon: typeof Briefcase;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 shrink-0 text-primary" />
          <h2 className="truncate text-base font-semibold">{title}</h2>
        </div>
        {subtitle && (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

function AssignedShiftCard({ item, onClose, onCancelled }: { item: AssignedItem; onClose: () => void; onCancelled?: (annId: string) => void }) {
  const { user } = useAuth();
  const [cancelOpen, setCancelOpen] = useState(false);
  const dateLabel = new Date(item.service_date).toLocaleDateString("it-IT", { weekday: "short", day: "2-digit", month: "short" });
  const timeLabel = item.service_time ? item.service_time.slice(0, 5) : null;
  // Compute end time label: prefer explicit end_time, otherwise derive from duration.
  const endTime = (() => {
    if (item.end_time) return item.end_time.slice(0, 5);
    if (!timeLabel || !item.duration_hours) return null;
    const [h, m] = timeLabel.split(":").map(Number);
    const total = h * 60 + m + Math.round(item.duration_hours * 60);
    const eh = Math.floor(total / 60) % 24;
    const em = total % 60;
    return `${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}`;
  })();

  // Compute actual start/end datetimes (handles overnight shifts via shared helpers).
  const startDt = getShiftStartDate(item);
  const endDt = getShiftEndDate(item);
  const now = Date.now();
  const beforeStart = !!startDt && now < startDt.getTime();
  const inProgress = !!startDt && !!endDt && now >= startDt.getTime() && now < endDt.getTime();
  const afterEnd = !!endDt && now >= endDt.getTime();
  const canClose = afterEnd;

  // Stato turno → label/colore
  const status = item.shift_status;
  let statusLabel = "Confermato";
  let statusClass = "bg-emerald-500/10 text-emerald-700 border-emerald-500/30";
  let StatusIcon = CheckCircle2;
  if (status === "scheduled" || status === null) {
    if (beforeStart) { statusLabel = "Turno assegnato"; }
    else if (inProgress) { statusLabel = "Turno in corso"; statusClass = "bg-amber-500/10 text-amber-700 border-amber-500/30"; StatusIcon = Clock; }
    else if (afterEnd) { statusLabel = "Turno concluso — da chiudere"; statusClass = "bg-orange-500/10 text-orange-700 border-orange-500/30"; StatusIcon = AlertTriangle; }
    else { statusLabel = "Confermato"; }
  }
  else if (status === "completed") { statusLabel = "Completato"; statusClass = "bg-blue-500/10 text-blue-700 border-blue-500/30"; StatusIcon = CheckCheck; }
  else if (status === "cancelled") { statusLabel = "Annullato"; statusClass = "bg-red-500/10 text-red-700 border-red-500/30"; StatusIcon = XCircle; }
  else if (status === "no_show") { statusLabel = "No-show"; statusClass = "bg-orange-500/10 text-orange-700 border-orange-500/30"; StatusIcon = AlertTriangle; }

  // Stato recensione
  const isOverdue = item.required_status === "overdue";
  let reviewLabel = "non ancora disponibile";
  let reviewClass = "text-muted-foreground";
  if (status === "completed") {
    if (item.has_review) { reviewLabel = "inviata"; reviewClass = "text-emerald-600"; }
    else if (isOverdue) { reviewLabel = "obbligatoria scaduta"; reviewClass = "text-destructive"; }
    else { reviewLabel = "da lasciare"; reviewClass = "text-amber-700"; }
  }

  return (
    <li className="rounded-xl border bg-background p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-medium">{item.role_label ?? "Servizio"}</div>
          {item.worker_name && (
            <div className="text-sm text-muted-foreground mt-0.5">{item.worker_name}</div>
          )}
          <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Calendar className="h-3.5 w-3.5 shrink-0" />
            <span>
              {dateLabel}
              {timeLabel && <> · {timeLabel}{endTime && ` - ${endTime}`}</>}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground truncate">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">{item.location_address}</span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${statusClass}`}>
            <StatusIcon className="h-3 w-3" />
            {statusLabel}
          </span>
          <span className={`text-[11px] ${reviewClass}`}>Recensione: {reviewLabel}</span>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {status === "scheduled" || status === null ? (
          <>
            <Button
              size="sm"
              onClick={canClose ? onClose : undefined}
              className="gap-1"
              disabled={!item.worker_id || !canClose}
              title={!canClose ? "Disponibile dopo la fine del turno" : undefined}
            >
              <CheckCheck className="h-4 w-4" /> Concludi turno
            </Button>
            {item.shift_id && !afterEnd && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setCancelOpen(true)}
                className="gap-1 border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20 hover:text-destructive focus-visible:ring-destructive"
                aria-label="Annulla turno"
              >
                <XCircle className="h-4 w-4" /> Annulla turno
              </Button>
            )}
            <span className="text-[11px] text-muted-foreground">
              {beforeStart && "Potrai concludere il turno dopo la fine del servizio."}
              {inProgress && (endTime ? `Turno in corso. Potrai concluderlo alle ${endTime}.` : "Turno in corso. Potrai concluderlo dopo la fine.")}
              {afterEnd && "Puoi chiudere il turno e lasciare la recensione."}
              {!startDt && "Dopo la chiusura potrai lasciare la recensione al lavoratore."}
            </span>
          </>
        ) : status === "completed" && !item.has_review ? (
          item.shift_id ? (
            <Link to="/ristoratore/turni/$shiftId" params={{ shiftId: item.shift_id }} search={{ section: "recensione" } as never}>
              <Button size="sm" variant={isOverdue ? "destructive" : "default"} className="gap-1">
                <Star className="h-4 w-4" /> {isOverdue ? "Recensione scaduta — agisci ora" : "Lascia recensione"}
              </Button>
            </Link>
          ) : (
            <Button size="sm" variant={isOverdue ? "destructive" : "default"} className="gap-1" disabled>
              <Star className="h-4 w-4" /> {isOverdue ? "Recensione scaduta — agisci ora" : "Lascia recensione"}
            </Button>
          )
        ) : status === "completed" && item.has_review ? (
          item.shift_id ? (
          <Link to="/ristoratore/turni/$shiftId" params={{ shiftId: item.shift_id }} search={{ section: "recensione" } as never}>
            <Button size="sm" variant="outline" className="gap-1">
              <Star className="h-4 w-4" /> Vedi recensione
            </Button>
          </Link>
          ) : null
        ) : status === "cancelled" ? (
          <span className="text-xs text-muted-foreground">Turno annullato</span>
        ) : status === "no_show" ? (
          item.app_id ? (
          <Link to="/messages/$id" params={{ id: item.app_id ?? "" }}>
            <Button size="sm" variant="outline" className="gap-1">
              <AlertTriangle className="h-4 w-4" /> Gestisci segnalazione
            </Button>
          </Link>
          ) : null
        ) : null}
        {item.shift_id ? (
          <Link to="/ristoratore/turni/$shiftId" params={{ shiftId: item.shift_id }} className="ml-auto">
            <Button size="sm" variant="ghost" className="gap-1">Dettagli <ArrowRight className="h-3.5 w-3.5" /></Button>
          </Link>
        ) : (
          <Link to="/announcements/$id" params={{ id: item.ann_id }} className="ml-auto">
            <Button size="sm" variant="ghost" className="gap-1">Dettagli <ArrowRight className="h-3.5 w-3.5" /></Button>
          </Link>
        )}
      </div>
      {item.shift_id && (
        <CancelShiftDialog
          open={cancelOpen}
          onOpenChange={setCancelOpen}
          shiftId={item.shift_id}
          restaurantId={user?.id ?? null}
          workerId={item.worker_id}
          applicationId={item.app_id}
          onCancelled={() => onCancelled?.(item.ann_id)}
        />
      )}
    </li>
  );
}
type FavWorker = {
  worker_id: string;
  full_name: string | null;
  primary_role: string | null;
  rating_avg: number | null;
  shifts_count: number;
  last_shift_date: string | null;
  last_application_id: string | null;
};

function FavoriteWorkersSection() {
  const { user } = useAuth();
  const [items, setItems] = useState<FavWorker[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!user) return;
      setLoading(true);
      const { data: favs } = await supabase
        .from("restaurant_worker_favorites")
        .select("worker_id")
        .eq("restaurant_id", user.id);
      const ids = (favs ?? []).map((f: any) => f.worker_id);
      if (ids.length === 0) { if (alive) { setItems([]); setLoading(false); } return; }

      const [{ data: profs }, { data: shifts }, { data: apps }] = await Promise.all([
        supabase.from("profiles")
          .select("id, full_name, primary_role, rating_avg")
          .in("id", ids),
        supabase.from("shifts")
          .select("worker_id, shift_date, status")
          .eq("restaurant_id", user.id)
          .in("worker_id", ids)
          .in("status", ["scheduled", "completed"]),
        supabase.from("applications")
          .select("id, worker_id, created_at")
          .eq("restaurant_id", user.id)
          .in("worker_id", ids)
          .order("created_at", { ascending: false }),
      ]);

      const agg = new Map<string, { count: number; last: string | null }>();
      (shifts ?? []).forEach((s: any) => {
        const cur = agg.get(s.worker_id) ?? { count: 0, last: null };
        cur.count += 1;
        if (!cur.last || s.shift_date > cur.last) cur.last = s.shift_date;
        agg.set(s.worker_id, cur);
      });
      const lastApp = new Map<string, string>();
      (apps ?? []).forEach((a: any) => { if (!lastApp.has(a.worker_id)) lastApp.set(a.worker_id, a.id); });
      const profMap = new Map((profs ?? []).map((p: any) => [p.id, p]));
      const out: FavWorker[] = ids.map((wid: string) => {
        const p: any = profMap.get(wid) ?? {};
        const a = agg.get(wid) ?? { count: 0, last: null };
        return {
          worker_id: wid,
          full_name: p.full_name ?? null,
          primary_role: p.primary_role ?? null,
          rating_avg: p.rating_avg ?? null,
          shifts_count: a.count,
          last_shift_date: a.last,
          last_application_id: lastApp.get(wid) ?? null,
        };
      }).sort((a, b) => (b.last_shift_date ?? "").localeCompare(a.last_shift_date ?? ""));
      if (alive) { setItems(out); setLoading(false); }
    })();
    return () => { alive = false; };
  }, [user]);

  if (loading || items.length === 0) return null;

  return (
    <div className="mt-6 rounded-2xl border bg-card p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Heart className="h-5 w-5 text-rose-600 fill-current" />
          <h2 className="font-semibold">Lavoratori preferiti</h2>
        </div>
        <Link to="/ristoratore/collaboratori">
          <Button variant="ghost" size="sm" className="gap-1">Vedi tutti <ArrowRight className="h-3.5 w-3.5" /></Button>
        </Link>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.slice(0, 6).map((w) => (
          <li key={w.worker_id} className="rounded-xl border p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-medium truncate">{w.full_name ?? "Lavoratore"}</div>
                <div className="text-xs text-muted-foreground capitalize truncate">{w.primary_role ?? "—"}</div>
                <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                  {w.rating_avg != null && (
                    <span className="inline-flex items-center gap-1"><Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />{Number(w.rating_avg).toFixed(1)}</span>
                  )}
                  <span>{w.shifts_count} turni</span>
                </div>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {w.last_application_id ? (
                <Link to="/messages/$id" params={{ id: w.last_application_id }}>
                  <Button size="sm" variant="outline" className="gap-1"><MessageSquare className="h-3.5 w-3.5" /> Ricontatta</Button>
                </Link>
              ) : (
                <Link to="/ristoratore/collaboratori">
                  <Button size="sm" variant="outline">Invita</Button>
                </Link>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
