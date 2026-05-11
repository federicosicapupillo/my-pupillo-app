import * as React from "react";
import { CalendarIcon } from "lucide-react";
import { it } from "date-fns/locale";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatDateIT, fromISODate, toISODate } from "@/lib/format";

type Props = {
  /** ISO yyyy-mm-dd value */
  value?: string;
  onChange: (iso: string) => void;
  min?: string; // ISO yyyy-mm-dd
  required?: boolean;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
};

/**
 * Italian date picker. UI shows dd/MM/yyyy with it-IT locale; stores ISO yyyy-mm-dd.
 */
export function DateField({
  value,
  onChange,
  min,
  required,
  placeholder = "gg/mm/aaaa",
  className,
  disabled,
}: Props) {
  const [open, setOpen] = React.useState(false);
  const selected = fromISODate(value);
  const minDate = fromISODate(min);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "h-10 w-full justify-start gap-2 bg-white/[0.04] font-normal",
            !selected && "text-muted-foreground",
            className,
          )}
          aria-required={required}
        >
          <CalendarIcon className="h-4 w-4 opacity-70" />
          {selected ? formatDateIT(selected) : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          locale={it}
          weekStartsOn={1}
          selected={selected}
          defaultMonth={selected ?? minDate ?? new Date()}
          onSelect={(d) => {
            if (d) {
              onChange(toISODate(d));
              setOpen(false);
            }
          }}
          disabled={minDate ? { before: minDate } : undefined}
          initialFocus
          className={cn("p-3 pointer-events-auto")}
        />
      </PopoverContent>
    </Popover>
  );
}