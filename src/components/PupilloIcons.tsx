import { SVGProps } from "react";

/**
 * Pupillo brand icons — hand-crafted SVGs with a soft, illustrated feel.
 * Use currentColor so they inherit from text-primary / text-foreground tokens.
 */

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

/** Menu: three offset, hand-drawn strokes with a small dot accent — friendlier than a flat hamburger. */
export function PupilloMenu({ size = 22, className, ...rest }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...rest}
    >
      <path d="M5 7c4-1 9-1 14 0" />
      <path d="M4 12.2c4-1 10-1 15 0" />
      <path d="M6 17.4c3-.7 8-.7 12 0" />
      <circle cx="20" cy="17.4" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Close: soft asymmetric X used when the menu is open. */
export function PupilloClose({ size = 22, className, ...rest }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...rest}
    >
      <path d="M6.5 6.5c4 4 7 7 11 11" />
      <path d="M17.5 6.5c-4 4-7 7-11 11" />
    </svg>
  );
}

/** Bell: bulb-shaped, illustrated bell with a clapper dot — distinctive but instantly readable. */
export function PupilloBell({ size = 22, className, ringing, ...rest }: IconProps & { ringing?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...rest}
    >
      {/* dome */}
      <path d="M6 16c-.4-3.2.2-6 2-7.8A5.7 5.7 0 0 1 12 6.3a5.7 5.7 0 0 1 4 1.9c1.8 1.8 2.4 4.6 2 7.8" />
      {/* base lip */}
      <path d="M5 16.2c4.6-.9 9.4-.9 14 0" />
      {/* clapper */}
      <circle cx="12" cy="19.4" r="1.4" fill="currentColor" stroke="none" />
      {/* top knot */}
      <path d="M12 6.3V4.6" />
      <circle cx="12" cy="3.7" r="0.9" fill="currentColor" stroke="none" />
      {ringing && (
        <>
          <path d="M3.5 9c.6-.9 1.4-1.6 2.4-2.1" />
          <path d="M20.5 9c-.6-.9-1.4-1.6-2.4-2.1" />
        </>
      )}
    </svg>
  );
}

function initialsFrom(name?: string | null, email?: string | null) {
  const src = (name && name.trim()) || (email && email.split("@")[0]) || "";
  if (!src) return "·";
  const parts = src.replace(/[._-]+/g, " ").split(/\s+/).filter(Boolean);
  const letters = (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
  return (letters || src.slice(0, 2)).toUpperCase();
}

/** Avatar chip: gradient ring + soft inner disc, brand-coherent and premium feeling. */
export function PupilloAvatar({
  name,
  email,
  size = 36,
  className = "",
}: {
  name?: string | null;
  email?: string | null;
  size?: number;
  className?: string;
}) {
  const initials = initialsFrom(name, email);
  return (
    <span
      className={
        "relative inline-flex items-center justify-center rounded-full p-[2px] " +
        "bg-[conic-gradient(from_140deg,hsl(var(--primary)),hsl(var(--accent)),hsl(var(--primary-glow,var(--primary))),hsl(var(--primary)))] " +
        "shadow-sm transition-transform duration-200 hover:scale-[1.04] focus-visible:scale-[1.04] " +
        className
      }
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <span className="flex h-full w-full items-center justify-center rounded-full bg-card text-[0.72rem] font-semibold tracking-wide text-foreground">
        {initials}
      </span>
    </span>
  );
}