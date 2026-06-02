import type { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { goToRestaurantOnboarding } from "@/lib/restaurant-onboarding-navigation";

type Navigate = ReturnType<typeof useNavigate>;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidId(v: string | undefined | null): v is string {
  if (!v) return false;
  const s = String(v).trim().toLowerCase();
  if (!s || s === "undefined" || s === "null" || s === "nan") return false;
  return true;
}

type UserRole = "worker" | "restaurant" | "admin" | null;

async function getCurrentRole(): Promise<UserRole> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    const roles = (data ?? []).map((r: { role: string }) => r.role);
    if (roles.includes("admin")) return "admin";
    if (roles.includes("restaurant")) return "restaurant";
    if (roles.includes("worker")) return "worker";
    return null;
  } catch {
    return null;
  }
}

/**
 * Navigate safely from a notification link.
 * - Maps known patterns to typed TanStack routes.
 * - Resolves `/reviews/<id>` to the dedicated review popup route.
 * - Blocks workers from being sent to restaurant-only routes
 *   (e.g. `/ristoratore/turni/<id>`) and falls back to a safe page.
 * - Falls back to `/messages` for unknown / invalid links so the user never
 *   lands on a 404 from an internal notification.
 */
export async function navigateFromNotificationLink(
  navigate: Navigate,
  link: string | null | undefined,
): Promise<void> {
  const ctx: Record<string, unknown> = { link };
  try { console.log("[PUPILLO_WORKER_NOTIFICATION_CLICK]", ctx); } catch { /* ignore */ }
  // Resolve role once; used for safe fallbacks and access checks.
  const role = await getCurrentRole();
  ctx.role = role;
  const safeHome = () => {
    if (role === "restaurant") return navigate({ to: "/dashboard" });
    if (role === "worker") return navigate({ to: "/jobs" });
    return navigate({ to: "/messages" });
  };
  // Per le notifiche di candidatura/proposta/chat la destinazione di
  // ripiego corretta è SEMPRE la lista messaggi: così il lavoratore può
  // selezionare manualmente la conversazione invece di vedere una pagina
  // di errore o di finire in una sezione (es. "I miei turni") che non
  // contiene il messaggio del ristoratore.
  const fallback = () => {
    try { console.log("[PUPILLO_WORKER_NOTIFICATION_FALLBACK_USED]", { ...ctx, fallback: "/messages" }); } catch { /* ignore */ }
    return navigate({ to: "/messages" });
  };

  if (!isValidId(link)) return fallback();
  const raw = String(link).trim();
  // Strip query/hash for matching; preserve them for the final navigate.
  const [pathOnly, rest = ""] = raw.split(/(?=[?#])/, 2);
  const search = rest.startsWith("?") ? rest.slice(1) : "";
  const hash = rest.startsWith("#") ? rest.slice(1) : raw.includes("#") ? raw.split("#")[1] : "";
  const path = pathOnly.replace(/\/+$/, "");
  let parts = path.split("/").filter(Boolean);
  // Alias: /worker/shifts → /shifts (no /worker/* routes exist in this app)
  if (parts[0] === "worker" && parts[1] === "shifts") parts = parts.slice(1);

  // Parse search params once for routes that support tab/shift highlight.
  const searchParams = new URLSearchParams(search);
  const searchObj: Record<string, string> = {};
  searchParams.forEach((v, k) => { searchObj[k] = v; });

  const seg = (i: number) => (parts[i] ?? "");

  try {
    // /messages
    if (parts.length === 1 && parts[0] === "messages") {
      return navigate({ to: "/messages" });
    }
    // /messages/<applicationId>
    if (parts.length === 2 && parts[0] === "messages") {
      const id = seg(1);
      if (!isValidId(id)) return fallback();
      // For both worker and restaurant, the notification destination is the
      // chat thread. Validate visibility first to avoid a 404; if the chat
      // is not reachable (e.g. RLS denies access), fall back to a safe page.
      if (role === "worker") {
        try {
          const { data: appRow } = await supabase
            .from("applications")
            .select("id")
            .eq("id", id)
            .maybeSingle();
          if (!appRow) return fallback();
        } catch {
          return fallback();
        }
      }
      try {
        return navigate({ to: "/messages/$id", params: { id } });
      } catch {
        return fallback();
      }
    }
    // /reviews/<reviewId> — dedicated popup route for the worker.
    // For restaurants we resolve to the related chat/shift instead.
    if (parts.length === 2 && parts[0] === "reviews") {
      const reviewId = seg(1);
      if (!isValidId(reviewId)) return fallback();
      if (role !== "restaurant") {
        // worker (or unknown) → open the review popup route
        return navigate({ to: "/reviews/$id", params: { id: reviewId } });
      }
      try {
        const { data } = await supabase
          .from("reviews")
          .select("application_id, shift_id")
          .eq("id", reviewId)
          .maybeSingle();
        const appId = (data as { application_id?: string | null } | null)?.application_id;
        if (isValidId(appId)) {
          return navigate({ to: "/messages/$id", params: { id: appId } });
        }
        const shiftId = (data as { shift_id?: string | null } | null)?.shift_id;
        if (isValidId(shiftId)) {
          return navigate({ to: "/ristoratore/turni/$shiftId", params: { shiftId } });
        }
      } catch {
        /* fall through to fallback */
      }
      return navigate({ to: "/shifts" });
    }
    // /shifts (preserve ?tab=to-review&shift=<id> from review notifications)
    if (parts.length === 1 && parts[0] === "shifts") {
      const isReviewNotif = searchObj.tab === "to-review" || searchObj.tab === "da-recensire";
      if (isReviewNotif) {
        try {
          console.log("[PUPILLO_WORKER_REVIEW_NOTIFICATION_CLICK]", { ...ctx });
          console.log("[PUPILLO_WORKER_REVIEW_NOTIFICATION_TO_MY_SHIFTS]", {
            ...ctx,
            resolved_path: `/shifts?${searchParams.toString()}`,
            shift_id: searchObj.shift ?? null,
            fallback_used: false,
          });
        } catch { /* ignore */ }
      }
      // Normalize tab alias da-recensire → to-review (the real tab key)
      if (searchObj.tab === "da-recensire") searchObj.tab = "to-review";
      return navigate({ to: "/shifts", search: searchObj as never });
    }
    // /ristoratore/turni/<shiftId> — restaurant-only route.
    // Workers must never be sent here (would render "Permesso negato").
    if (parts.length === 3 && parts[0] === "ristoratore" && parts[1] === "turni") {
      const shiftId = seg(2);
      if (!isValidId(shiftId)) return fallback();
      if (role === "worker") {
        // Safe worker-side fallback: their shifts list.
        return navigate({ to: "/shifts" });
      }
      return navigate({ to: "/ristoratore/turni/$shiftId", params: { shiftId } });
    }
    // /announcements/<id>
    if (parts.length === 2 && parts[0] === "announcements") {
      const id = seg(1);
      if (!isValidId(id)) return fallback();
      // Per il lavoratore: se l'annuncio non è più accessibile (cancellato,
      // scaduto, RLS), evita di aprire una pagina vuota e manda alle offerte.
      if (role === "worker") try {
        const { data: annRow } = await supabase
          .from("announcements")
          .select("id")
          .eq("id", id)
          .maybeSingle();
        if (!annRow) {
          try { console.warn("[PUPILLO_WORKER_NOTIFICATION_TARGET_NOT_FOUND]", { ...ctx, target_type: "announcement", target_id: id }); } catch { /* ignore */ }
          return navigate({ to: "/jobs" });
        }
      } catch {
        return navigate({ to: "/jobs" });
      }
      try { console.log("[PUPILLO_WORKER_NOTIFICATION_REDIRECT_RESOLVED]", { ...ctx, resolved_path: `/announcements/${id}` }); } catch { /* ignore */ }
      return navigate({ to: "/announcements/$id", params: { id } });
    }
    if (parts.length === 1 && parts[0] === "announcements") {
      return navigate({ to: "/announcements" });
    }
    // /workers/<id> or /workers_/<id> (worker public profile)
    if (parts.length === 2 && (parts[0] === "workers" || parts[0] === "workers_")) {
      const id = seg(1);
      if (!isValidId(id)) return fallback();
      return navigate({ to: "/workers/$id", params: { id } });
    }
    // Flat safe destinations
    const FLAT_SAFE: Record<string, () => void> = {
      "/profile": () => navigate({ to: "/profile" }),
      "/onboarding": () => role === "restaurant" ? goToRestaurantOnboarding(navigate) : navigate({ to: "/onboarding" }),
      "/dashboard": () => navigate({ to: "/dashboard" }),
      "/notifications": () => navigate({ to: "/notifications" }),
      "/jobs": () => navigate({ to: "/jobs" }),
      "/workers": () => navigate({ to: "/workers" }),
      "/announcements": () => navigate({ to: "/announcements" }),
      "/shifts": () => navigate({ to: "/shifts" }),
      "/messages": () => navigate({ to: "/messages" }),
      "/ristoratore/collaboratori": () => navigate({ to: "/ristoratore/collaboratori" }),
      "/ristoratore/recensioni": () => navigate({ to: "/ristoratore/recensioni" }),
    };
    const flat = FLAT_SAFE["/" + parts.join("/")];
    if (flat) return flat();
  } catch {
    /* fall through */
  }
  // Unknown link → safe role-aware fallback
  void search; void hash; void UUID_RE; // reserved for future use
  try { console.warn("[PUPILLO_WORKER_NOTIFICATION_INVALID_ROUTE]", { ...ctx, parts }); } catch { /* ignore */ }
  try { console.log("[PUPILLO_WORKER_NOTIFICATION_404_PREVENTED]", { ...ctx }); } catch { /* ignore */ }
  return safeHome();
}