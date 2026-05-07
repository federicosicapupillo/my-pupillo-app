import { createFileRoute, Link } from "@tanstack/react-router";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell, PageHeader } from "@/components/AppShell";
import { useAuth } from "@/lib/auth-context";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MessageSquare } from "lucide-react";

export const Route = createFileRoute("/messages")({
  head: () => ({ meta: [{ title: "Messaggi — Pupillo" }] }),
  component: () => <RequireAuth><Inbox /></RequireAuth>,
});

type Thread = { id: string; status: string; other: { id: string; name: string } };

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
                <div className="text-xs text-muted-foreground capitalize">{t.status}</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}