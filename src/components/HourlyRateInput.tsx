import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Props = {
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  placeholder?: string;
  className?: string;
  id?: string;
};

/**
 * Numeric input for hourly rate, with non-editable "EUR/h" suffix.
 * Stores only the numeric value (decimals allowed, no negatives, no zero).
 */
export function HourlyRateInput({
  value,
  onChange,
  required,
  placeholder = "Es. 12",
  className,
  id,
}: Props) {
  return (
    <div className={cn("relative", className)}>
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        min="0.01"
        step="0.5"
        required={required}
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          const v = e.target.value;
          // Block negative values; allow empty or positive decimals.
          if (v === "" || Number(v) >= 0) onChange(v);
        }}
        className="pr-20"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground"
      >
        EUR/h
      </span>
    </div>
  );
}