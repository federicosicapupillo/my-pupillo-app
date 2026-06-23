import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Star, MessageSquare, Lock } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

type ReviewRow = {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  shift_id: string | null;
  application_id: string | null;
  author_id: string;
  positive_tags: string[] | null;
  is_visible_to_worker: boolean | null;
};

type AuthorInfo = { id: string; business_name: string | null; full_name: string | null; city: string | null; is_deleted?: boolean | null };
type ShiftInfo = { id: string; restaurant_id: string | null };
type AnnInfo = { id: string; professional_profile: string | null; job_city: string | null };
type AppInfo = { id: string; announcement_id: string | null; status: string | null };

/**
 * Locked received-review descriptor. Built from `notifications.metadata`
 * because RLS hides the review row itself from the recipient until they
 * have left their own reciprocal review (Phase 3 of the blind system).
 */
type PendingReceived = {
  notificationId: string;
  reviewId: string | null;
  shiftId: string | null;
  applicationId: string | null;
  receivedAt: string;
};

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

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}

export function WorkerMyReviews({ workerId, limit }: { workerId: string; limit?: number }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [authors, setAuthors] = useState<Record<string, AuthorInfo>>({});
  const [shifts, setShifts] = useState<Record<string, ShiftInfo>>({});
  const [apps, setApps] = useState<Record<string, AppInfo>>({});
  const [anns, setAnns] = useState<Record<string, AnnInfo>>({});
  const [pending, setPending] = useState<PendingReceived[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      let q = supabase
        .from("reviews")
        .select("id,rating,comment,created_at,shift_id,application_id,author_id,positive_tags,is_visible_to_worker")
        .eq("target_id", workerId)
        .eq("is_visible_to_worker", true)
        .order("created_at", { ascending: false });
      if (limit && limit > 0) q = q.limit(limit) as typeof q;
      const { data } = await q;
      if (cancelled) return;
      const rows = (data ?? []) as ReviewRow[];
      setReviews(rows);

      const authorIds = Array.from(new Set(rows.map((r) => r.author_id).filter(Boolean)));
      const shiftIds = Array.from(new Set(rows.map((r) => r.shift_id).filter(Boolean) as string[]));
      const appIds = Array.from(new Set(rows.map((r) => r.application_id).filter(Boolean) as string[]));

      const [au, sh, ap] = await Promise.all([
        authorIds.length
          ? supabase.from("profiles").select("id,business_name,full_name,city,is_deleted").in("id", authorIds)
          : Promise.resolve({ data: [] as any[] }),
        shiftIds.length
          ? supabase.from("shifts").select("id,restaurant_id").in("id", shiftIds)
          : Promise.resolve({ data: [] as any[] }),
        appIds.length
          ? supabase.from("applications").select("id,announcement_id,status").in("id", appIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);
      if (cancelled) return;
      const authorMap: Record<string, AuthorInfo> = {};
      ((au.data ?? []) as AuthorInfo[]).forEach((p) => { authorMap[p.id] = p; });
      const shiftMap: Record<string, ShiftInfo> = {};
      ((sh.data ?? []) as ShiftInfo[]).forEach((s) => { shiftMap[s.id] = s; });
      const appMap: Record<string, AppInfo> = {};
      ((ap.data ?? []) as AppInfo[]).forEach((a) => { appMap[a.id] = a; });
      setAuthors(authorMap);
      setShifts(shiftMap);
      setApps(appMap);

      const annIds = Array.from(new Set(Object.values(appMap).map((a) => a.announcement_id).filter(Boolean) as string[]));
      if (annIds.length) {
        const { data: an } = await supabase
          .from("announcements")
          .select("id,professional_profile,job_city")
          .in("id", annIds);
        if (!cancelled) {
          const annMap: Record<string, AnnInfo> = {};
          ((an ?? []) as AnnInfo[]).forEach((x) => { annMap[x.id] = x; });
          setAnns(annMap);
        }
      }

      // "In attesa di sblocco" — locked received reviews. RLS hides the
      // review row, so we surface them via `notifications` (kind =
      // 'review_received') and drop the ones the worker has already
      // reciprocated (a row in `reviews` authored by the worker for the
      // same shift/application).
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user && user.id === workerId) {
          const { data: notifs } = await supabase
            .from("notifications")
            .select("id, metadata, created_at")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(50);
          const candidates: PendingReceived[] = ((notifs ?? []) as { id: string; metadata: Record<string, unknown> | null; created_at: string }[])
            .filter((n) => (n.metadata?.kind ?? n.metadata?.type) === "review_received")
            .map((n) => ({
              notificationId: n.id,
              reviewId: (n.metadata?.review_id as string | undefined) ?? null,
              shiftId: (n.metadata?.shift_id as string | undefined) ?? null,
              applicationId: (n.metadata?.application_id as string | undefined) ?? null,
              receivedAt: n.created_at,
            }));

          // Drop candidates the worker already reciprocated.
          const myShiftIds = Array.from(new Set(candidates.map((c) => c.shiftId).filter(Boolean) as string[]));
          const myAppIds = Array.from(new Set(candidates.map((c) => c.applicationId).filter(Boolean) as string[]));
          const reciprocatedShifts = new Set<string>();
          const reciprocatedApps = new Set<string>();
          if (myShiftIds.length) {
            const { data: mine } = await supabase
              .from("reviews")
              .select("shift_id")
              .eq("author_id", user.id)
              .in("shift_id", myShiftIds);
            ((mine ?? []) as { shift_id: string | null }[]).forEach((r) => { if (r.shift_id) reciprocatedShifts.add(r.shift_id); });
          }
          if (myAppIds.length) {
            const { data: mine2 } = await supabase
              .from("reviews")
              .select("application_id")
              .eq("author_id", user.id)
              .in("application_id", myAppIds);
            ((mine2 ?? []) as { application_id: string | null }[]).forEach((r) => { if (r.application_id) reciprocatedApps.add(r.application_id); });
          }
          const stillPending = candidates.filter((c) => {
            if (c.shiftId && reciprocatedShifts.has(c.shiftId)) return false;
            if (c.applicationId && reciprocatedApps.has(c.applicationId)) return false;
            return true;
          });
          if (!cancelled) setPending(stillPending);
        }
      } catch { /* non-blocking */ }

      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [workerId, limit]);

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
      </div>
    );
  }

  if (reviews.length === 0 && pending.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed bg-card p-8 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <MessageSquare className="h-6 w-6 text-primary" />
        </div>
        <h3 className="font-semibold">Non hai ancora recensioni</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Completa i tuoi primi turni per iniziare a costruire la tua reputazione su Pupillo.
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          Le recensioni dei ristoratori aiutano il tuo profilo a crescere e aumentano le possibilità di essere scelto.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {pending.length > 0 && (
        <section className="space-y-2" aria-labelledby="worker-pending-reviews-heading">
          <h3
            id="worker-pending-reviews-heading"
            className="text-sm font-semibold text-foreground/80"
          >
            In attesa di sblocco
          </h3>
          <div className="space-y-2">
            {pending.map((p) => (
              <div
                key={p.notificationId}
                className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-2"
              >
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Lock className="h-4 w-4 text-amber-600 dark:text-amber-300" />
                  Recensione ricevuta — visibile dopo la tua recensione.
                </div>
                <p className="text-xs text-muted-foreground">
                  Per leggerla, lascia anche tu la tua recensione: appena entrambe sono inviate diventano visibili.
                </p>
                <div className="flex items-center gap-0.5 blur-sm select-none pointer-events-none" aria-hidden>
                  <Stars value={5} />
                </div>
                <div className="pt-1">
                  <Button
                    size="sm"
                    onClick={() => {
                      if (p.applicationId) {
                        navigate({
                          to: "/messages/$id",
                          params: { id: p.applicationId },
                          search: { action: "review" } as never,
                        });
                      } else {
                        navigate({ to: "/messages" });
                      }
                    }}
                  >
                    Lascia la tua recensione
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="space-y-3">
      {reviews.map((r) => {
        const author = authors[r.author_id];
        const shift = r.shift_id ? shifts[r.shift_id] : null;
        const app = r.application_id ? apps[r.application_id] : null;
        const ann = app?.announcement_id ? anns[app.announcement_id] : null;
        // Show restaurant name only if worker actually performed a shift, or the application was accepted.
        const isDeleted = !!author?.is_deleted;
        const canShowName = !!shift || app?.status === "accepted";
        const realName = author?.business_name || author?.full_name || null;
        const restaurantLabel = isDeleted
          ? "Utente eliminato"
          : (canShowName && realName ? realName : "Ristorante partner");
        const roleLabel = ann?.professional_profile || null;
        const cityLabel = ann?.job_city || author?.city || null;
        return (
          <div key={r.id} className="rounded-2xl border bg-card p-4 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Stars value={r.rating} />
                  <span className="text-sm font-semibold">{r.rating}/5</span>
                </div>
                <div className="text-sm font-medium truncate mt-1">{restaurantLabel}</div>
                <div className="text-xs text-muted-foreground">
                  {[roleLabel, cityLabel].filter(Boolean).join(" · ") || "—"}
                </div>
              </div>
              <div className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(r.created_at)}</div>
            </div>
            {r.comment && (
              <p className="text-sm whitespace-pre-wrap text-foreground/90">{r.comment}</p>
            )}
            {r.positive_tags && r.positive_tags.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {r.positive_tags.map((t) => (
                  <Badge key={t} variant="secondary" className="text-[11px]">{t}</Badge>
                ))}
              </div>
            )}
          </div>
        );
      })}
      </div>
    </div>
  );
}