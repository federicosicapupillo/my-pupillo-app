import { useState } from "react";
import { HelpCircle } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { AssistantPanel } from "@/components/assistant/AssistantPanel";

export function AssistantFab() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  if (!user) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Apri assistenza"
        className="fixed bottom-4 right-4 z-40 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-medium text-primary-foreground shadow-lg hover:bg-primary/90 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:bottom-6 sm:right-6"
      >
        <HelpCircle className="h-4 w-4" />
        <span className="hidden sm:inline">Serve aiuto?</span>
      </button>
      <AssistantPanel open={open} onOpenChange={setOpen} />
    </>
  );
}