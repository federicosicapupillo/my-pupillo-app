import { createFileRoute, Link } from "@tanstack/react-router";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth-context";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ArrowLeft, Check, X, Euro, ThumbsUp, ThumbsDown, Send, Handshake, Ban } from "lucide-react";

export const Route = createFileRoute("/messages/$id")({
  head: () => ({ meta: [{ title: "Conversazione — Pupillo" }] }),
  component: () => <RequireAuth><Thread /></RequireAuth>,
});

type Msg = { id: string; sender_id: string; body: string; created_at: string };
type App = {
  id: string; status: string; restaurant_id: string; worker_id: string;
  announcement_id: string; proposed_tariff: number | null;
};
type Ann = { id: string; tariff_amount: number; tariff_type: string };
type LogEvent = {
  id: string;
  action: string;
  created_at: string;
  user_id: string | null;
  metadata: { tariff?: number; note?: string; by_role?: string } | null;
};

const TERMINAL = ["accepted", "rejected", "expired"];

type StepState = "done" | "current" | "todo" | "error";
type Step = { key: string; label: string; icon: typeof Send; state: StepState };

function buildTimeline(status?: string): Step[] {
  const s = status ?? "pending";
  const isReject = s === "rejected" || s === "not_interested";
  const isCounter = s === "counter_offer";
  const isAccepted = s === "accepted";
  const isInterested = s === "interested";
  const isExpired = s === "expired";

  const mark = (cond: boolean, isCurrent: boolean): StepState =>
    cond ? "done" : isCurrent ? "current" : "todo";

  return [
    { key: "sent", label: "Inviata", icon: Send, state: "done" },
    { key: "interest", label: "Interesse", icon: ThumbsUp,
      state: isReject ? "error" : mark(isInterested || isCounter || isAccepted, s === "pending") },
    { key: "counter", label: "Controfferta", icon: Handshake,
      state: isCounter ? "current" : (isAccepted ? "done" : "todo") },
    { key: "outcome", label: isReject ? "Rifiutata" : isExpired ? "Scaduta" : "Assegnata",
      icon: isReject || isExpired ? Ban : Check,
      state: isAccepted ? "done" : (isReject || isExpired) ? "error" : "todo" },
  ];
}

function Thread() {
  const { id } = Route.useParams();
  const { user, role } = useAuth();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [app, setApp] = useState<App | null>(null);
  const [ann, setAnn] = useState<Ann | null>(null);
  const [other, setOther] = useState<{ name: string } | null>(null);
  const [counterOpen, setCounterOpen] = useState(false);
  const [counterValue, setCounterValue] = useState("");
  const [events, setEvents] = useState<LogEvent[]>([]);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const { data: a } = await supabase.from("applications").select("*").eq("id", id).maybeSingle();
      setApp(a as App | null);
      if (a) {
        const otherId = a.restaurant_id === user?.id ? a.worker_id : a.restaurant_id;
        const [{ data: p }, { data: an }] = await Promise.all([
          supabase.from("profiles").select("full_name, business_name").eq("id", otherId).maybeSingle(),
          supabase.from("announcements").select("id, tariff_amount, tariff_type").eq("id", a.announcement_id).maybeSingle(),
        ]);
        setOther({ name: p?.business_name || p?.full_name || "Utente" });
        setAnn(an as Ann | null);
      }
      const { data: m } = await supabase.from("messages").select("*").eq("application_id", id).order("created_at");
      setMsgs((m as Msg[]) ?? []);
      const { data: ev } = await supabase.from("activity_logs")
        .select("*").eq("entity_type", "application").eq("entity_id", id)
        .order("created_at");
      setEvents((ev as LogEvent[]) ?? []);
    })();
    const ch = supabase.channel(`thread-${id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `application_id=eq.${id}` },
        (p) => setMsgs(prev => [...prev, p.new as Msg]))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "applications", filter: `id=eq.${id}` },
        (p) => setApp(p.new as App))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "activity_logs", filter: `entity_id=eq.${id}` },
        (p) => setEvents(prev => [...prev, p.new as LogEvent]))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, user]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !user) return;
    const body = text.trim();
    setText("");
    const { error } = await supabase.from("messages").insert({ application_id: id, sender_id: user.id, body });
    if (error) toast.error(error.message);
  };

  const transition = async (
    next: "interested" | "not_interested" | "accepted" | "rejected",
    extra?: Record<string, unknown>,
  ) => {
    if (!app || !user) return;
    const patch: any = { status: next, ...extra };
    if (role === "worker") patch.worker_response_at = new Date().toISOString();
    const { error } = await supabase.from("applications").update(patch).eq("id", id);
    if (error) { toast.error(error.message); return; }
    if (next === "accepted" && app.announcement_id) {
      await supabase.from("announcements").update({ status: "assigned", assigned_worker_id: app.worker_id }).eq("id", app.announcement_id);
    }
    await logEvent(next, { by_role: role ?? undefined });
    const labels: Record<string, string> = {
      interested: "Interesse confermato",
      not_interested: "Offerta rifiutata",
      accepted: "Lavoratore assegnato!",
      rejected: "Candidatura chiusa",
    };
    toast.success(labels[next]);
    setApp({ ...app, ...patch } as App);
  };

  const sendCounter = async () => {
    const v = parseFloat(counterValue);
    if (!v || v <= 0) { toast.error("Inserisci un importo valido"); return; }
    if (!app || !user) return;
    const { error } = await supabase.from("applications").update({
      status: "counter_offer", proposed_tariff: v,
      ...(role === "worker" ? { worker_response_at: new Date().toISOString() } : {}),
    }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    await supabase.from("messages").insert({
      application_id: id, sender_id: user.id,
      body: `💶 Controfferta: €${v} ${ann?.tariff_type === "hourly" ? "/ora" : "a servizio"}`,
    });
    await logEvent("counter_offer", { tariff: v, by_role: role ?? undefined });
    setApp({ ...app, status: "counter_offer", proposed_tariff: v });
    setCounterOpen(false);
    setCounterValue("");
    toast.success("Controfferta inviata");
  };

  const isTerminal = app ? TERMINAL.includes(app.status) : true;
  const currentTariff = app?.proposed_tariff ?? ann?.tariff_amount;

  const steps = buildTimeline(app?.status);

  const logEvent = async (action: string, metadata: Record<string, unknown>) => {
    if (!user) return;
    await supabase.from("activity_logs").insert({
      user_id: user.id, action, entity_type: "application", entity_id: id,
      metadata: metadata as never,
    });
  };

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <Link to="/messages"><Button variant="ghost" size="sm" className="gap-2"><ArrowLeft className="h-4 w-4" />Indietro</Button></Link>
          {app && <span className="text-xs rounded-full bg-secondary px-2 py-1 capitalize">{app.status}</span>}
        </div>
        <div className="rounded-2xl border bg-card p-4 mb-4 flex items-center justify-between gap-4">
          <div>
            <div className="font-semibold">{other?.name ?? "—"}</div>
            {currentTariff != null && (
              <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                <Euro className="h-3 w-3" />
                Tariffa attuale: €{currentTariff} {ann?.tariff_type === "hourly" ? "/ora" : "a servizio"}
                {app?.proposed_tariff != null && <span className="ml-1 text-primary">(controfferta)</span>}
              </div>
            )}
          </div>
        </div>

        {app && (
          <div className="rounded-2xl border bg-card p-4 mb-4">
            <div className="text-xs font-medium text-muted-foreground mb-3">Stato della richiesta</div>
            <ol className="flex items-start justify-between gap-2">
              {steps.map((s: Step, i: number) => (
                <li key={s.key} className="flex-1 flex flex-col items-center text-center min-w-0">
                  <div className="flex items-center w-full">
                    <div className={`h-px flex-1 ${i === 0 ? "invisible" : s.state === "todo" ? "bg-border" : "bg-primary"}`} />
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 border-2 ${
                      s.state === "done" ? "bg-primary border-primary text-primary-foreground" :
                      s.state === "current" ? "bg-primary/15 border-primary text-primary" :
                      s.state === "error" ? "bg-destructive border-destructive text-destructive-foreground" :
                      "bg-card border-border text-muted-foreground"
                    }`}>
                      <s.icon className="h-4 w-4" />
                    </div>
                    <div className={`h-px flex-1 ${i === steps.length - 1 ? "invisible" : s.state === "done" ? "bg-primary" : "bg-border"}`} />
                  </div>
                  <div className={`mt-2 text-[11px] leading-tight ${s.state === "current" ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{s.label}</div>
                </li>
              ))}
            </ol>
          </div>
        )}

        {!isTerminal && app && (
          <div className="mb-4 space-y-2">
            <div className="flex flex-wrap gap-2">
              {role === "worker" && app.status === "pending" && (<>
                <Button size="sm" className="gap-2" onClick={() => transition("interested")}><ThumbsUp className="h-4 w-4" />Sono interessato</Button>
                <Button size="sm" variant="outline" className="gap-2" onClick={() => transition("not_interested")}><ThumbsDown className="h-4 w-4" />Non interessato</Button>
              </>)}
              {role === "restaurant" && (
                <Button size="sm" className="gap-2" onClick={() => transition("accepted")}><Check className="h-4 w-4" />Assegna</Button>
              )}
              <Button size="sm" variant="secondary" className="gap-2" onClick={() => { setCounterOpen(o => !o); setCounterValue(currentTariff?.toString() ?? ""); }}>
                <Euro className="h-4 w-4" />Controfferta
              </Button>
              <Button size="sm" variant="outline" className="gap-2" onClick={() => transition("rejected")}><X className="h-4 w-4" />Rifiuta</Button>
            </div>
            {counterOpen && (
              <div className="flex gap-2 rounded-xl border bg-card p-3">
                <Input type="number" min="1" step="0.5" placeholder={`Nuovo importo €`} value={counterValue} onChange={e => setCounterValue(e.target.value)} />
                <Button size="sm" onClick={sendCounter}>Invia controfferta</Button>
                <Button size="sm" variant="ghost" onClick={() => setCounterOpen(false)}>Annulla</Button>
              </div>
            )}
          </div>
        )}

        <div className="rounded-2xl border bg-card p-4 h-[400px] overflow-y-auto space-y-2">
          {msgs.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">Inizia la conversazione.</p>}
          {msgs.map(m => (
            <div key={m.id} className={`flex ${m.sender_id === user?.id ? "justify-end" : "justify-start"}`}>
              <div className={`rounded-2xl px-4 py-2 max-w-[75%] text-sm ${m.sender_id === user?.id ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>{m.body}</div>
            </div>
          ))}
          <div ref={endRef} />
        </div>
        <form onSubmit={send} className="mt-4 flex gap-2">
          <Input value={text} onChange={e => setText(e.target.value)} placeholder="Scrivi un messaggio…" />
          <Button type="submit">Invia</Button>
        </form>
      </div>
    </AppShell>
  );
}