import { PayOnHireBox } from "@/components/PayOnHireInfo";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell, PageHeader } from "@/components/AppShell";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Briefcase, Plus, Users, MessageSquare, AlertCircle, Coins, CheckCircle2, Calendar, MapPin, ArrowRight, Star, Clock, XCircle, AlertTriangle, CheckCheck, Heart, Store, BadgeCheck, CalendarDays } from "lucide-react";
import { ProfileStatusBanner } from "@/components/ProfileStatusBanner";
import { ProfileCompletionBanner } from "@/components/ProfileCompletionBanner";
import { toastOnce } from "@/lib/toast-dedup";
import { ReferralCard } from "@/components/ReferralCard";
import { RequiredReviewsBanner } from "@/components/RequiredReviewsBanner";
import { WorkerReputationCard } from "@/components/WorkerReputationCard";
import { WorkerMyReviews } from "@/components/WorkerMyReviews";
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

  useEffect(() => {
    if (!user || !role) return;
    // Profilo incompleto: NON forziamo più il redirect a /onboarding.
    // L'utente deve poter restare sulla dashboard per vedere il banner
    // "Profilo incompleto", l'avanzamento e l'elenco dei dati mancanti.
    // Le funzioni operative sono gate-ate altrove (ProfileGateProvider).
  }, [user, role, profile, nav]);

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
        description: "Conferma il numero per attivare completamente l'account.",
        action: { label: "Verifica", onClick: () => nav({ to: "/verify-phone" }) },
        duration: 8000,
      });
    } else if (!profileOk) {
      toastOnce("Profilo da completare", {
        key: "reminder:profile",
        variant: "message",
        guard: () => !profile.profile_completed,
        description: "Aggiungi le informazioni mancanti per pubblicare e candidarti.",
        action: { label: "Completa", onClick: () => nav({ to: "/onboarding" }) },
        duration: 8000,
      });
    }
  }, [profile, nav]);

  useEffect(() => {
    if (!user || !role) return;
    (async () => {
      if (role === "restaurant") {
        const { count: active } = await supabase.from("announcements").select("*", { count: "exact", head: true }).eq("restaurant_id", user.id).eq("status", "active");
        const { count: assignedCount } = await supabase.from("announcements").select("*", { count: "exact", head: true }).eq("restaurant_id", user.id).eq("status", "assigned");
        const { count: apps } = await supabase.from("applications").select("*", { count: "exact", head: true }).eq("restaurant_id", user.id);
        const { data: appIds } = await supabase.from("applications").select("id").eq("restaurant_id", user.id);
        const ids = (appIds ?? []).map((a) => a.id);
        const { count: msgs } = ids.length
          ? await supabase.from("messages").select("*", { count: "exact", head: true }).in("application_id", ids)
          : { count: 0 };
        setStats({ active: active ?? 0, assigned: assignedCount ?? 0, applications: apps ?? 0, messages: msgs ?? 0 });
        await loadAssigned(user.id);
      } else if (role === "worker") {
        const { count: apps } = await supabase.from("applications").select("*", { count: "exact", head: true }).eq("worker_id", user.id);
        const { data: appIds } = await supabase.from("applications").select("id").eq("worker_id", user.id);
        const ids = (appIds ?? []).map((a) => a.id);
        const { count: msgs } = ids.length
          ? await supabase.from("messages").select("*", { count: "exact", head: true }).in("application_id", ids)
          : { count: 0 };
        setStats({ active: 0, assigned: 0, applications: apps ?? 0, messages: msgs ?? 0 });
      }
    })();
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
          <Link to="/ristoratore/annunci/nuovo"><Button className="gap-2"><Plus className="h-4 w-4" /> Nuovo annuncio</Button></Link>
        )}
      />

      {role === "restaurant" && <PayOnHireBox className="mb-6" />}

      <ProfileCompletionBanner />
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

      {/* Vecchio mini-box "Profilo incompleto" rimosso:
          ora gestito da <ProfileCompletionBanner /> con barra di
          avanzamento ed elenco dinamico dei dati mancanti. */}

      <div className={`grid gap-4 ${role === "restaurant" ? "md:grid-cols-4" : "md:grid-cols-3"}`}>
        <StatCard icon={Briefcase} label={role === "restaurant" ? "Annunci attivi" : "Candidature"} value={role === "restaurant" ? stats.active : stats.applications} />
        {role === "restaurant" && (
          <Link to="/announcements" search={{ status: "assigned" } as never} className="block">
            <StatCard icon={CheckCircle2} label="Annunci assegnati" value={stats.assigned} highlight />
          </Link>
        )}
        <StatCard icon={Users} label="Candidature totali" value={stats.applications} />
        <StatCard icon={MessageSquare} label="Messaggi" value={stats.messages} />
      </div>

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
              />
            ))}
          </ul>
        </div>
      )}

      {role === "restaurant" && <FavoriteWorkersSection />}

      {role === "worker" && user && profile && (
        <div className="mt-6 space-y-6">
          <section>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-primary" />
                <h2 className="font-semibold">Le mie disponibilità</h2>
              </div>
              <Link to="/availability">
                <Button variant="ghost" size="sm" className="gap-1">
                  Gestisci <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
            <div className="rounded-2xl border bg-card p-4 text-sm text-muted-foreground">
              Indica i giorni e gli orari in cui sei disponibile per ricevere proposte di lavoro più adatte ai tuoi orari.
              <div className="mt-3">
                <Link to="/availability">
                  <Button size="sm" className="gap-2">
                    <CalendarDays className="h-4 w-4" /> Imposta disponibilità
                  </Button>
                </Link>
              </div>
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Star className="h-5 w-5 text-primary" />
                <h2 className="font-semibold">La mia reputazione</h2>
              </div>
              <Link to="/profile">
                <Button variant="ghost" size="sm" className="gap-1">
                  Apri profilo <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
            <WorkerReputationCard workerId={user.id} profile={profile as never} showTips />
            <p className="mt-2 text-xs text-muted-foreground italic">
              Più turni completi con buone recensioni, più aumenta la tua visibilità verso i ristoratori.
            </p>
          </section>

          <section>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                <h2 className="font-semibold">Le mie recensioni</h2>
              </div>
              <Link to="/profile">
                <Button variant="ghost" size="sm" className="gap-1">
                  Vedi tutte le recensioni <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
            <WorkerMyReviews workerId={user.id} limit={3} />
          </section>
        </div>
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

      <div className="mt-8 rounded-2xl border bg-card p-6">
        <h2 className="font-semibold mb-2">Cosa puoi fare ora</h2>
        <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
          {role === "restaurant" && <>
            <li>Crea un nuovo annuncio per il prossimo servizio</li>
            <li>Cerca lavoratori disponibili nella tua zona</li>
            <li>Chatta con i candidati interessati</li>
          </>}
          {role === "worker" && <>
            <li>Aggiorna il tuo profilo professionale</li>
            <li>Rispondi alle offerte ricevute</li>
            <li>Imposta la tua zona di interesse</li>
          </>}
          {role === "admin" && <li>Apri il pannello Admin per gestire utenti e annunci</li>}
        </ul>
      </div>

      <div className="mt-6">
        <ReferralCard />
      </div>
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

function AssignedShiftCard({ item, onClose }: { item: AssignedItem; onClose: () => void }) {
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
