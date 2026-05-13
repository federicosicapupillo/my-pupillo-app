import * as React from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { WORKER_ROLES } from "@/lib/worker-roles";

type Props = {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
};

export function WorkerRolesMultiSelect({ value, onChange, placeholder = "Seleziona ruoli" }: Props) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");

  const all = WORKER_ROLES as readonly string[];
  const selected = new Set(value);
  const filtered = all.filter((r) => r.toLowerCase().includes(query.trim().toLowerCase()));

  const toggle = (role: string) => {
    const next = new Set(selected);
    if (next.has(role)) next.delete(role);
    else next.add(role);
    onChange(all.filter((r) => next.has(r)));
  };

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="w-full justify-between font-normal"
          >
            <span className={cn(value.length === 0 && "text-muted-foreground")}>
              {value.length === 0
                ? placeholder
                : value.length === all.length
                ? "Tutti i ruoli selezionati"
                : `${value.length} ruol${value.length === 1 ? "o" : "i"} selezionat${value.length === 1 ? "o" : "i"}`}
            </span>
            <ChevronDown className="h-4 w-4 opacity-60" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <div className="p-2 border-b">
            <Input
              autoFocus
              placeholder="Cerca ruolo..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-8"
            />
          </div>
          <div className="flex items-center justify-between gap-2 px-2 py-1.5 border-b text-xs">
            <button
              type="button"
              className="text-primary hover:underline"
              onClick={() => onChange([...all])}
            >
              Seleziona tutto
            </button>
            <button
              type="button"
              className="text-muted-foreground hover:underline"
              onClick={() => onChange([])}
            >
              Deseleziona tutto
            </button>
          </div>
          <div className="max-h-64 overflow-y-auto py-1 pointer-events-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                Nessun ruolo trovato
              </div>
            ) : (
              filtered.map((role) => {
                const isSel = selected.has(role);
                return (
                  <button
                    type="button"
                    key={role}
                    onClick={() => toggle(role)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent text-left"
                  >
                    <span
                      className={cn(
                        "flex h-4 w-4 items-center justify-center rounded border",
                        isSel ? "bg-primary border-primary text-primary-foreground" : "border-input",
                      )}
                    >
                      {isSel && <Check className="h-3 w-3" />}
                    </span>
                    <span>{role}</span>
                  </button>
                );
              })
            )}
          </div>
        </PopoverContent>
      </Popover>

      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((role) => (
            <Badge key={role} variant="secondary" className="gap-1 pr-1">
              {role}
              <button
                type="button"
                onClick={() => toggle(role)}
                className="ml-0.5 rounded hover:bg-muted-foreground/20 p-0.5"
                aria-label={`Rimuovi ${role}`}
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