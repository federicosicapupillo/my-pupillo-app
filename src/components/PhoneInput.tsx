import { Input } from "@/components/ui/input";
import { PHONE_PREFIXES, DEFAULT_PHONE_PREFIX } from "@/lib/phone-prefixes";

type Props = {
  code: string;
  number: string;
  onCodeChange: (code: string) => void;
  onNumberChange: (number: string) => void;
  required?: boolean;
  placeholder?: string;
  id?: string;
  disabled?: boolean;
};

export function PhoneInput({ code, number, onCodeChange, onNumberChange, required, placeholder, id, disabled }: Props) {
  const safeCode = code || DEFAULT_PHONE_PREFIX;
  return (
    <div className="flex flex-wrap gap-2 sm:flex-nowrap">
      <select
        value={safeCode}
        onChange={(e) => onCodeChange(e.target.value)}
        disabled={disabled}
        className="h-9 w-[5.5rem] shrink-0 rounded-md border border-white/10 bg-white/[0.04] text-foreground px-2 text-sm hover:border-white/20 focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40"
        aria-label="Prefisso internazionale"
      >
        {PHONE_PREFIXES.map((p) => (
          <option key={p.code} value={p.code}>
            {p.flag ? `${p.flag} ` : ""}{p.code}
          </option>
        ))}
      </select>
      <Input
        id={id}
        type="tel"
        inputMode="numeric"
        pattern="[0-9]*"
        required={required}
        disabled={disabled}
        readOnly={disabled}
        placeholder={placeholder ?? "Inserisci numero di cellulare"}
        value={number}
        onChange={(e) => onNumberChange(e.target.value.replace(/\D/g, ""))}
        className="flex-1 min-w-0"
      />
    </div>
  );
}
