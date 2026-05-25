import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell, PageHeader } from "@/components/AppShell";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { MapPin, Coins, Briefcase, Star, Phone, Mail, Globe, ArrowLeft, MessageSquare, Map as MapIcon, CalendarCheck, CheckCircle2, Clock } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { RestaurantRequirementsView, reqFromProfile } from "@/components/RestaurantRequirements";
import { ClipboardList } from "lucide-react";
import { priceRangeLabel } from "@/lib/price-range";
import { formatTariff } from "@/lib/format";

export const Route = createFileRoute("/restaurants/$id")({
  head: () => ({ meta: [{ title: "Dettaglio ristoratore — Pupillo" }] }),
  component: () => <RequireAuth><RestaurantDetailPage /></RequireAuth>,
});

type Restaurant = Record<string, any>;
type Ann = {
  id: string;
  professional_profile: string | null;
  location_address: string | null;
  status: string | null;
  service_date: string | null;
  service_time: string | null;
  duration_hours: number | null;
  tariff_amount: number | null;
  tariff_type: string | null;
  created_at: string | null;
};

function statusBadge(s?: string | null) {
  const map: Record<string, string> = {
    active: "bg-emerald-500/15 text-emerald-700",
    pending: "bg-amber-500/15 text-amber-700",
    suspended: "bg-red-500/15 text-red-700",
    expired: "bg-muted text-muted-foreground",
  };
  return map[s || ""] || "bg-muted text-muted-foreground";
}

function RestaurantDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const [r, setR] = useState<Restaurant | null>(null);
  const [anns, setAnns] = useState<Ann[]>([]);
  const [loading, setLoading] = useState(true);
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());
  const [confirmAnn, setConfirmAnn] = useState<Ann | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [bookingResult, setBookingResult] = useState<null | {
    applicationId: string;
    annTitle: string;
    when: string;
    duration: string;
    tariff: string;
    note: string;
    submittedAt: string;
    status: string;
    statusUpdatedAt?: string;
  }>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data: prof, error }, { data: a }] = await Promise.all([
        supabase
          .from("profiles")
          .select(
            "id, business_name, full_name, avatar_url, city, province, neighborhood, venue_type, venue_type_other, price_range, employees_count, opening_hours, busy_days, rating_avg, reviews_count, plan, badge, primary_role, short_bio, default_dress_code_items, default_dress_code_notes, default_required_skills, default_language_requirements, default_license_requirement",
          )
          .eq("id", id)
          .maybeSingle(),
        supabase.from("announcements")
          .select("id, professional_profile, location_address, status, service_date, service_time, duration_hours, tariff_amount, tariff_type, created_at")
          .eq("restaurant_id", id)
          .order("created_at", { ascending: false })
          .limit(50),
      ]);
      if (error) toast.error("Errore nel caricamento");
      setR(prof || null);
      setAnns((a as Ann[]) || []);
      setLoading(false);
    })();
  }, [id]);

  useEffect(() => {
    if (!user || anns.length === 0) return;
    (async () => {
      const ids = anns.map(a => a.id);
      const { data } = await supabase.from("applications")
        .select("announcement_id").eq("worker_id", user.id).in("announcement_id", ids);
      setAppliedIds(new Set((data || []).map((x: any) => x.announcement_id)));
    })();
  }, [user, anns]);

  const submitBooking = async () => {
    if (!user || !confirmAnn) return;
    setSubmitting(true);
    const { data: app, error } = await supabase.from("applications").insert({
      announcement_id: confirmAnn.id,
      worker_id: user.id,
      restaurant_id: id,
    }).select("id").single();
    if (error) { setSubmitting(false); return toast.error(error.message); }
    if (app?.id) {
      const autoBody =
        "Ciao! Ho inviato la mia candidatura per il turno pubblicato.\n" +
        "Sono disponibile nell'orario richiesto e resto a disposizione per conferma o ulteriori informazioni. A presto!";
      const messages: Array<{ application_id: string; sender_id: string; body: string; message_type: string }> = [
        { application_id: app.id, sender_id: user.id, body: autoBody, message_type: "auto" },
      ];
      if (note.trim()) {
        messages.push({ application_id: app.id, sender_id: user.id, body: note.trim(), message_type: "text" });
      }
      await supabase.from("messages").insert(messages);
    }
    const when = [confirmAnn.service_date, confirmAnn.service_time].filter(Boolean).join(" · ") || "data da definire";
    const dur = confirmAnn.duration_hours ? ` (${confirmAnn.duration_hours}h)` : "";
    toast.success("Candidatura inviata correttamente", {
      description:
        `${confirmAnn.professional_profile || "Turno"} — ${when}${dur}\n` +
        `Stato iniziale: In attesa di conferma del ristoratore.`,
      duration: 7000,
      action: { label: "Vedi messaggi", onClick: () => navigate({ to: "/messages" }) },
    });
    setAppliedIds(new Set(appliedIds).add(confirmAnn.id));
    setBookingResult({
      applicationId: app!.id,
      annTitle: confirmAnn.professional_profile || "Turno",
      when,
      duration: confirmAnn.duration_hours ? `${confirmAnn.duration_hours}h` : "—",
      tariff: confirmAnn.tariff_amount != null
        ? formatTariff(confirmAnn.tariff_amount, confirmAnn.tariff_type)
        : "—",
      note: note.trim(),
      submittedAt: new Date().toLocaleString("it-IT"),
      status: "pending",
    });
    setConfirmAnn(null); setNote(""); setSubmitting(false);
    if (app?.id) navigate({ to: "/messages/$id", params: { id: app.id } });
  };

  // Realtime: subscribe to status changes of the just-submitted application
  useEffect(() => {
    if (!bookingResult?.applicationId) return;
    const ch = supabase
      .channel(`booking-${bookingResult.applicationId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "applications", filter: `id=eq.${bookingResult.applicationId}` },
        (payload) => {
          const next = (payload.new as any)?.status as string | undefined;
          if (!next) return;
          setBookingResult((prev) => prev ? { ...prev, status: next, statusUpdatedAt: new Date().toLocaleString("it-IT") } : prev);
          const labels: Record<string, string> = {
            interested: "Il ristoratore ha mostrato interesse",
            accepted: "Prenotazione confermata!",
            rejected: "Prenotazione rifiutata",
            counter_offer: "Hai ricevuto una controproposta",
            expired: "Offerta scaduta",
          };
          if (labels[next]) toast.message(labels[next]);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [bookingResult?.applicationId]);

  if (loading) {
    return <AppShell><div className="p-8 text-sm text-muted-foreground">Caricamento…</div></AppShell>;
  }
  if (!r) {
    return (
      <AppShell>
        <PageHeader title="Ristoratore non trovato" />
        <div className="rounded-2xl border bg-card p-6 text-sm text-muted-foreground">
          Il profilo richiesto non esiste o è stato rimosso.
          <div className="mt-4"><Link to="/mappa"><Button variant="outline" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />Torna alla mappa</Button></Link></div>
        </div>
      </AppShell>
    );
  }

  const name = r.business_name || r.full_name || "Locale";
  const fullAddress = [r.address, r.neighborhood, r.city].filter(Boolean).join(", ");
  const activeAnns = anns.filter(a => a.status === "active");
  const canBook = role === "worker" && r.account_status === "active";

  return (
    <AppShell>
      <div className="mb-3">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/mappa" })} className="gap-1">
          <ArrowLeft className="h-4 w-4" />Indietro
        </Button>
      </div>

      <PageHeader
        title={name}
        subtitle={[r.venue_type, r.city].filter(Boolean).join(" · ") || "Ristoratore"}
      />

      {/* Status row */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className={`rounded-full px-3 py-1 text-xs capitalize ${statusBadge(r.account_status)}`}>{r.account_status || "—"}</span>
        <span className="rounded-full bg-accent text-accent-foreground px-3 py-1 text-xs capitalize">Piano {r.plan || "free"}</span>
        {r.rating_avg ? <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-xs"><Star className="h-3 w-3" />{Number(r.rating_avg).toFixed(1)}</span> : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        {/* Main */}
        <div className="space-y-4">
          {/* Info card */}
          <div className="rounded-2xl border bg-card p-5">
            <h2 className="font-semibold mb-3">Informazioni locale</h2>
            <dl className="grid gap-3 sm:grid-cols-2 text-sm">
              <Field icon={<MapPin className="h-4 w-4" />} label="Indirizzo" value={fullAddress || "—"} />
              <Field label="Tipologia" value={r.venue_type || "—"} />
              <Field label="Fascia di prezzo" value={priceRangeLabel(r.price_range)} />
              <Field label="Città" value={r.city || "—"} />
              <Field label="Zona" value={r.neighborhood || "—"} />
              <Field icon={<Phone className="h-4 w-4" />} label="Telefono" value={r.phone || "—"} />
              <Field icon={<Mail className="h-4 w-4" />} label="Email" value={r.email || "—"} />
              {r.website && <Field icon={<Globe className="h-4 w-4" />} label="Sito" value={r.website} />}
              {r.vat_number && <Field label="P.IVA" value={r.vat_number} />}
            </dl>
            {r.bio && (
              <div className="mt-4 pt-4 border-t">
                <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Descrizione</div>
                <p className="text-sm whitespace-pre-wrap">{r.bio}</p>
              </div>
            )}
          </div>

          {/* Requisiti standard */}
          <div className="rounded-2xl border bg-card p-5">
            <h2 className="font-semibold mb-3 flex items-center gap-2"><ClipboardList className="h-4 w-4 text-primary" />Requisiti e Competenze standard</h2>
            <RestaurantRequirementsView value={reqFromProfile(r)} />
          </div>

          {/* Active announcements */}
          <div className="rounded-2xl border bg-card p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">Richieste attive</h2>
              <span className="text-xs text-muted-foreground">{activeAnns.length} attive · {anns.length} totali</span>
            </div>
            {activeAnns.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nessuna richiesta attiva al momento.</p>
            ) : (
              <ul className="space-y-2">
                {activeAnns.map(a => (
                  <li key={a.id} className="rounded-xl border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium text-sm">{a.professional_profile || "Annuncio"}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {a.service_date || "Data da definire"}
                          {a.service_time ? ` · ${a.service_time}` : ""}
                          {a.duration_hours ? ` · ${a.duration_hours}h` : ""}
                        </div>
                        {a.location_address && (
                          <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                            <MapPin className="h-3 w-3" />{a.location_address}
                          </div>
                        )}
                      </div>
                      {a.tariff_amount != null && (
                        <span className="text-xs rounded-full bg-emerald-500/15 text-emerald-700 px-2 py-0.5 whitespace-nowrap">
                          {formatTariff(a.tariff_amount, a.tariff_type)}
                        </span>
                      )}
                    </div>
                    {canBook && (
                      <div className="mt-3 flex justify-end">
                        {appliedIds.has(a.id) ? (
                          <Button size="sm" variant="outline" disabled className="gap-1">
                            <CalendarCheck className="h-4 w-4" />Già prenotato
                          </Button>
                        ) : (
                          <Button size="sm" className="gap-1" onClick={() => { setNote(""); setConfirmAnn(a); }}>
                            <CalendarCheck className="h-4 w-4" />Prenota turno
                          </Button>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Sidebar / CTA */}
        <aside className="space-y-4">
          <div className="rounded-2xl border bg-card p-5">
            <div className="grid grid-cols-2 gap-3 text-center">
              <Stat icon={<Briefcase className="h-4 w-4" />} label="Richieste attive" value={activeAnns.length} />
              <Stat icon={<Coins className="h-4 w-4" />} label="Crediti" value={r.credits ?? 0} />
            </div>
          </div>

          <div className="rounded-2xl border bg-card p-5 space-y-2">
            <h3 className="font-semibold text-sm">Azioni</h3>
            {r.account_status === "active" ? (
              <>
                {canBook && activeAnns.length > 0 && (
                  <Button
                    className="w-full gap-2"
                    onClick={() => { setNote(""); setConfirmAnn(activeAnns[0]); }}
                  >
                    <CalendarCheck className="h-4 w-4" />Prenota turno
                  </Button>
                )}
                {canBook && activeAnns.length === 0 && (
                  <Button className="w-full gap-2" variant="outline" disabled>
                    <CalendarCheck className="h-4 w-4" />Nessun turno disponibile
                  </Button>
                )}
                <Link to="/messages" className="block">
                  <Button variant="outline" className="w-full gap-2"><MessageSquare className="h-4 w-4" />Contatta</Button>
                </Link>
                <Link to="/browse" className="block">
                  <Button variant="ghost" className="w-full gap-2"><Briefcase className="h-4 w-4" />Vedi tutte le richieste</Button>
                </Link>
              </>
            ) : r.account_status === "pending" ? (
              <p className="text-xs text-muted-foreground">Profilo in attesa di verifica. Le azioni saranno disponibili una volta attivato.</p>
            ) : (
              <p className="text-xs text-muted-foreground">Questo ristoratore non è attualmente attivo.</p>
            )}
            {r.service_area_lat != null && r.service_area_lng != null && (
              <Link to="/mappa" className="block">
                <Button variant="ghost" className="w-full gap-2"><MapIcon className="h-4 w-4" />Mostra sulla mappa</Button>
              </Link>
            )}
            {role && role !== "worker" && r.account_status === "active" && (
              <p className="text-xs text-muted-foreground pt-1">La prenotazione turni è disponibile per i lavoratori.</p>
            )}
          </div>
        </aside>
      </div>

      <Dialog open={!!confirmAnn} onOpenChange={(o) => !o && setConfirmAnn(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Prenota turno</DialogTitle>
            <DialogDescription>
              {confirmAnn?.professional_profile || "Annuncio"} · {confirmAnn?.service_date || "data da definire"}
              {confirmAnn?.service_time ? ` · ${confirmAnn.service_time}` : ""}
              {confirmAnn?.duration_hours ? ` · ${confirmAnn.duration_hours}h` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium">Nota per il ristoratore (opzionale)</label>
            <Textarea
              placeholder="Presentati brevemente o aggiungi dettagli utili"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmAnn(null)} disabled={submitting}>Annulla</Button>
            <Button onClick={submitBooking} disabled={submitting} className="gap-1">
              <CalendarCheck className="h-4 w-4" />{submitting ? "Invio…" : "Conferma prenotazione"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!bookingResult} onOpenChange={(o) => !o && setBookingResult(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              Prenotazione inviata
            </DialogTitle>
            <DialogDescription>
              La tua richiesta è stata inviata al ristoratore. Riceverai una notifica appena risponde.
            </DialogDescription>
          </DialogHeader>
          {bookingResult && (
            <div className="space-y-3">
              <div className="rounded-xl border bg-card p-4 space-y-2 text-sm">
                <Row label="Turno" value={bookingResult.annTitle} />
                <Row label="Data e ora" value={bookingResult.when} />
                <Row label="Durata" value={bookingResult.duration} />
                <Row label="Compenso" value={bookingResult.tariff} />
                <Row label="Inviata il" value={bookingResult.submittedAt} />
                <Row label="ID richiesta" value={<code className="text-xs">{bookingResult.applicationId.slice(0, 8)}</code>} />
              </div>
              <StatusBanner status={bookingResult.status} updatedAt={bookingResult.statusUpdatedAt} />
              {bookingResult.note && (
                <div className="text-xs text-muted-foreground">
                  <span className="font-medium">La tua nota:</span> {bookingResult.note}
                </div>
              )}
            </div>
          )}
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setBookingResult(null)} className="w-full sm:w-auto">Chiudi</Button>
            <Button onClick={() => navigate({ to: "/messages" })} className="w-full sm:w-auto gap-1">
              <MessageSquare className="h-4 w-4" />Vai ai messaggi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function Field({ icon, label, value }: { icon?: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground mb-0.5">{label}</div>
      <div className="flex items-center gap-1.5 text-sm">{icon}<span className="truncate">{value}</span></div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-secondary/50 p-3">
      <div className="flex items-center justify-center gap-1 text-muted-foreground text-xs mb-1">{icon}{label}</div>
      <div className="text-xl font-bold">{value}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}

function StatusBanner({ status, updatedAt }: { status: string; updatedAt?: string }) {
  const map: Record<string, { title: string; desc: string; cls: string }> = {
    pending: { title: "In attesa di conferma", desc: "Il ristoratore ha 24 ore per rispondere.", cls: "bg-amber-500/10 border-amber-500/30 text-amber-900" },
    interested: { title: "Interesse mostrato", desc: "Il ristoratore ha visto la tua richiesta ed è interessato.", cls: "bg-sky-500/10 border-sky-500/30 text-sky-900" },
    counter_offer: { title: "Controproposta ricevuta", desc: "Apri i messaggi per vedere la nuova offerta.", cls: "bg-indigo-500/10 border-indigo-500/30 text-indigo-900" },
    accepted: { title: "Prenotazione confermata", desc: "Il turno è tuo. Trovi i dettagli nei messaggi.", cls: "bg-emerald-500/10 border-emerald-500/30 text-emerald-900" },
    rejected: { title: "Richiesta rifiutata", desc: "Il ristoratore ha rifiutato la candidatura.", cls: "bg-red-500/10 border-red-500/30 text-red-900" },
    expired: { title: "Offerta scaduta", desc: "Non è stata accettata in tempo.", cls: "bg-muted border-border text-muted-foreground" },
  };
  const s = map[status] || map.pending;
  return (
    <div className={`rounded-xl border p-3 flex items-start gap-2 text-sm ${s.cls}`}>
      <Clock className="h-4 w-4 mt-0.5" />
      <div className="flex-1">
        <div className="font-medium flex items-center gap-2">
          {s.title}
          <span className="inline-flex h-2 w-2 rounded-full bg-current animate-pulse" aria-hidden />
        </div>
        <div className="text-xs opacity-80">{s.desc}</div>
        {updatedAt && <div className="text-[10px] opacity-60 mt-1">Aggiornato {updatedAt}</div>}
      </div>
    </div>
  );
}