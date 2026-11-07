import { Star } from 'lucide-react';

export function CurriculumStars({ stars }: { stars: number }) {
  return <span className="inline-flex shrink-0 items-center gap-1 text-primary" role="img" aria-label={`${stars} stelle su 5`}>
    {Array.from({ length: 5 }, (_, i) => <Star key={i} aria-hidden="true" className={`h-5 w-5 ${i < stars ? 'fill-current' : 'text-muted-foreground'}`} />)}
  </span>;
}