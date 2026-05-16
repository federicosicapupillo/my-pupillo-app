import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell, PageHeader } from "@/components/AppShell";
import { useAuth } from "@/lib/auth-context";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Star, MessageSquare, Send, Heart, Search, Calendar, Users, CheckCircle2, Moon, Clock, MapPin, Euro, Shirt, ListChecks, Coffee } from "lucide-react";
import { UserAvatar } from "@/components/UserAvatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ensureProposalApplication } from "@/lib/messages.functions";

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
};

type AnnLite = { id: string; service_date: string; service_time: string; location_address: string };

type AnnFull = AnnLite & {
  professional_profile: string | null;
  tariff_amount: number | null;
  tariff_type: string | null;
  duration_hours: number | null;
  job_city: string | null;
  job_province: string | null;
  end_date: string | null;
  end_time: string | null;
  is_long_shift: boolean | null;
  long_shift_reason: string | null;
  dress_code_items: string[] | null;
  dress_code_notes: string | null;
  required_skills: string[] | null;
  notes: string | null;
  job_address: string | null;
};

const RECALL_TEMPLATES = [
  { id: "recall_collab", body: "Ciao, abbiamo già collaborato e vorremmo proporti un nuovo servizio." },
  { id: "recall_available", body: "Sei disponibile per un nuovo turno presso il nostro locale?" },
  { id: "recall_similar", body: "Abbiamo un turno simile al precedente e vorremmo ricontattarti." },
  { id: "recall_next_days", body: "Vorremmo proporti un nuovo servizio nei prossimi giorni." },
  { id: "recall_evaluate", body: "Ti invitiamo a valutare questo nuovo turno." },
] as const;

function Page() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const ensureApplication = useServerFn(ensureProposalApplication);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [onlyFav, setOnlyFav] = useState(false);
  const [inviteFor, setInviteFor] = useState<Row | null>(null);
  const [openAnns, setOpenAnns] = useState<AnnFull[]>([]);
  const [selectedAnnId, setSelectedAnnId] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(RECALL_TEMPLATES[0].id);
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [restaurantName, setRestaurantName] = useState<string>("");

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

    const [{ data: profs }, { data: favs }, { data: apps }] = await Promise.all([
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
    ]);

    const favSet = new Set((favs ?? []).map((f: any) => f.worker_id));
    const lastApp = new Map<string, string>();
    (apps ?? []).forEach((a: any) => { if (!lastApp.has(a.worker_id)) lastApp.set(a.worker_id, a.id); });

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
      };
    }).sort((a, b) => (b.last_shift_date ?? "").localeCompare(a.last_shift_date ?? ""));

    setRows(out);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter(r => {
      if (onlyFav && !r.is_favorite) return false;
      if (!term) return true;
      const hay = [r.full_name, r.primary_role, r.badge].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(term);
    });
  }, [rows, q, onlyFav]);

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

  const openInvite = async (r: Row) => {
    if (!user) return;
    if ((r.shifts_count ?? 0) <= 0) {
      toast.error("Puoi ricontattare solo lavoratori che hanno già completato un turno con te.");
      return;
    }
    const { data } = await supabase.from("announcements")
      .select("id, service_date, service_time, location_address, professional_profile, tariff_amount, tariff_type, duration_hours, job_city, job_province, status, end_date, end_time, is_long_shift, long_shift_reason, dress_code_items, dress_code_notes, required_skills, notes, job_address")
      .eq("restaurant_id", user.id)
      .eq("status", "active")
      .order("service_date", { ascending: true });
    setOpenAnns((data ?? []) as any);
    setSelectedAnnId(((data ?? [])[0] as any)?.id ?? null);
    setSelectedTemplateId(RECALL_TEMPLATES[0].id);
    const { data: rest } = await supabase.from("profiles")
      .select("business_name, full_name").eq("id", user.id).maybeSingle();
    setRestaurantName((rest as any)?.business_name || (rest as any)?.full_name || "");
    setInviteFor(r);
  };

  const sendInvite = async () => {
    if (!inviteFor || !user || !selectedAnnId) return;
    const annId = selectedAnnId;
    const tpl = RECALL_TEMPLATES.find((t) => t.id === selectedTemplateId) ?? RECALL_TEMPLATES[0];
    setInviteSubmitting(true);
    try {
      const result = await ensureApplication({
        data: { announcementId: annId, workerId: inviteFor.worker_id },
      });
      const appId = result.applicationId;
      // Compose a rich summary so the worker sees ALL details of the proposed service.
      const ann = openAnns.find((a) => a.id === annId);
      const summaryLines: string[] = ["📋 Proposta nuovo servizio", ""];
      if (ann?.professional_profile) summaryLines.push(`• Ruolo: ${ann.professional_profile}`);
      if (restaurantName) summaryLines.push(`• Locale: ${restaurantName}`);
      if (ann?.service_date) {
        const d = new Date(ann.service_date).toLocaleDateString("it-IT");
        summaryLines.push(`• Data inizio: ${d}${ann.service_time ? ` · ${ann.service_time.slice(0, 5)}` : ""}`);
      }
      if (ann?.end_date || ann?.end_time) {
        const ed = ann.end_date ? new Date(ann.end_date).toLocaleDateString("it-IT") : (ann?.service_date ? new Date(ann.service_date).toLocaleDateString("it-IT") : "");
        summaryLines.push(`• Fine: ${ed}${ann.end_time ? ` · ${ann.end_time.slice(0, 5)}` : ""}`);
      }
      if (ann?.tariff_amount != null) {
        summaryLines.push(`• Tariffa: €${Number(ann.tariff_amount).toFixed(2)}${ann.tariff_type === "hourly" ? "/h" : ""}`);
      }
      const zone = [ann?.job_city, ann?.job_province].filter(Boolean).join(", ");
      if (zone) summaryLines.push(`• Zona: ${zone}`);
      if (ann?.job_address || ann?.location_address) summaryLines.push(`• Indirizzo: ${ann?.job_address || ann?.location_address}`);
      if (ann?.dress_code_items && ann.dress_code_items.length) summaryLines.push(`• Dress code: ${ann.dress_code_items.join(", ")}`);
      if (ann?.dress_code_notes) summaryLines.push(`  ${ann.dress_code_notes}`);
      if (ann?.required_skills && ann.required_skills.length) summaryLines.push(`• Requisiti: ${ann.required_skills.join(", ")}`);
      if (ann?.is_long_shift) summaryLines.push(`• ⚠️ Turno lungo${ann.long_shift_reason ? ` — ${ann.long_shift_reason}` : ""}`);
      if (ann?.notes) summaryLines.push(`• Note: ${ann.notes}`);
      summaryLines.push("", `💬 ${tpl.body}`);

      await supabase.from("messages").insert({
        application_id: appId,
        sender_id: user.id,
        receiver_id: inviteFor.worker_id,
        message_type: "template",
        template_id: tpl.id,
        action_type: "recall_worker",
        body: summaryLines.join("\n"),
      });
      await supabase.from("notifications").insert({
        user_id: inviteFor.worker_id,
        title: "Nuova proposta di servizio",
        body: "Un locale dove hai già lavorato ti ha proposto un nuovo turno.",
        link: `/messages/${appId}`,
      });
      toast.success("Proposta inviata");
      setInviteFor(null);
      navigate({ to: "/messages/$id", params: { id: appId } });
    } catch (e: any) {
      toast.error(e.message ?? "Errore invio proposta");
    } finally {
      setInviteSubmitting(false);
    }
  };

  const selectedAnn = openAnns.find((a) => a.id === selectedAnnId) ?? null;

  const isNightShift = (() => {
    if (!selectedAnn?.service_time) return false;
    const start = selectedAnn.service_time.slice(0, 5);
    const end = (selectedAnn.end_time || "").slice(0, 5);
    if (!end) return false;
    // crosses midnight if end <= start (lexicographic on HH:MM works)
    return end <= start;
  })();
  const isLongShift = !!selectedAnn?.is_long_shift || (selectedAnn?.duration_hours ? Number(selectedAnn.duration_hours) > 8 : false);

  if (role !== "restaurant") {
    return <AppShell><p className="text-muted-foreground">Sezione riservata ai ristoratori.</p></AppShell>;
  }

  return (
    <AppShell>
      <PageHeader
        title="Collaboratori già utilizzati"
        subtitle="Ritrova e ricontatta i lavoratori che hanno già svolto un turno con il tuo locale."
      />

      <div className="flex flex-col sm:flex-row gap-2 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cerca tra i lavoratori già utilizzati"
            className="pl-9"
          />
        </div>
        <Button
          variant={onlyFav ? "default" : "outline"}
          onClick={() => setOnlyFav(v => !v)}
          className="gap-2"
        >
          <Heart className={`h-4 w-4 ${onlyFav ? "fill-current" : ""}`} />
          Preferiti
        </Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Caricamento…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border bg-card p-12 text-center">
          <Users className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
          <p className="font-medium">Nessun collaboratore ancora</p>
          <p className="text-sm text-muted-foreground mt-1">
            Quando confermerai un lavoratore per un turno, lo ritroverai qui per richiamarlo facilmente.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((r) => (
            <div key={r.worker_id} className="rounded-2xl border bg-card p-5 flex flex-col gap-3 hover:shadow-md transition-shadow">
              <div className="flex items-start gap-3">
                <UserAvatar userId={r.worker_id} name={r.full_name} className="h-12 w-12" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="font-semibold truncate">{r.full_name ?? "Lavoratore"}</div>
                    {r.is_favorite && (
                      <Badge variant="secondary" className="gap-1">
                        <Heart className="h-3 w-3 fill-current" /> Preferito
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground capitalize truncate">{r.primary_role ?? "—"}</div>
                  <div className="flex items-center gap-2 mt-1 text-xs">
                    {r.badge && <Badge className="capitalize">{r.badge}</Badge>}
                    {typeof r.rating_avg === "number" && r.rating_avg > 0 && (
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <Star className="h-3.5 w-3.5 fill-yellow-500 text-yellow-500" />
                        {r.rating_avg.toFixed(1)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div className="rounded-lg bg-muted/40 p-2">
                  <div className="text-[10px] uppercase tracking-wide">Turni svolti</div>
                  <div className="text-base font-bold text-foreground tabular-nums">{r.shifts_count}</div>
                </div>
                <div className="rounded-lg bg-muted/40 p-2">
                  <div className="text-[10px] uppercase tracking-wide">Ultimo turno</div>
                  <div className="text-sm font-semibold text-foreground">
                    {r.last_shift_date ? new Date(r.last_shift_date).toLocaleDateString("it-IT") : "—"}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2 mt-1">
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1 gap-1" onClick={() => openInvite(r)}>
                    <MessageSquare className="h-4 w-4" />Ricontatta
                  </Button>
                  {r.last_application_id && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 gap-1"
                      onClick={() => navigate({ to: "/messages/$id", params: { id: r.last_application_id! } })}
                    >
                      <Send className="h-4 w-4" />Chat precedente
                    </Button>
                  )}
                </div>
                <div className="flex gap-2">
                  <Link to="/workers_/$id" params={{ id: r.worker_id }} className="flex-1">
                    <Button size="sm" variant="outline" className="w-full">Vedi profilo</Button>
                  </Link>
                  <Button size="sm" variant="ghost" onClick={() => toggleFav(r)} className="gap-1">
                    <Heart className={`h-4 w-4 ${r.is_favorite ? "fill-current text-red-500" : ""}`} />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!inviteFor} onOpenChange={(o) => !o && setInviteFor(null)}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto bg-background border-2 border-primary/40 shadow-2xl shadow-primary/20">
          <DialogHeader>
            <DialogTitle className="text-xl">Proponi un nuovo servizio</DialogTitle>
            <DialogDescription className="text-foreground/80">
              Stai ricontattando {inviteFor?.full_name ?? "un lavoratore"} che ha già collaborato con il tuo locale.
            </DialogDescription>
          </DialogHeader>

          {openAnns.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-6 rounded-xl border bg-muted/30">
              Nessun annuncio attivo. <Link to="/announcements/new" className="text-primary underline">Crea un annuncio</Link>.
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Seleziona servizio da proporre</label>
                <div className="space-y-2">
                  {openAnns.map((a) => {
                    const active = a.id === selectedAnnId;
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => setSelectedAnnId(a.id)}
                        className={`w-full text-left rounded-xl border p-3 transition-colors ${active ? "border-primary bg-primary/5" : "hover:border-primary/50"}`}
                      >
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <Calendar className="h-4 w-4 text-primary" />
                          {new Date(a.service_date).toLocaleDateString("it-IT")} · {a.service_time?.slice(0, 5)}
                          {active && <CheckCircle2 className="h-4 w-4 text-primary ml-auto" />}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1 truncate">{a.location_address}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {selectedAnn && (
                <div className="rounded-xl border-2 border-border bg-card p-4 text-sm space-y-2">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-[11px] uppercase tracking-wide font-semibold text-primary">Riepilogo servizio</div>
                    <div className="flex gap-1">
                      {isNightShift && <Badge variant="secondary" className="gap-1 bg-indigo-500/15 text-indigo-700 dark:text-indigo-300"><Moon className="h-3 w-3" />Notturno</Badge>}
                      {isLongShift && <Badge variant="secondary" className="gap-1 bg-amber-500/15 text-amber-700 dark:text-amber-300"><Clock className="h-3 w-3" />Turno lungo</Badge>}
                    </div>
                  </div>
                  {selectedAnn.professional_profile && (
                    <div className="flex justify-between gap-2"><span className="text-muted-foreground">Ruolo</span><span className="font-medium capitalize text-right">{selectedAnn.professional_profile}</span></div>
                  )}
                  {restaurantName && (
                    <div className="flex justify-between gap-2"><span className="text-muted-foreground">Locale</span><span className="font-medium text-right truncate">{restaurantName}</span></div>
                  )}
                  <div className="flex justify-between gap-2"><span className="text-muted-foreground">Inizio</span><span className="font-medium text-right">{new Date(selectedAnn.service_date).toLocaleDateString("it-IT")} · {selectedAnn.service_time?.slice(0,5)}</span></div>
                  {(selectedAnn.end_date || selectedAnn.end_time) && (
                    <div className="flex justify-between gap-2"><span className="text-muted-foreground">Fine</span><span className="font-medium text-right">{(selectedAnn.end_date ? new Date(selectedAnn.end_date) : new Date(selectedAnn.service_date)).toLocaleDateString("it-IT")}{selectedAnn.end_time ? ` · ${selectedAnn.end_time.slice(0,5)}` : ""}</span></div>
                  )}
                  {selectedAnn.tariff_amount != null && (
                    <div className="flex justify-between gap-2"><span className="text-muted-foreground inline-flex items-center gap-1"><Euro className="h-3.5 w-3.5" />Tariffa</span><span className="font-medium text-right">€{Number(selectedAnn.tariff_amount).toFixed(2)}{selectedAnn.tariff_type === "hourly" ? "/h" : ""}</span></div>
                  )}
                  {(selectedAnn.job_city || selectedAnn.job_province) && (
                    <div className="flex justify-between gap-2"><span className="text-muted-foreground inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />Zona</span><span className="font-medium text-right">{[selectedAnn.job_city, selectedAnn.job_province].filter(Boolean).join(", ")}</span></div>
                  )}
                  {(selectedAnn.job_address || selectedAnn.location_address) && (
                    <div className="flex justify-between gap-2"><span className="text-muted-foreground">Indirizzo</span><span className="font-medium text-right truncate max-w-[60%]">{selectedAnn.job_address || selectedAnn.location_address}</span></div>
                  )}
                  {selectedAnn.dress_code_items && selectedAnn.dress_code_items.length > 0 && (
                    <div className="flex justify-between gap-2"><span className="text-muted-foreground inline-flex items-center gap-1"><Shirt className="h-3.5 w-3.5" />Dress code</span><span className="font-medium text-right">{selectedAnn.dress_code_items.join(", ")}</span></div>
                  )}
                  {selectedAnn.required_skills && selectedAnn.required_skills.length > 0 && (
                    <div className="flex justify-between gap-2"><span className="text-muted-foreground inline-flex items-center gap-1"><ListChecks className="h-3.5 w-3.5" />Requisiti</span><span className="font-medium text-right">{selectedAnn.required_skills.join(", ")}</span></div>
                  )}
                  {selectedAnn.is_long_shift && selectedAnn.long_shift_reason && (
                    <div className="flex justify-between gap-2"><span className="text-muted-foreground inline-flex items-center gap-1"><Coffee className="h-3.5 w-3.5" />Motivazione</span><span className="font-medium text-right">{selectedAnn.long_shift_reason}</span></div>
                  )}
                  <p className="text-[11px] text-muted-foreground pt-2 border-t mt-2">La conferma scalerà 7 crediti solo se il lavoratore accetta.</p>
                </div>
              )}

              <div>
                <label className="text-sm font-medium mb-2 block">Messaggio preimpostato</label>
                <div className="space-y-2">
                  {RECALL_TEMPLATES.map((t) => {
                    const active = t.id === selectedTemplateId;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setSelectedTemplateId(t.id)}
                        className={`w-full text-left rounded-xl border p-3 text-sm transition-colors ${active ? "border-primary bg-primary/5" : "hover:border-primary/50"}`}
                      >
                        {t.body}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-muted-foreground mt-2">Non è possibile inviare testo libero in questa chat di proposta.</p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteFor(null)}>Annulla</Button>
            <Button
              onClick={sendInvite}
              disabled={inviteSubmitting || !selectedAnnId || openAnns.length === 0}
              className="gap-1"
            >
              <Send className="h-4 w-4" />
              {inviteSubmitting ? "Invio…" : "Invia proposta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}