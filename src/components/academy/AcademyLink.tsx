import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { ACADEMY_ENTRY_URL, ACADEMY_EXTERNAL_URL, ACADEMY_INFO_PATH } from "@/lib/academy";

export function AcademyLink({ className, children, onClick }: { className?: string; children: ReactNode; onClick?: () => void }) {
  if (ACADEMY_EXTERNAL_URL) {
    return (
      <a href={ACADEMY_ENTRY_URL} target="_blank" rel="noopener noreferrer" className={className} onClick={onClick}>
        {children}
        <span className="sr-only"> (si apre in una nuova scheda)</span>
      </a>
    );
  }
  return <Link to={ACADEMY_INFO_PATH} className={className} onClick={onClick}>{children}</Link>;
}

export const academyButtonClass =
  "inline-flex items-center justify-center rounded-xl bg-accent px-5 py-2.5 text-sm font-bold text-accent-foreground hover:bg-accent/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

export const academyCardStyle = { borderColor: "color-mix(in oklab, var(--neon-violet) 35%, transparent)" };

export function AcademyLabel() {
  return <span className="self-start rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-accent">Pupillo Academy · Gratuita e facoltativa</span>;
}
