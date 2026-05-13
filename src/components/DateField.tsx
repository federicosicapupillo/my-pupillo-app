import * as React from "react";
import { CalendarIcon } from "lucide-react";
import { it } from "date-fns/locale";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatDateIT, fromISODate, toISODate } from "@/lib/format";
import {
  formatDateMask,
  digitsBeforeCaret,
  caretAfterDigit,
  maskedToISO,
} from "@/lib/date-mask";

type Props = {
  /** ISO yyyy-mm-dd value */
  value?: string;
  onChange: (iso: string) => void;
  min?: string; // ISO yyyy-mm-dd
  max?: string; // ISO yyyy-mm-dd
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
  max,
  required,
  placeholder = "gg/mm/aaaa",
  className,
  disabled,
}: Props) {
  const [open, setOpen] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  const selected = fromISODate(value);
  const minDate = fromISODate(min);
  const maxDate = fromISODate(max);

  // Local typed text, kept in sync with the ISO value coming from the parent.
  // Lets the user type a partial date (e.g. "13/05/") without the parent
  // overwriting it on every keystroke.
  const [text, setText] = React.useState<string>(() =>
    selected ? formatDateIT(selected) : "",
  );
  const lastEmittedIso = React.useRef<string>(value ?? "");

  React.useEffect(() => {
    // External update (calendar pick, programmatic reset) → sync the input.
    if ((value ?? "") !== lastEmittedIso.current) {
      lastEmittedIso.current = value ?? "";
      setText(value ? formatDateIT(fromISODate(value)) : "");
    }
  }, [value]);

  function emitFromText(next: string) {
    const iso = next.length === 10 ? maskedToISO(next) : null;
    const out = iso ?? "";
    if (out !== lastEmittedIso.current) {
      lastEmittedIso.current = out;
      onChange(out);
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const el = e.currentTarget;
    const rawCaret = el.selectionStart ?? el.value.length;
    const digitsBefore = digitsBeforeCaret(el.value, rawCaret);
    const formatted = formatDateMask(el.value);
    setText(formatted);
    emitFromText(formatted);

    // Restore the caret on the next frame, after React updates the DOM.
    const nextCaret = caretAfterDigit(formatted, digitsBefore);
    requestAnimationFrame(() => {
      const node = inputRef.current;
      if (node && document.activeElement === node) {
        node.setSelectionRange(nextCaret, nextCaret);
      }
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    // Allow editing keys; block any printable non-digit so the user can only
    // type a valid dd/mm/yyyy pattern.
    const allowed =
      e.key.length !== 1 ||
      /\d/.test(e.key) ||
      e.metaKey ||
      e.ctrlKey ||
      e.altKey;
    if (!allowed) e.preventDefault();
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text");
    const formatted = formatDateMask(pasted);
    setText(formatted);
    emitFromText(formatted);
    requestAnimationFrame(() => {
      const node = inputRef.current;
      if (node) {
        const pos = formatted.length;
        node.setSelectionRange(pos, pos);
      }
    });
  }

  return (
    <div className={cn("flex items-stretch gap-2", className)}>
      <Input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder={placeholder}
        value={text}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        maxLength={10}
        disabled={disabled}
        aria-required={required}
        className="flex-1"
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={disabled}
            aria-label="Apri calendario"
            className="h-10 w-10 shrink-0"
          >
            <CalendarIcon className="h-4 w-4 opacity-70" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="single"
            locale={it}
            weekStartsOn={1}
            selected={selected}
            defaultMonth={selected ?? minDate ?? new Date()}
            onSelect={(d) => {
              if (d) {
                const iso = toISODate(d);
                lastEmittedIso.current = iso;
                setText(formatDateIT(d));
                onChange(iso);
                setOpen(false);
              }
            }}
            disabled={
              minDate && maxDate
                ? [{ before: minDate }, { after: maxDate }]
                : minDate
                ? { before: minDate }
                : maxDate
                ? { after: maxDate }
                : undefined
            }
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}