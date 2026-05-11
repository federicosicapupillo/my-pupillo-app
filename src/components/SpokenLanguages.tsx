import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Plus } from "lucide-react";

export const LANGUAGE_OPTIONS = [
  "Italiano", "Inglese", "Francese", "Spagnolo", "Tedesco", "Portoghese",
  "Arabo", "Cinese", "Russo", "Rumeno", "Albanese", "Ucraino", "Polacco", "Altro",
] as const;

export const LEVEL_OPTIONS = ["Base", "Intermedio", "Avanzato", "Madrelingua"] as const;

export type SpokenLanguage = { language: string; level?: string; cefr?: string };

const FLAG_MAP: Record<string, string> = {
  italiano: "🇮🇹",
  inglese: "🇬🇧",
  francese: "🇫🇷",
  tedesco: "🇩🇪",
  spagnolo: "🇪🇸",
  portoghese: "🇵🇹",
  arabo: "🇸🇦",
  cinese: "🇨🇳",
  russo: "🇷🇺",
  rumeno: "🇷🇴",
  albanese: "🇦🇱",
  ucraino: "🇺🇦",
  polacco: "🇵🇱",
};

const CEFR_MAP: Record<string, string> = {
  base: "A2",
  intermedio: "B2",
  avanzato: "C1",
  madrelingua: "C2",
};

export function flagFor(language: string): string {
  return FLAG_MAP[language?.trim().toLowerCase()] ?? "🌐";
}

export function cefrFor(level?: string | null): string | undefined {
  if (!level) return undefined;
  return CEFR_MAP[level.trim().toLowerCase()];
}

export function normalizeSpokenLanguages(raw: any): SpokenLanguage[] {
  if (Array.isArray(raw)) {
    return raw
      .map((x: any) => {
        if (typeof x === "string") return { language: x };
        if (x && typeof x === "object" && typeof x.language === "string") return { language: x.language, level: x.level, cefr: x.cefr };
        return null;
      })
      .filter(Boolean) as SpokenLanguage[];
  }
  return [];
}

export function SpokenLanguagesEditor({ value, onChange }: { value: SpokenLanguage[]; onChange: (v: SpokenLanguage[]) => void }) {
  const [picker, setPicker] = useState<string>("");
  const [otherText, setOtherText] = useState("");

  const addLanguage = (lang: string) => {
    const trimmed = lang.trim();
    if (!trimmed) return;
    if (value.some(v => v.language.toLowerCase() === trimmed.toLowerCase())) return;
    onChange([...value, { language: trimmed }]);
  };

  const remove = (lang: string) => onChange(value.filter(v => v.language !== lang));
  const setLevel = (lang: string, level: string) => onChange(value.map(v => v.language === lang ? { ...v, level: level || undefined } : v));

  const handlePickerChange = (v: string) => {
    setPicker(v);
    if (v && v !== "Altro") {
      addLanguage(v);
      setPicker("");
    }
  };

  const addOther = () => {
    if (!otherText.trim()) return;
    addLanguage(otherText);
    setOtherText("");
    setPicker("");
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <Select value={picker} onValueChange={handlePickerChange}>
          <SelectTrigger className="w-full sm:w-[220px]"><SelectValue placeholder="Seleziona una lingua…" /></SelectTrigger>
          <SelectContent>
            {LANGUAGE_OPTIONS.filter(opt => opt === "Altro" || !value.some(v => v.language.toLowerCase() === opt.toLowerCase())).map(opt => (
              <SelectItem key={opt} value={opt}>
                <span className="inline-flex items-center gap-2"><span aria-hidden>{flagFor(opt)}</span>{opt}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {picker === "Altro" && (
          <div className="flex gap-2 flex-1 min-w-[200px]">
            <Input placeholder="Specifica lingua" value={otherText} onChange={(e) => setOtherText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addOther(); } }} />
            <Button type="button" size="sm" onClick={addOther} className="gap-1"><Plus className="h-4 w-4" />Aggiungi</Button>
          </div>
        )}
      </div>
      {value.length > 0 && (
        <ul className="flex flex-col divide-y rounded-lg border bg-card">
          {value.map((v) => {
            const cefr = cefrFor(v.level);
            return (
              <li key={v.language} className="flex items-center gap-2 px-3 py-2 text-sm">
                <span aria-hidden className="text-base shrink-0">{flagFor(v.language)}</span>
                <span className="font-medium truncate">{v.language}</span>
                {cefr && <span className="text-muted-foreground text-xs">({cefr})</span>}
                <div className="ml-auto flex items-center gap-1">
                  <Select value={v.level ?? ""} onValueChange={(lv) => setLevel(v.language, lv)}>
                    <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue placeholder="Livello" /></SelectTrigger>
                    <SelectContent>
                      {LEVEL_OPTIONS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <button type="button" onClick={() => remove(v.language)} className="rounded-full p-1 hover:bg-destructive/10 text-muted-foreground hover:text-destructive" aria-label={`Rimuovi ${v.language}`}>
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function SpokenLanguagesView({ value }: { value: SpokenLanguage[] }) {
  if (!value || value.length === 0) return <p className="text-sm text-muted-foreground">—</p>;
  return (
    <ul className="flex flex-col gap-1 text-sm text-foreground">
      {value.map((v) => {
        const flag = flagFor(v.language);
        const cefr = v.cefr ?? cefrFor(v.level);
        return (
          <li key={v.language} className="flex items-baseline gap-2 leading-tight">
            <span aria-hidden className="text-base">{flag}</span>
            <span>
              <span className="font-medium">{v.language}</span>
              {v.level ? <span> {v.level}</span> : null}
              {cefr ? <span className="text-muted-foreground"> ({cefr})</span> : null}
            </span>
          </li>
        );
      })}
    </ul>
  );
}