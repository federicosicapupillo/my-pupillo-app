import { useState } from "react";
import { HelpCircle } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { AssistantPanel } from "@/components/assistant/AssistantPanel";
import { useLocation } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function AssistantFab() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const aboveSaveBar = pathname === "/availability";
  const [open, setOpen] = useState(false);
  if (!user) return null;
  return (
    <>
      <Button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Apri assistenza"
        className={cn("fixed right-4 z-40 h-11 rounded-full px-4 text-sm font-medium shadow-lg sm:bottom-6 sm:right-6", aboveSaveBar ? "bottom-32" : "bottom-4")}
      >
        <HelpCircle className="h-4 w-4" />
        <span className="hidden sm:inline">Serve aiuto?</span>
      </Button>
      <AssistantPanel open={open} onOpenChange={setOpen} />
    </>
  );
}