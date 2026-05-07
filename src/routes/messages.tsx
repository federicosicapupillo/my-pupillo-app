import { createFileRoute, Link } from "@tanstack/react-router";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell, PageHeader } from "@/components/AppShell";
import { useAuth } from "@/lib/auth-context";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MessageSquare } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/messages")({
  head: () => ({ meta: [{ title: "Messaggi — Pupillo" }] }),
  component: () => <RequireAuth><Inbox /></RequireAuth>,
});

type Thread = { id: string; status: string; other: { id: string; name: string } };

const STATUS_LABELS: Record<string, string> = {
  pending: "In attesa",
  interested: "Interesse mostrato",
  counter_offer: "Controproposta",
  accepted: "Confermato",
  rejected: "Rifiutato",
  expired: "Scaduto",
};
const STATUS_CLS: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-700",
  interested: "bg-sky-500/15 text-sky-700",
  counter_offer: "bg-indigo-500/15 text-indigo-700",
  accepted: "bg-emerald-500/15 text-emerald-700",
  rejected: "bg-red-500/15 text-red-700",
  expired: "bg-muted text-muted-foreground",
};

function Inbox() {
  const { user, role } = useAuth();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const col = role === "restaurant" ? "restaurant_id" : "worker_id";
      const otherCol = role === "restaurant" ? "worker_id" : "restaurant_id";
      const { data: apps } = await supabase.from("applications").select(`id, status, ${otherCol}`).eq(col, user.id);
      const others = (apps ?? []).map((a: any) => a[otherCol]);
      const { data: profs } = others.length ? await supabase.from("profiles").select("id, full_name, business_name").in("id", others) : { data: [] as any[] };
      const pmap = new Map((profs ?? []).map((p: any) => [p.id, p]));
      setThreads((apps ?? []).map((a: any) => {
        const p = pmap.get(a[otherCol]);
        return { id: a.id, status: a.status, other: { id: a[otherCol], name: p?.business_name || p?.full_name || "Utente" } };
      }));
      setLoading(false);
    })();
  }, [user, role]);

  // Realtime: keep thread statuses in sync
  useEffect(() => {
    if (!user) return;
    const col = role === "restaurant" ? "restaurant_id" : "worker_id";
    const ch = supabase
      .channel(`inbox-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "applications", filter: `${col}=eq.${user.id}` },
        (payload) => {
          const row: any = payload.new || payload.old;
          if (!row) return;
          setThreads((prev) => {
            const next = prev.map(t => t.id === row.id ? { ...t, status: row.status } : t);
            const prevStatus = prev.find(t => t.id === row.id)?.status;
            if (prevStatus && row.status && prevStatus !== row.status && STATUS_LABELS[row.status]) {
              toast.message(`Stato aggiornato: ${STATUS_LABELS[row.status]}`);
            }
            return next;
          });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, role]);

  return (
    <AppShell>
      <PageHeader title="Messaggi" subtitle="Le tue conversazioni" />
      {loading ? <p className="text-muted-foreground">Caricamento…</p> : threads.length === 0 ? (
        <div className="rounded-2xl border bg-card p-12 text-center text-muted-foreground">Nessuna conversazione.</div>
      ) : (
        <div className="space-y-2 max-w-2xl">
          {threads.map(t => (
            <Link key={t.id} to="/messages/$id" params={{ id: t.id }} className="flex items-center gap-3 rounded-2xl border bg-card p-4 hover:bg-accent transition">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center"><MessageSquare className="h-4 w-4 text-primary" /></div>
              <div className="flex-1">
                <div className="font-medium">{t.other.name}</div>
                <div className="mt-0.5">
                  <span className={`inline-block text-[10px] rounded-full px-2 py-0.5 ${STATUS_CLS[t.status] || "bg-muted text-muted-foreground"}`}>
                    {STATUS_LABELS[t.status] || t.status}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}