import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  LICENSE_OPTIONS, LANGUAGE_OPTIONS, TATTOO_OPTIONS, PIERCING_OPTIONS,
  BEARD_OPTIONS, SKILL_OPTIONS, DRESS_CODE_OPTIONS, labelOf, labelsOf,
} from "@/lib/announcement-requirements";

export type RestaurantRequirements = {
  license_requirement: string;
  language_requirements: string[];
  tattoos_allowed: string;
  piercings_allowed: string;
  beard_allowed: string;
  required_skills: string[];
  dress_code_items: string[];
  dress_code_notes: string;
};

export const EMPTY_REQ: RestaurantRequirements = {
  license_requirement: "nessuna",
  language_requirements: [],
  tattoos_allowed: "indifferente",
  piercings_allowed: "indifferente",
  beard_allowed: "solo_curata",
  required_skills: [],
  dress_code_items: [],
  dress_code_notes: "",
};

export function reqFromProfile(p: any): RestaurantRequirements {
  if (!p) return EMPTY_REQ;
  return {
    license_requirement: p.default_license_requirement ?? EMPTY_REQ.license_requirement,
    language_requirements: p.default_language_requirements ?? [],
    tattoos_allowed: p.default_tattoos_allowed ?? EMPTY_REQ.tattoos_allowed,
    piercings_allowed: p.default_piercings_allowed ?? EMPTY_REQ.piercings_allowed,
    beard_allowed: p.default_beard_allowed ?? EMPTY_REQ.beard_allowed,
    required_skills: p.default_required_skills ?? [],
    dress_code_items: p.default_dress_code_items ?? [],
    dress_code_notes: p.default_dress_code_notes ?? "",
  };
}

export function reqToProfileUpdate(r: RestaurantRequirements) {
  return {
    default_license_requirement: r.license_requirement || null,
    default_language_requirements: r.language_requirements ?? [],
    default_tattoos_allowed: r.tattoos_allowed || null,
    default_piercings_allowed: r.piercings_allowed || null,
    default_beard_allowed: r.beard_allowed || null,
    default_required_skills: r.required_skills ?? [],
    default_dress_code_items: r.dress_code_items ?? [],
    default_dress_code_notes: r.dress_code_notes || null,
  };
}

function toggle<T>(list: T[], v: T): T[] {
  return list.includes(v) ? list.filter(x => x !== v) : [...list, v];
}

export function RestaurantRequirementsEditor({ value, onChange }: { value: RestaurantRequirements; onChange: (next: RestaurantRequirements) => void }) {
  const set = (patch: Partial<RestaurantRequirements>) => onChange({ ...value, ...patch });
  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        {/* Colonna 1 */}
        <div className="space-y-4">
          <h4 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Requisiti</h4>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Tipo di patente</Label>
              <Select value={value.license_requirement} onValueChange={v => set({ license_requirement: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{LICENSE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tatuaggi ammessi</Label>
              <Select value={value.tattoos_allowed} onValueChange={v => set({ tattoos_allowed: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TATTOO_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Piercing ammessi</Label>
              <Select value={value.piercings_allowed} onValueChange={v => set({ piercings_allowed: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PIERCING_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Barba ammessa</Label>
              <Select value={value.beard_allowed} onValueChange={v => set({ beard_allowed: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{BEARD_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="mb-2 block">Lingue richieste</Label>
            <div className="flex flex-wrap gap-2">
              {LANGUAGE_OPTIONS.map(o => {
                const active = value.language_requirements.includes(o.value);
                return (
                  <button type="button" key={o.value}
                    onClick={() => set({ language_requirements: toggle(value.language_requirements, o.value) })}
                    className={`px-3 py-1.5 rounded-full text-xs border transition ${active ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-accent"}`}>
                    {o.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <Label className="mb-2 block">Competenze richieste</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {SKILL_OPTIONS.map(o => {
                const active = value.required_skills.includes(o.value);
                return (
                  <label key={o.value} className={`flex items-center gap-2 rounded-lg border p-2 text-sm cursor-pointer ${active ? "bg-primary/10 border-primary/40" : "hover:bg-accent"}`}>
                    <Checkbox checked={active} onCheckedChange={() => set({ required_skills: toggle(value.required_skills, o.value) })} />
                    <span>{o.label}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        {/* Colonna 2 */}
        <div className="space-y-4">
          <h4 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Disposizioni dress code</h4>
          <div className="grid gap-2 grid-cols-2 sm:grid-cols-3">
            {DRESS_CODE_OPTIONS.map(o => {
              const Icon = o.icon;
              const active = value.dress_code_items.includes(o.value);
              return (
                <button type="button" key={o.value}
                  onClick={() => set({ dress_code_items: toggle(value.dress_code_items, o.value) })}
                  className={`flex flex-col items-center text-center gap-1.5 rounded-xl border p-2.5 transition ${active ? "bg-primary/10 border-primary/50 ring-1 ring-primary/30" : "bg-card hover:bg-accent"}`}>
                  <div className={`h-9 w-9 rounded-full flex items-center justify-center ${active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="text-[11px] leading-tight">{o.label}</span>
                </button>
              );
            })}
          </div>
          <div>
            <Label>Note aggiuntive sul dress code</Label>
            <Textarea rows={3} value={value.dress_code_notes}
              onChange={e => set({ dress_code_notes: e.target.value })}
              placeholder="Es. Dress code come da descrizione, portare camicia bianca e pantalone nero." />
          </div>
        </div>
      </div>
    </div>
  );
}

export function RestaurantRequirementsView({ value }: { value: RestaurantRequirements }) {
  const langs = labelsOf(value.language_requirements, LANGUAGE_OPTIONS);
  const skills = labelsOf(value.required_skills, SKILL_OPTIONS);
  const dress = value.dress_code_items;
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="space-y-2">
        <h4 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground mb-2">Requisiti e Competenze</h4>
        <ViewRow label="Tipo di patente" value={labelOf(value.license_requirement, LICENSE_OPTIONS)} />
        <ViewRow label="Lingue" value={langs.length ? langs.join(", ") : "—"} bold={langs.length > 0} />
        <ViewRow label="Tatuaggi ammessi" value={labelOf(value.tattoos_allowed, TATTOO_OPTIONS)} bold />
        <ViewRow label="Piercing ammessi" value={labelOf(value.piercings_allowed, PIERCING_OPTIONS)} bold />
        <ViewRow label="Barba ammessa" value={labelOf(value.beard_allowed, BEARD_OPTIONS)} bold />
        <div>
          <div className="text-sm text-muted-foreground py-2">Competenze richieste</div>
          {skills.length === 0 ? (
            <p className="text-sm text-muted-foreground">—</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {skills.map(s => <span key={s} className="text-xs rounded-full border bg-card px-2 py-1">{s}</span>)}
            </div>
          )}
        </div>
      </div>
      <div className="space-y-3">
        <h4 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground mb-2">Disposizioni in merito al dress code</h4>
        {dress.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nessuna disposizione impostata.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {dress.map(v => {
              const opt = DRESS_CODE_OPTIONS.find(o => o.value === v);
              if (!opt) return null;
              const Icon = opt.icon;
              return (
                <div key={v} className="flex items-center gap-2 rounded-lg border bg-card p-2">
                  <div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-xs leading-tight">{opt.label}</span>
                </div>
              );
            })}
          </div>
        )}
        {value.dress_code_notes && (
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-1">Note dress code</div>
            <p className="text-sm">{value.dress_code_notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ViewRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between gap-4 py-2 border-b last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`text-sm text-right ${bold ? "font-semibold" : ""}`}>{value}</span>
    </div>
  );
}