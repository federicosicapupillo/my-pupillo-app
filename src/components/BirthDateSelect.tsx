import * as React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { MIN_WORKER_AGE_YEARS, todayInRome } from "@/lib/document-dates";

type Props = {
  /** ISO yyyy-mm-dd */
  value?: string | null;
  onChange: (iso: string) => void;
  error?: string | null;
  id?: string;
  disabled?: boolean;
};

const MONTHS_IT = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
];

function daysInMonth(year: number, month1: number): number {
  return new Date(year, month1, 0).getDate();
}

/**
 * Birth date picker built with three dropdowns (giorno / mese / anno).
 * - Year list is capped at currentYear - MIN_WORKER_AGE_YEARS.
 * - Day list adapts to the selected month/year.
 * - Emits ISO yyyy-mm-dd only when all three parts are selected and the
 *   resulting date is at least MIN_WORKER_AGE_YEARS ago.
 */
export function BirthDateSelect({ value, onChange, error, id, disabled }: Props) {
  const today = todayInRome();
  const maxYear = today.getFullYear() - MIN_WORKER_AGE_YEARS;
  const minYear = maxYear - 100; // 100 years window

  const parsed = React.useMemo(() => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? "");
    if (!m) return { y: "", mo: "", d: "" };
    return { y: m[1], mo: m[2], d: m[3] };
  }, [value]);

  const [y, setY] = React.useState(parsed.y);
  const [mo, setMo] = React.useState(parsed.mo);
  const [d, setD] = React.useState(parsed.d);

  React.useEffect(() => {
    setY(parsed.y);
    setMo(parsed.mo);
    setD(parsed.d);
  }, [parsed.y, parsed.mo, parsed.d]);

  const years = React.useMemo(() => {
    const out: number[] = [];
    for (let yr = maxYear; yr >= minYear; yr--) out.push(yr);
    return out;
  }, [maxYear, minYear]);

  const dayCount = React.useMemo(() => {
    if (!y || !mo) return 31;
    return daysInMonth(Number(y), Number(mo));
  }, [y, mo]);

  // Determine which (year, month) combinations are entirely in the future
  // beyond the 18-years-ago boundary. For the cap year (maxYear), some
  // months/days may need to be hidden.
  const isMonthDisabled = (m1: number) => {
    if (!y) return false;
    if (Number(y) !== maxYear) return false;
    // Cap = today minus 18 years. Month must be <= today.month.
    return m1 > today.getMonth() + 1;
  };

  const isDayDisabled = (day: number) => {
    if (!y || !mo) return false;
    if (day > dayCount) return true;
    if (Number(y) !== maxYear) return false;
    if (Number(mo) < today.getMonth() + 1) return false;
    if (Number(mo) > today.getMonth() + 1) return true;
    return day > today.getDate();
  };

  function emit(nextY: string, nextMo: string, nextD: string) {
    if (nextY && nextMo && nextD) {
      const dn = Number(nextD);
      const max = daysInMonth(Number(nextY), Number(nextMo));
      if (dn >= 1 && dn <= max) {
        const iso = `${nextY}-${nextMo}-${nextD}`;
        onChange(iso);
        return;
      }
    }
    onChange("");
  }

  function handleDay(v: string) {
    setD(v);
    emit(y, mo, v);
  }
  function handleMonth(v: string) {
    setMo(v);
    let nextD = d;
    if (d && y) {
      const max = daysInMonth(Number(y), Number(v));
      if (Number(d) > max) {
        nextD = "";
        setD("");
      }
    }
    emit(y, v, nextD);
  }
  function handleYear(v: string) {
    setY(v);
    let nextD = d;
    let nextMo = mo;
    if (mo && d) {
      const max = daysInMonth(Number(v), Number(mo));
      if (Number(d) > max) {
        nextD = "";
        setD("");
      }
    }
    // If switching to maxYear and selected month is in the future, clear it
    if (Number(v) === maxYear && mo && Number(mo) > today.getMonth() + 1) {
      nextMo = "";
      nextD = "";
      setMo("");
      setD("");
    }
    emit(v, nextMo, nextD);
  }

  const triggerCls = cn(
    error && "border-destructive focus-visible:ring-destructive/40",
  );

  return (
    <div className="space-y-1">
      <div className="grid grid-cols-3 gap-2">
        <Select value={d} onValueChange={handleDay} disabled={disabled}>
          <SelectTrigger id={id} className={triggerCls} aria-label="Giorno">
            <SelectValue placeholder="Giorno" />
          </SelectTrigger>
          <SelectContent>
            {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
              <SelectItem
                key={day}
                value={String(day).padStart(2, "0")}
                disabled={isDayDisabled(day)}
              >
                {String(day).padStart(2, "0")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={mo} onValueChange={handleMonth} disabled={disabled}>
          <SelectTrigger className={triggerCls} aria-label="Mese">
            <SelectValue placeholder="Mese" />
          </SelectTrigger>
          <SelectContent>
            {MONTHS_IT.map((name, idx) => {
              const v = String(idx + 1).padStart(2, "0");
              return (
                <SelectItem key={v} value={v} disabled={isMonthDisabled(idx + 1)}>
                  {name}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
        <Select value={y} onValueChange={handleYear} disabled={disabled}>
          <SelectTrigger className={triggerCls} aria-label="Anno">
            <SelectValue placeholder="Anno" />
          </SelectTrigger>
          <SelectContent>
            {years.map((yr) => (
              <SelectItem key={yr} value={String(yr)}>
                {yr}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}