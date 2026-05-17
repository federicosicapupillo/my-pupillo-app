import { createFileRoute, Link } from "@tanstack/react-router";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell, PageHeader } from "@/components/AppShell";
import { useAuth } from "@/lib/auth-context";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus, Calendar, MapPin, Euro, Clock, RotateCw, Users, EyeOff, Star, CheckCircle2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNavigate } from "@tanstack/react-router";
import { AnnouncementMap } from "@/components/AnnouncementMap";
import { formatTariff } from "@/lib/format";

export const Route = createFileRoute("/announcements")({
  head: () => ({ meta: [{ title: "Annunci — Pupillo" }] }),
  validateSearch: (s: Record<string, unknown>) => ({
    status: typeof s.status === "string" ? s.status : undefined,
  }),
  component: () => <RequireAuth><AnnouncementsPage /></RequireAuth>,
});

type Ann = { id: string; service_date: string; service_time: string; end_date: string | null; end_time: string | null; duration_hours: number; speed: string; tariff_type: string; tariff_amount: number; location_address: string; location_lat: number | null; location_lng: number | null; status: string; expires_at: string; professional_profile: string | null; is_long_shift?: boolean | null; long_shift_reason?: string | null; shift_duration_hours?: number | null; assigned_worker_id?: string | null };

type Candidate = {
  worker_id: string;
  full_name: string | null;
  professional_profile: string | null;
  rating_avg: number | null;
  badge: string | null;
};

type AssignedInfo = {
  worker_id: string;
  full_name: string | null;
  rating: number | null;
};

function formatRange(a: Ann) {
  const startD = new Date(a.service_date + "T00:00:00").toLocaleDateString("it-IT");
  const startT = a.service_time?.slice(0, 5) ?? "";
  if (!a.end_date || a.end_date === a.service_date) {
    const endT = a.end_time?.slice(0, 5);
    return `${startD} · ${startT}${endT ? `–${endT}` : ""}`;
  }
  const endD = new Date(a.end_date + "T00:00:00").toLocaleDateString("it-IT");
  const endT = a.end_time?.slice(0, 5) ?? "";
  return `${startD} ${startT} → ${endD} ${endT}`;
}

function expiresLabel(iso: string) {
  const ms = new Date(iso).getTime() - Date.now();
  const days = Math.ceil(ms / (1000 * 60 * 60 * 24));
  if (days < 0) return { text: "Scaduto", tone: "muted" as const };
  if (days === 0) return { text: "Scade oggi", tone: "warn" as const };
  if (days <= 2) return { text: `Scade tra ${days}g`, tone: "warn" as const };
  return { text: `Scade tra ${days}g`, tone: "ok" as const };
}

const STATUS_LABEL: Record<string, string> = {
  draft: "In bozza",
  active: "Attivo",
  assigned: "Assegnato",
  completed: "Completato",
  expired: "Scaduto",
  cancelled: "Annullato",
};

const STATUS_CLS: Record<string, string> = {
  draft: "bg-amber-100 text-amber-800",
  active: "bg-green-100 text-green-800",
  assigned: "bg-blue-100 text-blue-800",
  completed: "bg-blue-100 text-blue-800",
  expired: "bg-muted text-muted-foreground",
  cancelled: "bg-red-100 text-red-800",
};

function AnnouncementsPage() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const { status: initialStatus } = Route.useSearch();
  const [items, setItems] = useState<Ann[]>([]);
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [candidates, setCandidates] = useState<Record<string, Candidate[]>>({});
  const [assigned, setAssigned] = useState<Record<string, AssignedInfo>>({});
  const [openMaps, setOpenMaps] = useState<Record<string, boolean>>({});
  const [statusFilter, setStatusFilter] = useState<"all" | "draft" | "active" | "assigned" | "completed" | "expired" | "cancelled">(
    (initialStatus as any) || "all"
  );

  useEffect(() => {
    if (!user) return;
    (async () => {
      const base = supabase.from("announcements").select("*").order("created_at", { ascending: false });
      const { data } = role === "restaurant" ? await base.eq("restaurant_id", user.id) : await base.eq("status", "active");
      const list = (data as Ann[]) ?? [];
      setItems(list);
      if (role === "restaurant" && list.length) {
        const ids = list.map(a => a.id);
        const { data: apps } = await supabase
          .from("applications")
          .select("announcement_id, worker_id")
          .in("announcement_id", ids);
        const map: Record<string, number> = {};
        const byAnn: Record<string, string[]> = {};
        (apps ?? []).forEach((a: any) => {
          map[a.announcement_id] = (map[a.announcement_id] ?? 0) + 1;
          (byAnn[a.announcement_id] ||= []).push(a.worker_id);
        });
        setCounts(map);
        const assignedAnns = list.filter(a => a.assigned_worker_id);
        const assignedWorkerIds = assignedAnns.map(a => a.assigned_worker_id as string);
        const workerIds = Array.from(new Set([...(apps ?? []).map((a: any) => a.worker_id), ...assignedWorkerIds]));
        if (workerIds.length) {
          const { data: profs } = await supabase
            .from("profiles")
            .select("id, full_name, professional_profile, rating_avg, badge")
            .in("id", workerIds);
          const profMap: Record<string, any> = {};
          (profs ?? []).forEach((p: any) => { profMap[p.id] = p; });
          const candMap: Record<string, Candidate[]> = {};
          Object.entries(byAnn).forEach(([annId, wids]) => {
            candMap[annId] = wids.map((wid) => ({
              worker_id: wid,
              full_name: profMap[wid]?.full_name ?? null,
              professional_profile: profMap[wid]?.professional_profile ?? null,
              rating_avg: profMap[wid]?.rating_avg ?? null,
              badge: profMap[wid]?.badge ?? null,
            }));
          });
          setCandidates(candMap);
          if (assignedAnns.length) {
            const annIds = assignedAnns.map(a => a.id);
            const { data: revs } = await supabase
              .from("reviews")
              .select("announcement_id, target_id, rating, author_id")
              .in("announcement_id", annIds)
              .eq("author_id", user.id);
            const revMap: Record<string, number> = {};
            (revs ?? []).forEach((r: any) => { revMap[r.announcement_id] = r.rating; });
            const aMap: Record<string, AssignedInfo> = {};
            assignedAnns.forEach((a) => {
              const wid = a.assigned_worker_id as string;
              aMap[a.id] = {
                worker_id: wid,
                full_name: profMap[wid]?.full_name ?? null,
                rating: revMap[a.id] ?? null,
              };
            });
            setAssigned(aMap);
          }
        }
      }
      setLoading(false);
    })();
  }, [user, role]);

  const visible = items.filter(a => statusFilter === "all" ? true : a.status === statusFilter);

  return (
    <AppShell>
      <PageHeader
        title={role === "restaurant" ? "I miei annunci" : "Annunci disponibili"}
        action={role === "restaurant" && (<Link to="/ristoratore/annunci/nuovo"><Button className="gap-2"><Plus className="h-4 w-4" /> Nuovo annuncio</Button></Link>)}
      />
      {role === "restaurant" && (
        <div className="flex gap-2 mb-4 overflow-x-auto">
          {(["all","draft","active","assigned","completed","expired","cancelled"] as const).map(f => (
            <Button key={f} size="sm" variant={statusFilter === f ? "default" : "outline"} onClick={() => setStatusFilter(f)}>
              {f === "all" ? "Tutti" : f === "draft" ? "Bozze" : f === "active" ? "Pubblicati" : f === "assigned" ? "Assegnati" : f === "completed" ? "Completati" : f === "expired" ? "Scaduti" : "Annullati"}
            </Button>
          ))}
        </div>
      )}
      {loading ? <p className="text-muted-foreground">Caricamento…</p> : visible.length === 0 ? (
        <div className="rounded-2xl border bg-card p-12 text-center">
          <p className="text-muted-foreground">Nessun annuncio.</p>
          {role === "restaurant" && <Link to="/ristoratore/annunci/nuovo"><Button className="mt-4">Crea il primo</Button></Link>}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {visible.map((a) => (
            <div key={a.id} className="rounded-2xl border bg-card p-5">
              {role === "restaurant" && (a.status === "assigned" || a.status === "completed") && assigned[a.id] && (
                <div className={`mb-3 rounded-xl border p-3 ${a.status === "completed" ? "bg-blue-50 border-blue-200" : "bg-green-50 border-green-200"}`}>
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <CheckCircle2 className={`h-4 w-4 ${a.status === "completed" ? "text-blue-600" : "text-green-600"}`} />
                    <span className={a.status === "completed" ? "text-blue-800" : "text-green-800"}>
                      {a.status === "completed" ? "Turno completato" : "Turno assegnato"}
                    </span>
                  </div>
                  <div className="mt-1 text-sm text-foreground">
                    {a.status === "completed" ? "Lavoratore: " : "Assegnato a: "}
                    <span className="font-medium">{assigned[a.id].full_name || "Lavoratore"}</span>
                  </div>
                  {a.status === "completed" && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      {assigned[a.id].rating != null ? (
                      <span className="inline-flex items-center gap-1">
                        La tua valutazione:
                        <span className="inline-flex items-center">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className={`h-3 w-3 ${
                                i < (assigned[a.id].rating ?? 0)
                                  ? "text-yellow-400 fill-yellow-400"
                                  : "text-gray-300"
                              }`}
                            />
                          ))}
                        </span>
                        <span className="text-foreground font-medium">{assigned[a.id].rating}/5</span>
                      </span>
                      ) : (
                        <span className="italic">Valutazione non ancora inserita</span>
                      )}
                    </div>
                  )}
                </div>
              )}
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground"><Calendar className="h-4 w-4" />{formatRange(a)}</div>
                  <h3 className="mt-2 text-lg font-bold text-foreground">{a.professional_profile?.trim() || "Ruolo non specificato"}</h3>
                  <p className="text-xs text-muted-foreground">Durata: {a.shift_duration_hours ?? a.duration_hours}h{a.end_date && a.end_date !== a.service_date ? " · Turno notturno" : ""}</p>
                  {(a.is_long_shift || (a.shift_duration_hours ?? a.duration_hours) > 8) && (
                    <span className="mt-1 inline-block text-[10px] uppercase font-semibold rounded-full bg-amber-500/20 text-amber-700 px-2 py-0.5">Turno lungo +8h</span>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={`text-xs rounded-full px-2 py-1 font-medium ${STATUS_CLS[a.status] ?? 'bg-muted text-muted-foreground'}`}>
                    {STATUS_LABEL[a.status] ?? a.status}
                  </span>
                  {role === "restaurant" && (
                    <span
                      className={`inline-flex items-center gap-1 text-[11px] rounded-full px-2 py-0.5 font-medium ${(counts[a.id] ?? 0) > 0 ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}
                      title={`${counts[a.id] ?? 0} candidatur${(counts[a.id] ?? 0) === 1 ? 'a' : 'e'}`}
                    >
                      <Users className="h-3 w-3" />
                      {counts[a.id] ?? 0} candidat{(counts[a.id] ?? 0) === 1 ? 'o' : 'i'}
                    </span>
                  )}
                  {a.status === 'active' && (() => {
                    const e = expiresLabel(a.expires_at);
                    return <span className={`text-[10px] rounded-full px-2 py-0.5 ${e.tone === 'warn' ? 'bg-yellow-100 text-yellow-800' : e.tone === 'ok' ? 'bg-secondary text-secondary-foreground' : 'bg-muted text-muted-foreground'}`}>{e.text}</span>;
                  })()}
                </div>
              </div>
              <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                <div className="flex items-center gap-2"><MapPin className="h-4 w-4" />{a.location_address}</div>
                <div className="flex items-center gap-2"><Euro className="h-4 w-4" />{formatTariff(a.tariff_amount, a.tariff_type)}</div>
                <div className="flex items-center gap-2"><Clock className="h-4 w-4" />Scade il {new Date(a.expires_at).toLocaleDateString("it-IT")}</div>
                {role === "restaurant" && (
                  <div className="flex items-center gap-2"><Users className="h-4 w-4" />{counts[a.id] ?? 0} candidatur{(counts[a.id] ?? 0) === 1 ? "a" : "e"}</div>
                )}
              </div>
              <div className="mt-3">
                {a.location_lat != null && a.location_lng != null ? (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      onClick={() => setOpenMaps((prev) => ({ ...prev, [a.id]: !prev[a.id] }))}
                      aria-expanded={!!openMaps[a.id]}
                    >
                      {openMaps[a.id] ? (<><EyeOff className="h-3.5 w-3.5" />Nascondi mappa</>) : (<><MapPin className="h-3.5 w-3.5" />Vedi mappa</>)}
                    </Button>
                    {openMaps[a.id] && (
                      <div className="mt-3 overflow-hidden rounded-xl">
                        <AnnouncementMap
                          key={a.id}
                          lat={a.location_lat}
                          lng={a.location_lng}
                          address={a.location_address}
                          height={280}
                        />
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground italic">Mappa non disponibile: indirizzo incompleto</p>
                )}
              </div>
              {role === "restaurant" && a.status !== "active" && (
                <Link to="/ristoratore/annunci/nuovo" search={{ reuse: a.id } as never} className="mt-3 inline-flex"><Button variant="outline" size="sm" className="gap-2"><RotateCw className="h-3 w-3" />Riusa come nuovo</Button></Link>
              )}
              <div className="mt-3">
                {role === "restaurant" ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="default" className="gap-1">
                          <Users className="h-3.5 w-3.5" />
                          Vedi candidature{counts[a.id] ? ` (${counts[a.id]})` : ""}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-72 max-w-[calc(100vw-2rem)] z-50">
                        <DropdownMenuLabel>Candidati per questo annuncio</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {(candidates[a.id]?.length ?? 0) === 0 ? (
                          <div className="px-2 py-3 text-xs text-muted-foreground">
                            Nessuna candidatura ricevuta per questo annuncio
                          </div>
                        ) : (
                          candidates[a.id].map((c) => {
                            const isAssigned = a.assigned_worker_id === c.worker_id;
                            return (
                            <DropdownMenuItem
                              key={c.worker_id}
                              onSelect={() => {
                                navigate({ to: "/messages", search: { with: c.worker_id } });
                              }}
                              className={`flex flex-col items-start gap-0.5 cursor-pointer ${isAssigned ? "bg-green-50 dark:bg-green-950/30" : ""}`}
                            >
                              <span className="text-sm font-medium text-foreground flex items-center gap-1.5">
                                {c.full_name || "Lavoratore"}
                                {isAssigned && (
                                  <span className="inline-flex items-center gap-0.5 rounded-full bg-green-100 text-green-800 px-1.5 py-0.5 text-[10px] font-medium">
                                    ✅ Assegnato
                                  </span>
                                )}
                              </span>
                              <span className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                                {c.professional_profile && <span>{c.professional_profile}</span>}
                                {c.rating_avg != null && (
                                  <span className="inline-flex items-center gap-1">
                                    {Array.from({ length: 5 }).map((_, i) => (
                                      <Star
                                        key={i}
                                        className={`h-3 w-3 ${
                                          i < Math.round(c.rating_avg ?? 0)
                                            ? "text-yellow-400 fill-yellow-400"
                                            : "text-gray-300"
                                        }`}
                                      />
                                    ))}
                                    <span className="text-foreground font-medium">{Number(c.rating_avg).toFixed(1)}</span>
                                  </span>
                                )}
                                {c.badge && <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px]">{c.badge}</span>}
                              </span>
                            </DropdownMenuItem>
                            );
                          })
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                ) : (
                  <Link to="/announcements/$id" params={{ id: a.id }}>
                    <Button size="sm" variant="outline" className="gap-1">Apri dettagli</Button>
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}