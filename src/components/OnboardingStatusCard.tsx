import { Link } from "@tanstack/react-router";
import { CheckCircle2, Circle, Loader2, Lock, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type Status = "done" | "todo" | "locked";

export type OnboardingStep = {
  id: string;
  label: string;
  status: Status;
  /** href ancora (#sec-...) oppure route */
  href?: string;
  hint?: string;
};

export function OnboardingStatusCard({
  role,
  steps,
  title = "Completa il tuo profilo",
  subtitle = "Ti mancano pochi passaggi per iniziare a usare Pupillo.",
}: {
  role: "restaurant" | "worker" | "admin" | null | undefined;
  steps: OnboardingStep[];
  title?: string;
  subtitle?: string;
}) {
  const total = steps.length;
  const done = steps.filter((s) => s.status === "done").length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  const next = steps.find((s) => s.status === "todo");
  const allDone = done === total;

  return (
    <section
      aria-label="Stato registrazione"
      className="mb-6 overflow-hidden rounded-2xl border border-white/10 bg-card text-card-foreground shadow-[inset_0_1px_0_oklch(0.97_0.01_100/0.05),0_24px_60px_-25px_oklch(0.65_0.25_310/0.45)]"
      style={{
        backgroundImage:
          "radial-gradient(600px 200px at 100% 0%, oklch(0.65 0.25 310 / 18%), transparent 60%), radial-gradient(500px 180px at 0% 100%, oklch(0.93 0.22 120 / 12%), transparent 60%)",
      }}
    >
      <div className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-[oklch(0.93_0.22_120/0.4)] bg-[oklch(0.93_0.22_120/0.08)] px-2.5 py-1 text-[11px] font-semibold text-[oklch(0.93_0.22_120)]">
              <Sparkles className="h-3 w-3" />
              {role === "restaurant" ? "Ristoratore" : role === "worker" ? "Lavoratore" : "Profilo"}
            </div>
            <h2 className="mt-2 text-xl font-bold tracking-tight sm:text-2xl">
              {allDone ? "Profilo pronto" : title}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {allDone ? "Tutto in regola: puoi iniziare a usare Pupillo." : subtitle}
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-extrabold leading-none text-neon-gradient">{pct}%</div>
            <div className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground">
              {done}/{total} step
            </div>
          </div>
        </div>

        {/* Progress */}
        <div className="mt-4 h-2 w-full overflow-hidden rounded-full border border-white/10 bg-[oklch(0.18_0.025_280)]">
          <div
            className="h-full rounded-full transition-[width] duration-500"
            style={{
              width: `${pct}%`,
              background:
                "linear-gradient(90deg, oklch(0.93 0.22 120), oklch(0.82 0.16 195), oklch(0.7 0.27 350))",
              boxShadow: "0 0 18px oklch(0.93 0.22 120 / 60%)",
            }}
          />
        </div>

        {/* Steps */}
        <ol className="mt-5 grid gap-2">
          {steps.map((s, i) => (
            <StepRow key={s.id} index={i + 1} step={s} />
          ))}
        </ol>

        {/* CTA */}
        {next && (
          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              Prossimo: <span className="font-semibold text-foreground">{next.label}</span>
            </p>
            {next.href && (
              <Button asChild size="sm" className="gap-2">
                {next.href.startsWith("#") ? (
                  <a href={next.href}>
                    Continua registrazione <ArrowRight className="h-4 w-4" />
                  </a>
                ) : (
                  <Link to={next.href as never}>
                    Continua registrazione <ArrowRight className="h-4 w-4" />
                  </Link>
                )}
              </Button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function StepRow({ index, step }: { index: number; step: OnboardingStep }) {
  const { status, label, href, hint } = step;
  const Icon =
    status === "done" ? CheckCircle2 : status === "locked" ? Lock : Circle;
  const tone =
    status === "done"
      ? "text-[oklch(0.82_0.16_195)]"
      : status === "locked"
        ? "text-muted-foreground/70"
        : "text-[oklch(0.93_0.22_120)]";
  const badge: { label: string; cls: string } =
    status === "done"
      ? {
          label: "Completato",
          cls: "border-[oklch(0.82_0.16_195/0.4)] bg-[oklch(0.82_0.16_195/0.1)] text-[oklch(0.82_0.16_195)]",
        }
      : status === "locked"
        ? {
            label: "Bloccato",
            cls: "border-white/10 bg-white/[0.04] text-muted-foreground",
          }
        : {
            label: "Da completare",
            cls: "border-[oklch(0.93_0.22_120/0.4)] bg-[oklch(0.93_0.22_120/0.08)] text-[oklch(0.93_0.22_120)]",
          };

  const inner: ReactNode = (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 transition-colors",
        status !== "locked" && "hover:border-white/20 hover:bg-white/[0.06]",
      )}
    >
      <span
        aria-hidden
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/10 bg-[oklch(0.18_0.025_280)] text-xs font-bold text-muted-foreground"
      >
        {status === "done" ? <CheckCircle2 className={cn("h-4 w-4", tone)} /> : index}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Icon className={cn("h-4 w-4 shrink-0", tone)} />
          <span
            className={cn(
              "truncate text-sm font-medium",
              status === "locked" ? "text-muted-foreground" : "text-foreground",
            )}
          >
            {label}
          </span>
        </div>
        {hint && <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{hint}</p>}
      </div>
      <span
        className={cn(
          "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
          badge.cls,
        )}
      >
        {badge.label}
      </span>
    </div>
  );

  if (status === "locked" || !href) return <li>{inner}</li>;
  if (href.startsWith("#")) {
    return (
      <li>
        <a href={href} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl">
          {inner}
        </a>
      </li>
    );
  }
  return (
    <li>
      <Link to={href as never} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl">
        {inner}
      </Link>
    </li>
  );
}

// Tiny helper kept for symmetry with previous loader UX (not used yet).
export const _StatusLoader = Loader2;
