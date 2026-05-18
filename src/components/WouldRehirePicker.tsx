import { Check, HelpCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type WouldRehireValue = "yes" | "maybe" | "no" | null;

const OPTIONS: { value: Exclude<WouldRehireValue, null>; label: string; Icon: typeof Check; activeClass: string }[] = [
  { value: "yes", label: "Sì, lo richiamerei", Icon: Check, activeClass: "border-emerald-500/60 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  { value: "maybe", label: "Forse", Icon: HelpCircle, activeClass: "border-amber-500/60 bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  { value: "no", label: "No", Icon: X, activeClass: "border-rose-500/60 bg-rose-500/10 text-rose-700 dark:text-rose-300" },
];

export function WouldRehirePicker({
  value,
  onChange,
  disabled,
  required = true,
  className,
}: {
  value: WouldRehireValue;
  onChange: (v: WouldRehireValue) => void;
  disabled?: boolean;
  required?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <div className="text-sm font-medium">
        Lo richiameresti per un prossimo turno?{required ? " *" : ""}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {OPTIONS.map((opt) => {
          const active = value === opt.value;
          const Icon = opt.Icon;
          return (
            <button
              key={opt.value}
              type="button"
              disabled={disabled}
              onClick={() => onChange(active ? null : opt.value)}
              aria-pressed={active}
              className={cn(
                "flex flex-col items-center justify-center gap-1 rounded-xl border bg-card px-2 py-2 text-xs font-medium transition",
                active ? opt.activeClass : "border-border text-muted-foreground hover:bg-muted/50",
                disabled && "opacity-50 pointer-events-none",
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="text-center leading-tight">{opt.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Compact, read-only display for an already submitted answer. */
export function WouldRehireBadge({ value, className }: { value: WouldRehireValue | undefined; className?: string }) {
  if (!value) return null;
  const opt = OPTIONS.find((o) => o.value === value);
  if (!opt) return null;
  const Icon = opt.Icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        opt.activeClass,
        className,
      )}
    >
      <Icon className="h-3 w-3" />
      Richiamerebbe: {value === "yes" ? "Sì" : value === "maybe" ? "Forse" : "No"}
    </span>
  );
}