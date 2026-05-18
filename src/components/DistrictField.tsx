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

/**
 * District / Quartiere field (strict dropdown):
 * - Disabilitato finché non è selezionata la città.
 * - Desktop: shadcn Select (Radix) con elenco zone.
 * - Mobile: bottom-sheet con ricerca + lista zone.
 * - Nessun input libero: l'utente DEVE scegliere una zona dalla lista.
 *   Per le città senza elenco predefinito il campo è disabilitato con avviso.
 */
export function DistrictField({ city, value, onChange, disabled }: Props) {
  const isMobile = useIsMobile();
  const zones = React.useMemo(() => zonesForCity(city), [city]);

  const isKnown = !!value && zones.some((z) => z.toLowerCase() === value.toLowerCase());
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");

  // Se cambia la città e il valore corrente non è in elenco, lo resettiamo
  // per evitare di tenere valori "vecchi" o liberi non più validi.
  React.useEffect(() => {
    if (!value) return;
    if (zones.length === 0) return;
    if (!zones.some((z) => z.toLowerCase() === value.toLowerCase())) {
      onChange("");
    }
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

  // ---- Città senza elenco predefinito: campo disabilitato con avviso ----
  if (zones.length === 0) {
    return (
      <div className="space-y-1">
        <Input
          value=""
          readOnly
          disabled
          placeholder="Nessuna zona disponibile per questa città"
        />
        <p className="text-xs text-muted-foreground">
          Per questa città non è ancora disponibile l'elenco delle zone.
          Contatta il supporto per richiedere l'aggiunta.
        </p>
      </div>
    );
  }

  const filtered = query.trim()
    ? zones.filter((z) => z.toLowerCase().includes(query.trim().toLowerCase()))
    : zones;

  // ---- Mobile: bottom sheet ----
  if (isMobile) {
    const displayText = isKnown ? value : "";
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
          <span className="line-clamp-1 text-left">{displayText || "Seleziona zona/quartiere"}</span>
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
                    const selected = value.toLowerCase() === z.toLowerCase();
                    return (
                      <li key={z}>
                        <button
                          type="button"
                          onClick={() => {
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
            </div>
            <Button type="button" variant="outline" onClick={() => setSheetOpen(false)}>
              <X className="mr-2 h-4 w-4" /> Chiudi
            </Button>
          </SheetContent>
        </Sheet>
      </div>
    );
  }

  // ---- Desktop: Select Radix ----
  const selectValue = isKnown ? value : undefined;

  return (
    <Select
      value={selectValue}
      onValueChange={(v) => onChange(v)}
      disabled={disabled}
    >
      <SelectTrigger>
        <SelectValue placeholder="Seleziona zona/quartiere" />
      </SelectTrigger>
      <SelectContent className="z-[80] max-h-[60vh]">
        {zones.map((z) => <SelectItem key={z} value={z}>{z}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
