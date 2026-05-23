import { Link } from "@tanstack/react-router";
import { AlertCircle, LifeBuoy, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/lib/auth-context";
import {
  getCompleteProfileRoute,
  getProfileCompletion,
  type Role,
} from "@/lib/profile-completion";

/**
 * Dashboard banner shown when the current user's profile is not yet
 * complete. Renders nothing for admins or completed profiles.
 */
export function ProfileCompletionBanner() {
  const { profile, role } = useAuth();
  if (role !== "worker" && role !== "restaurant") return null;
  const completion = getProfileCompletion(profile as never, role as Role);
  if (completion.isComplete) return null;

  return (
    <div className="mb-6 rounded-2xl border border-amber-300/60 bg-amber-50 p-5 dark:border-amber-900/40 dark:bg-amber-950/20">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 h-9 w-9 shrink-0 rounded-lg bg-amber-200/60 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200 flex items-center justify-center">
          <AlertCircle className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <div className="text-base font-semibold text-foreground">Profilo incompleto</div>
            <p className="text-sm text-muted-foreground">
              Completa il tuo profilo per sbloccare tutte le funzioni operative di Pupillo.
            </p>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Completamento profilo</span>
              <span className="font-medium text-foreground">{completion.percent}%</span>
            </div>
            <Progress value={completion.percent} className="h-2" />
          </div>
          {completion.missing.length > 0 && (
            <ul className="grid grid-cols-1 gap-1 text-sm text-muted-foreground sm:grid-cols-2">
              {completion.missing.map((m) => (
                <li key={m.key} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  <span>{m.label}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            <Button asChild size="sm" className="gap-2">
              <Link to={getCompleteProfileRoute(role as Role)}>
                Completa profilo <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline" className="gap-2">
              <Link to="/notifications">
                <LifeBuoy className="h-4 w-4" /> Assistenza
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}