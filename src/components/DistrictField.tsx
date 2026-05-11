import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { zonesForCity } from "@/lib/italian-locations";
import { ChevronDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  province?: string | null;
  city?: string | null;
  cap?: string | null;
  value: string;
  onChange: (district: string) => void;
  disabled?: boolean;
};

const OTHER = "__other__";

/**
 * Smart District / Quartiere field:
 * - Disabilitato finché non è selezionata la città.
 * - Desktop: shadcn Select (Radix) dropdown.
 * - Mobile: bottom-sheet con campo di ricerca + lista + "Altro".
 * - Supporta "Altro…" con campo testo per zone non in elenco.
 */
export function DistrictField({ city, value, onChange, disabled }: Props) {
  const isMobile = useIsMobile();
  const zones = React.useMemo(() => zonesForCity(city), [city]);

  const isKnown = !!value && zones.some((z) => z.toLowerCase() === value.toLowerCase());
  const [other, setOther] = React.useState<boolean>(
    Boolean(value) && zones.length > 0 && !isKnown,
  );
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");

  React.useEffect(() => {
    if (zones.length === 0) {
      setOther(false);
      return;
    }
    setOther(Boolean(value) && !zones.some((z) => z.toLowerCase() === value.toLowerCase()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city]);

  // ---- Nessuna città selezionata: trigger disabilitato con hint ----
  if (!city) {
    return (
      <Input
        value=""
        readOnly
        disabled
        placeholder="Seleziona prima la città"
      />
    );
  }

  // ---- Città senza elenco predefinito: input libero ----
  if (zones.length === 0) {
    return (
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Quartiere / zona"
        disabled={disabled}
      />
    );
  }

  const filtered = query.trim()
    ? zones.filter((z) => z.toLowerCase().includes(query.trim().toLowerCase()))
    : zones;

  // ---- Mobile: bottom sheet ----
  if (isMobile) {
    const displayText = other ? "Altro…" : (isKnown ? value : "");
    return (
      <div className="space-y-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => { setQuery(""); setSheetOpen(true); }}
          className={cn(
            "flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
            !displayText && "text-muted-foreground",
          )}
        >
          <span className="line-clamp-1 text-left">{displayText || "Seleziona zona / quartiere"}</span>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </button>

        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetContent side="bottom" className="z-[80] flex max-h-[85vh] flex-col gap-3 p-4">
            <SheetHeader className="text-left">
              <SheetTitle>Zona / Quartiere</SheetTitle>
            </SheetHeader>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Cerca zona di ${city}`}
                className="pl-8"
                autoFocus
              />
            </div>
            <div className="-mx-1 flex-1 overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                  Nessuna zona trovata
                </p>
              ) : (
                <ul className="px-1">
                  {filtered.map((z) => {
                    const selected = !other && value.toLowerCase() === z.toLowerCase();
                    return (
                      <li key={z}>
                        <button
                          type="button"
                          onClick={() => {
                            setOther(false);
                            onChange(z);
                            setSheetOpen(false);
                          }}
                          className={cn(
                            "flex w-full items-center justify-between rounded-sm px-3 py-3 text-left text-sm hover:bg-accent",
                            selected && "bg-accent text-accent-foreground",
                          )}
                        >
                          <span>{z}</span>
                          {selected && <span className="text-xs">✓</span>}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              <button
                type="button"
                onClick={() => {
                  setOther(true);
                  onChange("");
                  setSheetOpen(false);
                }}
                className={cn(
                  "mt-1 flex w-full items-center rounded-sm px-3 py-3 text-left text-sm hover:bg-accent",
                  other && "bg-accent text-accent-foreground",
                )}
              >
                Altro…
              </button>
            </div>
            <Button type="button" variant="outline" onClick={() => setSheetOpen(false)}>
              <X className="mr-2 h-4 w-4" /> Chiudi
            </Button>
          </SheetContent>
        </Sheet>

        {other && (
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Specifica zona / quartiere"
            disabled={disabled}
          />
        )}
      </div>
    );
  }

  // ---- Desktop: Select Radix ----
  const selectValue = other ? OTHER : (isKnown ? value : undefined);

  return (
    <div className="space-y-2">
      <Select
        value={selectValue}
        onValueChange={(v) => {
          if (v === OTHER) {
            setOther(true);
            onChange("");
          } else {
            setOther(false);
            onChange(v);
          }
        }}
        disabled={disabled}
      >
        <SelectTrigger>
          <SelectValue placeholder="Seleziona zona / quartiere" />
        </SelectTrigger>
        <SelectContent className="z-[80] max-h-[60vh]">
          {zones.map((z) => <SelectItem key={z} value={z}>{z}</SelectItem>)}
          <SelectItem value={OTHER}>Altro…</SelectItem>
        </SelectContent>
      </Select>
      {other && (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Specifica zona / quartiere"
          disabled={disabled}
        />
      )}
    </div>
  );
}
