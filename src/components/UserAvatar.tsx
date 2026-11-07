import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAvatarUrl, useUserName } from "@/hooks/use-avatar-urls";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

function initials(name?: string | null) {
  if (!name) return "";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("");
}

interface Props {
  userId: string | null | undefined;
  name?: string | null;
  className?: string;
  zoomable?: boolean;
}

export function UserAvatar({ userId, name, className, zoomable = false }: Props) {
  const url = useAvatarUrl(userId);
  const fallbackName = useUserName(userId);
  const displayName = name ?? fallbackName ?? null;
  const isLoading = userId ? url === undefined : false;
  if (isLoading) {
    return <Skeleton className={cn("h-10 w-10 rounded-full", className)} />;
  }
  const init = initials(displayName);
  const avatar = (
    <Avatar className={cn("h-10 w-10", className)}>
      {url ? <AvatarImage src={url} alt={displayName ?? "Avatar"} /> : null}
      <AvatarFallback
        aria-label={displayName ?? "Avatar"}
        className="bg-primary/10 text-primary font-semibold uppercase tracking-wide"
      >
        {init || (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-1/2 w-1/2 opacity-70">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21c0-4 4-7 8-7s8 3 8 7" />
          </svg>
        )}
      </AvatarFallback>
    </Avatar>
  );
  if (!zoomable || !url) return avatar;
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" className="h-auto shrink-0 rounded-full p-0 cursor-zoom-in" aria-label={`Ingrandisci foto di ${displayName ?? 'lavoratore'}`} title="Ingrandisci foto">
          {avatar}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader className="pr-8">
          <DialogTitle>Foto di {displayName ?? 'lavoratore'}</DialogTitle>
        </DialogHeader>
        <img src={url} alt={displayName ?? 'Foto del lavoratore'} className="block w-full max-h-[65vh] object-contain" />
      </DialogContent>
    </Dialog>
  );
}