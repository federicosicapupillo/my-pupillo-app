import { ChevronDown } from "lucide-react";
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
  const current = PHONE_PREFIXES.find((p) => p.code === safeCode) ?? PHONE_PREFIXES[0];
  return (
    <div className="flex items-center gap-3">
      {/* Prefix pill */}
      <div className="relative shrink-0">
        <div
          className="flex h-14 items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-base font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
          aria-hidden
        >
          <span className="text-lg leading-none">{current.flag}</span>
          <span className="tabular-nums">{current.code}</span>
          <ChevronDown className="h-4 w-4 text-white/60" />
        </div>
        <select
          value={safeCode}
          onChange={(e) => onCodeChange(e.target.value)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          aria-label="Prefisso internazionale"
        >
          {PHONE_PREFIXES.map((p) => (
            <option key={p.code} value={p.code}>
              {p.flag ? `${p.flag} ` : ""}{p.country} ({p.code})
            </option>
          ))}
        </select>
      </div>
      {/* Number input */}
      <input
        id={id}
        type="tel"
        inputMode="numeric"
        pattern="[0-9]*"
        required={required}
        placeholder={placeholder ?? "Numero di telefono"}
        value={number}
        onChange={(e) => onNumberChange(e.target.value.replace(/\D/g, ""))}
        className="h-14 min-w-0 flex-1 rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-base text-white placeholder:text-white/40 outline-none transition focus:border-[oklch(0.92_0.18_115)] focus:ring-2 focus:ring-[oklch(0.92_0.18_115)]/40"
      />
    </div>
  );
}
