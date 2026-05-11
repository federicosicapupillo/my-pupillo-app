import * as React from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { zonesForCity } from "@/lib/italian-locations";

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
 * Smart District/Quartiere field (basato sulla CITTÀ):
 * - città con elenco zone → dropdown con le zone + "Altro" (con campo testo)
 * - città senza elenco / nessuna città → testo libero
 * Quando la città cambia, il valore non più valido viene azzerato dal parent.
 */
export function DistrictField({ city, value, onChange, disabled }: Props) {
  const zones = React.useMemo(() => zonesForCity(city), [city]);

  const isKnown = zones.some((z) => z.toLowerCase() === (value || "").toLowerCase());
  const [other, setOther] = React.useState<boolean>(
    Boolean(value) && zones.length > 0 && !isKnown,
  );

  // Quando cambia la città, ripristina lo stato "Altro" in base al valore.
  React.useEffect(() => {
    if (zones.length === 0) {
      setOther(false);
      return;
    }
    setOther(Boolean(value) && !zones.some((z) => z.toLowerCase() === value.toLowerCase()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city]);

  // Città senza elenco → testo libero
  if (zones.length === 0) {
    return (
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={city ? "Quartiere / zona" : "Seleziona prima la città"}
        disabled={disabled || !city}
      />
    );
  }

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
        <SelectTrigger><SelectValue placeholder="Seleziona zona / quartiere" /></SelectTrigger>
        <SelectContent className="z-[60] max-h-[60vh]">
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
