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
import { geocodeAddress } from "@/lib/geocode";
import { getShiftEndDate, getShiftStartDate, getExpiresAtDate } from "@/lib/announcement-time";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { labelOf, labelsOf } from "@/lib/announcement-requirements";

function AnnouncementMapBlock({
  annId, lat, lng, address, open, onToggle,
}: {
  annId: string;
  lat: number | null;
  lng: number | null;
  address: string | null | undefined;
  open: boolean;
  onToggle: () => void;
}) {
  const hasCoords = lat != null && lng != null;
  const hasAddress = !!(address && address.trim().length > 0);
  const [geo, setGeo] = useState<{ lat: number; lng: number } | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoFailed, setGeoFailed] = useState(false);

  useEffect(() => {
    if (!open || hasCoords || !hasAddress || geo || geoLoading || geoFailed) return;
    let cancelled = false;
    setGeoLoading(true);
    geocodeAddress(address as string).then((r) => {
      if (cancelled) return;
      if (r) setGeo(r); else setGeoFailed(true);
      setGeoLoading(false);
    }).catch(() => { if (!cancelled) { setGeoFailed(true); setGeoLoading(false); } });
    return () => { cancelled = true; };
  }, [open, hasCoords, hasAddress, address, geo, geoLoading, geoFailed]);

  if (!hasCoords && !hasAddress) {
    return <p className="text-xs text-muted-foreground italic">Indirizzo non disponibile</p>;
  }

  const effLat = hasCoords ? (lat as number) : geo?.lat;
  const effLng = hasCoords ? (lng as number) : geo?.lng;

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="gap-1"
        onClick={onToggle}
        aria-expanded={open}
      >
        {open ? (<><EyeOff className="h-3.5 w-3.5" />Nascondi mappa</>) : (<><MapPin className="h-3.5 w-3.5" />Vedi mappa</>)}
      </Button>
      {open && (
        <div className="mt-3 space-y-2">
          {effLat != null && effLng != null ? (
            <div className="overflow-hidden rounded-xl">
              <AnnouncementMap key={annId} lat={effLat} lng={effLng} address={address ?? undefined} height={280} />
            </div>
          ) : geoLoading ? (
            <div className="h-[120px] rounded-xl bg-muted animate-pulse" />
          ) : (
            <div className="rounded-xl border bg-muted/40 p-3 text-xs text-muted-foreground">
              Mappa non disponibile{hasAddress ? ", ma indirizzo presente:" : "."}
            </div>
          )}
          {hasAddress && (
            <p className="text-xs text-foreground">
              <MapPin className="inline h-3 w-3 mr-1 text-muted-foreground" />
              {address}
            </p>
          )}
        </div>
      )}
    </>
  );
}

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


type EffectiveStatus = "active" | "soon" | "expired" | "completed" | "assigned" | "draft" | "cancelled";

/** Determine the displayed status combining DB status with time-based expiry. */
function computeEffectiveStatus(a: Ann, now: Date): { kind: EffectiveStatus; countdown: string | null } {
  if (a.status === "completed") return { kind: "completed", countdown: null };
  if (a.status === "cancelled") return { kind: "cancelled", countdown: null };
  if (a.status === "draft") return { kind: "draft", countdown: null };

  const end = getShiftEndDate(a);
  const start = getShiftStartDate(a);
  const expiresAt = getExpiresAtDate(a);

  // Past the shift's end time? expired/completed.
  if (end && end.getTime() < now.getTime()) {
    return { kind: a.status === "assigned" ? "completed" : "expired", countdown: null };
  }
  // Past the expires_at (publication deadline) without assignment?
  if (a.status !== "assigned" && expiresAt && expiresAt.getTime() < now.getTime()) {
    return { kind: "expired", countdown: null };
  }
  if (a.status === "assigned") {
    return { kind: "assigned", countdown: start ? formatCountdown(start.getTime() - now.getTime(), "Turno") : null };
  }

  // Active: countdown is whichever comes first between expires_at and shift start.
  const targets = [expiresAt?.getTime(), start?.getTime()].filter((n): n is number => typeof n === "number" && n > now.getTime());
  const target = targets.length ? Math.min(...targets) : null;
  const ms = target ? target - now.getTime() : null;
  const isSoon = ms != null && ms <= 24 * 60 * 60 * 1000;
  return { kind: isSoon ? "soon" : "active", countdown: ms != null ? formatCountdown(ms, "Scade") : null };
}

function formatCountdown(ms: number, prefix: "Scade" | "Turno"): string {
  if (ms <= 0) return prefix === "Scade" ? "Scaduto" : "In corso";
  const totalMin = Math.floor(ms / 60000);
  const days = Math.floor(totalMin / (60 * 24));
  const hours = Math.floor((totalMin % (60 * 24)) / 60);
  const mins = totalMin % 60;
  if (prefix === "Turno") {
    if (days >= 1) return `Turno tra ${days} giorn${days === 1 ? "o" : "i"}`;
    if (hours >= 1) return `Turno tra ${hours}h${mins ? ` ${mins}m` : ""}`;
    return `Turno tra ${mins} min`;
  }
  if (days >= 1) return `Scade tra ${days} giorn${days === 1 ? "o" : "i"}${hours ? ` e ${hours}h` : ""}`;
  if (hours >= 1) return `Scade tra ${hours} or${hours === 1 ? "a" : "e"}${mins ? ` e ${mins} min` : ""}`;
  return `Scade tra ${mins} min`;
}

const STATUS_LABEL: Record<string, string> = {
  draft: "In bozza",
  active: "Attivo",
  soon: "In scadenza",
  assigned: "Assegnato",
  completed: "Completato",
  expired: "Scaduto",
  cancelled: "Annullato",
};

const STATUS_CLS: Record<string, string> = {
  draft: "bg-amber-100 text-amber-800",
  active: "bg-green-100 text-green-800",
  soon: "bg-yellow-100 text-yellow-900 border border-yellow-300",
  assigned: "bg-blue-100 text-blue-800",
  completed: "bg-blue-100 text-blue-800",
  expired: "bg-red-100 text-red-800 border border-red-300",
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
  const [republishOpen, setRepublishOpen] = useState(false);
  const [republishAnn, setRepublishAnn] = useState<Ann | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "draft" | "active" | "assigned" | "completed" | "expired" | "cancelled">(
    (initialStatus as any) || "all"
  );
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

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
          {visible.map((a) => {
            const effOuter = computeEffectiveStatus(a, now);
            const isExpired = effOuter.kind === "expired" || effOuter.kind === "cancelled";
            return (
            <div
              key={a.id}
              className={`rounded-2xl border bg-card p-5 ${isExpired ? "opacity-70 border-red-200" : ""}`}
            >
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
                {(() => {
                  const eff = computeEffectiveStatus(a, now);
                  return (
                <div className="flex flex-col items-end gap-1">
                  <span className={`text-xs rounded-full px-2 py-1 font-medium ${STATUS_CLS[eff.kind] ?? 'bg-muted text-muted-foreground'}`}>
                    {STATUS_LABEL[eff.kind] ?? eff.kind}
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
                  {eff.countdown && (eff.kind === "active" || eff.kind === "soon" || eff.kind === "assigned") && (
                    <span
                      className={`text-[10px] rounded-full px-2 py-0.5 ${
                        eff.kind === "soon"
                          ? "bg-yellow-100 text-yellow-900"
                          : eff.kind === "assigned"
                          ? "bg-blue-50 text-blue-800"
                          : "bg-secondary text-secondary-foreground"
                      }`}
                    >
                      {eff.countdown}
                    </span>
                  )}
                  {eff.kind === "expired" && (
                    <span className="text-[10px] rounded-full px-2 py-0.5 bg-red-100 text-red-800 font-semibold">
                      Annuncio scaduto
                    </span>
                  )}
                </div>
                  );
                })()}
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
                <AnnouncementMapBlock
                  annId={a.id}
                  lat={a.location_lat}
                  lng={a.location_lng}
                  address={a.location_address}
                  open={!!openMaps[a.id]}
                  onToggle={() => setOpenMaps((prev) => ({ ...prev, [a.id]: !prev[a.id] }))}
                />
              </div>
              {role === "restaurant" && a.status !== "active" && (() => {
                const eff = computeEffectiveStatus(a, now);
                const label = eff.kind === "expired" ? "Ripubblica annuncio" : "Riusa come nuovo";
                return (
                  <Button
                    variant={eff.kind === "expired" ? "default" : "outline"}
                    size="sm"
                    className="gap-2 mt-3"
                    onClick={() => { setRepublishAnn(a); setRepublishOpen(true); }}
                  >
                    <RotateCw className="h-3 w-3" />{label}
                  </Button>
                );
              })()}
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
                        {(effOuter.kind === "expired" || effOuter.kind === "completed" || effOuter.kind === "cancelled") && (
                          <div className="px-2 pt-1 pb-2 text-[11px] text-muted-foreground italic">
                            Annuncio {effOuter.kind === "completed" ? "completato" : effOuter.kind === "cancelled" ? "annullato" : "scaduto"}: messaggistica disabilitata.
                          </div>
                        )}
                        {(candidates[a.id]?.length ?? 0) === 0 ? (
                          <div className="px-2 py-3 text-xs text-muted-foreground">
                            Nessuna candidatura ricevuta per questo annuncio
                          </div>
                        ) : (
                          candidates[a.id].map((c) => {
                            const isAssigned = a.assigned_worker_id === c.worker_id;
                            const msgDisabled = effOuter.kind === "expired" || effOuter.kind === "completed" || effOuter.kind === "cancelled";
                            return (
                            <DropdownMenuItem
                              key={c.worker_id}
                              disabled={msgDisabled}
                              onSelect={() => {
                                if (msgDisabled) return;
                                navigate({ to: "/messages", search: { with: c.worker_id } });
                              }}
                              className={`flex flex-col items-start gap-0.5 ${msgDisabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"} ${isAssigned ? "bg-green-50 dark:bg-green-950/30" : ""}`}
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
            );
          })}
        </div>
      )}

      <RepublishDialog
        open={republishOpen}
        onOpenChange={setRepublishOpen}
        ann={republishAnn}
      />
    </AppShell>
  );
}

function RepublishDialog({
  open,
  onOpenChange,
  ann,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  ann: Ann | null;
}) {
  const navigate = useNavigate();
  if (!ann) return null;

  const startD = new Date(ann.service_date + "T00:00:00").toLocaleDateString("it-IT", {
    weekday: "long", day: "2-digit", month: "long", year: "numeric",
  });
  const st = ann.service_time?.slice(0, 5) ?? "";
  const endDate = ann.end_date;
  const et = ann.end_time?.slice(0, 5) ?? "";
  const dateRange = endDate && endDate !== ann.service_date
    ? `${startD} ore ${st} → ${new Date(endDate + "T00:00:00").toLocaleDateString("it-IT", { day: "2-digit", month: "long" })} ore ${et}`
    : `${startD} · ${st}${et ? `–${et}` : ""}`;

  const speedLabel: Record<string, string> = {
    normal: "Normale (7 giorni)",
    fast: "Veloce (24 ore)",
    flash: "Flash (immediato)",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Ripubblica annuncio</DialogTitle>
          <DialogDescription>
            Verrà creato un nuovo annuncio precompilato con i dati qui sotto. Potrai modificarli prima di pubblicare.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <SummaryRow icon={Calendar} label="Data e ora" value={dateRange} />
          <SummaryRow icon={Clock} label="Durata" value={`${ann.shift_duration_hours ?? ann.duration_hours} ore`} />
          <SummaryRow icon={Euro} label="Tariffa" value={formatTariff(ann.tariff_amount, ann.tariff_type)} />
          <SummaryRow icon={MapPin} label="Indirizzo" value={ann.location_address} />
          {ann.professional_profile && (
            <SummaryRow icon={Users} label="Ruolo richiesto" value={ann.professional_profile} />
          )}
          <SummaryRow icon={RotateCw} label="Velocità ricerca" value={speedLabel[ann.speed] ?? ann.speed} />
          {ann.license_requirement && ann.license_requirement !== "nessuna" && (
            <SummaryRow icon={CheckCircle2} label="Patente" value={labelOf(ann.license_requirement, [
              { value: "b", label: "Patente B" },
              { value: "c", label: "Patente C" },
              { value: "d", label: "Patente D" },
              { value: "nessuna", label: "Nessuna" },
            ])} />
          )}
          {ann.language_requirements && ann.language_requirements.length > 0 && (
            <SummaryRow icon={CheckCircle2} label="Lingue" value={labelsOf(ann.language_requirements, [
              { value: "italiano", label: "Italiano" },
              { value: "inglese", label: "Inglese" },
              { value: "francese", label: "Francese" },
              { value: "spagnolo", label: "Spagnolo" },
              { value: "tedesco", label: "Tedesco" },
              { value: "cinese", label: "Cinese" },
              { value: "arabo", label: "Arabo" },
              { value: "russo", label: "Russo" },
              { value: "portoghese", label: "Portoghese" },
            ]).join(", ")} />
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annulla</Button>
          <Button
            onClick={() => {
              onOpenChange(false);
              navigate({ to: "/ristoratore/annunci/nuovo", search: { reuse: ann.id } as never });
            }}
          >
            Conferma e crea
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SummaryRow({ icon: Icon, label, value }: { icon: typeof Calendar; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="font-medium">{value}</div>
      </div>
    </div>
  );
}