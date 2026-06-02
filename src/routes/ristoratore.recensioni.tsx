import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { RequireRole } from "@/components/RequireRole";
import { AppShell, PageHeader } from "@/components/AppShell";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { RestaurantReceivedReviewsList } from "@/components/RestaurantReceivedReviews";

export const Route = createFileRoute("/ristoratore/recensioni")({
  head: () => ({ meta: [{ title: "Recensioni ricevute — Pupillo" }] }),
  component: () => (
    <RequireAuth>
      <RequireRole allow={["restaurant"]}>
        <Page />
      </RequireRole>
    </RequireAuth>
  ),
});

function Page() {
  const { user } = useAuth();
  useEffect(() => {
    try { console.log("[PUPILLO_RESTAURANT_REVIEW_HISTORY_OPENED]", { restaurantId: user?.id }); } catch { /* */ }
  }, [user?.id]);
  return (
    <AppShell>
      <PageHeader
        title="Recensioni ricevute"
        subtitle="Storico completo delle recensioni lasciate dai lavoratori dopo i turni conclusi."
        action={(
          <Link to="/dashboard">
            <Button variant="ghost" size="sm" className="gap-1"><ArrowLeft className="h-4 w-4" /> Dashboard</Button>
          </Link>
        )}
      />
      {user && (
        <RestaurantReceivedReviewsList restaurantId={user.id} showFilters />
      )}
    </AppShell>
  );
}