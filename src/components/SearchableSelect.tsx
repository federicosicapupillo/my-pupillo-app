import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Check, ChevronDown } from "lucide-react";

export type SearchableSelectOption = { value: string; label: string };

type Props = {
  options:
    | readonly string[]
    | string[]
    | readonly SearchableSelectOption[]
    | SearchableSelectOption[];
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  triggerClassName?: string;
};

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Seleziona…",
  searchPlaceholder = "Cerca…",
  disabled,
  triggerClassName,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const normalized: SearchableSelectOption[] = useMemo(
    () =>
      (options as Array<string | SearchableSelectOption>).map((o) =>
        typeof o === "string" ? { value: o, label: o } : o,
      ),
    [options],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return normalized;
    return normalized.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        o.value.toLowerCase().includes(q),
    );
  }, [normalized, query]);

  const selectedLabel =
    normalized.find((o) => o.value === value)?.label ?? value;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={["w-full justify-between h-12 text-left font-normal", triggerClassName].filter(Boolean).join(" ")}
        >
          <span className={!value ? "text-muted-foreground" : ""}>
            {value ? selectedLabel : placeholder}
          </span>
          <ChevronDown className="h-4 w-4 opacity-60 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="p-0 w-[--radix-popover-trigger-width] max-w-[95vw] z-[1100]"
        align="start"
        sideOffset={4}
      >
        <div className="p-2 border-b">
          <Input
            autoFocus
            placeholder={searchPlaceholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-9"
          />
        </div>
        <div className="max-h-64 overflow-auto p-1">
          {filtered.length === 0 && (
            <div className="px-3 py-4 text-sm text-muted-foreground text-center">Nessun risultato</div>
          )}
          {filtered.map((opt) => (
            <button
              type="button"
              key={opt.value}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
                setQuery("");
              }}
              className="w-full flex items-center gap-2 px-2 py-2 rounded-md hover:bg-accent text-sm text-left"
            >
              <Check className={`h-4 w-4 ${value === opt.value ? "opacity-100" : "opacity-0"}`} />
              {opt.label}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
