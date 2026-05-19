import { createFileRoute, Link } from "@tanstack/react-router";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell, PageHeader } from "@/components/AppShell";
import { useAuth } from "@/lib/auth-context";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus, Calendar, MapPin, Euro, Clock, RotateCw, Users, EyeOff, Star, CheckCircle2, FileText, Pencil, AlertTriangle, Briefcase, Languages, UserCheck, Copy, Trash2, Lock, MessageSquare, Send } from "lucide-react";
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
import { ApproximateAreaMap } from "@/components/ApproximateAreaMap";
import { publicLocationLabel, PRECISE_ADDRESS_HINT } from "@/lib/public-location";
import { formatTariff } from "@/lib/format";
import { geocodeAddress } from "@/lib/geocode";
import { getShiftEndDate, getShiftStartDate, getExpiresAtDate } from "@/lib/announcement-time";
import { sendShiftProposal } from "@/lib/shift-proposal";
import { useRequiredReviews } from "@/lib/required-reviews";
import { BlockedContactDialog } from "@/components/BlockedContactDialog";
import { UserAvatar } from "@/components/UserAvatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  labelOf, labelsOf,
  LICENSE_OPTIONS, LANGUAGE_OPTIONS, SKILL_OPTIONS, DRESS_CODE_OPTIONS,
} from "@/lib/announcement-requirements";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

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

type Ann = { id: string; service_date: string; service_time: string; end_date: string | null; end_time: string | null; duration_hours: number; speed: string; tariff_type: string; tariff_amount: number; location_address: string; location_lat: number | null; location_lng: number | null; status: string; expires_at: string; professional_profile: string | null; is_long_shift?: boolean | null; long_shift_reason?: string | null; shift_duration_hours?: number | null; assigned_worker_id?: string | null; license_requirement?: string | null; language_requirements?: string[] | null; tattoos_allowed?: string | null; piercings_allowed?: string | null; beard_allowed?: string | null; required_skills?: string[] | null; dress_code_items?: string[] | null; dress_code_notes?: string | null; job_city?: string | null; }

type Candidate = {
  worker_id: string;
  full_name: string | null;
  professional_profile: string | null;
  rating_avg: number | null;
  badge: string | null;
  application_id: string | null;
  app_status: string | null;
  application_created_at: string | null;
  last_message_preview: string | null;
  last_message_at: string | null;
  reviewed: boolean;
  avatar_url: string | null;
};

type AssignedInfo = {
  worker_id: string;
  full_name: string | null;
  rating: number | null;
  shift_id: string | null;
  shift_status: string | null;
};

type ProposalStatusKind =
  | "pending"
  | "accepted"
  | "confirmed"
  | "rejected"
  | "completed"
  | "review_pending"
  | "review_sent";

const PROPOSAL_STATUS_LABEL: Record<ProposalStatusKind, string> = {
  pending: "In attesa di risposta",
  accepted: "Accettata",
  confirmed: "Confermata",
  rejected: "Rifiutata",
  completed: "Turno completato",
  review_pending: "Recensione da inviare",
  review_sent: "Recensione inviata",
};

const PROPOSAL_STATUS_CLS: Record<ProposalStatusKind, string> = {
  pending: "bg-amber-100 text-amber-800 border border-amber-200",
  accepted: "bg-green-100 text-green-800 border border-green-200",
  confirmed: "bg-emerald-100 text-emerald-800 border border-emerald-300",
  rejected: "bg-red-100 text-red-800 border border-red-200",
  completed: "bg-blue-100 text-blue-800 border border-blue-200",
  review_pending: "bg-yellow-100 text-yellow-900 border border-yellow-300",
  review_sent: "bg-indigo-100 text-indigo-800 border border-indigo-200",
};

function deriveProposalStatus(ann: Ann, c: Candidate): ProposalStatusKind {
  const isAssigned = ann.assigned_worker_id === c.worker_id;
  if (ann.status === "completed" && isAssigned) {
    return c.reviewed ? "review_sent" : "review_pending";
  }
  if (ann.status === "completed") return "completed";
  if (isAssigned) return "confirmed";
  const s = c.app_status;
  if (s === "accepted") return "accepted";
  if (s === "rejected" || s === "not_interested") return "rejected";
  return "pending";
}

function formatRelativeShort(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("it-IT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

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

  // Turno assegnato e già finito → completato.
  if (a.status === "assigned" && end && end.getTime() < now.getTime()) {
    return { kind: "completed", countdown: null };
  }
  // Scadenza annuncio = inizio turno. Quando si raggiunge l'inizio, l'annuncio
  // smette di essere modificabile/candidabile; se era assegnato resta "assegnato"
  // finché il turno non finisce, altrimenti diventa "scaduto".
  if (start && start.getTime() <= now.getTime()) {
    if (a.status === "assigned") {
      return { kind: "assigned", countdown: "Turno in corso" };
    }
    return { kind: "expired", countdown: null };
  }
  if (a.status === "assigned") {
    return { kind: "assigned", countdown: start ? formatCountdown(start.getTime() - now.getTime(), "Turno") : null };
  }

  // Active: countdown verso l'inizio del turno.
  const ms = start ? start.getTime() - now.getTime() : null;
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
  const { user, role, profile } = useAuth();
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
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsAnn, setDetailsAnn] = useState<Ann | null>(null);
  const [proposalTarget, setProposalTarget] = useState<{ ann: Ann; candidate: Candidate } | null>(null);
  const { isBlocked, actionShifts } = useRequiredReviews();
  const [blockOpen, setBlockOpen] = useState(false);
  const [closeTarget, setCloseTarget] = useState<Ann | null>(null);
  const [closing, setClosing] = useState(false);
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
      const base = supabase.from("announcements").select("*");
      const { data } = role === "restaurant" ? await base.eq("restaurant_id", user.id) : await base.eq("status", "active");
      const list = ((data as Ann[]) ?? []).sort((a, b) => {
        const sa = getShiftStartDate(a);
        const sb = getShiftStartDate(b);
        if (!sa && !sb) return 0;
        if (!sa) return 1;
        if (!sb) return -1;
        return sa.getTime() - sb.getTime();
      });
      setItems(list);
      if (role === "restaurant" && list.length) {
        const ids = list.map(a => a.id);
        const { data: apps } = await supabase
          .from("applications")
          .select("id, announcement_id, worker_id, status, created_at, last_message_preview, last_message_at")
          .in("announcement_id", ids);
        const map: Record<string, number> = {};
        const byAnn: Record<string, any[]> = {};
        (apps ?? []).forEach((a: any) => {
          map[a.announcement_id] = (map[a.announcement_id] ?? 0) + 1;
          (byAnn[a.announcement_id] ||= []).push(a);
        });
        setCounts(map);
        const assignedAnns = list.filter(a => a.assigned_worker_id);
        const assignedWorkerIds = assignedAnns.map(a => a.assigned_worker_id as string);
        const workerIds = Array.from(new Set([...(apps ?? []).map((a: any) => a.worker_id), ...assignedWorkerIds]));
        if (workerIds.length) {
          const [{ data: profs }, { data: allRevs }] = await Promise.all([
            supabase
              .from("profiles")
              .select("id, full_name, professional_profile, rating_avg, badge, avatar_url")
              .in("id", workerIds),
            supabase
              .from("reviews")
              .select("announcement_id, target_id, author_id")
              .in("announcement_id", ids)
              .eq("author_id", user.id),
          ]);
          const profMap: Record<string, any> = {};
          (profs ?? []).forEach((p: any) => { profMap[p.id] = p; });
          const reviewedSet = new Set<string>();
          (allRevs ?? []).forEach((r: any) => { reviewedSet.add(`${r.announcement_id}::${r.target_id}`); });
          const candMap: Record<string, Candidate[]> = {};
          Object.entries(byAnn).forEach(([annId, rows]) => {
            candMap[annId] = rows.map((row: any) => ({
              worker_id: row.worker_id,
              full_name: profMap[row.worker_id]?.full_name ?? null,
              professional_profile: profMap[row.worker_id]?.professional_profile ?? null,
              rating_avg: profMap[row.worker_id]?.rating_avg ?? null,
              badge: profMap[row.worker_id]?.badge ?? null,
              avatar_url: profMap[row.worker_id]?.avatar_url ?? null,
              application_id: row.id ?? null,
              app_status: row.status ?? null,
              application_created_at: row.created_at ?? null,
              last_message_preview: row.last_message_preview ?? null,
              last_message_at: row.last_message_at ?? null,
              reviewed: reviewedSet.has(`${annId}::${row.worker_id}`),
            }));
          });
          setCandidates(candMap);
          if (assignedAnns.length) {
            const annIds = assignedAnns.map(a => a.id);
            const [{ data: revs }, { data: shiftRows }] = await Promise.all([
              supabase
                .from("reviews")
                .select("announcement_id, target_id, rating, author_id")
                .in("announcement_id", annIds)
                .eq("author_id", user.id),
              supabase
                .from("shifts")
                .select("id, announcement_id, worker_id, status")
                .in("announcement_id", annIds)
                .eq("restaurant_id", user.id),
            ]);
            const revMap: Record<string, number> = {};
            (revs ?? []).forEach((r: any) => { revMap[r.announcement_id] = r.rating; });
            const shiftMap: Record<string, { id: string; status: string }> = {};
            (shiftRows ?? []).forEach((s: any) => {
              shiftMap[`${s.announcement_id}::${s.worker_id}`] = { id: s.id, status: s.status };
            });
            const aMap: Record<string, AssignedInfo> = {};
            assignedAnns.forEach((a) => {
              const wid = a.assigned_worker_id as string;
              const sh = shiftMap[`${a.id}::${wid}`];
              aMap[a.id] = {
                worker_id: wid,
                full_name: profMap[wid]?.full_name ?? null,
                rating: revMap[a.id] ?? null,
                shift_id: sh?.id ?? null,
                shift_status: sh?.status ?? null,
              };
            });
            setAssigned(aMap);
          }
        }
      }
      setLoading(false);
    })();
  }, [user, role]);

  const isPastKind = (kind: EffectiveStatus) => kind === "expired" || kind === "completed" || kind === "cancelled";

  const filtered = items.filter(a => statusFilter === "all" ? true : a.status === statusFilter);
  const upcoming = statusFilter === "all" ? filtered.filter(a => !isPastKind(computeEffectiveStatus(a, now).kind)) : filtered;
  const past = statusFilter === "all" ? filtered.filter(a => isPastKind(computeEffectiveStatus(a, now).kind)) : [];

  const openDetails = (a: Ann) => { setDetailsAnn(a); setDetailsOpen(true); };
  const handleAnnUpdated = (updated: Ann) => {
    setItems((prev) => prev.map((x) => x.id === updated.id ? { ...x, ...updated } : x));
    setDetailsAnn((prev) => prev && prev.id === updated.id ? { ...prev, ...updated } : prev);
  };

  const renderCard = (a: Ann) => {
    const effOuter = computeEffectiveStatus(a, now);
    const isExpired = effOuter.kind === "expired" || effOuter.kind === "cancelled";
    return (
      <div
        key={a.id}
        className={`rounded-2xl border bg-card p-5 ${isExpired ? "opacity-70 border-red-200" : ""}`}
      >
        {role === "restaurant" && (a.status === "assigned" || a.status === "completed") && assigned[a.id] && (() => {
          const info = assigned[a.id];
          const start = getShiftStartDate(a);
          const end = getShiftEndDate(a);
          const nowMs = now.getTime();
          const hasReview = info.rating != null;
          const isClosed = info.shift_status === "completed" || a.status === "completed";
          const afterEnd = !!end && nowMs >= end.getTime();
          const afterStart = !!start && nowMs >= start.getTime();
          let stateLabel = "Turno assegnato";
          let stateCls = "bg-green-50 border-green-200 text-green-800";
          if (hasReview) {
            stateLabel = "Turno chiuso — recensione inviata";
            stateCls = "bg-indigo-50 border-indigo-200 text-indigo-800";
          } else if (isClosed) {
            stateLabel = "Turno chiuso — recensione da inviare";
            stateCls = "bg-yellow-50 border-yellow-300 text-yellow-900";
          } else if (afterEnd) {
            stateLabel = "Turno concluso — da chiudere";
            stateCls = "bg-amber-50 border-amber-200 text-amber-800";
          } else if (afterStart) {
            stateLabel = "Turno in corso";
            stateCls = "bg-blue-50 border-blue-200 text-blue-800";
          }
          return (
            <div className={`mb-3 rounded-xl border p-3 ${stateCls}`}>
              <div className="flex items-center gap-2 text-sm font-semibold">
                <CheckCircle2 className="h-4 w-4" />
                <span>{stateLabel}</span>
              </div>
              <div className="mt-1 text-sm text-foreground">
                Lavoratore: <span className="font-medium">{info.full_name || "Lavoratore"}</span>
              </div>
              {hasReview && (
                <div className="mt-1 text-xs text-muted-foreground inline-flex items-center gap-1">
                  La tua valutazione:
                  <span className="inline-flex items-center">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`h-3 w-3 ${i < (info.rating ?? 0) ? "text-yellow-400 fill-yellow-400" : "text-gray-300"}`}
                      />
                    ))}
                  </span>
                  <span className="text-foreground font-medium">{info.rating}/5</span>
                </div>
              )}
              {!isClosed && !hasReview && (
                <div className="mt-2">
                  {afterEnd ? (
                    <Button size="sm" className="gap-1" onClick={() => setCloseTarget(a)}>
                      <CheckCircle2 className="h-3.5 w-3.5" /> Chiudi turno
                    </Button>
                  ) : (
                    <div className="flex flex-col gap-1">
                      <Button size="sm" disabled className="gap-1 w-fit">
                        <Lock className="h-3.5 w-3.5" /> Chiudi turno
                      </Button>
                      <p className="text-[11px] text-muted-foreground italic">
                        Potrai chiudere il turno dopo l'orario di fine servizio.
                      </p>
                    </div>
                  )}
                </div>
              )}
              {isClosed && !hasReview && info.shift_id && (
                <div className="mt-2">
                  <Button size="sm" className="gap-1" onClick={() => navigate({ to: "/shifts", search: { tab: "to-review", shift: info.shift_id } as never })}>
                    <Star className="h-3.5 w-3.5" /> Lascia recensione
                  </Button>
                </div>
              )}
            </div>
          );
        })()}
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
        {(() => {
        const canSeePrecise = role === "restaurant" || (!!user && a.assigned_worker_id === user.id);
        const zoneLabel = publicLocationLabel({ job_city: a.job_city });
        return (
        <>
        <div className="mt-3 space-y-1 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            {canSeePrecise ? a.location_address : zoneLabel}
          </div>
          <div className="flex items-center gap-2"><Euro className="h-4 w-4" />{formatTariff(a.tariff_amount, a.tariff_type)}</div>
          <div className="flex items-center gap-2"><Clock className="h-4 w-4" />Scade il {new Date(a.service_date + "T00:00:00").toLocaleDateString("it-IT")} alle {a.service_time?.slice(0,5) ?? "—"}</div>
          {role === "restaurant" && (
            <div className="flex items-center gap-2"><Users className="h-4 w-4" />{counts[a.id] ?? 0} candidatur{(counts[a.id] ?? 0) === 1 ? "a" : "e"}</div>
          )}
        </div>
        <div className="mt-3">
          {canSeePrecise ? (
            <AnnouncementMapBlock
              annId={a.id}
              lat={a.location_lat}
              lng={a.location_lng}
              address={a.location_address}
              open={!!openMaps[a.id]}
              onToggle={() => setOpenMaps((prev) => ({ ...prev, [a.id]: !prev[a.id] }))}
            />
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">Zona indicativa del turno</span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-1"
                  onClick={() => setOpenMaps((prev) => ({ ...prev, [a.id]: !prev[a.id] }))}
                  aria-expanded={!!openMaps[a.id]}
                >
                  {openMaps[a.id]
                    ? (<><EyeOff className="h-3.5 w-3.5" />Nascondi mappa</>)
                    : (<><MapPin className="h-3.5 w-3.5" />Vedi zona</>)}
                </Button>
              </div>
              {openMaps[a.id] && (
                <>
                  {a.location_lat != null && a.location_lng != null ? (
                    <ApproximateAreaMap lat={a.location_lat} lng={a.location_lng} height={200} radiusM={1200} />
                  ) : (
                    <div className="h-[120px] rounded-2xl border bg-muted/40 flex items-center justify-center text-xs text-muted-foreground px-3 text-center">
                      Zona non disponibile sulla mappa.
                    </div>
                  )}
                  <p className="text-[11px] text-muted-foreground italic">{PRECISE_ADDRESS_HINT}</p>
                </>
              )}
            </div>
          )}
        </div>
        </>
        );
        })()}
        {role === "restaurant" && (
          <Button
            variant="outline"
            size="sm"
            className="gap-2 mt-3"
            onClick={() => openDetails(a)}
          >
            <FileText className="h-3.5 w-3.5" />
            Vedi riepilogo annuncio
          </Button>
        )}
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
            <>
              {(candidates[a.id]?.length ?? 0) > 0 && (
                <div className="mb-3 rounded-xl border bg-muted/30 p-3">
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <Send className="h-3.5 w-3.5" />
                    Richieste inviate ({candidates[a.id].length})
                  </div>
                  <ul className="space-y-2">
                    {candidates[a.id].map((c) => {
                      const ps = deriveProposalStatus(a, c);
                      return (
                        <li key={c.worker_id} className="rounded-lg border bg-card p-2.5">
                          <div className="flex items-start gap-2.5">
                            <UserAvatar userId={c.worker_id} name={c.full_name} className="h-9 w-9 shrink-0" />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-semibold text-foreground truncate">
                                  {c.full_name || "Lavoratore"}
                                </span>
                                {c.rating_avg != null && (
                                  <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
                                    <Star className="h-3 w-3 text-yellow-400 fill-yellow-400" />
                                    <span className="text-foreground font-medium">{Number(c.rating_avg).toFixed(1)}</span>
                                  </span>
                                )}
                              </div>
                              <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                                {c.professional_profile && <span>{c.professional_profile}</span>}
                                {c.application_created_at && (
                                  <span title="Richiesta inviata">· {formatRelativeShort(c.application_created_at)}</span>
                                )}
                              </div>
                              <div className="mt-1.5 flex items-center gap-2">
                                <span className={`text-[11px] rounded-full px-2 py-0.5 font-medium ${PROPOSAL_STATUS_CLS[ps]}`}>
                                  {PROPOSAL_STATUS_LABEL[ps]}
                                </span>
                              </div>
                              {c.last_message_preview && (
                                <p className="mt-1.5 text-xs text-muted-foreground italic line-clamp-1">
                                  “{c.last_message_preview}”
                                </p>
                              )}
                            </div>
                            {c.application_id && (
                              <Link
                                to="/messages/$id"
                                params={{ id: c.application_id }}
                                className="shrink-0"
                              >
                                <Button size="sm" variant="outline" className="gap-1 h-8">
                                  <MessageSquare className="h-3.5 w-3.5" />
                                  Apri chat
                                </Button>
                              </Link>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="default" className="gap-1">
                    <Users className="h-3.5 w-3.5" />
                    Vedi candidature{counts[a.id] ? ` (${counts[a.id]})` : ""}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-72 max-w-[calc(100vw-2rem)] z-50">
                  <DropdownMenuItem
                    onSelect={(e) => { e.preventDefault(); openDetails(a); }}
                    className="cursor-pointer gap-2 text-primary font-medium"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    Vedi riepilogo annuncio
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
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
                          if (isBlocked) { setBlockOpen(true); return; }
                          setProposalTarget({ ann: a, candidate: c });
                        }}
                        className={`flex flex-col items-start gap-0.5 ${msgDisabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"} ${isAssigned ? "bg-green-50 dark:bg-green-950/30" : ""}`}
                      >
                        <span className="text-sm font-medium text-foreground flex items-center gap-1.5">
                          {c.full_name || "Lavoratore"}
                          {isAssigned && (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-green-100 text-green-800 px-1.5 py-0.5 text-[10px] font-medium">
                              Assegnato
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
            </>
          ) : (
            <Link to="/announcements/$id" params={{ id: a.id }}>
              <Button size="sm" variant="outline" className="gap-1">Apri dettagli</Button>
            </Link>
          )}
        </div>
      </div>
    );
  };

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
      {loading ? <p className="text-muted-foreground">Caricamento…</p> : filtered.length === 0 ? (
        <div className="rounded-2xl border bg-card p-12 text-center">
          <p className="text-muted-foreground">Nessun annuncio.</p>
          {role === "restaurant" && <Link to="/ristoratore/annunci/nuovo"><Button className="mt-4">Crea il primo</Button></Link>}
        </div>
      ) : (
        <div className="space-y-6">
          {statusFilter === "all" && upcoming.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-foreground mb-3 uppercase tracking-wide">Annunci attivi / in arrivo</h2>
              <div className="grid gap-4 md:grid-cols-2">
                {upcoming.map((a) => renderCard(a))}
              </div>
            </div>
          )}
          {statusFilter === "all" && past.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Annunci scaduti / completati</h2>
              <div className="grid gap-4 md:grid-cols-2">
                {past.map((a) => renderCard(a))}
              </div>
            </div>
          )}
          {statusFilter !== "all" && (
            <div className="grid gap-4 md:grid-cols-2">
              {upcoming.map((a) => renderCard(a))}
            </div>
          )}
        </div>
      )}

      <RepublishDialog
        open={republishOpen}
        onOpenChange={setRepublishOpen}
        ann={republishAnn}
      />
      <AnnouncementDetailsDialog
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        ann={detailsAnn}
        candidatesCount={detailsAnn ? (counts[detailsAnn.id] ?? 0) : 0}
        assignedCount={detailsAnn?.assigned_worker_id ? 1 : 0}
        venueName={(profile as any)?.business_name ?? null}
        statusKind={detailsAnn ? computeEffectiveStatus(detailsAnn, now).kind : "active"}
        onUpdated={handleAnnUpdated}
        onDuplicate={(a) => { setDetailsOpen(false); setRepublishAnn(a); setRepublishOpen(true); }}
      />
      <ProposalConfirmDialog
        target={proposalTarget}
        venueName={(profile as any)?.business_name ?? (profile as any)?.full_name ?? null}
        restaurantId={user?.id ?? null}
        statusKind={proposalTarget ? computeEffectiveStatus(proposalTarget.ann, now).kind : "active"}
        onClose={() => setProposalTarget(null)}
      />
      <BlockedContactDialog open={blockOpen} onClose={() => setBlockOpen(false)} shifts={actionShifts} />
      <Dialog open={!!closeTarget} onOpenChange={(v) => { if (!v) setCloseTarget(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Chiudi turno</DialogTitle>
            <DialogDescription>Confermi che il turno è stato svolto?</DialogDescription>
          </DialogHeader>
          {closeTarget && (() => {
            const info = assigned[closeTarget.id];
            return (
              <div className="space-y-1.5 text-sm">
                <div><span className="text-muted-foreground">Ruolo:</span> <span className="font-medium">{closeTarget.professional_profile || "—"}</span></div>
                <div><span className="text-muted-foreground">Data:</span> <span className="font-medium">{new Date(closeTarget.service_date + "T00:00:00").toLocaleDateString("it-IT", { weekday: "short", day: "2-digit", month: "short", year: "numeric" })}</span></div>
                <div><span className="text-muted-foreground">Orario:</span> <span className="font-medium">{closeTarget.service_time?.slice(0,5)}{closeTarget.end_time ? `–${closeTarget.end_time.slice(0,5)}` : ""}</span></div>
                {(profile as any)?.business_name && (
                  <div><span className="text-muted-foreground">Locale:</span> <span className="font-medium">{(profile as any).business_name}</span></div>
                )}
                <div><span className="text-muted-foreground">Indirizzo:</span> <span className="font-medium">{closeTarget.location_address || "—"}</span></div>
                <div><span className="text-muted-foreground">Lavoratore:</span> <span className="font-medium">{info?.full_name || "Lavoratore"}</span></div>
                <div><span className="text-muted-foreground">Stato:</span> <span className="font-medium">Da chiudere</span></div>
              </div>
            );
          })()}
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setCloseTarget(null)} disabled={closing}>Annulla</Button>
            <Button
              disabled={closing}
              onClick={async () => {
                if (!closeTarget) return;
                const info = assigned[closeTarget.id];
                if (!info?.shift_id) {
                  toast.error("Turno non trovato. Riprova più tardi.");
                  return;
                }
                setClosing(true);
                try {
                  const { error } = await supabase
                    .from("shifts")
                    .update({ status: "completed", completed_at: new Date().toISOString() } as never)
                    .eq("id", info.shift_id);
                  if (error) {
                    toast.error(error.message);
                    return;
                  }
                  await supabase
                    .from("announcements")
                    .update({ status: "completed" } as never)
                    .eq("id", closeTarget.id);
                  setAssigned((prev) => ({
                    ...prev,
                    [closeTarget.id]: { ...prev[closeTarget.id], shift_status: "completed" },
                  }));
                  setItems((prev) => prev.map((x) => x.id === closeTarget.id ? { ...x, status: "completed" } : x));
                  toast.success("Turno chiuso. Ora lascia la recensione.");
                  const shiftId = info.shift_id;
                  setCloseTarget(null);
                  navigate({ to: "/shifts", search: { tab: "to-review", shift: shiftId } as never });
                } finally {
                  setClosing(false);
                }
              }}
            >
              {closing ? "Salvataggio…" : "Conferma chiusura"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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

function AnnouncementDetailsDialog({
  open, onOpenChange, ann, candidatesCount, assignedCount, venueName, statusKind, onUpdated, onDuplicate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  ann: Ann | null;
  candidatesCount: number;
  assignedCount: number;
  venueName: string | null;
  statusKind: EffectiveStatus;
  onUpdated: (a: Ann) => void;
  onDuplicate: (a: Ann) => void;
}) {
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [recreateOpen, setRecreateOpen] = useState(false);
  const [recreating, setRecreating] = useState(false);
  const [form, setForm] = useState<any>(null);

  useEffect(() => {
    if (!ann) return;
    setEditing(false);
    setConfirmOpen(false);
    setRecreateOpen(false);
    setForm({
      required_skills: [...(ann.required_skills ?? [])],
      dress_code_items: [...(ann.dress_code_items ?? [])],
      dress_code_notes: ann.dress_code_notes ?? "",
      language_requirements: [...(ann.language_requirements ?? [])],
      license_requirement: ann.license_requirement ?? "nessuna",
      notes: (ann as any).notes ?? "",
    });
  }, [ann?.id, open]);

  if (!ann || !form) return null;

  const dateLabel = new Date(ann.service_date + "T00:00:00").toLocaleDateString("it-IT", {
    weekday: "long", day: "2-digit", month: "long", year: "numeric",
  });
  const hasInvolved = candidatesCount > 0 || assignedCount > 0;

  const toggleArr = (key: "required_skills" | "dress_code_items" | "language_requirements", value: string) => {
    setForm((f: any) => ({
      ...f,
      [key]: f[key].includes(value) ? f[key].filter((x: string) => x !== value) : [...f[key], value],
    }));
  };

  const doSave = async () => {
    setSaving(true);
    const payload: any = {
      required_skills: form.required_skills,
      dress_code_items: form.dress_code_items,
      dress_code_notes: form.dress_code_notes || null,
      language_requirements: form.language_requirements,
      license_requirement: form.license_requirement,
      notes: form.notes || null,
    };
    // Detect operational changes that require notifying accepted workers
    const arrEq = (a: any[] = [], b: any[] = []) =>
      a.length === b.length && [...a].sort().join("|") === [...b].sort().join("|");
    const dressChanged =
      !arrEq(payload.dress_code_items ?? [], ann.dress_code_items ?? []) ||
      (payload.dress_code_notes ?? "") !== (ann.dress_code_notes ?? "");
    const skillsChanged = !arrEq(payload.required_skills ?? [], ann.required_skills ?? []);
    const notesChanged = (payload.notes ?? "") !== ((ann as any).notes ?? "");
    const shouldNotifyWorkers = dressChanged || skillsChanged || notesChanged;

    const { data, error } = await supabase
      .from("announcements")
      .update(payload)
      .eq("id", ann.id)
      .select("*")
      .maybeSingle();
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Annuncio aggiornato correttamente.");
    setEditing(false);
    setConfirmOpen(false);
    if (data) onUpdated(data as Ann);

    // Fire-and-forget notification to accepted workers
    if (shouldNotifyWorkers) {
      void (async () => {
        try {
          const { data: apps } = await supabase
            .from("applications")
            .select("worker_id")
            .eq("announcement_id", ann.id)
            .eq("status", "accepted");
          const workerIds = Array.from(new Set((apps ?? []).map((a: any) => a.worker_id).filter(Boolean)));
          if (workerIds.length === 0) return;
          const changed: string[] = [];
          if (dressChanged) changed.push("dress code");
          if (skillsChanged) changed.push("mansioni");
          if (notesChanged) changed.push("note operative");
          const rows = workerIds.map((uid) => ({
            user_id: uid,
            title: "Dettagli turno aggiornati",
            body: "Il ristoratore ha aggiornato alcuni dettagli del turno. Controlla il riepilogo aggiornato.",
            link: `/shifts`,
            metadata: {
              kind: "announcement_updated",
              announcement_id: ann.id,
              changed_fields: changed,
            },
          }));
          await supabase.from("notifications").insert(rows);
        } catch (_) {
          // silent
        }
      })();
    }
  };

  const trySave = () => {
    if (hasInvolved) { setConfirmOpen(true); return; }
    void doSave();
  };

  const dressLabels = labelsOf(ann.dress_code_items ?? [], DRESS_CODE_OPTIONS as any);
  const skillLabels = labelsOf(ann.required_skills ?? [], SKILL_OPTIONS as any);
  const langLabels = labelsOf(ann.language_requirements ?? [], LANGUAGE_OPTIONS as any);
  const licenseLabel = labelOf(ann.license_requirement, LICENSE_OPTIONS as any);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            {editing ? "Modifica annuncio" : "Riepilogo annuncio"}
          </DialogTitle>
          <DialogDescription>
            {editing
              ? "Modifica i dettagli del turno. La data non può essere modificata."
              : "Tutti i dettagli del turno in un'unica vista."}
          </DialogDescription>
        </DialogHeader>

        {!editing ? (
          <div className="space-y-5 text-sm">
            <Section title="1. Dettagli turno">
              <SummaryRow icon={Briefcase} label="Ruolo richiesto" value={ann.professional_profile || "—"} />
              <SummaryRow icon={Calendar} label="Data del turno" value={dateLabel} />
              <SummaryRow icon={Clock} label="Orario" value={`${ann.service_time?.slice(0,5) ?? "—"}${ann.end_time ? ` – ${ann.end_time.slice(0,5)}` : ""}`} />
              <SummaryRow icon={Users} label="Numero lavoratori richiesti" value="1" />
            </Section>

            <Section title="2. Luogo">
              <SummaryRow icon={Briefcase} label="Nome locale" value={venueName || "—"} />
              <SummaryRow icon={MapPin} label="Indirizzo" value={ann.location_address || "—"} />
              {(ann.location_lat != null && ann.location_lng != null) && (
                <div className="overflow-hidden rounded-xl">
                  <AnnouncementMap key={`det-${ann.id}`} lat={ann.location_lat} lng={ann.location_lng} address={ann.location_address ?? undefined} height={200} />
                </div>
              )}
            </Section>

            <Section title="3. Compenso">
              <SummaryRow icon={Euro} label="Compenso" value={formatTariff(ann.tariff_amount, ann.tariff_type)} />
            </Section>

            <Section title="4. Mansioni richieste">
              {skillLabels.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {skillLabels.map((l) => <span key={l} className="rounded-full bg-secondary px-2 py-0.5 text-xs">{l}</span>)}
                </div>
              ) : <p className="text-xs text-muted-foreground italic">Nessuna mansione specifica.</p>}
            </Section>

            <Section title="5. Dress code">
              {dressLabels.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {dressLabels.map((l) => <span key={l} className="rounded-full bg-secondary px-2 py-0.5 text-xs">{l}</span>)}
                </div>
              ) : <p className="text-xs text-muted-foreground italic">Nessun dress code richiesto.</p>}
              {ann.dress_code_notes && <p className="text-xs text-muted-foreground mt-2">{ann.dress_code_notes}</p>}
            </Section>

            <Section title="6. Requisiti">
              <SummaryRow icon={UserCheck} label="Patente" value={licenseLabel} />
              <SummaryRow icon={Languages} label="Lingue richieste" value={langLabels.length ? langLabels.join(", ") : "—"} />
            </Section>

            <Section title="7. Note operative">
              <p className="text-sm whitespace-pre-wrap">{(ann as any).notes || <span className="text-muted-foreground italic">Nessuna nota.</span>}</p>
            </Section>

            <Section title="8. Stato annuncio">
              <span className={`inline-block text-xs rounded-full px-2 py-1 font-medium ${STATUS_CLS[statusKind] ?? "bg-muted"}`}>
                {STATUS_LABEL[statusKind] ?? statusKind}
              </span>
            </Section>

            <Section title="9. Candidati e confermati">
              <div className="flex gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2 py-1 text-xs font-medium">
                  <Users className="h-3 w-3" /> {candidatesCount} candidat{candidatesCount === 1 ? "o" : "i"}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-green-100 text-green-800 px-2 py-1 text-xs font-medium">
                  <CheckCircle2 className="h-3 w-3" /> {assignedCount} confermat{assignedCount === 1 ? "o" : "i"}
                </span>
              </div>
            </Section>
          </div>
        ) : (
          <div className="space-y-4 text-sm">
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 space-y-2 text-amber-900">
              <div className="flex items-center gap-2 text-sm font-semibold"><Lock className="h-4 w-4" />Dati principali bloccati</div>
              <p className="text-xs">Questi dati non possono essere modificati dopo la pubblicazione dell'annuncio. Per cambiare data, orario, ruolo, locale, indirizzo o compenso devi eliminare questo annuncio e crearne uno nuovo.</p>
              <Button
                size="sm"
                variant="outline"
                className="gap-2 border-amber-400 bg-white text-amber-900 hover:bg-amber-100"
                onClick={() => setRecreateOpen(true)}
              >
                <Trash2 className="h-3.5 w-3.5" /> Elimina annuncio e crea nuovo
              </Button>
            </div>

            <div className="grid gap-3 md:grid-cols-2 opacity-90">
              <div><Label className="flex items-center gap-1"><Lock className="h-3 w-3" />Ruolo richiesto</Label><Input value={ann.professional_profile ?? ""} disabled /></div>
              <div><Label className="flex items-center gap-1"><Lock className="h-3 w-3" />Nome locale</Label><Input value={venueName ?? ""} disabled /></div>
              <div><Label className="flex items-center gap-1"><Lock className="h-3 w-3" />Data del turno</Label><Input value={dateLabel} disabled /></div>
              <div><Label className="flex items-center gap-1"><Lock className="h-3 w-3" />Orario</Label><Input value={`${ann.service_time?.slice(0,5) ?? "—"}${ann.end_time ? ` – ${ann.end_time.slice(0,5)}` : ""}`} disabled /></div>
              <div className="md:col-span-2"><Label className="flex items-center gap-1"><Lock className="h-3 w-3" />Indirizzo</Label><Input value={ann.location_address ?? ""} disabled /></div>
              <div className="md:col-span-2"><Label className="flex items-center gap-1"><Lock className="h-3 w-3" />Compenso</Label><Input value={formatTariff(ann.tariff_amount, ann.tariff_type)} disabled /></div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label>Patente</Label>
                <Select value={form.license_requirement} onValueChange={(v) => setForm({ ...form, license_requirement: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{LICENSE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Lingue richieste</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {LANGUAGE_OPTIONS.map((o) => (
                  <label key={o.value} className="flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs cursor-pointer">
                    <Checkbox checked={form.language_requirements.includes(o.value)} onCheckedChange={() => toggleArr("language_requirements", o.value)} />
                    {o.label}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <Label>Mansioni richieste</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {SKILL_OPTIONS.map((o) => (
                  <label key={o.value} className="flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs cursor-pointer">
                    <Checkbox checked={form.required_skills.includes(o.value)} onCheckedChange={() => toggleArr("required_skills", o.value)} />
                    {o.label}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <Label>Dress code</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {DRESS_CODE_OPTIONS.map((o) => (
                  <label key={o.value} className="flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs cursor-pointer">
                    <Checkbox checked={form.dress_code_items.includes(o.value)} onCheckedChange={() => toggleArr("dress_code_items", o.value)} />
                    {o.label}
                  </label>
                ))}
              </div>
              <Textarea className="mt-2" rows={2} placeholder="Note dress code" value={form.dress_code_notes} onChange={(e) => setForm({ ...form, dress_code_notes: e.target.value })} />
            </div>

            <div>
              <Label>Note operative</Label>
              <Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>

            {hasInvolved && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 flex gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>Questo annuncio ha già lavoratori candidati o confermati. Le modifiche a dress code, mansioni, lingue o note aggiorneranno il riepilogo del turno e saranno visibili nelle chat collegate; candidature, conversazioni e recensioni esistenti restano invariate.</span>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 flex-col sm:flex-row">
          {!editing ? (
            <>
              <Button variant="outline" className="gap-2" onClick={() => onDuplicate(ann)}>
                <Copy className="h-4 w-4" /> Duplica annuncio
              </Button>
              <Button className="gap-2" onClick={() => setEditing(true)}>
                <Pencil className="h-4 w-4" /> Modifica annuncio
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={() => setEditing(false)} disabled={saving}>Annulla</Button>
              <Button onClick={trySave} disabled={saving}>{saving ? "Salvataggio…" : "Salva modifiche"}</Button>
            </>
          )}
        </DialogFooter>

        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-600" />Conferma modifiche</DialogTitle>
              <DialogDescription>
                Attenzione: questo annuncio ha già lavoratori candidati o confermati. Verranno aggiornati solo dress code, mansioni, lingue, requisiti e note operative. I dati principali (data, orario, ruolo, locale, indirizzo, compenso) non possono essere modificati.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setConfirmOpen(false)} disabled={saving}>Annulla</Button>
              <Button onClick={doSave} disabled={saving}>{saving ? "Salvataggio…" : "Conferma e salva"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={recreateOpen} onOpenChange={setRecreateOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-600" />Annulla e ricrea annuncio</DialogTitle>
              <DialogDescription>
                Se modifichi data, orario, ruolo, locale, indirizzo o compenso, devi creare un nuovo annuncio. L'annuncio attuale verrà annullato e le candidature collegate resteranno nello storico. Vuoi continuare?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setRecreateOpen(false)} disabled={recreating}>Annulla</Button>
              <Button
                variant="destructive"
                disabled={recreating}
                onClick={async () => {
                  setRecreating(true);
                  const { error } = await supabase
                    .from("announcements")
                    .update({ status: "cancelled" })
                    .eq("id", ann.id);
                  setRecreating(false);
                  if (error) { toast.error(error.message); return; }
                  toast.success("Annuncio annullato. Compila i dati del nuovo annuncio.");
                  setRecreateOpen(false);
                  onOpenChange(false);
                  navigate({ to: "/ristoratore/annunci/nuovo", search: { reuse: ann.id } as never });
                }}
              >
                {recreating ? "Annullamento…" : "Conferma e crea nuovo annuncio"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}

function ProposalConfirmDialog({
  target, venueName, restaurantId, statusKind, onClose,
}: {
  target: { ann: Ann; candidate: Candidate } | null;
  venueName: string | null;
  restaurantId: string | null;
  statusKind: EffectiveStatus;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const [sending, setSending] = useState(false);

  if (!target) return null;
  const { ann, candidate } = target;

  const dateLabel = new Date(ann.service_date + "T00:00:00").toLocaleDateString("it-IT", {
    weekday: "long", day: "2-digit", month: "long", year: "numeric",
  });
  const timeLabel = `${ann.service_time?.slice(0,5) ?? "—"}${ann.end_time ? ` – ${ann.end_time.slice(0,5)}` : ""}`;
  const dressLabels = labelsOf(ann.dress_code_items ?? [], DRESS_CODE_OPTIONS as any);
  const skillLabels = labelsOf(ann.required_skills ?? [], SKILL_OPTIONS as any);

  const handleSend = async () => {
    if (!restaurantId) { toast.error("Sessione non valida"); return; }
    setSending(true);
    try {
      const { data: existing } = await supabase
        .from("applications")
        .select("id")
        .eq("announcement_id", ann.id)
        .eq("worker_id", candidate.worker_id)
        .maybeSingle();
      let appId = (existing as any)?.id as string | undefined;
      if (!appId) {
        const { data: ins, error } = await supabase
          .from("applications")
          .insert({
            announcement_id: ann.id,
            worker_id: candidate.worker_id,
            restaurant_id: restaurantId,
            status: "pending",
          })
          .select("id")
          .single();
        if (error) throw error;
        appId = (ins as any).id as string;
      }
      await sendShiftProposal({
        applicationId: appId!,
        announcementId: ann.id,
        restaurantId,
        workerId: candidate.worker_id,
      });
      await supabase.from("notifications").insert({
        user_id: candidate.worker_id,
        title: "Nuova proposta di lavoro",
        body: "Hai ricevuto una nuova proposta di turno. Apri la chat per vedere i dettagli.",
        link: `/messages/${appId}`,
        metadata: { kind: "shift_proposal", announcement_id: ann.id, application_id: appId } as any,
      } as any);
      toast.success("Proposta inviata correttamente.");
      onClose();
      navigate({ to: "/messages/$id", params: { id: appId! } });
    } catch (e: any) {
      toast.error(e?.message ?? "Errore invio proposta");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={!!target} onOpenChange={(v) => { if (!v && !sending) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Conferma invio proposta</DialogTitle>
          <DialogDescription>
            Stai per inviare una proposta di lavoro a <strong>{candidate.full_name || "questo lavoratore"}</strong>. Controlla il riepilogo del turno prima di procedere.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <Section title="1. Dettagli turno">
            <SummaryRow icon={Briefcase} label="Ruolo richiesto" value={ann.professional_profile || "—"} />
            <SummaryRow icon={Calendar} label="Data turno" value={dateLabel} />
            <SummaryRow icon={Clock} label="Orario" value={timeLabel} />
            <SummaryRow icon={Users} label="Numero lavoratori richiesti" value="1" />
          </Section>

          <Section title="2. Luogo">
            <SummaryRow icon={Briefcase} label="Nome locale" value={venueName || "—"} />
            <SummaryRow icon={MapPin} label="Indirizzo" value={ann.location_address || "—"} />
          </Section>

          <Section title="3. Compenso">
            <SummaryRow icon={Euro} label="Compenso" value={formatTariff(ann.tariff_amount, ann.tariff_type)} />
          </Section>

          <Section title="4. Dress code">
            {dressLabels.length ? (
              <div className="flex flex-wrap gap-1.5">
                {dressLabels.map((l) => <span key={l} className="rounded-full bg-secondary px-2 py-0.5 text-xs">{l}</span>)}
              </div>
            ) : <p className="text-xs text-muted-foreground italic">Nessun dress code richiesto.</p>}
            {ann.dress_code_notes && <p className="text-xs text-muted-foreground mt-2">{ann.dress_code_notes}</p>}
          </Section>

          <Section title="5. Mansioni richieste">
            {skillLabels.length ? (
              <div className="flex flex-wrap gap-1.5">
                {skillLabels.map((l) => <span key={l} className="rounded-full bg-secondary px-2 py-0.5 text-xs">{l}</span>)}
              </div>
            ) : <p className="text-xs text-muted-foreground italic">Nessuna mansione specifica.</p>}
          </Section>

          <Section title="6. Note operative">
            <p className="text-sm whitespace-pre-wrap">{(ann as any).notes || <span className="text-muted-foreground italic">Nessuna nota.</span>}</p>
          </Section>

          <Section title="7. Stato annuncio">
            <span className={`inline-block text-xs rounded-full px-2 py-1 font-medium ${STATUS_CLS[statusKind] ?? "bg-muted"}`}>
              {STATUS_LABEL[statusKind] ?? statusKind}
            </span>
          </Section>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={sending}>Annulla</Button>
          <Button onClick={handleSend} disabled={sending}>
            {sending ? "Invio in corso…" : "Invia proposta"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}