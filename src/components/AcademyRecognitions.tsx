import { useEffect, useState } from "react";
import { getAcademyRecognitions } from "@/lib/academy-recognitions.functions";
import type { AcademyRecognition } from "@/lib/academy-recognitions";
import { earnedBadges, PATH_BADGE_COUNT } from "@/lib/academy-badges";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const cache = new Map<string, Promise<AcademyRecognition[]>>();
function useRecognitions(workerId?: string | null) {
  const [items, setItems] = useState<AcademyRecognition[]>([]);
  useEffect(() => {
    if (!workerId) return;
    let alive = true;
    let p = cache.get(workerId);
    if (!p) { p = getAcademyRecognitions({ data: { workerId } }).catch(() => [] as AcademyRecognition[]); cache.set(workerId, p); }
    p.then((r) => { if (alive) setItems(r); });
    return () => { alive = false; };
  }, [workerId]);
  return earnedBadges(items);
}
const fmt = (d: string) => new Date(d).toLocaleDateString("it-IT");

function Details({ earned }: { earned: ReturnType<typeof earnedBadges> }) {
  const top = earned[0]!;
  const pathDone = Math.min(PATH_BADGE_COUNT, earned.filter((e) => e.badge.rank <= PATH_BADGE_COUNT).length);
  return (
    <div className="space-y-2 text-left">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-primary">Pupillo Academy · {pathDone} di {PATH_BADGE_COUNT} traguardi</div>
      <div className="flex gap-1" aria-hidden>{Array.from({ length: PATH_BADGE_COUNT }, (_, i) => <span key={i} className={cn("h-1.5 flex-1 rounded-full", i < pathDone ? "bg-primary" : "bg-muted")} />)}</div>
      <ul className="space-y-1.5">
        {earned.map((e) => (
          <li key={e.badge.key} className={cn("flex items-center gap-2 text-sm", e === top && "font-semibold")}>
            <img src={e.badge.image} alt="" className="h-7 w-7 object-contain" />
            <span className="leading-tight">{e.badge.name}<span className="block text-xs font-normal text-muted-foreground">{e.badge.course} · {fmt(e.passed_at)}</span></span>
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-muted-foreground">Conoscenze teoriche verificate, mostrate per scelta del lavoratore. Non è una qualifica ufficiale.</p>
    </div>
  );
}

function BadgePopover({ earned, children, label }: { earned: ReturnType<typeof earnedBadges>; children: React.ReactNode; label: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" aria-label={label} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)} onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }} className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {children}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72" side="top" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}><Details earned={earned} /></PopoverContent>
    </Popover>
  );
}

/** Foto del lavoratore con lo stendardo Academy più alto in basso a destra. */
export function AcademyAvatarBadge({ workerId, children, size = "md" }: { workerId?: string | null; children: React.ReactNode; size?: "sm" | "md" | "lg" }) {
  const earned = useRecognitions(workerId);
  const top = earned[0];
  const px = size === "lg" ? "h-10 w-10" : size === "sm" ? "h-6 w-6" : "h-8 w-8";
  return (
    <div className="relative inline-block shrink-0">
      {children}
      {top ? (
        <span className="absolute -bottom-1 -right-1">
          <BadgePopover earned={earned} label={`Pupillo Academy: ${top.badge.name}`}>
            <img src={top.badge.image} alt="" className={cn(px, "object-contain drop-shadow-md transition-transform hover:scale-110")} />
          </BadgePopover>
        </span>
      ) : null}
    </div>
  );
}

/** Riga sobria con gli stendardi ottenuti; nulla se il lavoratore non ne mostra. */
export function AcademyRecognitions({ workerId, compact = false }: { workerId: string; compact?: boolean }) {
  const earned = useRecognitions(workerId);
  if (earned.length === 0) return null;
  return (
    <section className={compact ? "text-sm" : "rounded-xl border bg-card p-3"}>
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pupillo Academy</span>
        <BadgePopover earned={earned} label="Dettagli Pupillo Academy">
          <span className="flex -space-x-1.5">
            {earned.slice().reverse().map((e) => <img key={e.badge.key} src={e.badge.image} alt={e.badge.name} title={e.badge.name} className="h-8 w-8 object-contain drop-shadow" />)}
          </span>
        </BadgePopover>
        <span className="text-xs text-muted-foreground truncate">{earned[0]!.badge.name}</span>
      </div>
    </section>
  );
}
