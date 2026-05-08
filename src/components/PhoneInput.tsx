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
};

export function PhoneInput({ code, number, onCodeChange, onNumberChange, required, placeholder, id }: Props) {
  const safeCode = code || DEFAULT_PHONE_PREFIX;
  return (
    <div className="flex flex-wrap gap-2 sm:flex-nowrap">
      <select
        value={safeCode}
        onChange={(e) => onCodeChange(e.target.value)}
        className="h-9 w-[6.5rem] shrink-0 rounded-md border border-input bg-background px-2 text-sm sm:basis-1/4 sm:w-auto"
        aria-label="Prefisso internazionale"
      >
        {PHONE_PREFIXES.map((p) => (
          <option key={p.code} value={p.code}>
            {p.flag ? `${p.flag} ` : ""}
            {p.code} {p.country}
          </option>
        ))}
      </select>
      <Input
        id={id}
        type="tel"
        inputMode="numeric"
        pattern="[0-9]*"
        required={required}
        placeholder={placeholder ?? "Inserisci numero di cellulare"}
        value={number}
        onChange={(e) => onNumberChange(e.target.value.replace(/\D/g, ""))}
        className="flex-1 min-w-0 sm:basis-3/4"
      />
    </div>
  );
}
