import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, X } from "lucide-react";
import { ALL_ZONES_OPTION } from "@/lib/worker-cities";

type Props = {
  options: string[];
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
};

export function ZonesMultiSelect({ options, value, onChange, disabled, placeholder }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const allOptions = useMemo(() => [ALL_ZONES_OPTION, ...options], [options]);
  const filtered = useMemo(
    () => allOptions.filter((o) => o.toLowerCase().includes(query.trim().toLowerCase())),
    [allOptions, query],
  );

  const isAll = value.includes(ALL_ZONES_OPTION);

  function toggle(opt: string) {
    if (opt === ALL_ZONES_OPTION) {
      onChange(isAll ? [] : [ALL_ZONES_OPTION]);
      return;
    }
    const without = value.filter((v) => v !== ALL_ZONES_OPTION);
    if (without.includes(opt)) {
      onChange(without.filter((v) => v !== opt));
    } else {
      onChange([...without, opt]);
    }
  }

  function remove(opt: string) {
    onChange(value.filter((v) => v !== opt));
  }

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            className="w-full justify-between min-h-12 h-auto py-2 text-left font-normal"
          >
            <span className={value.length === 0 ? "text-muted-foreground" : ""}>
              {value.length === 0
                ? placeholder ?? "Seleziona zone"
                : isAll
                  ? ALL_ZONES_OPTION
                  : `${value.length} ${value.length === 1 ? "zona selezionata" : "zone selezionate"}`}
            </span>
            <ChevronDown className="h-4 w-4 opacity-60 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-[--radix-popover-trigger-width] max-w-[95vw]" align="start">
          <div className="p-2 border-b">
            <Input
              autoFocus
              placeholder="Cerca zona…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-9"
            />
          </div>
          <div className="max-h-64 overflow-auto p-1">
            {filtered.length === 0 && (
              <div className="px-3 py-4 text-sm text-muted-foreground text-center">Nessun risultato</div>
            )}
            {filtered.map((opt) => {
              const checked = value.includes(opt);
              return (
                <label
                  key={opt}
                  className="flex items-center gap-2 px-2 py-2 rounded-md hover:bg-accent cursor-pointer text-sm"
                >
                  <Checkbox checked={checked} onCheckedChange={() => toggle(opt)} />
                  <span className={opt === ALL_ZONES_OPTION ? "font-medium" : ""}>{opt}</span>
                </label>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>

      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((v) => (
            <Badge key={v} variant="secondary" className="gap-1 pl-2 pr-1 py-1">
              {v}
              <button
                type="button"
                aria-label={`Rimuovi ${v}`}
                onClick={() => remove(v)}
                className="rounded-full hover:bg-background/60 p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
