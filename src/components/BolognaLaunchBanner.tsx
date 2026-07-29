import { PartyPopper } from "lucide-react";
import { BOLOGNA_LAUNCH_CAMPAIGN, shouldShowBolognaLaunch } from "@/lib/launch-campaign";

/**
 * Comunicazione promozionale del lancio su Bologna.
 * Non chiudibile, visibile solo ai ristoratori e solo fino al 31/12/2026.
 * Testo e regole arrivano da `@/lib/launch-campaign`.
 */
export function BolognaLaunchBanner({
  role,
  className = "",
}: {
  role: string | null | undefined;
  className?: string;
}) {
  if (!shouldShowBolognaLaunch(role)) return null;

  return (
    <section
      role="status"
      aria-label={BOLOGNA_LAUNCH_CAMPAIGN.title}
      className={`rounded-2xl border border-primary/40 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent p-4 sm:p-5 ${className}`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <PartyPopper className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground sm:text-lg">
            {BOLOGNA_LAUNCH_CAMPAIGN.title}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{BOLOGNA_LAUNCH_CAMPAIGN.body}</p>
          <span className="mt-3 inline-flex items-center rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            {BOLOGNA_LAUNCH_CAMPAIGN.highlight}
          </span>
        </div>
      </div>
    </section>
  );
}
