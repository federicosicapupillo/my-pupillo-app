import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAvatarUrl } from "@/hooks/use-avatar-urls";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function initials(name?: string | null) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

interface Props {
  userId: string | null | undefined;
  name?: string | null;
  className?: string;
}

export function UserAvatar({ userId, name, className }: Props) {
  const url = useAvatarUrl(userId);
  const isLoading = userId ? url === undefined : false;
  if (isLoading) {
    return <Skeleton className={cn("h-10 w-10 rounded-full", className)} />;
  }
  return (
    <Avatar className={cn("h-10 w-10", className)}>
      {url ? <AvatarImage src={url} alt={name ?? "Avatar"} /> : null}
      <AvatarFallback className="bg-primary/10 text-primary font-semibold">
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}