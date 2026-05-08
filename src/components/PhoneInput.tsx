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
    <div className="flex gap-2">
      <select
        value={safeCode}
        onChange={(e) => onCodeChange(e.target.value)}
        className="h-9 shrink-0 rounded-md border border-input bg-background px-2 text-sm"
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
        required={required}
        placeholder={placeholder ?? "Numero di telefono"}
        value={number}
        onChange={(e) => onNumberChange(e.target.value.replace(/\D/g, ""))}
      />
    </div>
  );
}
