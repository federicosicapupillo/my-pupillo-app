import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell, PageHeader } from "@/components/AppShell";
import { useAuth } from "@/lib/auth-context";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Star, MessageSquare, Send, Heart, Search, Calendar, Users, CheckCircle2, Sparkles, Gift, Quote, ArrowRight, Trophy } from "lucide-react";
import { UserAvatar } from "@/components/UserAvatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { sendShiftProposal } from "@/lib/shift-proposal";
import { setLastAnnouncementId } from "@/lib/last-announcement";
import { getShiftStartDate } from "@/lib/announcement-time";
import { useRequiredReviews } from "@/lib/required-reviews";
import { BlockedContactDialog } from "@/components/BlockedContactDialog";
import { AlreadyInContactDialog } from "@/components/AlreadyInContactDialog";
import { checkExistingContact, isDuplicateContactError } from "@/lib/already-in-contact";

export const Route = createFileRoute("/ristoratore/collaboratori")({
  head: () => ({ meta: [{ title: "Collaboratori — Pupillo" }] }),
  component: () => <RequireAuth><Page /></RequireAuth>,
});

type Row = {
  worker_id: string;
  full_name: string | null;
  avatar_url: string | null;
  badge: string | null;
  rating_avg: number | null;
  primary_role: string | null;
  spoken_languages: any;
  reliability_pct: number | null;
  shifts_count: number;
  last_shift_date: string | null;
  last_application_id: string | null;
  is_favorite: boolean;
  last_review: string | null;
  last_review_rating: number | null;
};

type AnnLite = { id: string; service_date: string; service_time: string; location_address: string };

function Page() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [onlyFav, setOnlyFav] = useState(false);
  const [sortMode, setSortMode] = useState<"recent" | "top_rated" | "most_used">("recent");
  const [inviteFor, setInviteFor] = useState<Row | null>(null);
  const [openAnns, setOpenAnns] = useState<AnnLite[]>([]);
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const { isBlocked, actionShifts } = useRequiredReviews();
  const [blockOpen, setBlockOpen] = useState(false);
  const [alreadyContactAppId, setAlreadyContactAppId] = useState<string | null>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    // 1) Shifts of this restaurant
    const { data: shifts } = await supabase
      .from("shifts")
      .select("worker_id, shift_date, status")
      .eq("restaurant_id", user.id)
      .in("status", ["scheduled", "completed"]);

    const byWorker = new Map<string, { count: number; last: string | null }>();
    (shifts ?? []).forEach((s: any) => {
      const cur = byWorker.get(s.worker_id) ?? { count: 0, last: null };
      cur.count += 1;
      if (!cur.last || s.shift_date > cur.last) cur.last = s.shift_date;
      byWorker.set(s.worker_id, cur);
    });

    const workerIds = Array.from(byWorker.keys());
    if (workerIds.length === 0) { setRows([]); setLoading(false); return; }

    const [{ data: profs }, { data: favs }, { data: apps }, { data: reviews }] = await Promise.all([
      supabase.from("profiles")
        .select("id, full_name, avatar_url, badge, rating_avg, primary_role, spoken_languages, reliability_pct")
        .in("id", workerIds),
      supabase.from("restaurant_worker_favorites")
        .select("worker_id").eq("restaurant_id", user.id),
      supabase.from("applications")
        .select("id, worker_id, created_at")
        .eq("restaurant_id", user.id)
        .in("worker_id", workerIds)
        .order("created_at", { ascending: false }),
      supabase.from("reviews")
        .select("target_id, rating, comment, created_at")
        .eq("author_id", user.id)
        .in("target_id", workerIds)
        .order("created_at", { ascending: false }),
    ]);

    const favSet = new Set((favs ?? []).map((f: any) => f.worker_id));
    const lastApp = new Map<string, string>();
    (apps ?? []).forEach((a: any) => { if (!lastApp.has(a.worker_id)) lastApp.set(a.worker_id, a.id); });
    const lastReview = new Map<string, { comment: string | null; rating: number | null }>();
    (reviews ?? []).forEach((rv: any) => {
      if (!lastReview.has(rv.target_id)) lastReview.set(rv.target_id, { comment: rv.comment ?? null, rating: rv.rating ?? null });
    });

    const profMap = new Map((profs ?? []).map((p: any) => [p.id, p]));
    const out: Row[] = workerIds.map((wid) => {
      const p: any = profMap.get(wid) ?? {};
      const agg = byWorker.get(wid)!;
      return {
        worker_id: wid,
        full_name: p.full_name ?? null,
        avatar_url: p.avatar_url ?? null,
        badge: p.badge ?? null,
        rating_avg: p.rating_avg ?? null,
        primary_role: p.primary_role ?? null,
        spoken_languages: p.spoken_languages ?? null,
        reliability_pct: p.reliability_pct ?? null,
        shifts_count: agg.count,
        last_shift_date: agg.last,
        last_application_id: lastApp.get(wid) ?? null,
        is_favorite: favSet.has(wid),
        last_review: lastReview.get(wid)?.comment ?? null,
        last_review_rating: lastReview.get(wid)?.rating ?? null,
      };
    }).sort((a, b) => (b.last_shift_date ?? "").localeCompare(a.last_shift_date ?? ""));

    setRows(out);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = rows.filter(r => {
      if (onlyFav && !r.is_favorite) return false;
      if (!term) return true;
      const hay = [r.full_name, r.primary_role, r.badge].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(term);
    });
    const sorted = [...list];
    if (sortMode === "top_rated") {
      sorted.sort((a, b) => (b.rating_avg ?? 0) - (a.rating_avg ?? 0));
    } else if (sortMode === "most_used") {
      sorted.sort((a, b) => b.shifts_count - a.shifts_count);
    } else {
      sorted.sort((a, b) => (b.last_shift_date ?? "").localeCompare(a.last_shift_date ?? ""));
    }
    return sorted;
  }, [rows, q, onlyFav, sortMode]);

  const stats = useMemo(() => {
    const total = rows.length;
    const free = rows.length; // all "già utilizzati" sono ricontattabili gratis
    const last = rows.reduce<string | null>((acc, r) => {
      if (!r.last_shift_date) return acc;
      if (!acc || r.last_shift_date > acc) return r.last_shift_date;
      return acc;
    }, null);
    return { total, free, last };
  }, [rows]);

  const toggleFav = async (r: Row) => {
    if (!user) return;
    if (r.is_favorite) {
      const { error } = await supabase.from("restaurant_worker_favorites")
        .delete().eq("restaurant_id", user.id).eq("worker_id", r.worker_id);
      if (error) { toast.error(error.message); return; }
      toast.success("Rimosso dai preferiti");
    } else {
      const { error } = await supabase.from("restaurant_worker_favorites")
        .insert({ restaurant_id: user.id, worker_id: r.worker_id });
      if (error) { toast.error(error.message); return; }
      toast.success("Aggiunto ai preferiti");
    }
    setRows(prev => prev.map(p => p.worker_id === r.worker_id ? { ...p, is_favorite: !p.is_favorite } : p));
  };

  const recontact = async (r: Row) => {
    if (r.last_application_id) {
      navigate({ to: "/messages/$id", params: { id: r.last_application_id } });
      return;
    }
    toast.message("Crea un nuovo invito a un turno per avviare la chat.", {
      action: { label: "Invita", onClick: () => openInvite(r) },
    });
  };

  const openInvite = async (r: Row) => {
    if (!user) return;
    if (isBlocked) { setBlockOpen(true); return; }
    const { data } = await supabase.from("announcements")
      .select("id, service_date, service_time, location_address, status")
      .eq("restaurant_id", user.id)
      .eq("status", "active")
      .order("service_date", { ascending: true });
    const now = new Date();
    const filtered = ((data ?? []) as any[]).filter((a) => {
      const start = getShiftStartDate(a);
      return start ? start.getTime() > now.getTime() : true;
    });
    setOpenAnns(filtered as any);
    setInviteFor(r);
  };

  const sendInvite = async (annId: string) => {
    if (!inviteFor || !user) return;
    setInviteSubmitting(true);
    try {
      // Blocca se esiste già una candidatura/proposta attiva per questo annuncio.
      const contact = await checkExistingContact({
        announcementId: annId,
        workerId: inviteFor.worker_id,
      });
      if (contact.existing) {
        setInviteFor(null);
        setAlreadyContactAppId(contact.applicationId);
        setInviteSubmitting(false);
        return;
      }
      const { data: ins, error } = await supabase.from("applications")
        .insert({
          announcement_id: annId,
          worker_id: inviteFor.worker_id,
          restaurant_id: user.id,
          status: "pending",
        }).select("id").single();
      if (error) {
        if (isDuplicateContactError(error)) {
          const c = await checkExistingContact({ announcementId: annId, workerId: inviteFor.worker_id });
          setInviteFor(null);
          setAlreadyContactAppId(c.existing ? c.applicationId : null);
          setInviteSubmitting(false);
          return;
        }
        throw error;
      }
      const appId = ins!.id as string;
      // Auto-message: graphical shift proposal pre-filled with announcement details.
      await sendShiftProposal({
        applicationId: appId,
        announcementId: annId,
        restaurantId: user.id,
        workerId: inviteFor.worker_id,
      });
      setLastAnnouncementId(user.id, annId);
      // Notify worker
      await supabase.from("notifications").insert({
        user_id: inviteFor.worker_id,
        title: "Nuovo invito da un locale dove hai già lavorato",
        body: "Un ristoratore con cui hai già collaborato ti ha invitato a un nuovo turno.",
        link: `/messages/${appId}`,
      });
      toast.success("Invito inviato");
      setInviteFor(null);
      navigate({ to: "/messages/$id", params: { id: appId } });
    } catch (e: any) {
      toast.error(e.message ?? "Errore invio invito");
    } finally {
      setInviteSubmitting(false);
    }
  };

  if (role !== "restaurant") {
    return <AppShell><p className="text-muted-foreground">Sezione riservata ai ristoratori.</p></AppShell>;
  }

  return (
    <AppShell>
      <PageHeader
        title="Collaboratori già utilizzati"
        subtitle="Ritrova facilmente i lavoratori con cui hai già collaborato."
      />
      <BlockedContactDialog open={blockOpen} onClose={() => setBlockOpen(false)} shifts={actionShifts} />

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
        <div className="rounded-2xl border bg-gradient-to-br from-primary/10 to-primary/5 p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Users className="h-3.5 w-3.5" /> Collaboratori
          </div>
          <div className="text-2xl font-bold tabular-nums mt-1">{stats.total}</div>
        </div>
        <div className="rounded-2xl border bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Gift className="h-3.5 w-3.5" /> Ricontatto gratis
          </div>
          <div className="text-2xl font-bold tabular-nums mt-1">{stats.free}</div>
        </div>
        <div className="rounded-2xl border bg-card p-4 col-span-2 sm:col-span-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" /> Ultima collaborazione
          </div>
          <div className="text-base font-semibold mt-1">
            {stats.last ? new Date(stats.last).toLocaleDateString("it-IT", { day: "numeric", month: "long" }) : "—"}
          </div>
        </div>
      </div>

      {/* Search + filter */}
      <div className="flex flex-col sm:flex-row gap-2 mb-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cerca collaboratore per nome, ruolo o badge"
            className="pl-9 h-11 rounded-xl"
          />
        </div>
        <Button
          variant={onlyFav ? "default" : "outline"}
          onClick={() => setOnlyFav(v => !v)}
          className="gap-2 h-11 rounded-xl"
        >
          <Heart className={`h-4 w-4 ${onlyFav ? "fill-current" : ""}`} />
          Preferiti
        </Button>
      </div>

      {/* Sort chips */}
      <div className="flex flex-wrap gap-2 mb-5">
        {([
          { id: "recent", label: "Più recenti" },
          { id: "top_rated", label: "Miglior valutati" },
          { id: "most_used", label: "Più utilizzati" },
        ] as const).map((opt) => (
          <button
            key={opt.id}
            onClick={() => setSortMode(opt.id)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              sortMode === opt.id
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card hover:bg-muted border-border text-foreground"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[0,1,2].map((i) => (
            <div key={i} className="rounded-2xl border bg-card p-5 animate-pulse h-56" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl border bg-card p-12 text-center">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            <Users className="h-8 w-8 text-primary" />
          </div>
          <p className="font-semibold text-lg">Nessun collaboratore ancora utilizzato</p>
          <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
            Quando completerai un turno con un lavoratore, lo ritroverai qui per poterlo ricontattare più velocemente.
          </p>
          <Link to="/workers" className="inline-block mt-5">
            <Button className="gap-2">
              <Search className="h-4 w-4" /> Cerca lavoratori
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((r) => {
            const isTop = (r.rating_avg ?? 0) >= 4.7 && r.shifts_count >= 2;
            const recent = r.last_shift_date
              ? (Date.now() - new Date(r.last_shift_date).getTime()) / (1000 * 60 * 60 * 24) <= 30
              : false;
            return (
              <div
                key={r.worker_id}
                role="link"
                tabIndex={0}
                onClick={() => navigate({ to: "/workers_/$id", params: { id: r.worker_id } })}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    navigate({ to: "/workers_/$id", params: { id: r.worker_id } });
                  }
                }}
                className="group relative rounded-3xl border bg-card p-5 flex flex-col gap-4 shadow-sm hover:shadow-lg hover:-translate-y-0.5 hover:border-primary/30 transition-all duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                aria-label={`Apri profilo di ${r.full_name ?? "lavoratore"}`}
              >
                <button
                  onClick={(e) => { e.stopPropagation(); toggleFav(r); }}
                  className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-muted transition-colors"
                  aria-label="Preferito"
                >
                  <Heart className={`h-4 w-4 ${r.is_favorite ? "fill-red-500 text-red-500" : "text-muted-foreground"}`} />
                </button>

                {/* Header */}
                <div className="flex items-start gap-3 pr-8">
                  <div className="relative">
                    <UserAvatar userId={r.worker_id} name={r.full_name} className="h-14 w-14 ring-2 ring-primary/10" />
                    {isTop && (
                      <span className="absolute -bottom-1 -right-1 bg-amber-400 text-amber-950 rounded-full p-1 shadow">
                        <Trophy className="h-3 w-3" />
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-base leading-tight truncate">{r.full_name ?? "Lavoratore"}</div>
                    <div className="text-xs text-muted-foreground capitalize truncate mt-0.5">{r.primary_role ?? "Collaboratore"}</div>
                    {typeof r.rating_avg === "number" && r.rating_avg > 0 && (
                      <div className="flex items-center gap-1 mt-1.5">
                        {[1,2,3,4,5].map(i => (
                          <Star
                            key={i}
                            className={`h-3.5 w-3.5 ${i <= Math.round(r.rating_avg!) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`}
                          />
                        ))}
                        <span className="text-xs font-medium text-foreground ml-1 tabular-nums">{r.rating_avg.toFixed(1)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Badges */}
                <div className="flex flex-wrap gap-1.5">
                  <Badge className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/15 gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Già lavorato con te
                  </Badge>
                  <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/15 gap-1">
                    <Gift className="h-3 w-3" /> Ricontatto gratuito
                  </Badge>
                  {isTop && (
                    <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20 hover:bg-amber-500/15 gap-1">
                      <Sparkles className="h-3 w-3" /> Top collaboratore
                    </Badge>
                  )}
                  {recent && (
                    <Badge variant="secondary" className="gap-1">
                      <Calendar className="h-3 w-3" /> Collab. recente
                    </Badge>
                  )}
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-muted/50 p-3">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Turni insieme</div>
                    <div className="text-lg font-bold text-foreground tabular-nums leading-tight">{r.shifts_count}</div>
                  </div>
                  <div className="rounded-xl bg-muted/50 p-3">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Ultima volta</div>
                    <div className="text-sm font-semibold text-foreground leading-tight">
                      {r.last_shift_date
                        ? new Date(r.last_shift_date).toLocaleDateString("it-IT", { day: "numeric", month: "short" })
                        : "—"}
                    </div>
                  </div>
                </div>

                {/* Last review */}
                {r.last_review && (
                  <div className="rounded-xl border bg-muted/30 p-3 relative">
                    <Quote className="h-3.5 w-3.5 text-primary/50 absolute top-2 left-2" />
                    <p className="text-xs text-foreground/80 italic line-clamp-2 pl-5">
                      "{r.last_review}"
                    </p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-col gap-2 mt-auto" onClick={(e) => e.stopPropagation()}>
                  <Button
                    size="sm"
                    className="w-full gap-1.5 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-sm"
                    onClick={(e) => { e.stopPropagation(); recontact(r); }}
                  >
                    <MessageSquare className="h-4 w-4" /> Ricontatta gratis
                  </Button>
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" className="flex-1 gap-1" onClick={(e) => { e.stopPropagation(); openInvite(r); }}>
                      <Send className="h-3.5 w-3.5" /> Invita
                    </Button>
                    <Link to="/workers_/$id" params={{ id: r.worker_id }} className="flex-1" onClick={(e) => e.stopPropagation()}>
                      <Button size="sm" variant="outline" className="w-full gap-1">
                        Profilo <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!inviteFor} onOpenChange={(o) => !o && setInviteFor(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Invita {inviteFor?.full_name ?? "il lavoratore"} a un nuovo turno</DialogTitle>
            <DialogDescription>
              Seleziona uno dei tuoi annunci attivi. La conferma scalerà 7 crediti solo se il lavoratore accetta.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[50vh] overflow-y-auto space-y-2">
            {openAnns.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-6">
                Nessun annuncio attivo. <Link to="/announcements/new" className="text-primary underline">Crea un annuncio</Link>.
              </div>
            ) : openAnns.map((a) => (
              <button
                key={a.id}
                disabled={inviteSubmitting}
                onClick={() => sendInvite(a.id)}
                className="w-full text-left rounded-xl border p-3 hover:border-primary hover:bg-primary/5 transition-colors disabled:opacity-50"
              >
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Calendar className="h-4 w-4 text-primary" />
                  {new Date(a.service_date).toLocaleDateString("it-IT")}
                  {a.service_time ? ` · ${a.service_time.slice(0,5)}` : ""}
                </div>
                {a.location_address && (
                  <div className="text-xs text-muted-foreground mt-1 truncate">{a.location_address}</div>
                )}
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteFor(null)}>Chiudi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}