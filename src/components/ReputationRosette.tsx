import logo from "@/assets/pupillo-logo-completo.png.asset.json";

/** Decorative Pupillo rosette, not a claim of an earned reputation level. */
export function ReputationRosette() {
  return (
    <span className="relative block h-20 w-18 shrink-0" aria-hidden="true">
      <svg viewBox="0 0 72 80" className="absolute inset-0 h-full w-full" fill="none">
        <path d="M19 48 10 77 24 71 31 79 38 50" className="fill-accent" />
        <path d="m34 50 8 29 8-8 13 6-10-29" className="fill-accent" />
        <path d="m36 2 7 4 8-1 5 7 8 3 1 9 5 7-4 8 1 9-8 5-4 8-9-1-10 5-8-5-9 1-4-8-8-5 1-9-4-8 5-7 1-9 8-3 5-7 8 1Z" className="fill-primary" />
        <circle cx="36" cy="33" r="23" className="fill-card stroke-accent" strokeWidth="2" />
      </svg>
      <img src={logo.url} alt="" className="absolute left-3 top-4 h-9 w-12 object-contain" />
    </span>
  );
}