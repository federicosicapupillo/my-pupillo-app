import squadra from "@/assets/academy/squadra-di-sala.png.asset.json";
import gagliardetto from "@/assets/academy/gagliardetto.png.asset.json";
import piatto from "@/assets/academy/piatto-d-oro.png.asset.json";
import papillon from "@/assets/academy/papillon.png.asset.json";
import chiave from "@/assets/academy/chiave-di-sala.png.asset.json";
import coccarda from "@/assets/academy/coccarda.png.asset.json";
import type { AcademyRecognition } from "./academy-recognitions";

/** Catalogo ufficiale dei distintivi Academy, in ordine di percorso. */
export interface AcademyBadge { key: string; rank: number; name: string; course: string; image: string; keywords: string[] }
export const ACADEMY_BADGES: AcademyBadge[] = [
  { key: "m1", rank: 1, name: "Scudetto «Squadra di Sala»", course: "M1 · Il mestiere del cameriere", image: squadra.url, keywords: ["squadra di sala", "scudetto", "mestiere del cameriere", "m1", "modulo 1", "module-1", "modulo-1"] },
  { key: "m2", rank: 2, name: "Gagliardetto", course: "M2 · Conoscere il ristorante", image: gagliardetto.url, keywords: ["gagliardetto", "conoscere il ristorante", "m2", "modulo 2", "module-2", "modulo-2"] },
  { key: "m3", rank: 3, name: "Piatto d'oro", course: "M3 · Mise en place", image: piatto.url, keywords: ["piatto d'oro", "piatto d’oro", "mise en place", "m3", "modulo 3", "module-3", "modulo-3"] },
  { key: "m4", rank: 4, name: "Papillon", course: "M4 · Accoglienza", image: papillon.url, keywords: ["papillon", "accoglienza", "m4", "modulo 4", "module-4", "modulo-4"] },
  { key: "base", rank: 5, name: "Chiave di Sala", course: "Livello Sala Base", image: chiave.url, keywords: ["chiave di sala", "sala base", "livello", "level"] },
  { key: "challenge", rank: 6, name: "Coccarda", course: "Challenge Torino", image: coccarda.url, keywords: ["coccarda", "cocarda", "challenge"] },
];
export const PATH_BADGE_COUNT = 5;

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

/** Trova il distintivo di un riconoscimento: prima per nome del premio, poi per corso, poi per codice modulo. */
export function badgeFor(r: Pick<AcademyRecognition, "module" | "title" | "award">): AcademyBadge | null {
  for (const field of [r.award, r.title, r.module]) {
    const v = norm(field || "");
    if (!v) continue;
    const hit = ACADEMY_BADGES.find((b) => b.keywords.some((k) => { const n = norm(k); return n.length <= 3 ? v === n || v.startsWith(n + "-") || v.startsWith(n + "_") || v.startsWith(n + " ") : v.includes(n); }));
    if (hit) return hit;
  }
  return null;
}

/** Distintivi ottenuti, senza duplicati, dal più alto al più basso. */
export function earnedBadges(items: AcademyRecognition[]): { badge: AcademyBadge; passed_at: string }[] {
  const map = new Map<string, { badge: AcademyBadge; passed_at: string }>();
  for (const r of items) { const b = badgeFor(r); if (b && !map.has(b.key)) map.set(b.key, { badge: b, passed_at: r.passed_at }); }
  return [...map.values()].sort((a, b) => b.badge.rank - a.badge.rank);
}

/** Distintivo per codice modulo dell'Academy (es. "L1-M2" → Gagliardetto). */
export function badgeForModuleId(id: string): AcademyBadge | null {
  const n = /-M(\d+)$/i.exec(id.trim())?.[1];
  return n ? ACADEMY_BADGES.find((b) => b.key === `m${Number(n)}`) ?? null : null;
}
