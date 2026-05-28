import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listRoleMismatches, repairUserRole, type RoleMismatchReport } from "@/lib/role-repair.functions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, RefreshCw } from "lucide-react";

type Role = "admin" | "worker" | "restaurant";

export function AdminRoleRepairSection() {
  const list = useServerFn(listRoleMismatches);
  const repair = useServerFn(repairUserRole);
  const [data, setData] = useState<RoleMismatchReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyUser, setBusyUser] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await list();
      setData(res);
    } catch (e) {
      toast.error(`Impossibile caricare report: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const doRepair = async (userId: string, role: Role) => {
    setBusyUser(userId);
    try {
      await repair({ data: { userId, role } });
      toast.success(`Ruolo "${role}" assegnato.`);
      await load();
    } catch (e) {
      toast.error(`Riparazione fallita: ${(e as Error).message}`);
    } finally {
      setBusyUser(null);
    }
  };

  return (
    <section className="rounded-xl border bg-card p-4 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold">Ripara ruoli utenti</h3>
          <p className="text-sm text-muted-foreground">
            Allinea Supabase Auth con <code>profiles</code> e <code>user_roles</code> dopo un ripristino backup.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          <span className="ml-2">Aggiorna</span>
        </Button>
      </div>

      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-sm">
            <Stat label="Auth users" value={data.authUsers} />
            <Stat label="Profiles" value={data.profiles} />
            <Stat label="User roles" value={data.userRoles} />
            <Stat label="Profili orfani" value={data.orphanProfiles} warn={data.orphanProfiles > 0} />
            <Stat label="Ruoli orfani" value={data.orphanRoles} warn={data.orphanRoles > 0} />
          </div>

          <div>
            <h4 className="font-medium">Admin attivi ({data.admins.length})</h4>
            <ul className="text-sm text-muted-foreground">
              {data.admins.map((a) => <li key={a.id}>{a.email ?? a.id}</li>)}
            </ul>
          </div>

          <div>
            <h4 className="font-medium">Utenti Auth senza ruolo ({data.authWithoutRole.length})</h4>
            {data.authWithoutRole.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nessuno. Tutti gli utenti hanno un ruolo.</p>
            ) : (
              <ul className="divide-y border rounded">
                {data.authWithoutRole.map((u) => (
                  <li key={u.id} className="p-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-sm">
                      <div className="font-medium">{u.email ?? u.id}</div>
                      <div className="text-muted-foreground text-xs">
                        id: {u.id} · metadata role: {u.metaRole ?? "—"}
                      </div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {(["worker", "restaurant", "admin"] as Role[]).map((r) => (
                        <Button
                          key={r}
                          size="sm"
                          variant={u.metaRole === r ? "default" : "outline"}
                          disabled={busyUser === u.id}
                          onClick={() => doRepair(u.id, r)}
                        >
                          {busyUser === u.id ? <Loader2 className="h-3 w-3 animate-spin" /> : `Assegna ${r}`}
                        </Button>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {data.authWithoutProfile.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Profili mancanti per {data.authWithoutProfile.length} utenti Auth — verranno creati automaticamente all'assegnazione del ruolo.
            </p>
          )}
        </>
      )}
    </section>
  );
}

function Stat({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 ${warn ? "border-destructive/40" : ""}`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold ${warn ? "text-destructive" : ""}`}>{value}</div>
    </div>
  );
}