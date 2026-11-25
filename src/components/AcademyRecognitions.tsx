import { useEffect, useState } from "react";
import { Award } from "lucide-react";
import { getAcademyRecognitions } from "@/lib/academy-recognitions.functions";
import type { AcademyRecognition } from "@/lib/academy-recognitions";

/** Mostrato solo se il lavoratore ha superato moduli Academy e ha scelto di mostrarli. */
export function AcademyRecognitions({ workerId, compact = false }: { workerId: string; compact?: boolean }) {
  const [items, setItems] = useState<AcademyRecognition[]>([]);
  useEffect(() => {
    let alive = true;
    getAcademyRecognitions({ data: { workerId } }).then((r) => { if (alive) setItems(r); }).catch(() => {});
    return () => { alive = false; };
  }, [workerId]);
  if (items.length === 0) return null;
  return (
    <section className={compact ? "text-sm" : "rounded-xl border bg-card p-4"}>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Pupillo Academy</h3>
      <ul className="flex flex-wrap gap-2">
        {items.map((r) => (
          <li key={r.module} className="flex items-center gap-3 rounded-xl border border-primary/40 bg-primary/10 px-3 py-2 text-sm">
            {r.badge_url ? (
              <img src={r.badge_url} alt={`Stemma ${r.award || r.title}`} className="h-11 w-11 shrink-0 object-contain" loading="lazy" referrerPolicy="no-referrer" />
            ) : (
              <span role="img" aria-label={`Stemma ${r.award || r.title}`} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground ring-2 ring-accent shadow">
                <Award className="h-6 w-6" aria-hidden />
              </span>
            )}
            <span className="flex flex-col leading-tight">
              <strong>{r.award || r.title}</strong>
              {r.award ? <span>{r.title}</span> : null}
              <span className="text-xs text-muted-foreground">Superato il {new Date(r.passed_at).toLocaleDateString("it-IT")}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted-foreground">Moduli superati con verifica, pubblicati per scelta del lavoratore.</p>
    </section>
  );
}
