/** Riconoscimenti Pupillo Academy: solo moduli superati che il lavoratore ha scelto di mostrare. */
export interface AcademyRecognition { module: string; title: string; award: string; passed_at: string }

const str = (v: unknown, max = 120) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

/** Estrae dalla risposta dell'Academy i riconoscimenti del solo lavoratore richiesto. */
export function pickRecognitions(body: unknown, workerId: string): AcademyRecognition[] {
  const workers = (body as { workers?: unknown })?.workers;
  if (!Array.isArray(workers)) return [];
  const w = workers.find((x) => (x as { pupillo_subject?: unknown })?.pupillo_subject === workerId) as { modules?: unknown } | undefined;
  if (!w || !Array.isArray(w.modules)) return [];
  const out: AcademyRecognition[] = [];
  for (const m of w.modules) {
    const r = m as Record<string, unknown>;
    const module = str(r["module"]); const title = str(r["title"]); const passed_at = str(r["passed_at"], 40);
    if (!module || !title || !passed_at || Number.isNaN(Date.parse(passed_at))) continue;
    out.push({ module, title, award: str(r["award"]) ?? "", passed_at });
  }
  return out;
}
