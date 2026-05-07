import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell, PageHeader } from "@/components/AppShell";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Bell, BellRing, Inbox, ExternalLink, CheckCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/notifications")({
  head: () => ({ meta: [{ title: "Notifiche — Pupillo" }] }),
  component: () => <RequireAuth><NotificationsPage /></RequireAuth>,
});

type Notif = {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean | null;
  created_at: string;
  read_at?: string | null;
};

type Filter = "all" | "unread" | "read";

function fmt(iso: string) {
  return new Date(iso).toLocaleString("it-IT", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function NotificationsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(200);
      setItems((data as Notif[]) || []);
      setLoading(false);
    })();
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`notif-page-${user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (p) => setItems(prev => [p.new as Notif, ...prev]))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (p) => { const n = p.new as Notif; setItems(prev => prev.map(i => i.id === n.id ? { ...i, ...n } : i)); })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (p) => { const o = p.old as Notif; setItems(prev => prev.filter(i => i.id !== o.id)); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);

  const filtered = useMemo(() => items.filter(n =>
    filter === "all" ? true : filter === "unread" ? !n.read : !!n.read
  ), [items, filter]);

  const unreadCount = items.filter(n => !n.read).length;
  const opened = items.find(n => n.id === openId) || null;

  const markRead = async (n: Notif, read: boolean) => {
    setItems(prev => prev.map(i => i.id === n.id ? { ...i, read } : i));
    const { error } = await supabase.from("notifications").update({ read }).eq("id", n.id);
    if (error) {
      setItems(prev => prev.map(i => i.id === n.id ? { ...i, read: !read } : i));
      toast.error("Aggiornamento non riuscito");
    }
  };

  const openItem = async (n: Notif) => {
    setOpenId(n.id);
    if (!n.read) await markRead(n, true);
  };

  const goToLink = (n: Notif) => {
    if (n.link) navigate({ to: n.link as never });
  };

  const markAllRead = async () => {
    if (!user || unreadCount === 0) return;
    const ids = items.filter(i => !i.read).map(i => i.id);
    setItems(prev => prev.map(i => ({ ...i, read: true })));
    const { error } = await supabase.from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false);
    if (error) {
      setItems(prev => prev.map(i => ids.includes(i.id) ? { ...i, read: false } : i));
      toast.error("Aggiornamento non riuscito");
    } else {
      toast.success("Tutte segnate come lette");
    }
  };

  const deleteOne = async (n: Notif) => {
    setItems(prev => prev.filter(i => i.id !== n.id));
    if (openId === n.id) setOpenId(null);
    const { error } = await supabase.from("notifications").delete().eq("id", n.id);
    if (error) {
      setItems(prev => [n, ...prev].sort((a, b) => b.created_at.localeCompare(a.created_at)));
      toast.error("Eliminazione non riuscita");
    }
  };

  return (
    <AppShell>
      <PageHeader
        title="Notifiche"
        subtitle={unreadCount > 0 ? `${unreadCount} non lette` : "Sei in pari"}
        action={
          <Button variant="outline" size="sm" onClick={markAllRead} disabled={unreadCount === 0} className="gap-2">
            <CheckCheck className="h-4 w-4" />Segna tutte lette
          </Button>
        }
      />

      <div className="flex gap-2 mb-4">
        {([
          { v: "all", label: "Tutte", count: items.length },
          { v: "unread", label: "Non lette", count: unreadCount },
          { v: "read", label: "Lette", count: items.length - unreadCount },
        ] as { v: Filter; label: string; count: number }[]).map(t => (
          <Button
            key={t.v}
            variant={filter === t.v ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setFilter(t.v)}
            className="gap-2"
          >
            {t.label}
            <span className="text-xs rounded-full bg-muted px-1.5 py-0.5">{t.count}</span>
          </Button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <div className="rounded-2xl border bg-card overflow-hidden">
          {loading ? (
            <p className="p-8 text-sm text-muted-foreground text-center">Caricamento…</p>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <Inbox className="h-10 w-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">{filter === "unread" ? "Nessuna notifica non letta" : "Nessuna notifica"}</p>
            </div>
          ) : (
            <ul className="divide-y">
              {filtered.map(n => (
                <li key={n.id}>
                  <button
                    onClick={() => openItem(n)}
                    className={`w-full text-left px-4 py-3 hover:bg-accent transition flex items-start gap-3 ${openId === n.id ? "bg-accent" : ""} ${!n.read ? "bg-primary/5" : ""}`}
                  >
                    <div className={`mt-1 h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${!n.read ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                      {!n.read ? <BellRing className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm truncate ${!n.read ? "font-semibold" : ""}`}>{n.title}</span>
                        {!n.read && <span className="h-2 w-2 rounded-full bg-primary shrink-0" />}
                      </div>
                      {n.body && <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{n.body}</div>}
                      <div className="text-[10px] text-muted-foreground mt-1 flex flex-wrap gap-x-2">
                        <span>{fmt(n.created_at)}</span>
                        {n.read && n.read_at && (
                          <span className="text-primary/80">· Letta il {fmt(n.read_at)}</span>
                        )}
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <aside className="rounded-2xl border bg-card p-5 h-fit lg:sticky lg:top-20">
          {!opened ? (
            <div className="text-center text-muted-foreground py-8">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Seleziona una notifica per vedere i dettagli</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <div className="text-xs text-muted-foreground">{fmt(opened.created_at)}</div>
                <h2 className="font-semibold text-base mt-1">{opened.title}</h2>
                {opened.read && opened.read_at && (
                  <div className="text-xs text-primary mt-1">Letta il {fmt(opened.read_at)}</div>
                )}
              </div>
              {opened.body && (
                <p className="text-sm whitespace-pre-wrap text-muted-foreground">{opened.body}</p>
              )}
              <div className="flex flex-wrap gap-2 pt-2 border-t">
                {opened.link && (
                  <Button size="sm" onClick={() => goToLink(opened)} className="gap-1">
                    <ExternalLink className="h-4 w-4" />Apri
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => markRead(opened, !opened.read)}>
                  {opened.read ? "Segna come non letta" : "Segna come letta"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => deleteOne(opened)} className="gap-1 text-destructive hover:text-destructive">
                  <Trash2 className="h-4 w-4" />Elimina
                </Button>
              </div>
              {opened.link && (
                <Link to={opened.link as never} className="block text-xs text-primary hover:underline pt-2">
                  {opened.link}
                </Link>
              )}
            </div>
          )}
        </aside>
      </div>
    </AppShell>
  );
}