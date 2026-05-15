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
import { Star, MessageSquare, Send, Heart, Search, Calendar, Users, CheckCircle2 } from "lucide-react";
import { UserAvatar } from "@/components/UserAvatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

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
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [onlyFav, setOnlyFav] = useState(false);
  const [inviteFor, setInviteFor] = useState<Row | null>(null);
  const [openAnns, setOpenAnns] = useState<AnnFull[]>([]);
  const [selectedAnnId, setSelectedAnnId] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(RECALL_TEMPLATES[0].id);
  const [inviteSubmitting, setInviteSubmitting] = useState(false);

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
      .select("id, service_date, service_time, location_address, professional_profile, tariff_amount, tariff_type, duration_hours, job_city, job_province, status")
      .eq("restaurant_id", user.id)
      .eq("status", "active")
      .order("service_date", { ascending: true });
    setOpenAnns((data ?? []) as any);
    setSelectedAnnId(((data ?? [])[0] as any)?.id ?? null);
    setSelectedTemplateId(RECALL_TEMPLATES[0].id);
    setInviteFor(r);
  };

  const sendInvite = async () => {
    if (!inviteFor || !user || !selectedAnnId) return;
    const annId = selectedAnnId;
    const tpl = RECALL_TEMPLATES.find((t) => t.id === selectedTemplateId) ?? RECALL_TEMPLATES[0];
    setInviteSubmitting(true);
    try {
      // Avoid duplicate active applications for same announcement+worker
      const { data: existing } = await supabase.from("applications")
        .select("id").eq("announcement_id", annId).eq("worker_id", inviteFor.worker_id).maybeSingle();
      let appId = existing?.id as string | undefined;
      if (!appId) {
        const { data: ins, error } = await supabase.from("applications")
          .insert({
            announcement_id: annId,
            worker_id: inviteFor.worker_id,
            restaurant_id: user.id,
            status: "pending",
          }).select("id").single();
        if (error) throw error;
        appId = ins!.id;
      }
      await supabase.from("messages").insert({
        application_id: appId,
        sender_id: user.id,
        receiver_id: inviteFor.worker_id,
        message_type: "template",
        template_id: tpl.id,
        action_type: "recall_worker",
        body: tpl.body,
      });
      await supabase.from("notifications").insert({
        user_id: inviteFor.worker_id,
        title: "Nuova proposta da un locale dove hai già lavorato",
        body: "Il ristoratore ti ha invitato a valutare un nuovo servizio.",
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
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Proposta nuovo servizio</DialogTitle>
            <DialogDescription>
              Stai ricontattando {inviteFor?.full_name ?? "un lavoratore"} che ha già collaborato con il tuo locale.
              Seleziona un annuncio attivo e un messaggio preimpostato. La conferma scalerà 7 crediti solo se il lavoratore accetta.
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
                <div className="rounded-xl border bg-muted/30 p-3 text-xs space-y-1">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Riepilogo proposta</div>
                  {selectedAnn.professional_profile && <div><span className="text-muted-foreground">Ruolo:</span> <span className="font-medium capitalize">{selectedAnn.professional_profile}</span></div>}
                  <div><span className="text-muted-foreground">Data:</span> <span className="font-medium">{new Date(selectedAnn.service_date).toLocaleDateString("it-IT")}</span></div>
                  <div><span className="text-muted-foreground">Orario:</span> <span className="font-medium">{selectedAnn.service_time?.slice(0, 5)}{selectedAnn.duration_hours ? ` · ${selectedAnn.duration_hours}h` : ""}</span></div>
                  {selectedAnn.tariff_amount != null && (
                    <div><span className="text-muted-foreground">Tariffa:</span> <span className="font-medium">€{Number(selectedAnn.tariff_amount).toFixed(2)}{selectedAnn.tariff_type === "hourly" ? "/h" : ""}</span></div>
                  )}
                  {(selectedAnn.job_city || selectedAnn.job_province) && (
                    <div><span className="text-muted-foreground">Zona:</span> <span className="font-medium">{[selectedAnn.job_city, selectedAnn.job_province].filter(Boolean).join(", ")}</span></div>
                  )}
                  <div><span className="text-muted-foreground">Locale:</span> <span className="font-medium truncate">{selectedAnn.location_address}</span></div>
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