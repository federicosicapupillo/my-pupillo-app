import { createFileRoute, Link } from "@tanstack/react-router";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth-context";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ArrowLeft, Check, X } from "lucide-react";

export const Route = createFileRoute("/messages/$id")({
  head: () => ({ meta: [{ title: "Conversazione — Pupillo" }] }),
  component: () => <RequireAuth><Thread /></RequireAuth>,
});

type Msg = { id: string; sender_id: string; body: string; created_at: string };

function Thread() {
  const { id } = Route.useParams();
  const { user, role } = useAuth();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [app, setApp] = useState<any>(null);
  const [other, setOther] = useState<{ name: string } | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const { data: a } = await supabase.from("applications").select("*").eq("id", id).maybeSingle();
      setApp(a);
      if (a) {
        const otherId = a.restaurant_id === user?.id ? a.worker_id : a.restaurant_id;
        const { data: p } = await supabase.from("profiles").select("full_name, business_name").eq("id", otherId).maybeSingle();
        setOther({ name: p?.business_name || p?.full_name || "Utente" });
      }
      const { data: m } = await supabase.from("messages").select("*").eq("application_id", id).order("created_at");
      setMsgs((m as Msg[]) ?? []);
    })();
    const ch = supabase.channel(`thread-${id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `application_id=eq.${id}` },
        (p) => setMsgs(prev => [...prev, p.new as Msg]))
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

  const setStatus = async (status: "accepted" | "rejected") => {
    const { error } = await supabase.from("applications").update({ status }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    if (status === "accepted" && app?.announcement_id) {
      await supabase.from("announcements").update({ status: "assigned", assigned_worker_id: app.worker_id }).eq("id", app.announcement_id);
    }
    toast.success(status === "accepted" ? "Lavoratore assegnato!" : "Candidatura rifiutata");
    setApp({ ...app, status });
  };

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <Link to="/messages"><Button variant="ghost" size="sm" className="gap-2"><ArrowLeft className="h-4 w-4" />Indietro</Button></Link>
          {app && <span className="text-xs rounded-full bg-secondary px-2 py-1 capitalize">{app.status}</span>}
        </div>
        <div className="rounded-2xl border bg-card p-4 mb-4">
          <div className="font-semibold">{other?.name ?? "—"}</div>
        </div>
        {role === "restaurant" && app && ["pending","interested","counter_offer"].includes(app.status) && (
          <div className="mb-4 flex gap-2">
            <Button size="sm" className="gap-2" onClick={() => setStatus("accepted")}><Check className="h-4 w-4" />Assegna</Button>
            <Button size="sm" variant="outline" className="gap-2" onClick={() => setStatus("rejected")}><X className="h-4 w-4" />Rifiuta</Button>
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