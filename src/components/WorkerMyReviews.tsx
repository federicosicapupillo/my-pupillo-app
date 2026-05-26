import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Star, MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

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
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [authors, setAuthors] = useState<Record<string, AuthorInfo>>({});
  const [shifts, setShifts] = useState<Record<string, ShiftInfo>>({});
  const [apps, setApps] = useState<Record<string, AppInfo>>({});
  const [anns, setAnns] = useState<Record<string, AnnInfo>>({});

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

  if (reviews.length === 0) {
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
          ? "Ristoratore eliminato"
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
  );
}