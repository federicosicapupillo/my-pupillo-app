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
          <li key={r.module} className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-sm">
            <Award className="h-4 w-4 text-primary" aria-hidden />
            <span><strong>{r.award || r.title}</strong>{r.award ? ` · ${r.title}` : ""}</span>
            <span className="text-muted-foreground">{new Date(r.passed_at).toLocaleDateString("it-IT")}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted-foreground">Moduli superati con verifica, pubblicati per scelta del lavoratore.</p>
    </section>
  );
}
