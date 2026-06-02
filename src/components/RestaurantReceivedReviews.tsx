import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Star, MessageSquare, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { BlindReciprocalReviewDialog } from "@/components/BlindReciprocalReviewDialog";

export type RestaurantReceivedReview = {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  shift_id: string | null;
  application_id: string | null;
  announcement_id: string | null;
  author_id: string;
  positive_tags: string[] | null;
  negative_tags: string[] | null;
  tags: string[] | null;
};

type WorkerInfo = { id: string; full_name: string | null; is_deleted?: boolean | null };
type ShiftInfo = { id: string; shift_date: string | null };
type AnnInfo = { id: string; professional_profile: string | null; service_date: string | null };
type AppInfo = { id: string; announcement_id: string | null };

type Filter = "all" | "5" | "4" | "le3" | "comment";
type Sort = "newest" | "oldest";

function Stars({ value }: { value: number }) {
  const v = Math.max(0, Math.min(5, Math.round(value)));
  return (
    <div className="flex items-center gap-0.5" aria-label={`${v} su 5 stelle`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={`h-4 w-4 ${n <= v ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/40"}`} />
      ))}
    </div>
  );
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return iso; }
}

/**
 * Loads reviews where `target_id = restaurantId` and the author has the
 * `worker` role (direction worker_to_restaurant). RLS already restricts
 * visibility, but we keep the filter explicit for safety.
 */
export async function loadRestaurantReceivedReviews(restaurantId: string): Promise<{
  rows: RestaurantReceivedReview[];
  workers: Record<string, WorkerInfo>;
  shifts: Record<string, ShiftInfo>;
  anns: Record<string, AnnInfo>;
}> {
  try { console.log("[PUPILLO_RESTAURANT_REVIEW_RLS_CHECK]", { restaurantId }); } catch { /* */ }
  const { data } = await supabase
    .from("reviews")
    .select("id,rating,comment,created_at,shift_id,application_id,announcement_id,author_id,positive_tags,negative_tags,tags")
    .eq("target_id", restaurantId)
    .order("created_at", { ascending: false });
  const all = (data ?? []) as RestaurantReceivedReview[];
  // Keep only reviews whose author is a worker.
  const authorIds = Array.from(new Set(all.map((r) => r.author_id).filter(Boolean)));
  let workerIdSet = new Set<string>();
  if (authorIds.length) {
    const { data: roleRows } = await supabase
      .from("user_roles")
      .select("user_id, role")
      .in("user_id", authorIds)
      .eq("role", "worker");
    workerIdSet = new Set(((roleRows ?? []) as { user_id: string }[]).map((r) => r.user_id));
  }
  const rows = all.filter((r) => workerIdSet.has(r.author_id));

  const wIds = Array.from(new Set(rows.map((r) => r.author_id)));
  const shiftIds = Array.from(new Set(rows.map((r) => r.shift_id).filter(Boolean) as string[]));
  const appIds = Array.from(new Set(rows.map((r) => r.application_id).filter(Boolean) as string[]));

  const [wRes, sRes, aRes] = await Promise.all([
    wIds.length ? supabase.from("profiles").select("id, full_name, is_deleted").in("id", wIds) : Promise.resolve({ data: [] as WorkerInfo[] }),
    shiftIds.length ? supabase.from("shifts").select("id, shift_date").in("id", shiftIds) : Promise.resolve({ data: [] as ShiftInfo[] }),
    appIds.length ? supabase.from("applications").select("id, announcement_id").in("id", appIds) : Promise.resolve({ data: [] as AppInfo[] }),
  ]);
  const workers: Record<string, WorkerInfo> = {};
  ((wRes.data ?? []) as WorkerInfo[]).forEach((w) => { workers[w.id] = w; });
  const shifts: Record<string, ShiftInfo> = {};
  ((sRes.data ?? []) as ShiftInfo[]).forEach((s) => { shifts[s.id] = s; });
  const apps = ((aRes.data ?? []) as AppInfo[]);

  const annIdsAll = Array.from(new Set([
    ...rows.map((r) => r.announcement_id).filter(Boolean) as string[],
    ...apps.map((a) => a.announcement_id).filter(Boolean) as string[],
  ]));
  const anns: Record<string, AnnInfo> = {};
  if (annIdsAll.length) {
    const { data: an } = await supabase
      .from("announcements")
      .select("id, professional_profile, service_date")
      .in("id", annIdsAll);
    ((an ?? []) as AnnInfo[]).forEach((x) => { anns[x.id] = x; });
  }
  // Index annId by appId so the renderer can look it up.
  const appToAnn: Record<string, string> = {};
  apps.forEach((a) => { if (a.id && a.announcement_id) appToAnn[a.id] = a.announcement_id; });
  // attach via field
  rows.forEach((r) => {
    if (!r.announcement_id && r.application_id && appToAnn[r.application_id]) {
      r.announcement_id = appToAnn[r.application_id];
    }
  });
  return { rows, workers, shifts, anns };
}

export function RestaurantReceivedReviewsList({
  restaurantId,
  limit,
  showFilters = false,
}: {
  restaurantId: string;
  limit?: number;
  showFilters?: boolean;
}) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<RestaurantReceivedReview[]>([]);
  const [workers, setWorkers] = useState<Record<string, WorkerInfo>>({});
  const [shifts, setShifts] = useState<Record<string, ShiftInfo>>({});
  const [anns, setAnns] = useState<Record<string, AnnInfo>>({});
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("newest");
  /** Map reviewId → true when the restaurant has already left the
   *  restaurant_to_worker counter-review (review unlocked). */
  const [unlocked, setUnlocked] = useState<Record<string, boolean>>({});
  const [openBlind, setOpenBlind] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const data = await loadRestaurantReceivedReviews(restaurantId);
      if (cancelled) return;
      setRows(data.rows);
      setWorkers(data.workers);
      setShifts(data.shifts);
      setAnns(data.anns);
      // For each received review, check if restaurant_to_worker exists for
      // the same shift+worker. Only then unlock the card.
      const map: Record<string, boolean> = {};
      await Promise.all(
        data.rows.map(async (r) => {
          if (!r.shift_id) { map[r.id] = true; return; }
          const { data: rec } = await supabase
            .from("reviews")
            .select("id")
            .eq("shift_id", r.shift_id)
            .eq("author_id", restaurantId)
            .eq("target_id", r.author_id)
            .maybeSingle();
          map[r.id] = !!rec;
        }),
      );
      if (!cancelled) setUnlocked(map);
      try { console.log("[PUPILLO_RESTAURANT_RECEIVED_REVIEWS_LOADED]", { count: data.rows.length }); } catch { /* */ }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [restaurantId, reloadKey]);

  const filtered = useMemo(() => {
    let r = rows.slice();
    switch (filter) {
      case "5": r = r.filter((x) => x.rating === 5); break;
      case "4": r = r.filter((x) => x.rating === 4); break;
      case "le3": r = r.filter((x) => x.rating <= 3); break;
      case "comment": r = r.filter((x) => !!(x.comment && x.comment.trim())); break;
    }
    r.sort((a, b) => sort === "newest"
      ? b.created_at.localeCompare(a.created_at)
      : a.created_at.localeCompare(b.created_at));
    if (limit && limit > 0) r = r.slice(0, limit);
    return r;
  }, [rows, filter, sort, limit]);

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {showFilters && (
        <div className="flex flex-wrap items-center gap-2">
          {([
            ["all", "Tutte"],
            ["5", "5 stelle"],
            ["4", "4 stelle"],
            ["le3", "3★ o meno"],
            ["comment", "Con commento"],
          ] as [Filter, string][]).map(([k, l]) => (
            <Button
              key={k}
              size="sm"
              variant={filter === k ? "default" : "outline"}
              onClick={() => setFilter(k)}
              className="h-8 text-xs"
            >{l}</Button>
          ))}
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant={sort === "newest" ? "default" : "outline"} onClick={() => setSort("newest")} className="h-8 text-xs">Più recenti</Button>
            <Button size="sm" variant={sort === "oldest" ? "default" : "outline"} onClick={() => setSort("oldest")} className="h-8 text-xs">Più vecchie</Button>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card p-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <MessageSquare className="h-6 w-6 text-primary" />
          </div>
          <h3 className="font-semibold">Nessuna recensione</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Le recensioni lasciate dai lavoratori dopo i turni conclusi appariranno qui.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => {
            const w = workers[r.author_id];
            const isDeleted = !!w?.is_deleted;
            const name = isDeleted ? "Utente eliminato" : (w?.full_name ?? "Lavoratore");
            const ann = r.announcement_id ? anns[r.announcement_id] : null;
            const shift = r.shift_id ? shifts[r.shift_id] : null;
            const roleLabel = ann?.professional_profile ?? null;
            const shiftDate = shift?.shift_date ?? ann?.service_date ?? null;
            const positive = (r.positive_tags ?? []).concat((r.tags ?? []).filter((t) => !(r.positive_tags ?? []).includes(t) && !(r.negative_tags ?? []).includes(t)));
            const negative = r.negative_tags ?? [];
            const isUnlocked = unlocked[r.id] !== false; // default true until checked
            if (!isUnlocked) {
              return (
                <div key={r.id} className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Lock className="h-4 w-4 text-amber-600 dark:text-amber-300" />
                    Hai ricevuto una recensione
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Lascia la tua recensione al lavoratore per sbloccarla.
                  </p>
                  <div className="text-xs text-muted-foreground">
                    {name}{roleLabel ? ` — ${roleLabel}` : ""} · Turno del {formatDate(shiftDate)}
                  </div>
                  <div className="flex items-center gap-0.5 blur-sm select-none pointer-events-none" aria-hidden>
                    <Stars value={5} />
                  </div>
                  <p className="text-xs italic text-muted-foreground blur-sm select-none pointer-events-none">
                    Commento e tag nascosti
                  </p>
                  <div className="pt-1">
                    <Button size="sm" onClick={() => setOpenBlind(r.id)}>Recensisci e sblocca</Button>
                  </div>
                </div>
              );
            }
            return (
              <div key={r.id} className="rounded-2xl border bg-card p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Stars value={r.rating} />
                      <span className="text-sm font-semibold">{r.rating}/5</span>
                    </div>
                    <div className="text-sm font-medium truncate mt-1">
                      {name}{roleLabel ? ` — ${roleLabel}` : ""}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Turno del {formatDate(shiftDate)} · Recensione del {formatDate(r.created_at)}
                    </div>
                  </div>
                </div>
                {r.comment && (
                  <p className="text-sm whitespace-pre-wrap text-foreground/90">{r.comment}</p>
                )}
                {(positive.length > 0 || negative.length > 0) && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {positive.map((t) => (
                      <Badge key={`p-${t}`} variant="secondary" className="text-[11px]">{t}</Badge>
                    ))}
                    {negative.map((t) => (
                      <Badge key={`n-${t}`} variant="destructive" className="text-[11px]">{t}</Badge>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {openBlind && (
        <BlindReciprocalReviewDialog
          reviewId={openBlind}
          open={!!openBlind}
          onOpenChange={(o) => { if (!o) setOpenBlind(null); }}
          onUnlocked={() => { setReloadKey((k) => k + 1); }}
        />
      )}
    </div>
  );
}