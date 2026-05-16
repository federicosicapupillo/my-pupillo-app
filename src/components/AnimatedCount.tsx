import { useEffect, useRef, useState } from "react";

/**
 * Mostra un numero che pulsa brevemente quando cambia, con un piccolo
 * badge transitorio (+N / -N / ✓ se va a 0) per rendere percepibile
 * l'aggiornamento in tempo reale dei conteggi dei chip.
 */
export function AnimatedCount({ value, tone = "default" }: { value: number; tone?: "default" | "unread" | "status" }) {
  const prevRef = useRef(value);
  const [pulse, setPulse] = useState(false);
  const [delta, setDelta] = useState<{ key: number; label: string; kind: "up" | "down" | "zero" } | null>(null);

  useEffect(() => {
    const prev = prevRef.current;
    if (prev === value) return;
    prevRef.current = value;
    setPulse(true);
    const diff = value - prev;
    if (value === 0 && prev > 0) {
      setDelta({ key: Date.now(), label: "✓", kind: "zero" });
    } else if (diff !== 0) {
      setDelta({
        key: Date.now(),
        label: diff > 0 ? `+${diff}` : `${diff}`,
        kind: diff > 0 ? "up" : "down",
      });
    }
    const t1 = setTimeout(() => setPulse(false), 450);
    const t2 = setTimeout(() => setDelta(null), 900);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [value]);

  const deltaColor =
    delta?.kind === "up"
      ? "text-amber-600"
      : delta?.kind === "down"
        ? "text-emerald-600"
        : "text-emerald-600";

  return (
    <span className="relative inline-flex items-center">
      <span
        key={value}
        className={`inline-block tabular-nums transition-transform ${pulse ? "animate-scale-in" : ""} ${tone === "unread" && value > 0 ? "font-semibold" : ""}`}
      >
        {value}
      </span>
      {delta && (
        <span
          key={delta.key}
          aria-hidden
          className={`pointer-events-none absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-semibold ${deltaColor} animate-fade-in`}
        >
          {delta.label}
        </span>
      )}
    </span>
  );
}