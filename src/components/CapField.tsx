import * as React from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { capsForCity, capsForDistrict } from "@/lib/italian-locations";

type Props = {
  province?: string | null;
  city?: string | null;
  district?: string | null;
  value: string;
  onChange: (cap: string) => void;
  disabled?: boolean;
};

/**
 * Smart CAP field:
 * - filtra i CAP in base alla zona/quartiere se disponibile, altrimenti alla città
 * - 1 CAP coerente → auto-fill read-only
 * - più CAP → Select dropdown
 * - nessun dato → input numerico libero (5 cifre)
 * Auto-resetta/auto-completa quando città o zona cambiano.
 */
export function CapField({ province, city, district, value, onChange, disabled }: Props) {
  const caps = React.useMemo(
    () => (district ? capsForDistrict(province, city, district) : capsForCity(province, city)),
    [province, city, district],
  );
  const lastKeyRef = React.useRef<string>(`${city ?? ""}|${district ?? ""}`);

  React.useEffect(() => {
    const key = `${city ?? ""}|${district ?? ""}`;
    if (lastKeyRef.current !== key) {
      lastKeyRef.current = key;
      if (caps.length === 1) {
        if (value !== caps[0]) onChange(caps[0]);
      } else if (caps.length > 1) {
        if (value && !caps.includes(value)) onChange("");
      } else {
        // dati non disponibili → mantieni valore
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city, district, caps]);

  if (caps.length > 1) {
    return (
      <Select value={value || undefined} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger><SelectValue placeholder="Seleziona CAP" /></SelectTrigger>
        <SelectContent className="z-[60] max-h-[60vh]">
          {caps.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
        </SelectContent>
      </Select>
    );
  }

  if (caps.length === 1) {
    return (
      <Input
        value={value || caps[0]}
        readOnly
        disabled={disabled}
        inputMode="numeric"
        maxLength={5}
      />
    );
  }

  return (
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 5))}
      placeholder="CAP (5 cifre)"
      disabled={disabled}
      inputMode="numeric"
      maxLength={5}
    />
  );
}
