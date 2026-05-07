import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell, PageHeader } from "@/components/AppShell";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { MapPin, Coins, Briefcase, Star, Phone, Mail, Globe, ArrowLeft, MessageSquare, Map as MapIcon, CalendarCheck } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

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

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data: prof, error }, { data: a }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", id).maybeSingle(),
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
    if (note.trim() && app?.id) {
      await supabase.from("messages").insert({
        application_id: app.id, sender_id: user.id, body: note.trim(),
      });
    }
    toast.success("Richiesta inviata");
    setAppliedIds(new Set(appliedIds).add(confirmAnn.id));
    setConfirmAnn(null); setNote(""); setSubmitting(false);
  };

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
                          €{Number(a.tariff_amount).toFixed(2)}{a.tariff_type === "hourly" ? "/h" : ""}
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