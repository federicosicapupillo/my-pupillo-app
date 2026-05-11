import * as React from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { capsForCity } from "@/lib/italian-locations";

type Props = {
  province?: string | null;
  city?: string | null;
  value: string;
  onChange: (cap: string) => void;
  disabled?: boolean;
};

/**
 * Smart CAP field:
 * - if the city has 1 known CAP → auto-fills, read-only Input
 * - if multiple known CAPs → Select dropdown
 * - if no CAP data → free numeric Input (5 digits)
 * Auto-resets/auto-fills when city changes.
 */
export function CapField({ province, city, value, onChange, disabled }: Props) {
  const caps = React.useMemo(() => capsForCity(province, city), [province, city]);
  const lastCityRef = React.useRef<string | null | undefined>(city);

  React.useEffect(() => {
    if (lastCityRef.current !== city) {
      lastCityRef.current = city;
      if (caps.length === 1) {
        if (value !== caps[0]) onChange(caps[0]);
      } else if (caps.length > 1) {
        if (value && !caps.includes(value)) onChange("");
      } else {
        // unknown city → leave current value
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city, caps]);

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
