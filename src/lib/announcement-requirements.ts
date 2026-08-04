import {
  Languages, IdCard, Sparkles, Scissors, ListChecks,
  Flame, Wine, PenTool, Footprints, Shirt, Briefcase,
  Apple, Crown, Hand, Building2, CircleOff,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { DRESS_CODE_ITEMS } from "@/lib/requirement-options";
import { formatDisplayLabel } from "@/lib/format-label";

// Le opzioni vivono in `requirement-options.ts` (modulo puro, condiviso con il
// formatter centralizzato). Qui vengono ri-esportate e arricchite con le icone.
export {
  LICENSE_OPTIONS,
  LANGUAGE_OPTIONS,
  TATTOO_OPTIONS,
  PIERCING_OPTIONS,
  BEARD_OPTIONS,
  SKILL_OPTIONS,
  SPEED_OPTIONS,
  SPEED_SHORT_LABELS,
} from "@/lib/requirement-options";

const DRESS_CODE_ICONS: Record<string, LucideIcon> = {
  accendino: Flame,
  cavatappi: Wine,
  penna: PenTool,
  calze_lunghe_nere: Footprints,
  cintura_nera: Briefcase,
  grembiule_nero: Apple,
  camicia_bianca: Shirt,
  cravatta_nera: Crown,
  pantalone_nero: Briefcase,
  scarpe_nere: Footprints,
  capelli_raccolti: Scissors,
  unghie_curate: Hand,
  no_profumi: CircleOff,
  divisa_fornita: Building2,
  total_black: Shirt,
  altro: Sparkles,
};

export const DRESS_CODE_OPTIONS: { value: string; label: string; icon: LucideIcon }[] =
  DRESS_CODE_ITEMS.map((o) => ({
    value: o.value,
    label: o.label,
    icon: DRESS_CODE_ICONS[o.value] ?? Sparkles,
  }));

/**
 * Etichetta di un valore: dizionario della lista → dizionario ufficiale
 * centralizzato → formatter generico. Non mostra mai la chiave tecnica grezza.
 */
export function labelOf(value: string | null | undefined, list: readonly { value: string; label: string }[]): string {
  if (!value) return "—";
  return list.find(o => o.value === value)?.label ?? formatDisplayLabel(value);
}
export function labelsOf(values: string[] | null | undefined, list: readonly { value: string; label: string }[]): string[] {
  if (!values || values.length === 0) return [];
  return values
    .map(v => list.find(o => o.value === v)?.label ?? formatDisplayLabel(v))
    .filter(Boolean);
}

export const REQ_ICONS = { Languages, IdCard, Sparkles, Scissors, ListChecks };
