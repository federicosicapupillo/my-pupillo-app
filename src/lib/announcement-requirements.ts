import {
  Languages, IdCard, Sparkles, Scissors, ListChecks,
  Flame, Wine, PenTool, Footprints, Shirt, Briefcase,
  Apple, Crown, Hand, Building2, CircleOff,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const LICENSE_OPTIONS = [
  { value: "nessuna", label: "Nessuna" },
  { value: "patente_b", label: "Patente B" },
  { value: "patente_a", label: "Patente A" },
  { value: "automunito", label: "Automunito richiesto" },
  { value: "altro", label: "Altro" },
] as const;

export const LANGUAGE_OPTIONS = [
  { value: "italiano_base", label: "Italiano Base (A2)" },
  { value: "italiano_intermedio", label: "Italiano Intermedio (B2)" },
  { value: "italiano_avanzato", label: "Italiano Avanzato (C1)" },
  { value: "italiano_madrelingua", label: "Italiano Madrelingua" },
  { value: "inglese_base", label: "Inglese Base (A2)" },
  { value: "inglese_intermedio", label: "Inglese Intermedio (B2)" },
  { value: "inglese_avanzato", label: "Inglese Avanzato (C1)" },
  { value: "francese_base", label: "Francese Base (A2)" },
  { value: "francese_intermedio", label: "Francese Intermedio (B2)" },
  { value: "francese_avanzato", label: "Francese Avanzato (C1)" },
  { value: "tedesco_base", label: "Tedesco Base (A2)" },
  { value: "tedesco_intermedio", label: "Tedesco Intermedio (B2)" },
  { value: "tedesco_avanzato", label: "Tedesco Avanzato (C1)" },
  { value: "spagnolo_base", label: "Spagnolo Base (A2)" },
  { value: "spagnolo_intermedio", label: "Spagnolo Intermedio (B2)" },
  { value: "spagnolo_avanzato", label: "Spagnolo Avanzato (C1)" },
] as const;

export const TATTOO_OPTIONS = [
  { value: "si", label: "Sì" },
  { value: "no", label: "No" },
  { value: "solo_non_visibili", label: "Solo se non visibili" },
  { value: "indifferente", label: "Indifferente" },
] as const;

export const PIERCING_OPTIONS = [
  { value: "si", label: "Sì" },
  { value: "no", label: "No" },
  { value: "solo_discreti", label: "Solo se discreti" },
  { value: "indifferente", label: "Indifferente" },
] as const;

export const BEARD_OPTIONS = [
  { value: "si", label: "Sì" },
  { value: "no", label: "No" },
  { value: "solo_curata", label: "Solo curata" },
  { value: "indifferente", label: "Indifferente" },
] as const;

export const SKILL_OPTIONS = [
  { value: "saper_portare_tre_piatti", label: "Saper portare tre piatti" },
  { value: "uso_palmare", label: "Uso palmare/comande" },
  { value: "servizio_al_tavolo", label: "Servizio al tavolo" },
  { value: "preparazione_cocktail", label: "Cocktail base" },
  { value: "preparazione_caffetteria", label: "Caffetteria" },
  { value: "gestione_cassa", label: "Gestione cassa" },
  { value: "banqueting", label: "Banqueting" },
  { value: "fine_dining", label: "Fine dining" },
  { value: "gestione_sala", label: "Gestione sala" },
  { value: "altro", label: "Altro" },
] as const;

export const DRESS_CODE_OPTIONS: { value: string; label: string; icon: LucideIcon }[] = [
  { value: "accendino", label: "Accendino", icon: Flame },
  { value: "cavatappi", label: "Cavatappi", icon: Wine },
  { value: "penna", label: "Penna", icon: PenTool },
  { value: "calze_lunghe_nere", label: "Calze lunghe nere", icon: Footprints },
  { value: "cintura_nera", label: "Cintura nera pelle", icon: Briefcase },
  { value: "grembiule_nero", label: "Grembiule nero", icon: Apple },
  { value: "camicia_bianca", label: "Camicia bianca no loghi", icon: Shirt },
  { value: "cravatta_nera", label: "Cravatta nera no loghi", icon: Crown },
  { value: "pantalone_nero", label: "Pantalone nero (no jeans)", icon: Briefcase },
  { value: "scarpe_nere", label: "Scarpe nere eleganti", icon: Footprints },
  { value: "capelli_raccolti", label: "Capelli raccolti", icon: Scissors },
  { value: "unghie_curate", label: "Unghie curate", icon: Hand },
  { value: "no_profumi", label: "No profumi intensi", icon: CircleOff },
  { value: "divisa_fornita", label: "Divisa fornita dal locale", icon: Building2 },
  { value: "total_black", label: "Total black", icon: Shirt },
  { value: "altro", label: "Altro", icon: Sparkles },
];

export function labelOf(value: string | null | undefined, list: readonly { value: string; label: string }[]): string {
  if (!value) return "—";
  return list.find(o => o.value === value)?.label ?? value;
}
export function labelsOf(values: string[] | null | undefined, list: readonly { value: string; label: string }[]): string[] {
  if (!values || values.length === 0) return [];
  return values.map(v => list.find(o => o.value === v)?.label ?? v);
}

export const REQ_ICONS = { Languages, IdCard, Sparkles, Scissors, ListChecks };
