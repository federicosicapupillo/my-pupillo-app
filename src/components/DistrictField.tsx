import * as React from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { zonesForCap } from "@/lib/italian-locations";

type Props = {
  province?: string | null;
  city?: string | null;
  cap?: string | null;
  value: string;
  onChange: (district: string) => void;
  disabled?: boolean;
};

/**
 * Smart District/Quartiere field:
 * - 1 zone known → auto-fills, read-only
 * - >1 zones known → dropdown
 * - unknown → free text input
 * Resets/refills automatically when city or CAP changes.
 */
export function DistrictField({ province, city, cap, value, onChange, disabled }: Props) {
  const zones = React.useMemo(() => zonesForCap(province, cap), [province, cap]);
  const lastKeyRef = React.useRef<string>("");

  React.useEffect(() => {
    const key = `${province || ""}|${city || ""}|${cap || ""}`;
    if (lastKeyRef.current === key) return;
    lastKeyRef.current = key;
    if (zones.length === 1) {
      if (value !== zones[0]) onChange(zones[0]);
    } else if (zones.length > 1) {
      if (value && !zones.some((z) => z.toLowerCase() === value.toLowerCase())) onChange("");
    }
    // unknown → leave current value
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [province, city, cap, zones]);

  if (zones.length > 1) {
    return (
      <Select value={value || undefined} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger><SelectValue placeholder="Seleziona quartiere / zona" /></SelectTrigger>
        <SelectContent className="z-[60] max-h-[60vh]">
          {zones.map((z) => <SelectItem key={z} value={z}>{z}</SelectItem>)}
        </SelectContent>
      </Select>
    );
  }

  if (zones.length === 1) {
    return (
      <Input
        value={value || zones[0]}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder="Quartiere / zona"
      />
    );
  }

  return (
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Quartiere / zona (opzionale)"
      disabled={disabled}
    />
  );
}
